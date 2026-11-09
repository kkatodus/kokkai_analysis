"""Where a politician's portrait comes from, in priority order.

1. The House profile photo for current members (shugiin.go.jp / sangiin.go.jp): the
   `link` in the latest parliamentMembers snapshot points at the profile page; the
   photo URL is derived from it. Both sites allow reuse with the source named.
2. Wikimedia: the Wikidata item for the person (searched by kanji name, accepted only
   when it is a human who held a Diet seat or is described as a politician), its P18
   image or the Japanese Wikipedia page image, downloaded from Commons as a 512px
   thumbnail with the licence and attribution from `extmetadata`.

Everything goes through one polite `Fetcher` (per-host spacing, retries, a UA with a
contact address, as api.wikimedia.org asks).
"""
from __future__ import annotations

import logging
import re
import time
from dataclasses import dataclass, field
from typing import Callable, Dict, List, Optional
from urllib.parse import quote, urlparse

import requests

log = logging.getLogger("person_images.sources")

USER_AGENT = "KokkaiDoc/1.0 (+https://github.com/kkatodus/kokkai_analysis; contact katoken629@gmail.com)"
WIKIDATA_API = "https://www.wikidata.org/w/api.php"
JAWIKI_API = "https://ja.wikipedia.org/w/api.php"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"
THUMB_WIDTH = 512

Q_HUMAN = "Q5"
Q_POLITICIAN = "Q82955"
Q_LOWER_HOUSE_MEMBER = "Q17506823"   # 衆議院議員
Q_UPPER_HOUSE_MEMBER = "Q14552828"   # 参議院議員
DIET_SEATS = {Q_LOWER_HOUSE_MEMBER, Q_UPPER_HOUSE_MEMBER}

MIN_INTERVAL = {"www.shugiin.go.jp": 1.0, "www.sangiin.go.jp": 1.0}
DEFAULT_INTERVAL = 0.3   # Wikimedia asks for sequential, not parallel, requests


class SourceError(RuntimeError):
	pass


class NotFound(SourceError):
	pass


@dataclass
class ImageHit:
	source: str                  # shugiin | sangiin | wikimedia
	image_url: str
	source_url: str              # the page a reader can check
	license: str
	attribution: str
	credit: str = ""
	extra: Dict[str, str] = field(default_factory=dict)


class Fetcher:
	def __init__(self, session: Optional[requests.Session] = None, sleep: Callable[[float], None] = time.sleep):
		self.session = session or requests.Session()
		self.session.headers["User-Agent"] = USER_AGENT
		self.sleep = sleep
		self._last: Dict[str, float] = {}
		self.requests_made = 0

	def _space(self, url: str) -> None:
		host = urlparse(url).netloc
		wait = self._last.get(host, 0.0) + MIN_INTERVAL.get(host, DEFAULT_INTERVAL) - time.monotonic()
		if wait > 0:
			self.sleep(wait)
		self._last[host] = time.monotonic()

	def get(self, url: str, params: Optional[dict] = None, timeout: int = 60) -> requests.Response:
		last: Optional[Exception] = None
		for attempt in range(4):
			self._space(url)
			try:
				r = self.session.get(url, params=params, timeout=timeout)
				self.requests_made += 1
				if r.status_code == 404:
					raise NotFound(f"404 {r.url}")
				if r.status_code in (429, 500, 502, 503, 504):
					raise requests.HTTPError(f"{r.status_code} {r.url}")
				r.raise_for_status()
				return r
			except NotFound:
				raise
			except requests.RequestException as e:
				last = e
				log.warning("GET %s failed (attempt %d): %s", url.split("?")[0], attempt + 1, e)
				self.sleep(5 * 2 ** attempt)
		raise SourceError(f"GET {url} failed: {last}")

	def json(self, url: str, params: dict) -> dict:
		return self.get(url, {**params, "format": "json"}).json()


# --- House photos ---

SHUGIIN_PROFILE = re.compile(r"^(https://www\.shugiin\.go\.jp/internet/itdb_giinprof\.nsf/html/profile/)(\d+)\.html$")
SANGIIN_PROFILE = re.compile(r"^(https://www\.sangiin\.go\.jp/japanese/joho1/kousei/giin/)profile/(\d+)\.htm$")


def house_photo(link: Optional[str]) -> Optional[ImageHit]:
	"""The official portrait for a member's profile link, or None if the link isn't one we know."""
	if not link:
		return None
	m = SHUGIIN_PROFILE.match(link)
	if m:
		base, num = m.groups()
		return ImageHit("shugiin", f"{base}{num}.jpg/$File/{num}.jpg", link,
			"衆議院ウェブサイト利用規約（出典明記で利用可）", "衆議院")
	m = SANGIIN_PROFILE.match(link)
	if m:
		base, num = m.groups()
		return ImageHit("sangiin", f"{base}photo/g{num}.jpg", link,
			"参議院ウェブサイト（出典明記で利用可）", "参議院")
	return None


# --- Wikimedia ---

def _claim_ids(entity: dict, prop: str) -> List[str]:
	out = []
	for c in entity.get("claims", {}).get(prop, []):
		v = c.get("mainsnak", {}).get("datavalue", {}).get("value")
		if isinstance(v, dict) and v.get("id"):
			out.append(v["id"])
		elif isinstance(v, str):
			out.append(v)
	return out


def is_diet_politician(entity: dict) -> bool:
	if Q_HUMAN not in _claim_ids(entity, "P31"):
		return False
	if DIET_SEATS & set(_claim_ids(entity, "P39")):
		return True
	if Q_POLITICIAN in _claim_ids(entity, "P106"):
		return True
	desc = entity.get("descriptions", {}).get("ja", {}).get("value", "")
	return "政治家" in desc or "議員" in desc


def pick_entity(entities: List[dict]) -> Optional[dict]:
	"""The first candidate that is a Diet politician; seat holders beat description-only matches."""
	seated = [e for e in entities if DIET_SEATS & set(_claim_ids(e, "P39")) and Q_HUMAN in _claim_ids(e, "P31")]
	if seated:
		return seated[0]
	for e in entities:
		if is_diet_politician(e):
			return e
	return None


def find_entity(f: Fetcher, name_kanji: str) -> Optional[dict]:
	hits = f.json(WIKIDATA_API, {"action": "wbsearchentities", "search": name_kanji, "language": "ja", "limit": 7}).get("search", [])
	ids = [h["id"] for h in hits]
	if not ids:
		return None
	ents = f.json(WIKIDATA_API, {"action": "wbgetentities", "ids": "|".join(ids), "props": "claims|descriptions|sitelinks|labels",
		"languages": "ja", "sitefilter": "jawiki"}).get("entities", {})
	return pick_entity([ents[i] for i in ids if i in ents])


def commons_file_for(f: Fetcher, entity: dict) -> Optional[str]:
	"""Commons file name (without 'File:') from P18, else the Japanese Wikipedia page image."""
	p18 = _claim_ids(entity, "P18")
	if p18:
		return p18[0]
	title = entity.get("sitelinks", {}).get("jawiki", {}).get("title")
	if not title:
		return None
	pages = f.json(JAWIKI_API, {"action": "query", "titles": title, "prop": "pageimages", "piprop": "name|original"}).get("query", {}).get("pages", {})
	for p in pages.values():
		if p.get("pageimage") and "commons" in (p.get("original", {}).get("source", "") or "upload.wikimedia.org/wikipedia/commons"):
			return p["pageimage"]
	return None


def _plain(html: str) -> str:
	return re.sub(r"<[^>]+>", "", html or "").strip()


def commons_image(f: Fetcher, file_name: str, source_url: str) -> Optional[ImageHit]:
	d = f.json(COMMONS_API, {"action": "query", "titles": f"File:{file_name}", "prop": "imageinfo",
		"iiprop": "url|extmetadata|size|mime", "iiurlwidth": THUMB_WIDTH})
	for p in d.get("query", {}).get("pages", {}).values():
		info = (p.get("imageinfo") or [None])[0]
		if not info:
			continue
		em = info.get("extmetadata", {})
		val = lambda k: _plain(em.get(k, {}).get("value", ""))
		if not (info.get("mime") or "").startswith("image/"):
			return None
		return ImageHit("wikimedia", info.get("thumburl") or info["url"], f"https://commons.wikimedia.org/wiki/File:{quote(file_name)}",
			val("LicenseShortName") or val("License") or "unknown", val("Artist"), val("Credit"),
			{"source_page": source_url, "usage_terms": val("UsageTerms"), "attribution_required": val("AttributionRequired"),
			"original_url": info.get("url", "")})
	return None


def wikimedia_photo(f: Fetcher, name_kanji: str) -> Optional[ImageHit]:
	entity = find_entity(f, name_kanji)
	if not entity:
		return None
	title = entity.get("sitelinks", {}).get("jawiki", {}).get("title")
	page_url = f"https://ja.wikipedia.org/wiki/{quote(title)}" if title else f"https://www.wikidata.org/wiki/{entity['id']}"
	file_name = commons_file_for(f, entity)
	if not file_name:
		return None
	hit = commons_image(f, file_name, page_url)
	if hit:
		hit.extra["wikidata"] = entity["id"]
	return hit
