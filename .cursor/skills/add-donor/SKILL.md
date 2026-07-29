---
name: add-donor
description: Add a supporter's display name to the KOKKAI DOC donor list shown in the DonateModal. Use when the user asks to add, remove, rename, or reorder a donor, or mentions the donors list / 募金 supporters.
disable-model-invocation: true
---

# Add a Donor

Donors eligible for listing are those who donated **4000円 or more**. Their display names live in a single hard-coded list on the backend; the frontend fetches it and renders it in the donate modal.

## Source of truth

Edit the `DONORS` list in `backend/app/routers/donors.py`:

```5:28:backend/app/routers/donors.py
DONORS = [
    "Kohei Oshida",
    ...
]
```

The `GET /donors/` endpoint returns `{"donors": [...]}`.

## Data flow (no other edits needed)

1. `backend/app/routers/donors.py` — the list (edit here)
2. `frontend/app/api/donors/route.ts` — Next.js proxy to `GET /donors/`
3. `frontend/app/components/modal/modals/DonateModal.tsx` — renders the list

## Steps to add a donor

1. Open `backend/app/routers/donors.py`.
2. Append the new name as a new string element at the **end** of the `DONORS` list (newest last), preserving the exact wording/characters the user provided.
3. Keep the trailing comma and the existing formatting.
4. That's it — no frontend change is required.

## Rules

- Use the donor's name **verbatim** (Japanese, kana, symbols like ® and full-width chars are all fine).
- Do not deduplicate or reorder existing entries unless asked.
- For removal or rename requests, edit/delete the matching string in the same list.
