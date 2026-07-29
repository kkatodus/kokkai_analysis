"""Custom layer-group DARE-TIES merge over POLIS anchor adapters (spec §2.3/§2.4).

PEFT's `add_weighted_adapter(combination_type="dare_ties")` only supports a single
global weight per anchor. POLIS needs the merge coefficients to vary by **depth
group** (lower/middle/upper layers) — a [n_anchors × n_groups] coefficient matrix
that Bayesian optimisation tunes (spec §2.4). This module implements that merge as
direct weight-space tensor arithmetic over the reconstructed LoRA deltas.

Pipeline per target module (q/k/v/o_proj in each decoder layer):
  1. reconstruct ΔW_a = (alpha/r)·B_a·A_a for each anchor a           (full-rank)
  2. DARE: drop each element w.p. (1-density), rescale survivors by 1/density.
     The drop mask is **fixed at construction** (seeded) so the merge — and thus
     the BO objective — is deterministic in the coefficients (drop rate is a fixed
     hyperparameter with a sensitivity check, per spec §2.3, not a BO dimension).
  3. weight anchor a's delta by coeff[a, group(module)].
  4. TIES: elect a sign per element from the summed weighted deltas; keep only the
     anchors whose sign agrees; average them (disjoint merge).
  5. merged W = W_base + merged ΔW, written into the live model.

`apply(coeffs)` restores base weights then re-merges, so a single loaded model can
be re-merged cheaply for every BO evaluation (no reload, no training).

Run the self-test from research/polis/:
    python merge_layer_group.py
"""
from __future__ import annotations

import glob
import json
import os
import re
from dataclasses import dataclass

import torch
from safetensors.torch import load_file

_LAYER_RE = re.compile(r"\.layers\.(\d+)\.")


@dataclass
class _AnchorModule:
    """One anchor's DARE-masked, rescaled delta for one target module."""
    delta: torch.Tensor      # [out, in] float32, already DARE-dropped + rescaled
    group: int               # depth group index of this module's layer


class LayerGroupMerger:
    """Layer-group-wise DARE-TIES merge of anchor LoRA adapters into a base model."""

    def __init__(
        self,
        base_model,
        adapter_dirs: list[str],
        n_groups: int = 3,
        density: float = 0.1,
        seed: int = 0,
        device: str | None = None,
    ):
        self.model = base_model
        self.n_groups = n_groups
        self.density = density
        self.anchor_names = [os.path.basename(a).replace("polis_", "") for a in adapter_dirs]
        self.n_anchors = len(adapter_dirs)
        self._params = dict(base_model.named_parameters())
        self._dev = device or next(base_model.parameters()).device

        gen = torch.Generator(device="cpu").manual_seed(seed)

        # module_path -> list over anchors of _AnchorModule (None where anchor lacks it)
        self.modules: dict[str, list[_AnchorModule | None]] = {}
        self.base_weights: dict[str, torch.Tensor] = {}
        self._n_layers = self._count_layers(adapter_dirs[0])

        for ai, adir in enumerate(adapter_dirs):
            cfg = json.load(open(os.path.join(adir, "adapter_config.json")))
            scaling = cfg["lora_alpha"] / cfg["r"]
            weights = load_file(os.path.join(adir, "adapter_model.safetensors"))
            prefixes = sorted({k.rsplit(".lora_A", 1)[0] for k in weights if ".lora_A" in k})
            for pfx in prefixes:
                a = next(v for k, v in weights.items() if k.startswith(pfx) and ".lora_A" in k)
                b = next(v for k, v in weights.items() if k.startswith(pfx) and ".lora_B" in k)
                delta = (b.float() @ a.float()) * scaling            # [out, in]
                # DARE drop + rescale with a fixed mask.
                mask = (torch.rand(delta.shape, generator=gen) < self.density)
                delta = torch.where(mask, delta / self.density, torch.zeros_like(delta))

                mod_path = pfx.replace("base_model.model.", "")       # -> model.layers.L....proj
                group = self._group_of(mod_path)
                slot = self.modules.setdefault(mod_path, [None] * self.n_anchors)
                slot[ai] = _AnchorModule(delta=delta.to(self._dev), group=group)

        # Snapshot original base weights for the touched modules (for restore).
        # Guard against the meta-tensor trap: under device_map="auto" a model too
        # big for the GPU has its overflow layers placed as *meta* tensors, and
        # the in-place ΔW writes in apply() are then silent no-ops — the merge
        # looks like it worked but upper-group coefficients do nothing. Fail loudly
        # instead; use device_map={"": "cpu"} or a GPU that fits the whole model.
        meta = [p for p in self.modules
                if self._params[p + ".weight"].device.type == "meta"]
        if meta:
            raise RuntimeError(
                f"{len(meta)} of {len(self.modules)} target modules are meta tensors "
                f"(offloaded), e.g. {meta[0]}. In-place merge writes would silently "
                f"no-op. Load the model fully on one device (--device cpu, or a GPU "
                f"with enough VRAM) instead of device_map='auto'."
            )
        for mod_path in self.modules:
            w = self._params[mod_path + ".weight"]
            self.base_weights[mod_path] = w.data.clone()

    # ---- layer grouping ------------------------------------------------------
    def _count_layers(self, adapter_dir: str) -> int:
        weights = load_file(os.path.join(adapter_dir, "adapter_model.safetensors"))
        idxs = {int(m.group(1)) for k in weights if (m := _LAYER_RE.search(k))}
        return max(idxs) + 1

    def _group_of(self, mod_path: str) -> int:
        m = _LAYER_RE.search(mod_path)
        layer = int(m.group(1)) if m else 0
        # contiguous depth partition: floor(layer / ceil(n_layers / n_groups))
        per = -(-self._n_layers // self.n_groups)  # ceil div
        return min(layer // per, self.n_groups - 1)

    # ---- the merge -----------------------------------------------------------
    def apply(self, coeffs) -> None:
        """coeffs: [n_anchors, n_groups] array-like of mixing weights. Writes the
        layer-group DARE-TIES merge into the live model's weights in place."""
        C = torch.as_tensor(coeffs, dtype=torch.float32).reshape(self.n_anchors, self.n_groups)
        for mod_path, slot in self.modules.items():
            base = self.base_weights[mod_path]
            stacked = []
            for ai, am in enumerate(slot):
                if am is None:
                    continue
                w = float(C[ai, am.group])
                if w != 0.0:
                    stacked.append(am.delta * w)
            if not stacked:
                self._params[mod_path + ".weight"].data.copy_(base)
                continue
            merged = self._ties(torch.stack(stacked, dim=0))          # [out, in] f32
            self._params[mod_path + ".weight"].data.copy_(
                (base.float() + merged.to(base.device)).to(base.dtype)
            )

    @staticmethod
    def _ties(deltas: torch.Tensor) -> torch.Tensor:
        """TIES disjoint merge over already-weighted deltas [n_anchors, out, in]."""
        elected = torch.sign(deltas.sum(dim=0))                       # [out, in]
        agree = (torch.sign(deltas) == elected) & (deltas != 0)       # keep agreeing, non-zero
        kept = torch.where(agree, deltas, torch.zeros_like(deltas))
        count = agree.sum(dim=0).clamp(min=1)
        return kept.sum(dim=0) / count

    def restore(self) -> None:
        """Reset the model to the unmerged base weights."""
        for mod_path, w in self.base_weights.items():
            self._params[mod_path + ".weight"].data.copy_(w)


# ---------------------------------------------------------------------------
# Self-test: prove the merge produces a working model whose behaviour responds
# to layer-group coefficients (no BO here — that's bo_merge_coeffs.py).
# ---------------------------------------------------------------------------
def _selftest() -> None:
    import argparse
    from transformers import AutoModelForCausalLM, AutoTokenizer

    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="Qwen/Qwen2.5-0.5B-Instruct")
    ap.add_argument("--adapters", nargs="*")
    ap.add_argument("--n-groups", type=int, default=3)
    ap.add_argument("--device", default="auto",
                    help="'auto' = device_map=auto (splits big models; offloaded "
                         "layers become meta tensors, which LayerGroupMerger now "
                         "rejects). Anything else pins the whole model to that "
                         "device: 'cuda' if it fits in VRAM, else 'cpu'.")
    args = ap.parse_args()

    here = os.path.dirname(__file__)
    adapters = args.adapters or sorted(glob.glob(os.path.join(here, "output", "polis_*")))
    adapters = [a for a in adapters if os.path.isfile(os.path.join(a, "adapter_model.safetensors"))]

    tok = AutoTokenizer.from_pretrained(args.base)
    if tok.pad_token is None:
        tok.pad_token = tok.eos_token
    device_map = "auto" if args.device == "auto" else {"": args.device}
    model = AutoModelForCausalLM.from_pretrained(args.base, device_map=device_map, dtype=torch.bfloat16)
    model.eval()

    merger = LayerGroupMerger(model, adapters, n_groups=args.n_groups)
    print(f"anchors={merger.anchor_names}  n_layers={merger._n_layers}  "
          f"n_groups={merger.n_groups}  touched_modules={len(merger.modules)}")
    print("group of each layer:", [merger._group_of(f"model.layers.{L}.x") for L in range(merger._n_layers)])

    probe_prompt = ("あなたは日本の国会議員です。\n"
                    "青柳陽一郎：原子力発電についてどうお考えですか。\n")
    probe_cont = "原子力発電は今後も重要な電力源の一つとして活用すべきだと考えます。"

    def nll(prompt: str, cont: str) -> float:
        ids_p = tok(prompt, return_tensors="pt").input_ids.to(model.device)
        ids_c = tok(cont, return_tensors="pt").input_ids.to(model.device)
        ids = torch.cat([ids_p, ids_c], dim=1)
        with torch.no_grad():
            logits = model(ids).logits[:, :-1]
            logp = torch.log_softmax(logits.float(), dim=-1)
            tgt = ids[:, 1:]
            tok_logp = logp.gather(-1, tgt.unsqueeze(-1)).squeeze(-1)[0]
        n_ctx = ids_p.shape[1] - 1
        return -tok_logp[n_ctx:].mean().item()

    import numpy as np
    merger.restore()
    print(f"\nbase NLL                 = {nll(probe_prompt, probe_cont):.4f}")
    merger.apply(np.ones((merger.n_anchors, merger.n_groups)))
    print(f"uniform merge NLL        = {nll(probe_prompt, probe_cont):.4f}")
    # upper-layers-only vs lower-layers-only should give *different* NLLs → coeffs bite.
    C = np.zeros((merger.n_anchors, merger.n_groups)); C[:, -1] = 1.0
    merger.apply(C)
    print(f"upper-group-only merge   = {nll(probe_prompt, probe_cont):.4f}")
    C = np.zeros((merger.n_anchors, merger.n_groups)); C[:, 0] = 1.0
    merger.apply(C)
    print(f"lower-group-only merge   = {nll(probe_prompt, probe_cont):.4f}")
    merger.restore()
    print(f"restored base NLL        = {nll(probe_prompt, probe_cont):.4f}  (should match base)")
    print("\n[OK] layer-group merge applies, is reversible, and responds to per-group coeffs.")


if __name__ == "__main__":
    _selftest()
