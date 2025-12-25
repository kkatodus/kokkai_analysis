# FastAPI backend

A FastAPI implementation of the existing Node/Express API. Endpoints mirror the current routes under `api/` and load JSON assets from the repository data directories by default.

## Development

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.app.main:app --reload
```

Configuration is managed through environment variables (see `backend/app/core/config.py`). Defaults point at the existing `api` data folders so the server can run without additional setup. Configure Stripe keys to enable payment endpoints:

- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `FRONTEND_URL` (optional, defaults to `https://kokkaidoc.com`)

## Docker

A production-ready image can be built from the repository root:

```bash
docker build -t kokkai-backend -f backend/Dockerfile .
docker run -p 8000:8000 --env-file .env kokkai-backend
```
