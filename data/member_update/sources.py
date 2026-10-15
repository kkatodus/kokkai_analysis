"""Scrape the official member lists (衆議院 and 参議院) into snapshot rows.

Rows keep the shape of the existing parliamentMembers/*.json files, which the
frontend reads: name (full-width spaces → spaces, no 君), kaiha (short 会派),
district, yomikata, number_of_terms_lower/upper (衆 only), link, period (参
only: 任期満了), person_id (filled in by match.py).
"""
from __future__ import annotations

import logging
import re
import time
from html.parser import HTMLParser
from typing import Callable, List, Optional, Tuple
from urllib.parse import urljoin

import requests

log = logging.getLogger(__name__)

SHUGIIN_PAGE_URL = "https://www.shugiin.go.jp/internet/itdb_annai.nsf/html/statics/syu/{}giin.htm"
SHUGIIN_PAGES = range(1, 11)  # あ行 … わ行
# redirects (via JavaScript) to the current session's list, e.g. 222/giin.htm
SANGIIN_CURRENT_URL = "https://www.sangiin.go.jp/japanese/joho1/kousei/giin/current/giin.htm"
USER_AGENT = "Mozilla/5.0 (compatible; kokkai-doc member updater)"

HOUSES = ("shugiin", "sangiin")
Cell = Tuple[str, Optional[str]]  # (text, first href)


class SourceError(RuntimeError):
	pass


class _TableRows(HTMLParser):
	"""Every <tr> as a list of (cell text, first link href). <br> becomes a newline."""

	def __init__(self):
		super().__init__(convert_charrefs=True)
		self.rows: List[List[Cell]] = []
		self._row: Optional[List[Cell]] = None
		self._cell: Optional[List[str]] = None
		self._href: Optional[str] = None

	def handle_starttag(self, tag, attrs):
		if tag == "tr":
			self._row = []
		elif tag == "td" and self._row is not None:
			self._cell, self._href = [], None
		elif tag == "a" and self._cell is not None and self._href is None:
			self._href = dict(attrs).get("href")
		elif tag == "br" and self._cell is not None:
			self._cell.append("\n")

	def handle_endtag(self, tag):
		if tag == "td" and self._cell is not None and self._row is not None:
			self._row.append(("".join(self._cell), self._href))
			self._cell = None
		elif tag == "tr" and self._row is not None:
			self.rows.append(self._row)
			self._row = None

	def handle_data(self, data):
		if self._cell is not None:
			self._cell.append(data)


def table_rows(html: str) -> List[List[Cell]]:
	parser = _TableRows()
	parser.feed(html)
	parser.close()
	return parser.rows


def display_text(s: str) -> str:
	"""Cell text in the snapshot style: each full-width space → one space, line breaks → a space."""
	return s.strip().replace("\n", " ").replace("　", " ")


def clean_name(s: str) -> str:
	return re.sub(r"君$", "", display_text(s))


def parse_terms(s: str) -> Tuple[Optional[int], int]:
	"""衆 当選回数 cell: "14" → (14, 0); "1（参2）" → (1, 2)."""
	s = re.sub(r"\s", "", s)
	m = re.match(r"(\d+)(?:[（(]参(\d+)[）)])?", s)
	if not m:
		return None, 0
	return int(m.group(1)), int(m.group(2) or 0)


def parse_shugiin_page(html: str, page_url: str) -> List[dict]:
	out = []
	for row in table_rows(html):
		if len(row) != 5 or not row[0][1] or "profile" not in row[0][1]:
			continue
		lower, upper = parse_terms(row[4][0])
		out.append({
			"name": clean_name(row[0][0]),
			"kaiha": display_text(row[2][0]),
			"district": display_text(row[3][0]),
			"yomikata": display_text(row[1][0]),
			"number_of_terms_lower": lower,
			"number_of_terms_upper": upper,
			"link": urljoin(page_url, row[0][1]),
			"period": None,
			"person_id": None,
		})
	return out


def parse_sangiin_page(html: str, page_url: str) -> List[dict]:
	out = []
	for row in table_rows(html):
		if len(row) < 5 or not row[0][1] or "profile" not in row[0][1]:
			continue
		out.append({
			"name": clean_name(row[0][0]),
			"kaiha": display_text(row[2][0]),
			"district": display_text(row[3][0]),
			"yomikata": display_text(row[1][0]),
			"number_of_terms_lower": None,
			"number_of_terms_upper": None,
			"link": urljoin(page_url, row[0][1]),
			"period": display_text(row[4][0]),
			"person_id": None,
		})
	return out


def sangiin_redirect(html: str, page_url: str) -> Optional[str]:
	m = re.search(r"location\.replace\(\s*[\"']([^\"']+)[\"']", html) or re.search(r"<a\s+href=[\"']([^\"']*giin\.htm)[\"']", html, re.I)
	return urljoin(page_url, m.group(1)) if m else None


class Fetcher:
	def __init__(self, min_interval: float = 2.0, session: Optional[requests.Session] = None, sleep: Callable[[float], None] = time.sleep):
		self.session = session or requests.Session()
		self.session.headers["User-Agent"] = USER_AGENT
		self.min_interval = min_interval
		self.sleep = sleep
		self._last = 0.0
		self.requests_made = 0

	def get(self, url: str, encoding: str) -> str:
		wait = self._last + self.min_interval - time.monotonic()
		if wait > 0:
			self.sleep(wait)
		last_error: Optional[Exception] = None
		for attempt in range(3):
			try:
				r = self.session.get(url, timeout=30)
				self._last = time.monotonic()
				self.requests_made += 1
				r.raise_for_status()
				return r.content.decode(encoding)
			except (requests.RequestException, UnicodeDecodeError) as e:
				last_error = e
				log.warning("GET %s failed (attempt %d): %s", url, attempt + 1, e)
				self.sleep(5 * (attempt + 1))
		raise SourceError(f"GET {url} failed: {last_error}")

	def shugiin(self) -> List[dict]:
		rows: List[dict] = []
		for i in SHUGIIN_PAGES:
			url = SHUGIIN_PAGE_URL.format(i)
			rows.extend(parse_shugiin_page(self.get(url, "cp932"), url))
		return rows

	def sangiin(self) -> List[dict]:
		html = self.get(SANGIIN_CURRENT_URL, "utf-8")
		url = sangiin_redirect(html, SANGIIN_CURRENT_URL)
		if not url:
			raise SourceError(f"no redirect to the current list found at {SANGIIN_CURRENT_URL}")
		log.info("参議院 current list: %s", url)
		return parse_sangiin_page(self.get(url, "utf-8"), url)

	def house(self, house: str) -> List[dict]:
		return self.shugiin() if house == "shugiin" else self.sangiin()
