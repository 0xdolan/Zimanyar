"""Turn the bundle's Parquet tables into the small TSV files the TypeScript builder reads.

Only the columns the checker uses are kept. The words and lemmas are written sorted, so the
same bundle always gives the same files. The grammar rules, the licence notice, and zimankit's
function word and core verb tables are copied beside the package, where they are committed.

    uv run scripts/data/export_lexicon.py
"""

from __future__ import annotations

import csv
import json
import shutil
import sys
from importlib import resources
from pathlib import Path

import pyarrow.parquet as pq
from common import BUNDLE_DIR, DATA, LANGS, RAW, read_version

FEATURE_COLUMNS = (
    "gender", "number", "case", "definiteness", "ezafe", "person", "enclitic", "agent", "agreement",
    "tense", "aspect", "mood", "voice", "polarity", "transitivity", "alignment", "verb_form", "derivation",
    "degree", "postposition", "additive", "demonstrative", "pron_type", "num_type", "adp_type", "deixis",
    "other_features",
)  # fmt: skip
LEMMA_COLUMNS = (
    "lemma",
    "upos",
    "gender",
    "transitivity",
    "present_stem",
    "past_stem",
    "variant_of",
    "see_also",
)


def clean(value: object) -> str:
    text = "" if value is None else str(value)
    # The lemma table writes an em dash for "this verb has no such stem".
    if text == "\u2014":
        return ""
    if "\t" in text or "\n" in text:
        raise ValueError(f"a tab or newline inside a value: {text!r}")
    return text


def features_of(row: dict) -> str:
    # Absent and false features are left out: most forms share a small number of feature sets.
    present = {column: row[column] for column in FEATURE_COLUMNS if row[column] not in (None, False, "")}
    return json.dumps(present, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def write_tsv(path: Path, rows: list[list[str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    rows.sort(key=lambda row: row[0])
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        for row in rows:
            fh.write("\t".join(row) + "\n")


def export_language(bundle: Path, lang: str) -> None:
    columns = ["word", "lemma", "upos", "attested", "zipf", "quality_tier", *FEATURE_COLUMNS]
    words = pq.read_table(bundle / f"kurdish_words_{lang}.parquet", columns=columns).to_pylist()
    forms = [
        [clean(r["word"]), clean(r["lemma"]), clean(r["upos"]), features_of(r), "1" if r["attested"] else "0",
         clean(r["zipf"]), clean(r["quality_tier"])]
        for r in words
    ]  # fmt: skip
    write_tsv(RAW / lang / "forms.tsv", forms)
    lemmas = pq.read_table(
        bundle / f"kurdish_lemmas_{lang}.parquet", columns=[*LEMMA_COLUMNS, "zipf"]
    ).to_pylist()
    write_tsv(RAW / lang / "lemmas.tsv", [[clean(r[c]) for c in (*LEMMA_COLUMNS, "zipf")] for r in lemmas])
    variants: list[list[str]] = []
    table = bundle / f"kurdish_spelling_variants_{lang}.csv"
    if table.exists():
        with open(table, encoding="utf-8", newline="") as fh:
            variants = [[clean(r["variant"]), clean(r["standard"])] for r in csv.DictReader(fh)]
    write_tsv(RAW / lang / "variants.tsv", variants)
    print(f"{lang}: {len(forms)} forms, {len(lemmas)} lemmas, {len(variants)} variants", file=sys.stderr)


def main() -> int:
    version = read_version()
    bundle = BUNDLE_DIR / version["bundle"].removesuffix(".tar.zst")
    for lang in LANGS:
        export_language(bundle, lang)
        shutil.copyfile(bundle / f"grammar_rules_{lang}.json", DATA / "rules" / f"grammar_rules_{lang}.json")
        for table in ("function_words", "verbs_core"):
            source = resources.files("zimankit.data") / f"{lang}_{table}.tsv"
            (DATA / "tables" / f"{lang}_{table}.tsv").write_bytes(source.read_bytes())
    shutil.copyfile(bundle / "NOTICE", DATA / "NOTICE")
    return 0


if __name__ == "__main__":
    sys.exit(main())
