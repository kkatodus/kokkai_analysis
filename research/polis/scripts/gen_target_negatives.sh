#!/usr/bin/env bash
# Fill the `rejected` side for the 33 held-out targets (spec §4.3 baseline 4, DPO).
#
# Targets were exported prompt/chosen only -- a held-out target gets no adapter of its
# own -- so the DPO baseline needs negatives generated before it can train. Runs on the
# laptop: Gemini API, no GPU, so it is safe alongside a pod run.
#
# USAGE (nothing to export, nothing to paste):
#   ./research/polis/scripts/gen_target_negatives.sh
#   DRY_RUN=1 ./research/polis/scripts/gen_target_negatives.sh   # show the plan, spend nothing
#   LIMIT=0   ./research/polis/scripts/gen_target_negatives.sh   # all rows, not just the first 30
#
# COST: --limit 30 is 33 x 30 = 990 calls, ~600 in / ~250 out tokens each, roughly
# $0.20 at flash-lite pricing and 5-10 min at 8 workers. LIMIT=0 is ~8000 calls (~$1.60).
# Only the first 30 rows per target are ever used by the nested CV at budget=30.
#
# Resumable: rows whose speechID already has a `rejected` are skipped, so re-running
# after an interruption -- or after raising LIMIT -- fills the gap rather than redoing.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CODE="$(dirname "$HERE")"                       # research/polis
REPO="$(cd "$CODE/../.." && pwd)"

PY="${PY:-$HOME/.venvs/polis-api/bin/python}"
WORKERS="${WORKERS:-8}"
LIMIT="${LIMIT:-30}"
IN_DIR="${IN_DIR:-$REPO/data/data/polis/dpo_pairs_targets}"
OUT_DIR="${OUT_DIR:-$REPO/data/data/polis/dpo_pairs_targets_full}"
SPEC="$REPO/specs/polis-low-resource-persona/targets_n30.json"
ORIGINAL_TARGETS="1279 2053 2289"

die() { echo "FATAL: $*" >&2; exit 1; }

# ---- interpreter -----------------------------------------------------------
# The system python has neither google-genai nor python-dotenv, and Ubuntu's python3.12
# ships without ensurepip, so `-m venv` fails on it. Find an interpreter that can
# actually build a venv and create one on first run.
bootstrap_venv() {
  local venv="${PY%/bin/python}" base=""
  for cand in /home/linuxbrew/.linuxbrew/bin/python3.14 \
              /home/linuxbrew/.linuxbrew/bin/python3 \
              python3.13 python3.12 python3; do
    command -v "$cand" >/dev/null 2>&1 || continue
    "$cand" -m ensurepip --version >/dev/null 2>&1 && { base="$cand"; break; }
  done
  [ -n "$base" ] || die "no interpreter with ensurepip found; install python3-venv, then re-run"
  echo "  bootstrapping $venv with $base (google-genai, python-dotenv)"
  "$base" -m venv "$venv" || die "venv creation failed"
  "$venv/bin/pip" install -q google-genai==1.60.0 python-dotenv==1.2.1 \
    || die "pip install failed"
}

[ -x "$PY" ] || bootstrap_venv
"$PY" -c "import google.genai, dotenv" 2>/dev/null \
  || die "$PY is missing google-genai / python-dotenv; delete ${PY%/bin/python} and re-run"

# ---- API key ---------------------------------------------------------------
# generate_polis_rejected.py calls load_dotenv(), which walks up from research/polis --
# it never reaches data/.env, which is a sibling. Load it here instead.
if [ -z "${GEMINI_API_KEY:-}" ] && [ -f "$REPO/data/.env" ]; then
  set -a; . "$REPO/data/.env"; set +a
fi
[ -n "${GEMINI_API_KEY:-}" ] || die "GEMINI_API_KEY unset and not found in $REPO/data/.env"

# ---- targets ---------------------------------------------------------------
[ -f "$SPEC" ] || die "missing $SPEC"
IDS="$("$PY" -c "
import json,sys
d=json.load(open(sys.argv[1]))
print(' '.join(str(t['person_id']) for t in d['targets']))" "$SPEC")" || die "could not read $SPEC"
IDS="$ORIGINAL_TARGETS $IDS"
N=$(echo "$IDS" | wc -w)

echo "=== target negatives ==="
echo "  interpreter : $PY"
echo "  targets     : $N"
echo "  rows/target : ${LIMIT} (0 = all)"
echo "  in          : $IN_DIR"
echo "  out         : $OUT_DIR"
echo "  workers     : $WORKERS"
for id in $IDS; do
  [ -f "$IN_DIR/$id.jsonl" ] || die "no exported pairs for $id in $IN_DIR"
done
echo "  all $N input files present"

if [ "${DRY_RUN:-0}" = "1" ]; then
  echo "DRY_RUN=1 -- stopping before any API call."
  exit 0
fi

mkdir -p "$OUT_DIR" || die "cannot create $OUT_DIR (is the data drive writable?)"

LIMIT_ARG=()
[ "$LIMIT" != "0" ] && LIMIT_ARG=(--limit "$LIMIT")

fail=0
i=0
for id in $IDS; do
  i=$((i + 1))
  echo ""
  echo "=== [$i/$N] person $id ==="
  "$PY" "$CODE/generate_polis_rejected.py" \
    --person-id "$id" --workers "$WORKERS" "${LIMIT_ARG[@]}" \
    --input-dir "$IN_DIR" --output-dir "$OUT_DIR" || { fail=$((fail + 1)); echo "  ^^ $id FAILED" >&2; }
done

# ---- verify ----------------------------------------------------------------
echo ""
echo "=== verify ==="
short=0
for id in $IDS; do
  f="$OUT_DIR/$id.jsonl"
  if [ ! -f "$f" ]; then echo "  MISSING $id"; short=$((short + 1)); continue; fi
  n=$("$PY" -c "
import json,sys
ok=sum(1 for l in open(sys.argv[1],encoding='utf-8') if json.loads(l).get('rejected'))
print(ok)" "$f")
  want=$([ "$LIMIT" = "0" ] && wc -l < "$IN_DIR/$id.jsonl" || echo "$LIMIT")
  [ "$n" -lt "$want" ] && { echo "  SHORT   $id: $n/$want rows have a negative"; short=$((short + 1)); }
done
[ "$short" -eq 0 ] && echo "  all $N targets have $LIMIT non-empty negatives"
echo ""
echo "done: $((N - fail))/$N targets processed, $short short/missing -> $OUT_DIR"
[ "$fail" -eq 0 ] && [ "$short" -eq 0 ] || exit 1
