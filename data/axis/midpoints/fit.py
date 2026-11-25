"""Fit con|neutral|pro cut points per sub-topic axis from hand labels.
Ordinal 3-zone fit: x < a → con, a <= x < b → neutral, x >= b → pro.
Cost: pro/con on the wrong side = 1, a neutral outside the band or pro/con inside it = 0.5.
Among optimal (a, b) choose the narrowest band, then centre within the tie range."""
import gzip, json, sys, random
from pathlib import Path
S = Path(sys.argv[1])
doc = json.load(gzip.open('s3_mirror/kokkai-doc/ideology/ideology.json.gz'))

def cost(pts, a, b):
    c = 0.0
    for x, l in pts:
        zone = 'con' if x < a else ('pro' if x >= b else 'neutral')
        if zone == l: continue
        c += 1.0 if {zone, l} == {'con', 'pro'} else 0.5
    return c

def fit(pts):
    xs = sorted(set(x for x, _ in pts))
    cuts = [xs[0] - 1e-6] + [(xs[i] + xs[i+1]) / 2 for i in range(len(xs) - 1)] + [xs[-1] + 1e-6]
    best = None
    for i, a in enumerate(cuts):
        for b in cuts[i:]:
            c = cost(pts, a, b)
            key = (c, b - a)
            if best is None or key < best[0]: best = (key, a, b)
    (c, _), a, b = best
    return a, b, c

def auc(pts):
    p = [x for x, l in pts if l == 'pro']; n = [x for x, l in pts if l == 'con']
    if not p or not n: return None
    return sum((1 if xp > xn else 0.5 if xp == xn else 0) for xp in p for xn in n) / (len(p) * len(n))

out = {}
for t in doc['data']:
    lf = S / 'labels' / f"{t['topic']}.json"
    if not lf.exists(): continue
    L = json.load(open(lf))
    l2 = S / 'labels2' / f"{t['topic']}.json"
    if l2.exists():
        for pid, lab in json.load(open(l2))['labels'].items():
            L['labels'].setdefault(pid, {}).update(lab)
    for st in t['sub_topics']:
        allp = [p for p in st['1d']['data'] if p['person_id']]
        xs_all = sorted(p['x'] for p in allp)
        xof = {p['person_id']: p['x'] for p in allp}
        pts = [(xof[int(pid)], lab[st['sub_topic']]) for pid, lab in L['labels'].items()
               if int(pid) in xof and lab.get(st['sub_topic']) in ('pro', 'con', 'neutral')]
        cnt = {k: sum(1 for _, l in pts if l == k) for k in ('pro', 'con', 'neutral')}
        cnt['na'] = sum(1 for pid, lab in L['labels'].items() if int(pid) in xof and lab.get(st['sub_topic']) == 'na')
        res = {'n_labelled': len(pts), 'counts': cnt, 'auc': auc(pts), 'axis_note': L.get('axis_notes', {}).get(st['sub_topic'])}
        if cnt['pro'] + cnt['con'] >= 6 and len(pts) >= 10:
            a, b, c = fit(pts)
            # bootstrap the midpoint
            mids = []
            rnd = random.Random(0)
            for _ in range(200):
                bs = [rnd.choice(pts) for _ in pts]
                if len({l for _, l in bs}) < 2: continue
                ba, bb, _ = fit(bs); mids.append((ba + bb) / 2)
            mids.sort()
            pct = lambda v: sum(1 for x in xs_all if x < v) / len(xs_all)
            res.update({'neutral_from': round(a, 4), 'neutral_to': round(b, 4), 'midpoint': round((a + b) / 2, 4),
                        'misfit_cost': c, 'agreement': round(1 - c / len(pts), 3),
                        'midpoint_ci90': [round(mids[int(.05*len(mids))], 3), round(mids[int(.95*len(mids))], 3)] if mids else None,
                        'pct_below_neutral': round(pct(a), 3), 'pct_above_neutral': round(1 - pct(b), 3)})
        out[f"{t['topic']}/{st['sub_topic']}"] = res
json.dump(out, open(S / 'fit.json', 'w'), ensure_ascii=False, indent=1)
for k, r in out.items():
    print(k, r['counts'], 'auc', r['auc'] and round(r['auc'], 2), 'mid', r.get('midpoint'), 'band', r.get('neutral_from'), r.get('neutral_to'),
          'agree', r.get('agreement'), 'ci', r.get('midpoint_ci90'), 'con%', r.get('pct_below_neutral'), 'pro%', r.get('pct_above_neutral'))
