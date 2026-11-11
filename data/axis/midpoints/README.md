# Axis midpoints (where con turns into pro)

`../midpoints.json` gives, for each sub-topic axis in `ideology.json.gz`, where on the 1D `x` scale the politicians'
stances actually switch from con to pro, plus a neutral band. Raw `x` is relative (the axis midpoint 0 sits halfway
between two generated reference texts), so 0 is not the real political middle.

How it was made (2026-11-11, against the ideology file generated 2026-11-11T14:42):

1. Round 1: per sub-topic, 30 politicians at evenly spaced quantiles of `x` (preferring ≥10 opinion sentences), union
   per topic; whole population for small topics. Run-1 summary only, names removed.
2. Each (person, sub-topic) hand-labelled `pro | con | neutral | na` against the axis by Claude Opus 5.5 subagents; how
   each oddly framed axis was read is in `labels/<topic>.json` → `axis_notes` and in `midpoints.json` → `axis_reading`.
3. `fit.py`: 3-zone ordinal fit on `x` (wrong side = 1, neutral/pro/con mismatch with the band = 0.5; narrowest band
   among ties), bootstrap 90 % interval for the midpoint.
4. Round 2: up to 25 more unlabelled politicians inside each calibrated axis's interval, labelled with the same
   reading, then refit. 1,558 summaries read in total.

Status per axis:

- `calibrated` (24): both sides present and ordered along `x` (AUC ≥ 0.78). `confidence: high` when AUC ≥ 0.88 and
  ≥ 80 % of labels fall in their zone. Use `midpoint`, `neutral_from` / `neutral_to`.
- `one_sided_pro` (22): nearly everyone who addresses it leans pro (the axis's con statement is usually not a real
  opposite). Do not paint the left half as 反対.
- `unclear` (14): labels don't line up with `x`, or too few people address it. Show no midpoint.

The thresholds are fixed `x` values on fixed reference axes, so they stay valid while a person's summary is
unchanged; re-run after an axis or reference text changes. Applies to the 1D view only (UMAP 2D is not linear).

Rerun the fit: `python3 data/axis/midpoints/fit.py <dir containing labels/>` from the repo root (needs the mirror's
`ideology.json.gz`).
