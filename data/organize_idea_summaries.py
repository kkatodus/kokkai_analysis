"""Flatten idea_summaries/ into a two-column table of (politician_id, summary).

Walks `data/idea_summaries/{person_id}/{Topic}/summary.json`, reads the
`summaries` array (multiple anonymized summaries per politician per topic), and
emits one row per summary. Because each politician has several summaries (and may
appear across multiple topics), `politician_id` is intentionally repeated.

Usage:
    python organize_idea_summaries.py
    python organize_idea_summaries.py --topic Defence
    python organize_idea_summaries.py --output table.tsv --delimiter tab
"""

from __future__ import annotations

import argparse
import csv
import json
import os
from typing import Iterator

from params.paths import DATA_DIR

IDEA_SUMMARIES_DIR = os.path.join(DATA_DIR, "idea_summaries")
SUMMARY_FILENAME = "summary.json"
DEFAULT_OUTPUT = os.path.join(IDEA_SUMMARIES_DIR, "idea_summaries_table.csv")
COLUMNS = ["politician_id", "summary"]
# Sentinel that replaces newlines within a summary so each row stays single-line.
# Downstream consumers should swap this back to "\n" after reading.
NEWLINE_PLACEHOLDER = "␤"


def iter_summary_rows(
    summaries_dir: str,
    topic_filter: str | None = None,
    newline_placeholder: str = NEWLINE_PLACEHOLDER,
) -> Iterator[dict[str, str]]:
    """Yield one {politician_id, summary} row per summary string on disk.

    Newlines inside each summary are replaced with ``newline_placeholder`` so
    every row stays on a single physical line.
    """
    for person_id in sorted(os.listdir(summaries_dir)):
        person_dir = os.path.join(summaries_dir, person_id)
        if not person_id.isdigit() or not os.path.isdir(person_dir):
            continue

        for topic_en in sorted(os.listdir(person_dir)):
            if topic_filter and topic_en != topic_filter:
                continue
            summary_path = os.path.join(person_dir, topic_en, SUMMARY_FILENAME)
            if not os.path.isfile(summary_path):
                continue

            with open(summary_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            for summary in data.get("summaries", []):
                summary = (summary or "").strip()
                if not summary:
                    continue
                summary = summary.replace("\r\n", "\n").replace(
                    "\n", newline_placeholder
                )
                yield {"politician_id": person_id, "summary": summary}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--summaries-dir",
        default=IDEA_SUMMARIES_DIR,
        help=f"Input directory (default: {IDEA_SUMMARIES_DIR})",
    )
    parser.add_argument(
        "--output",
        default=DEFAULT_OUTPUT,
        help=f"Output file path (default: {DEFAULT_OUTPUT})",
    )
    parser.add_argument(
        "--topic",
        default=None,
        help="Only include this English topic name (e.g. Defence). Default: all topics.",
    )
    parser.add_argument(
        "--delimiter",
        choices=["comma", "tab"],
        default="comma",
        help="Output delimiter (default: comma).",
    )
    parser.add_argument(
        "--newline-placeholder",
        default=NEWLINE_PLACEHOLDER,
        help=(
            "Character(s) that replace newlines within a summary "
            f"(default: {NEWLINE_PLACEHOLDER!r}). Swap back to '\\n' downstream."
        ),
    )
    args = parser.parse_args()

    delimiter = "\t" if args.delimiter == "tab" else ","
    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)

    row_count = 0
    with open(args.output, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=COLUMNS,
            delimiter=delimiter,
            quoting=csv.QUOTE_ALL,
        )
        writer.writeheader()
        for row in iter_summary_rows(
            args.summaries_dir,
            topic_filter=args.topic,
            newline_placeholder=args.newline_placeholder,
        ):
            writer.writerow(row)
            row_count += 1

    print(f"Wrote {row_count} summary rows to {args.output}")


if __name__ == "__main__":
    main()
