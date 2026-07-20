#!/usr/bin/env python
# coding: utf-8
"""A5 — Wordfish baseline for the Ensemble Scaling paper (model grid row 6).

Spec: specs/ensemble-scaling-reliability/ (work item A5; "Wordfish on the
summarized texts" — the classical text-scaling baseline the embedding grid is
measured against).

What this does
--------------
Reads the same scope-keyed A3 stance summaries the embedding grid uses
(data/data/idea_summaries_ensemble/{scope}/{person_id}/{topic}/summary.json),
builds a politician × content-word count matrix, and fits the Wordfish model
(Slapin & Proksch 2008) to place each politician on a single latent dimension.

Wordfish is a Poisson item-response / scaling model:

    y_ij ~ Poisson(mu_ij),   log mu_ij = alpha_i + psi_j + beta_j * omega_i

  alpha_i  document (politician) fixed effect — loquacity
  psi_j    word fixed effect — overall frequency
  beta_j   word discrimination — how strongly word j separates the dimension
  omega_i  document position — the scaled ideal point we want

Estimation is conditional MLE by alternating Newton sweeps: with omega fixed
every word's (psi_j, beta_j) is an independent 2-parameter Poisson GLM (offset
alpha_i, covariate omega_i); with the word parameters fixed every document's
(alpha_i, omega_i) is an independent 2-parameter Poisson GLM (offset psi_j,
covariate beta_j). Both sweeps are vectorised across all words / all documents.
omega is standardised (mean 0, sd 1) after each sweep for identification, with
psi/beta rescaled so the fit is preserved.

Wordfish's sign is not identified by the model. We fix it deterministically
(positive correlation with the SVD initialiser) for reproducibility; **A6
orients every method — embeddings and Wordfish alike — against UTAS**, so the
raw sign here is immaterial to validity.

Output
------
  artifacts/embeddings/{scope}/{topic}/wordfish.npz     (mirrors the A4 cache)
      person_ids : (n,)   str   row-aligned to the A4 embedding grid
      parties    : (n,)   str
      embeddings : (n, 1) float32   omega, as a 1-D "embedding" so A6 ingests
                                    Wordfish exactly like the embedding rows
  artifacts/embeddings/{scope}/{topic}/wordfish.meta.json
  artifacts/a5_wordfish_{scope}.json / .md   diagnostics: vocab size, iterations,
      convergence, most discriminating words per pole, per-party mean position.

Usage
-----
  python3 data/ensemble_scaling/a5_wordfish.py --scope term
  python3 data/ensemble_scaling/a5_wordfish.py --scope term --topics Defence --min-df 5
  python3 data/ensemble_scaling/a5_wordfish.py --scope allhistory --force

Requires python3 (deps live in the py3.10 dist), same as A3/A4.
"""

import argparse
import json
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, HERE)

# Reuse A4's summary loader so Wordfish rows are aligned to the embedding cache
# (same person_id order per scope/topic → A6 can stack methods without a join).
from a4_embed_grid import ARTIFACTS_DIR, EMB_ROOT, TOPICS, load_summaries  # noqa: E402

# Content parts-of-speech (unidic pos1) kept as scaling tokens. 形状詞 is
# unidic's adjectival-noun tag (e.g. 明確), 形容詞 the true adjective.
CONTENT_POS = {"名詞", "動詞", "形容詞", "形状詞"}
# Semantically empty high-frequency lemmas (generic verbs / formal nouns) that
# would otherwise dominate the vocabulary without carrying a position.
STOP_LEMMAS = {
    "為る", "有る", "無い", "成る", "居る", "出来る", "思う", "言う", "行く",
    "事", "物", "為", "所", "方", "様", "того", "これ", "それ", "の", "ん",
    "此れ", "其れ", "何", "者", "点", "中", "上", "下", "際",
}


def build_tagger():
    import fugashi
    import unidic_lite

    dic = unidic_lite.DICDIR
    rc = os.path.join(dic, "mecabrc")
    return fugashi.Tagger(f'-r "{rc}" -d "{dic}"')


def tokenize(tagger, text: str) -> list[str]:
    """Content-word lemmas from one text. Drops function words, punctuation,
    numbers, single-character kana, and generic stop-lemmas."""
    toks = []
    for w in tagger(text):
        f = w.feature
        pos1 = getattr(f, "pos1", None)
        if pos1 not in CONTENT_POS:
            continue
        lemma = getattr(f, "lemma", None) or w.surface
        # unidic lemmas can carry a "-reading"/"-gloss" suffix (e.g. 主体-body);
        # keep the head before the first hyphen.
        lemma = lemma.split("-", 1)[0]
        if not lemma or lemma in STOP_LEMMAS:
            continue
        if pos1 == "名詞" and lemma.isascii() and lemma.isdigit():
            continue
        if len(lemma) == 1 and pos1 == "名詞":
            # single-char nouns are mostly counters/formal nouns; keep verbs/adj
            continue
        toks.append(lemma)
    return toks


def build_dtm(rows: list[dict], tagger, min_df: int):
    """politician × word count matrix. One document per politician: counts are
    summed over that politician's summary runs (the count-space analogue of the
    A4 mean-pool-over-runs)."""
    from collections import Counter

    per_doc = []
    doc_freq: Counter = Counter()
    for r in rows:
        c: Counter = Counter()
        for s in r["summaries"]:
            c.update(tokenize(tagger, s))
        per_doc.append(c)
        doc_freq.update(c.keys())

    vocab = sorted(w for w, df in doc_freq.items() if df >= min_df)
    vindex = {w: j for j, w in enumerate(vocab)}
    Y = np.zeros((len(rows), len(vocab)), dtype=np.float64)
    for i, c in enumerate(per_doc):
        for w, n in c.items():
            j = vindex.get(w)
            if j is not None:
                Y[i, j] = n
    # Drop documents that end up empty after trimming (they carry no position).
    keep = Y.sum(1) > 0
    return Y[keep], vocab, keep


def fit_wordfish(Y: np.ndarray, maxiter: int = 200, tol: float = 1e-5, seed: int = 42):
    """Conditional-MLE Wordfish via alternating vectorised Newton sweeps.

    Returns (omega, alpha, psi, beta, info)."""
    rng = np.random.default_rng(seed)
    N, V = Y.shape

    row = Y.sum(1)
    col = Y.sum(0)
    alpha = np.log(row) - np.log(row).mean()
    psi = np.log(col) - np.log(col.sum() / N)
    beta = np.zeros(V)

    # Initialise omega from the leading PC of the double-centred log matrix.
    L = np.log(Y + 0.5)
    L = L - L.mean(1, keepdims=True) - L.mean(0, keepdims=True) + L.mean()
    _, _, Vt = np.linalg.svd(L, full_matrices=False)
    omega = Vt[0]
    omega = (omega - omega.mean()) / (omega.std() + 1e-12)
    omega_init = omega.copy()
    beta = rng.normal(0, 0.01, V)

    def clip_eta(e):
        return np.clip(e, -30, 30)

    prev = omega.copy()
    info = {"converged": False, "iters": maxiter}
    for it in range(1, maxiter + 1):
        # --- word sweep: (psi_j, beta_j) | alpha, omega ---
        mu = np.exp(clip_eta(alpha[:, None] + psi[None, :] + omega[:, None] * beta[None, :]))
        S0 = mu.sum(0)
        S1 = (omega[:, None] * mu).sum(0)
        S2 = (omega[:, None] ** 2 * mu).sum(0)
        gpsi = (Y - mu).sum(0)
        gbeta = (omega[:, None] * (Y - mu)).sum(0)
        det = S0 * S2 - S1 * S1
        det = np.where(np.abs(det) < 1e-12, 1e-12, det)
        psi += (S2 * gpsi - S1 * gbeta) / det
        beta += (-S1 * gpsi + S0 * gbeta) / det

        # --- document sweep: (alpha_i, omega_i) | psi, beta ---
        mu = np.exp(clip_eta(alpha[:, None] + psi[None, :] + omega[:, None] * beta[None, :]))
        T0 = mu.sum(1)
        T1 = (beta[None, :] * mu).sum(1)
        T2 = (beta[None, :] ** 2 * mu).sum(1)
        galpha = (Y - mu).sum(1)
        gomega = (beta[None, :] * (Y - mu)).sum(1)
        det = T0 * T2 - T1 * T1
        det = np.where(np.abs(det) < 1e-12, 1e-12, det)
        alpha += (T2 * galpha - T1 * gomega) / det
        omega += (-T1 * galpha + T0 * gomega) / det

        # --- identify: standardise omega, absorb the transform into psi/beta ---
        m, s = omega.mean(), omega.std() + 1e-12
        psi = psi + beta * m
        beta = beta * s
        omega = (omega - m) / s

        shift = np.max(np.abs(omega - prev))
        prev = omega.copy()
        if shift < tol:
            info = {"converged": True, "iters": it}
            break

    # Deterministic sign: align with the SVD initialiser.
    if np.corrcoef(omega, omega_init)[0, 1] < 0:
        omega = -omega
        beta = -beta

    mu = np.exp(clip_eta(alpha[:, None] + psi[None, :] + omega[:, None] * beta[None, :]))
    ll = float((Y * np.log(mu + 1e-12) - mu).sum())
    info["loglik"] = ll
    return omega, alpha, psi, beta, info


def run_topic(scope: str, topic: str, min_df: int, force: bool) -> dict | None:
    rows = load_summaries(scope, topic)
    if not rows:
        print(f"[A5] {scope}/{topic}: no summaries yet, skip")
        return None

    out_dir = os.path.join(EMB_ROOT, scope, topic)
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "wordfish.npz")
    if os.path.exists(out_path) and not force:
        print(f"[A5] {scope}/{topic}: cached ({out_path}), skip")
        with open(os.path.join(out_dir, "wordfish.meta.json"), encoding="utf-8") as f:
            return json.load(f)

    tagger = build_tagger()
    Y, vocab, keep = build_dtm(rows, tagger, min_df)
    kept_rows = [r for r, k in zip(rows, keep) if k]
    if Y.shape[0] < 3 or Y.shape[1] < 3:
        print(f"[A5] {scope}/{topic}: too small after trim (Y={Y.shape}), skip")
        return None

    omega, alpha, psi, beta, info = fit_wordfish(Y)

    person_ids = np.array([r["person_id"] for r in kept_rows])
    parties = np.array([r["party"] for r in kept_rows])
    np.savez(
        out_path,
        person_ids=person_ids,
        parties=parties,
        embeddings=omega.astype(np.float32)[:, None],
    )

    # Most discriminating words per pole (by beta).
    order = np.argsort(beta)
    neg_words = [vocab[j] for j in order[:15]]
    pos_words = [vocab[j] for j in order[::-1][:15]]

    # Per-party mean position (sign is arbitrary; for a human eyeball only).
    party_means = {}
    for p in sorted(set(parties.tolist())):
        party_means[p] = float(omega[parties == p].mean())

    meta = {
        "model": "wordfish",
        "scope": scope,
        "topic": topic,
        "n": int(Y.shape[0]),
        "n_dropped_empty": int((~keep).sum()),
        "vocab_size": int(Y.shape[1]),
        "min_df": min_df,
        "converged": info["converged"],
        "iters": info["iters"],
        "loglik": info["loglik"],
        "pos_pole_words": pos_words,
        "neg_pole_words": neg_words,
        "party_means": party_means,
    }
    with open(os.path.join(out_dir, "wordfish.meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    print(
        f"[A5] {scope}/{topic}: n={meta['n']} vocab={meta['vocab_size']} "
        f"iters={meta['iters']} converged={meta['converged']} ll={meta['loglik']:.0f} "
        f"→ {out_path}"
    )
    return meta


def write_summary(scope: str, metas: list[dict]) -> None:
    if not metas:
        return
    js = os.path.join(ARTIFACTS_DIR, f"a5_wordfish_{scope}.json")
    with open(js, "w", encoding="utf-8") as f:
        json.dump({"scope": scope, "topics": metas}, f, ensure_ascii=False, indent=2)

    lines = [f"# A5 Wordfish baseline — scope: {scope}", ""]
    for m in metas:
        lines += [
            f"## {m['topic']}",
            "",
            f"- n politicians: **{m['n']}** ({m['n_dropped_empty']} dropped empty), "
            f"vocab: **{m['vocab_size']}** (min_df={m['min_df']})",
            f"- estimation: {m['iters']} iters, converged={m['converged']}, "
            f"loglik={m['loglik']:.0f}",
            f"- (+) pole words: {'、'.join(m['pos_pole_words'])}",
            f"- (−) pole words: {'、'.join(m['neg_pole_words'])}",
            "- party means (sign arbitrary; A6 orients vs UTAS):",
        ]
        for p, v in sorted(m["party_means"].items(), key=lambda kv: kv[1]):
            lines.append(f"    - {p}: {v:+.3f}")
        lines.append("")
    md = os.path.join(ARTIFACTS_DIR, f"a5_wordfish_{scope}.md")
    with open(md, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"[A5] wrote {js} and {md}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--scope", choices=["term", "allhistory"], required=True)
    ap.add_argument("--topics", nargs="+", default=TOPICS)
    ap.add_argument("--min-df", type=int, default=5,
                    help="keep words appearing in >= this many politicians")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    metas = []
    for topic in args.topics:
        m = run_topic(args.scope, topic, args.min_df, args.force)
        if m:
            metas.append(m)
    write_summary(args.scope, metas)


if __name__ == "__main__":
    main()
