"""NDL Kokkai `/api/meeting` client: date-window paging, spacing and retries.

NDL asks clients not to send parallel requests, so requests are sequential and
at least `min_interval` seconds apart.
"""
from __future__ import annotations

import logging
import time
from datetime import date
from typing import Callable, Iterator, Optional

import requests

log = logging.getLogger(__name__)

MEETING_URL = "https://kokkai.ndl.go.jp/api/meeting"
PAGE_SIZE = 10  # the meeting endpoint returns at most 10 records per page
USER_AGENT = "kokkai-doc-speech-update/1.0 (+https://github.com/kkatodus/kokkai_analysis)"


class NdlError(RuntimeError):
	pass


class NdlRejected(NdlError):
	"""4xx or API-level error (bad parameters): retrying won't help."""


class NdlClient:
	def __init__(
		self,
		min_interval: float = 3.0,
		max_tries: int = 5,
		timeout: float = 120.0,
		session: Optional[requests.Session] = None,
		sleep: Callable[[float], None] = time.sleep,
		clock: Callable[[], float] = time.monotonic,
	):
		self.min_interval = min_interval
		self.max_tries = max_tries
		self.timeout = timeout
		self.session = session or requests.Session()
		# NDL's CDN answers 403 to the default python-requests User-Agent
		self.session.headers["User-Agent"] = USER_AGENT
		self._sleep = sleep
		self._clock = clock
		self._last_request: Optional[float] = None
		self.requests_made = 0

	def iter_meetings(self, date_from: date, date_until: date) -> Iterator[dict]:
		"""Yield every raw meetingRecord dated within [date_from, date_until]."""
		start = 1
		total = None
		while start:
			page = self._get_page({
				"from": date_from.isoformat(),
				"until": date_until.isoformat(),
				"recordPacking": "json",
				"maximumRecords": PAGE_SIZE,
				"startRecord": start,
			})
			if total is None:
				total = int(page.get("numberOfRecords") or 0)
				log.info("NDL: %d meetings dated %s → %s", total, date_from, date_until)
			records = page.get("meetingRecord") or []
			if isinstance(records, dict):
				records = [records]
			yield from records
			nxt = page.get("nextRecordPosition")
			start = int(nxt) if nxt else None

	def _get_page(self, params: dict) -> dict:
		last_error: Optional[Exception] = None
		for attempt in range(1, self.max_tries + 1):
			self._throttle()
			try:
				resp = self.session.get(MEETING_URL, params=params, timeout=self.timeout)
				self.requests_made += 1
				if resp.status_code >= 500 or resp.status_code == 429:
					raise NdlError(f"HTTP {resp.status_code}")
				if resp.status_code >= 400:
					raise NdlRejected(f"NDL rejected request {params}: HTTP {resp.status_code} {resp.text[:200]}")
				body = resp.json()
				if "message" in body and "numberOfRecords" not in body:
					raise NdlRejected(f"NDL rejected request {params}: {body['message']}")
				return body
			except NdlRejected:
				raise
			except NdlError as e:
				last_error = e
			except (requests.RequestException, ValueError) as e:
				last_error = e
			log.warning("NDL request failed (try %d/%d): %s", attempt, self.max_tries, last_error)
			if attempt < self.max_tries:
				self._sleep(min(5 * 2 ** (attempt - 1), 120))
		raise NdlError(f"NDL request failed after {self.max_tries} tries: {last_error}")

	def _throttle(self) -> None:
		if self._last_request is not None:
			wait = self.min_interval - (self._clock() - self._last_request)
			if wait > 0:
				self._sleep(wait)
		self._last_request = self._clock()
