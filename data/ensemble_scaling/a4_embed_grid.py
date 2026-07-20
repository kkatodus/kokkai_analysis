#!/usr/bin/env python
# coding: utf-8
"""A4 — Multi-model embedding grid for the Ensemble Scaling paper.

Spec: specs/ensemble-scaling-reliability/ (work item A4; model grid rows 1-5).
Wordfish (row 6) is the separate classical baseline, work item A5.

What this does
--------------
Reads the scope-keyed stance summaries from A3
(data/data/idea_summaries_ensemble/{scope}/{person_id}/{topic}/summary.json) and
embeds each politician with every model in the grid. Per (scope, topic, model) it
caches one matrix so the ensemble estimators (A4-ensemble) and metrics (A6) can be
recomputed cheaply without ever re-embedding:

  artifacts/embeddings/{scope}/{topic}/{model_slug}.npz
      person_ids : (n,)   str   politician person_id, row-aligned to embeddings
      parties    : (n,)   str
      embeddings : (n, d) float32   mean-pooled over the person's summary runs

Each politician's SUMMARY_RUNS summaries are embedded and mean-pooled into a single
vector (matching the production pipeline's per-repr aggregation). Embeddings are the
raw model outputs — normalisation/axis-projection is A6's job so the same cache
serves every downstream estimator.

Model grid (spec §Model grid)
  1 sarashina-v2-1b   sbintuitions/sarashina-embedding-v2-1b   pipeline default
  2 ruri-v3           cl-nagoya/ruri-v3-310m                   JP retriever family
  3 me5-large         intfloat/multilingual-e5-large           multilingual reference
  4 openai-3-large    text-embedding-3-large (API)             different training regime
  5 bert-ja-v3        cl-tohoku/bert-base-japanese-v3          legacy row (CLS pooling)

Usage
-----
  python data/ensemble_scaling/a4_embed_grid.py --scope term --models bert-ja-v3   # dev
  python data/ensemble_scaling/a4_embed_grid.py --scope term                       # rows 1-5 (needs OPENAI key for row 4)
  python data/ensemble_scaling/a4_embed_grid.py --scope allhistory --skip-api
"""

import argparse
import json
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
DATA_PKG_DIR = os.path.abspath(os.path.join(HERE, ".."))
REPO_ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, DATA_PKG_DIR)

from dotenv import load_dotenv  # noqa: E402

load_dotenv(os.path.join(DATA_PKG_DIR, ".env"))

DATA_DATA = os.path.join(REPO_ROOT, "data", "data")
SUMMARIES_ROOT = os.path.join(DATA_DATA, "idea_summaries_ensemble")
ARTIFACTS_DIR = os.path.join(
    REPO_ROOT, "specs", "ensemble-scaling-reliability", "artifacts"
)
EMB_ROOT = os.path.join(ARTIFACTS_DIR, "embeddings")

TOPICS = ["Defence", "NuclearPower"]

# Grid rows 1-5. `pooling`: "native" = use SentenceTransformer(id) as-is;
# "cls" = build Transformer+CLS pooling (legacy bert row, matches the KOKKAI DOC
# monolith). `doc_prefix` is prepended to each summary before encoding (e5/ruri
# are trained with instruction prefixes; omitting them degrades retrieval models).
MODELS: dict[str, dict] = {
    "sarashina-v2-1b": {"hf": "sbintuitions/sarashina-embedding-v2-1b", "kind": "st", "pooling": "native", "doc_prefix": ""},
    "ruri-v3": {"hf": "cl-nagoya/ruri-v3-310m", "kind": "st", "pooling": "native", "doc_prefix": "検索文書: "},
    "me5-large": {"hf": "intfloat/multilingual-e5-large", "kind": "st", "pooling": "native", "doc_prefix": "passage: "},
    "openai-3-large": {"hf": "text-embedding-3-large", "kind": "api_openai", "pooling": None, "doc_prefix": ""},
    "bert-ja-v3": {"hf": "cl-tohoku/bert-base-japanese-v3", "kind": "st", "pooling": "cls", "doc_prefix": ""},
}


def fix_seed(seed: int = 42) -> None:
    import torch

    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)
    torch.backends.cudnn.deterministic = True


def load_summaries(scope: str, topic: str) -> list[dict]:
    """Every politician with a summary.json for this scope/topic, sorted by
    numeric person_id for a stable row order across models."""
    topic_root = os.path.join(SUMMARIES_ROOT, scope)
    rows = []
    if not os.path.isdir(topic_root):
        return rows
    for pid in os.listdir(topic_root):
        path = os.path.join(topic_root, pid, topic, "summary.json")
        if not os.path.exists(path):
            continue
        with open(path, encoding="utf-8") as f:
            d = json.load(f)
        summaries = [s for s in d.get("summaries", []) if s and s.strip()]
        if not summaries:
            continue
        rows.append({"person_id": pid, "party": d.get("party", ""), "summaries": summaries})
    rows.sort(key=lambda r: int(r["person_id"]) if r["person_id"].isdigit() else r["person_id"])
    return rows


def build_st_encoder(spec: dict):
    """Return a callable texts->np.ndarray for a SentenceTransformer model."""
    import torch
    from sentence_transformers import SentenceTransformer, models

    device = "cuda" if torch.cuda.is_available() else "cpu"
    if spec["pooling"] == "cls":
        # Legacy KOKKAI DOC construction: raw transformer + CLS-token pooling.
        transformer = models.Transformer(spec["hf"])
        pooling = models.Pooling(
            transformer.get_word_embedding_dimension(),
            pooling_mode_mean_tokens=False,
            pooling_mode_cls_token=True,
            pooling_mode_max_tokens=False,
        )
        st = SentenceTransformer(modules=[transformer, pooling], device=device)
    else:
        st = SentenceTransformer(spec["hf"], device=device, trust_remote_code=True)

    def encode(texts: list[str]) -> np.ndarray:
        return st.encode(texts, convert_to_numpy=True, show_progress_bar=False, normalize_embeddings=False)

    return encode


def build_openai_encoder(spec: dict):
    from openai import OpenAI

    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    model = spec["hf"]

    def encode(texts: list[str]) -> np.ndarray:
        resp = client.embeddings.create(model=model, input=texts)
        return np.array([d.embedding for d in resp.data], dtype=np.float32)

    return encode


def embed_people(rows: list[dict], encoder, doc_prefix: str) -> np.ndarray:
    """One mean-pooled vector per politician over their summary runs."""
    vecs = []
    for r in rows:
        texts = [doc_prefix + s for s in r["summaries"]]
        emb = encoder(texts)  # (runs, d)
        vecs.append(np.asarray(emb, dtype=np.float32).mean(axis=0))
    return np.vstack(vecs).astype(np.float32)


def run_model(slug: str, scope: str, topics: list[str], force: bool) -> None:
    spec = MODELS[slug]
    if spec["kind"] == "st":
        fix_seed()
        encoder = build_st_encoder(spec)
    elif spec["kind"] == "api_openai":
        encoder = build_openai_encoder(spec)
    else:
        raise ValueError(f"unknown kind {spec['kind']}")

    for topic in topics:
        rows = load_summaries(scope, topic)
        if not rows:
            print(f"[A4] {slug} {scope}/{topic}: no summaries yet, skip")
            continue
        out_dir = os.path.join(EMB_ROOT, scope, topic)
        os.makedirs(out_dir, exist_ok=True)
        out_path = os.path.join(out_dir, f"{slug}.npz")
        if os.path.exists(out_path) and not force:
            print(f"[A4] {slug} {scope}/{topic}: cached ({out_path}), skip")
            continue
        emb = embed_people(rows, encoder, spec["doc_prefix"])
        np.savez(
            out_path,
            person_ids=np.array([r["person_id"] for r in rows]),
            parties=np.array([r["party"] for r in rows]),
            embeddings=emb,
        )
        with open(os.path.join(out_dir, f"{slug}.meta.json"), "w", encoding="utf-8") as f:
            json.dump({"model": slug, "hf": spec["hf"], "scope": scope, "topic": topic,
                       "n": len(rows), "dim": int(emb.shape[1])}, f, ensure_ascii=False, indent=2)
        print(f"[A4] {slug} {scope}/{topic}: wrote {emb.shape} → {out_path}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--scope", choices=["term", "allhistory"], required=True)
    ap.add_argument("--models", nargs="+", default=list(MODELS.keys()),
                    help=f"subset of {list(MODELS.keys())}")
    ap.add_argument("--topics", nargs="+", default=TOPICS)
    ap.add_argument("--skip-api", action="store_true", help="skip the OpenAI row")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    for slug in args.models:
        if slug not in MODELS:
            raise SystemExit(f"unknown model {slug}; choose from {list(MODELS)}")
        if args.skip_api and MODELS[slug]["kind"].startswith("api"):
            print(f"[A4] skipping API model {slug}")
            continue
        print(f"[A4] === {slug} ({MODELS[slug]['hf']}) ===")
        run_model(slug, args.scope, args.topics, args.force)


if __name__ == "__main__":
    main()
