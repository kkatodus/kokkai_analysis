# Gold set v1 (model-labelled)

163 committee Q&A exchanges from Diet speeches since 2000 (plenary excluded), labelled with the §3 scheme in
[specs/speech-quality-labels](../../../specs/speech-quality-labels/README.md).

**These labels were made by Claude (`claude-opus-5-5`), not by a person.** The user
had no time to label the set, so Phase 1 comparisons of candidate models measure
agreement with Opus, not with a human. Spot-check the exchanges listed below before
trusting the set; fix a label by editing `labels_v1.jsonl` and re-running `merge`.

## Files

| File | What |
|---|---|
| `gold_v1.jsonl` | One row per labelled exchange: `gold_id` (`issue_id#index`), `speech_ids`, `date`, `house`, `meeting`, `stratum`, `questioner`, `questioner_group`, `ruling`, `answerers`, `labels`, `labeller` |
| `labels_v1.jsonl` | Raw labels (185 rows; 22 marked `excluded`: 4 segmenter faults, 18 plenary) |
| `sample_v1.jsonl` | Sampling manifest, main draw (150) |
| `sample_v1_supplement.jsonl` | Sampling manifest, supplement (16 keyword + 7 hand-picked) |
| `sample_v1_supplement2.jsonl` | Sampling manifest, second hand-picked supplement (12: private scandals and near-misses) |

The exchange texts used for labelling are in `s3_mirror/.speech-quality/gold_texts_v1*.jsonl`
(outside git; rebuilt by `draw`).

## Sampling

`speech_quality/segment.py` splits a meeting into exchanges: a new exchange starts when a
member other than the current questioner speaks; a chair turn that closes questioning
(質疑終局, 議題とします, 趣旨説明…) ends it. `sample_gold.py scan` builds a pool of
committee exchanges (400–12,000 chars; plenary excluded since 2026-10-18) with keyword hits; `draw` takes
strata round-robin over (era, house) cells, at most one exchange per meeting per
stratum, seed `20261018`:

- keyword strata to oversample problems: private scandal 12, public scandal 12,
  evasive 10, procedural dispute 10, softball (ruling-party questioners) 12,
  personal attack 6, redundant 8
- random: 予算委員会 25, other committees 40 (the v1 draw also took 15 plenary; those 18 rows are now `excluded`)

Keyword precision for private scandals and redundancy was low, so `draw --supplement`
(seed `20261019`, meetings already sampled excluded) added 16 more, plus 7 exchanges
picked by hand (`SUPPLEMENT_MANUAL`) so every issue type appears at least 5 times.

After plenary was excluded only 3 `private_scandal` cases were left, so `draw --supplement2`
writes 12 more committee exchanges picked by hand (`SUPPLEMENT2_MANUAL`), found by searching
question text for named scandals (女性問題, 不倫, 愛人, 週刊誌 stories about ministers, 経歴詐称,
酩酊, 秘書の酒気帯び, 総理秘書官) and read in full: six where the questioner pursues a private
matter (高木毅's alleged theft, PM Mori's alleged 1958 arrest, a minister's hostess, a #MeToo
story, an aide's drink-driving, a brief mention of a resignation) and six near-misses that look
like scandal but are about public money, official duty or the election law (donations,
absence on duty, a vice-minister's harassment of reporters, a fake degree, the G7 press
conference, the PM's son using an official car). All twelve are 衆 except one.
Two boundary calls are worth a user check: `119604889X00520180328#2` (a minister's alleged
harassment at drinking parties before taking office, marked private) and
`119604260X00920180413#7` (the finance vice-minister's harassment of reporters, marked
oversight, low confidence).

Decision taken here on 経歴詐称 (false credentials): **not** `private_scandal`. False claims
in election material deceive voters and are an election-law offence, so they concern public
office.

Mix: 衆 84 / 参 79; 41 ruling-party questioners; every year 2000–2026.

## Label schema notes

Fields follow §3: `function`, `issues`, `contribution`, `responsible`, `outcomes`,
`topic`, `reason` (ja), `reason_en`, `confidence`, `notes`. Additions:

- each issue is `{type, by, extent}`; `extent` is `part` or `most` of the exchange
- `responsible` is derived mechanically from the issues' `by`
- `topic_detail`: free text; `topic` is one of the 12 site topics or `other`

Excluded (segmenter faults, not Q&A): `115005254X01220001110#2` (plenary 討論 split
by （続）), `119005261X01420160218#11` and `117704601X02420110728#0` (witness
statements under a 座長), `120105007X00620200318#0` (附帯決議 explanation). The first
three are fixed in the segmenter; 附帯決議 explanations are not.

## Distribution

163 exchanges (after the user review, plenary exclusion and supplement 2):

- function: oversight 58, policy 55, legislation 45, representation 4, none 1
- contribution: limited 84, substantive 77, none 2
- issues: evasive 35, softball 32, grandstanding 17, private_scandal 9, redundant 7,
  procedural_dispute 7, personal_attack 5 (74 exchanges with none)
- responsible: neither 74, questioner 54, answerer 24, both 11
- outcomes: new_information 105, commitment 61, proposal 36
- confidence: medium 95, high 66, low 2
- topic: other 116

## Spot-check (22)

All 18 low-confidence labels:
`120104889X01520200529#7`, `116605254X01420070316#10`, `115603968X01020030516#3`,
`115515254X00820021122#4`, `116405254X02920060511#8`, `117715254X03420110822#2`,
`120415254X02120210512#4`, `121705254X02020250415#2`, `116515254X01720061206#3`,
`119315254X00320170125#2`, `117605254X00920101116#20`, `122115254X01320260515#1`,
`115115254X03220010615#0`, `115605254X01120030228#6`, `119215254X00920161109#2`,
`119815261X01120190318#6`, `116205261X00620050204#10`, `115015206X00220001102#8`

Plus a random 4 (seed 20261018): `119003968X00420160316#16`, `121105261X01020230213#3`,
`121305254X02120240416#8`, `121704536X00320250403#8`

## Rerun

From `data/`:

```
python3 -m speech_quality.sample_gold scan              # pool → s3_mirror/.speech-quality/
python3 -m speech_quality.sample_gold draw              # main sample + texts
python3 -m speech_quality.sample_gold draw --supplement
python3 -m speech_quality.sample_gold draw --supplement2  # hand-picked list, texts only
python3 -m speech_quality.sample_gold merge             # labels_v1 + samples → gold_v1
```

`sample_v1.jsonl` was drawn before the 座長 and （続） segmenter fixes; a fresh `draw`
will not reproduce it exactly. Keep the committed manifests as the reference.

## User review (2026-10-18)

The user checked the 22 spot-check exchanges and set rules now in the spec §3: legal nuance and
another ministry's jurisdiction are not evasion; privacy refusals are evasion only when they shield
the government's own conduct; a public official's private habit is a private scandal, possible
blackmail is not. Plenary sessions are out of scope: the 18 plenary rows are kept in
`labels_v1.jsonl` with `excluded: true` and left out of `gold_v1.jsonl` (151 exchanges).
