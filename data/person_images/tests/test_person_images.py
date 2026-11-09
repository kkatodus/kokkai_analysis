import io
import json
import tempfile
import unittest
from pathlib import Path

from person_images.job import Index, Person, run, to_jpeg
from person_images.sources import ImageHit, house_photo, pick_entity


def entity(qid, p31=("Q5",), p39=(), p106=(), desc=""):
	claims = {}
	for prop, ids in (("P31", p31), ("P39", p39), ("P106", p106)):
		claims[prop] = [{"mainsnak": {"datavalue": {"value": {"id": i}}}} for i in ids]
	return {"id": qid, "claims": claims, "descriptions": {"ja": {"value": desc}} if desc else {}}


class SourcesTest(unittest.TestCase):
	def test_house_photo_urls(self):
		h = house_photo("https://www.shugiin.go.jp/internet/itdb_giinprof.nsf/html/profile/001.html")
		self.assertEqual((h.source, h.image_url), ("shugiin", "https://www.shugiin.go.jp/internet/itdb_giinprof.nsf/html/profile/001.jpg/$File/001.jpg"))
		h = house_photo("https://www.sangiin.go.jp/japanese/joho1/kousei/giin/profile/7007006.htm")
		self.assertEqual((h.source, h.image_url), ("sangiin", "https://www.sangiin.go.jp/japanese/joho1/kousei/giin/photo/g7007006.jpg"))
		self.assertIsNone(house_photo(None))
		self.assertIsNone(house_photo("https://example.com/x.html"))

	def test_pick_entity_prefers_seat_holder(self):
		writer = entity("Q1", p106=("Q36180",), desc="日本の小説家")
		talker = entity("Q2", desc="日本の政治家")
		seated = entity("Q3", p39=("Q17506823",))
		self.assertEqual(pick_entity([writer, talker, seated])["id"], "Q3")
		self.assertEqual(pick_entity([writer, talker])["id"], "Q2")
		self.assertIsNone(pick_entity([writer, entity("Q4", p31=("Q4167410",), p39=("Q17506823",))]))


class FakeFetcher:
	"""Serves one PNG for shugiin URLs and 404s for everything else."""

	def __init__(self):
		from PIL import Image
		buf = io.BytesIO()
		Image.new("RGB", (900, 1200), "red").save(buf, "PNG")
		self.png = buf.getvalue()
		self.urls = []

	def get(self, url, params=None, timeout=60):
		from person_images.sources import NotFound
		self.urls.append(url)
		if "shugiin" in url:
			return type("R", (), {"content": self.png})()
		raise NotFound(url)

	def json(self, url, params):
		return {"search": []}   # no Wikidata candidates


class JobTest(unittest.TestCase):
	def test_to_jpeg_resizes(self):
		f = FakeFetcher()
		jpeg, w, h = to_jpeg(f.png)
		self.assertEqual((w, h), (384, 512))
		self.assertTrue(jpeg.startswith(b"\xff\xd8"))

	def test_run_is_resumable_and_keeps_old_pictures(self):
		with tempfile.TemporaryDirectory() as d:
			out = Path(d) / "person_images"
			index = Index(out / "index.json")
			persons = [Person(1, "逢沢一郎", None, "https://www.shugiin.go.jp/internet/itdb_giinprof.nsf/html/profile/001.html"),
				Person(2, "左藤恵", None, None)]
			f = FakeFetcher()
			stats = run(persons, out, index, fetcher=f)
			self.assertEqual((stats["found"], stats["none"]), (1, 1))
			self.assertTrue((out / "1.jpg").exists())
			self.assertEqual(index.get(1)["source"], "shugiin")
			self.assertEqual(index.get(2)["status"], "none")
			self.assertEqual(index.dirty, ["person_images/1.jpg"])
			# second run: nothing to do
			self.assertEqual(run(persons, out, Index(out / "index.json"), fetcher=f)["done"], 0)
			# refresh with the source gone keeps the earlier picture
			f2 = FakeFetcher()
			f2.get = lambda url, params=None, timeout=60: (_ for _ in ()).throw(__import__("person_images.sources", fromlist=["NotFound"]).NotFound(url))
			idx = Index(out / "index.json")
			run(persons, out, idx, refresh=True, fetcher=f2)
			self.assertEqual(idx.get(1)["source"], "shugiin")
			saved = json.loads((out / "index.json").read_text())
			self.assertIn("1", saved["persons"])


if __name__ == "__main__":
	unittest.main()
