# A1 — Topic volume gate (G3)

Cohort: **460** members of 第49回衆議院議員総選挙 (当選) with a speech directory (9 of 469 had no directory).

Term window: **2021-11-10 → 2024-10-09**, house = **衆議院**. Volume = speeches in each topic jsonl restricted to that window/house. `searchword_segs` is an upper bound on the opinion count the pipeline gates on (`MIN_OPINIONS=3`).

## Coverage — cohort members with n_term_hor speeches ≥ threshold

| Topic | ≥1 | ≥3 | ≥5 | ≥10 | ≥3 opinion-seg (UB) |
|---|---|---|---|---|---|
| **Defence** ✅committed | 401 (87.2%) | 323 (70.2%) | 288 (62.6%) | 224 (48.7%) | 350 (76.1%) |
| **NuclearPower** ✅committed | 253 (55.0%) | 141 (30.7%) | 96 (20.9%) | 42 (9.1%) | 166 (36.1%) |
| **FamilySeparate** ⚠️conditional | 59 (12.8%) | 16 (3.5%) | 10 (2.2%) | 3 (0.7%) | 26 (5.7%) |
| **LGBT** ⚠️conditional | 67 (14.6%) | 27 (5.9%) | 17 (3.7%) | 7 (1.5%) | 39 (8.5%) |

## Volume distribution (members with ≥1 term speech)

| Topic | n>0 | median | mean | p90 | max | total speeches |
|---|---|---|---|---|---|---|
| Defence | 401 | 12 | 28.5 | 67 | 582 | 11424 |
| NuclearPower | 253 | 3 | 9.0 | 18 | 269 | 2284 |
| FamilySeparate | 59 | 1 | 2.9 | 5 | 32 | 171 |
| LGBT | 67 | 2 | 3.9 | 9 | 23 | 258 |

## Term-scoping impact (all-history vs 49th-term-HoR speeches)

| Topic | Σ n_alltime | Σ n_term_hor | retained |
|---|---|---|---|
| Defence | 68001 | 11424 | 16.8% |
| NuclearPower | 18551 | 2284 | 12.3% |
| FamilySeparate | 874 | 171 | 19.6% |
| LGBT | 429 | 258 | 60.1% |

## House-filter sensitivity (in-term 衆議院 vs 参議院 speeches)

Speeches the cohort delivered **in 参議院 during the term** — mostly ministers answering in the other chamber. Currently EXCLUDED (corpus = House of Representatives). Including them adds text but skews Cabinet members toward the government line.

| Topic | 衆議院 (kept) | 参議院 (dropped) | dropped share |
|---|---|---|---|
| Defence | 11424 | 2847 | 19.9% |
| NuclearPower | 2284 | 528 | 18.8% |
| FamilySeparate | 171 | 36 | 17.4% |
| LGBT | 258 | 75 | 22.5% |

## G3 read

- **FamilySeparate**: 26 members (5.7%) clear the ≥3 opinion-segment upper bound; 10 have ≥5 term speeches. 
- **LGBT**: 39 members (8.5%) clear the ≥3 opinion-segment upper bound; 17 have ≥5 term speeches. 

(A minimum-text threshold and the include/exclude call for the conditional topics are made from the numbers above — see the CSV for the full per-member distribution.)
