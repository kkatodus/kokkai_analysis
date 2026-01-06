from __future__ import annotations

import os
import secrets
from typing import Iterable, Optional

from fastapi import Depends, HTTPException, Request, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, Response

from core.config import Environment, Settings, get_settings


def _normalize_host(host: str) -> str:
	# "example.com:443" -> "example.com"
	return host.split(",")[0].strip().split(":")[0].strip().lower()


def _is_allowed_host(host: str, allowed_hosts: Iterable[str]) -> bool:
	allowed = [h.strip().lower() for h in allowed_hosts if h.strip()]
	if not allowed:
		return True
	if "*" in allowed:
		return True
	return _normalize_host(host) in set(allowed)


def _is_allowed_origin(origin: str, allowed_origins: Iterable[str]) -> bool:
	allowed = [o.strip() for o in allowed_origins if o.strip()]
	if not allowed:
		return True
	return origin in set(allowed)


class DomainVerificationMiddleware(BaseHTTPMiddleware):
	"""Verifies that requests look like they are coming from expected domains.

	- If `Origin` is present (typical browser requests), it must be in `settings.cors_allow_origins`.
	- If `ALLOWED_HOSTS` is configured, `Host`/`X-Forwarded-Host` must be allowed.
	"""

	def __init__(
		self,
		app,
		settings: Settings,
		exempt_path_prefixes: Optional[list[str]] = None,
	) -> None:
		super().__init__(app)
		self.settings = settings
		self.exempt_path_prefixes = exempt_path_prefixes or [
			"/health",
			"/docs",
			"/openapi.json",
			"/redoc",
		]

	async def dispatch(self, request: Request, call_next) -> Response:
		if request.method.upper() == "OPTIONS":
			return await call_next(request)

		path = request.url.path
		if any(path.startswith(p) for p in self.exempt_path_prefixes):
			return await call_next(request)

		origin = request.headers.get("origin")
		if origin and not _is_allowed_origin(origin, self.settings.cors_allow_origins):
			return JSONResponse(
				status_code=status.HTTP_403_FORBIDDEN,
				content={"detail": f"Origin not allowed: {origin}"},
			)

		forwarded_host = request.headers.get("x-forwarded-host")
		print('forwarded_host', forwarded_host)
		host = forwarded_host or request.headers.get("host")
		print('host', request.headers.get("host"))
		print('host', host)
		print('allowed_hosts', self.settings.allowed_hosts)
		if host and not _is_allowed_host(host, self.settings.allowed_hosts):
			return JSONResponse(
				status_code=status.HTTP_403_FORBIDDEN,
				content={"detail": f"Host not allowed: {_normalize_host(host)}"},
			)

		return await call_next(request)


async def require_api_key(
	request: Request,
	settings: Settings = Depends(get_settings),
) -> None:
	"""Require a valid API key in the configured header (default: X-API-KEY)."""
	print('settings.env', settings.env)
	if settings.env == Environment.LOCAL:
		print("local environment, skipping api key check")
		return
	header_name = settings.api_key_header_name
	provided = request.headers.get(header_name)
	if not provided:
		raise HTTPException(
			status_code=status.HTTP_401_UNAUTHORIZED,
			detail="Missing API key",
		)
	print("comparing provided and settings.api_key")
	print("provided", provided)
	print("settings.api_key", settings.api_key)
	if not secrets.compare_digest(provided, settings.api_key):
		raise HTTPException(
			status_code=status.HTTP_401_UNAUTHORIZED,
			detail="Invalid API key",
		)


