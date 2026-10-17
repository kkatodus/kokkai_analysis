"""Repo-relative paths for the POLIS research scripts.

Replaces the old `from params.paths import DATA_DIR` (which only resolved when a
script was run from inside `data/`) now that the pipeline, training, merge and
BO scripts all live together under `research/polis/`.

`DATA_DIR` is `<repo>/data/data`, a symlink onto the external SSD -- if it looks
empty, the drive is not mounted (`kdata mount`). Override with `KOKKAI_DATA_DIR`
when running somewhere the symlink does not exist, e.g. a rented GPU box:

    export KOKKAI_DATA_DIR=/workspace/kokkai_data
"""
from __future__ import annotations

import os

HERE = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))

DATA_DIR = os.environ.get("KOKKAI_DATA_DIR") or os.path.join(REPO_ROOT, "data", "data")
S3_MIRROR_DIR = os.environ.get("KOKKAI_S3_MIRROR") or os.path.join(REPO_ROOT, "s3_mirror")

# LoRA/DPO adapters. Gitignored (~1 GB of safetensors) -- see research/README.md.
OUTPUT_DIR = os.environ.get("POLIS_OUTPUT_DIR") or os.path.join(HERE, "output")

POLIS_DATA_DIR = os.path.join(DATA_DIR, "polis")
