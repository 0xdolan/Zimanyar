"""Copy zimankit's data tables into TypeScript, so that only logic is ported by hand.

Many of these tables hold invisible or look-alike characters (ZWNJ, bidi marks, Arabic letters
that differ by a dot), where one slip while retyping would be nearly impossible to see. Every
non-ASCII character is written as an escape, so formatters and editors cannot change it. CI
regenerates this file and fails if it differs from what is committed.

    uv run scripts/data/export_core_tables.py
"""

from __future__ import annotations

import json
import re
import sys
from importlib import resources

from common import ROOT
from zimankit import __version__
from zimankit.shared_utils import (
    lid,
    normalizer,
    phonology_core,
    text_helpers,
    tokenizer,
    unicode_tables,
)
from zimankit.skills_ckb import morphology as ckb_morphology
from zimankit.skills_ckb import orthography as ckb_orthography
from zimankit.skills_ckb import phonology_ipa as ckb_phonology
from zimankit.skills_ckb import verbs as ckb_verbs
from zimankit.skills_kmr import morphology as kmr_morphology
from zimankit.skills_kmr import orthography as kmr_orthography
from zimankit.skills_kmr import phonology_ipa as kmr_phonology
from zimankit.skills_kmr import syntax as kmr_syntax
from zimankit.skills_kmr import translit as kmr_translit
from zimankit.skills_kmr import verbs as kmr_verbs

TARGET = ROOT / "packages" / "core" / "src" / "generated" / "tables.ts"
TABLES = {
    unicode_tables: [
        "ARABIC_DIACRITICS", "ARABIC_INDIC_DIGITS", "ARABIC_ONLY_LETTERS", "BIDI_CONTROLS",
        "CKB_ALPHABET", "CKB_CHAR_MAP", "CKB_CONSONANT_LETTERS", "CKB_LETTERS", "CKB_SEMIVOWELS",
        "CKB_SEQUENCE_MAP", "CKB_VOWEL_LETTERS", "KMR_ALPHABET", "KMR_CHAR_MAP", "KMR_EXTENDED_LETTERS",
        "KMR_FOREIGN_LETTERS", "KMR_LETTERS", "KMR_VOWELS", "LATIN_DIGITS", "MICRO_SPACES", "PERSIAN_DIGITS",
        "TATWEEL", "WIDE_SPACES", "ZWJ", "ZWNJ",
    ],
    text_helpers: ["CKB_LETTER_CLASS", "KMR_LETTER_CLASS", "PATTERNS"],
    lid: ["ARABIC_SCRIPT_PROFILES", "LATIN_SCRIPT_PROFILES"],
    phonology_core: ["FRICATIVES", "GLIDES", "LIQUIDS", "NASALS", "SIBILANTS", "STOPS"],
}  # fmt: skip
# The same, where two varieties use one name: exported as CKB_<name without leading underscore>.
PREFIXED = {
    "CKB": {
        ckb_orthography: ["VARIANT_SWAPS", "_ILLEGAL_SEQUENCES"],
        ckb_phonology: ["CONSONANTS", "IPA_TO_LATIN", "LATIN_STYLES", "VOWELS"],
        ckb_morphology: ["CLITICS", "PERSONS", "POS_PRIORITY", "PROCLITICS"],
        ckb_verbs: ["CLITIC_SUBJECT_PRESENT", "IRREGULAR", "PASSIVE_STEM", "PREVERBS", "SET2", "VOWEL_END"],
    },
    "KMR": {
        kmr_morphology: ["DECLENSION", "DERIVATIONS", "INFLECTIONS", "POS_PRIORITY"],
        kmr_verbs: ["NI_NEGATION", "PERSONS", "PREVERBS"],
        kmr_syntax: ["DIRECT_PRONOUNS", "OBLIQUE_PRONOUNS", "PRONOUN_PERSON"],
    },
    "KMR_PHON": {kmr_phonology: ["ASPIRABLE", "CONSONANTS", "VOWELS"]},
    "KMR_TRANSLIT": {kmr_translit: ["MAP"]},
}
PREFIXED_REGEXES = {
    "KMR": {kmr_orthography: ["_APOS_EDGE_RE", "_VALID_RE"]},
    "CKB": {
        ckb_orthography: [
            "_INITIAL_R_RE", "_INITIAL_VOWEL_RE", "_LEGACY_FINAL_HEH_RE", "_LEGACY_HEH_ZWNJ_RE", "_SEQ_RE",
            "_VALID_RE",
        ],
    },
}  # fmt: skip
DATA_FILES = ["ckb_function_words", "ckb_verbs_core", "kmr_function_words", "kmr_verbs_core"]
# Compiled regexes, as Python source. packages/core/src/python.ts translates the syntax.
REGEXES = {
    normalizer: [
        "BLANK_LINES_RE", "EMAIL_RE", "EMOJI_RE", "HSPACE_RE", "MENTION_RE", "URL_RE",
        "_ZWNJ_AFTER_NONJOINING_RE", "_ZWNJ_EDGE_RE", "_ZWNJ_RUN_RE",
    ],
    tokenizer: ["HYPHEN_WORD_RE", "SENTENCE_END_RE", "TOKEN_RE", "WORD_RE"],
}  # fmt: skip


def plain(value: object) -> object:
    """Sets become sorted lists; everything else keeps its order."""
    if isinstance(value, set | frozenset):
        return sorted(plain(item) for item in value)
    if isinstance(value, tuple | list):
        return [plain(item) for item in value]
    if isinstance(value, dict):
        # A tuple key, such as (tense, person), becomes "tense|person".
        return {
            ("|".join(key) if isinstance(key, tuple) else key): plain(item) for key, item in value.items()
        }
    return value


def affix(item: ckb_morphology.Affix) -> dict:
    return {
        "form": item.form,
        "tag": item.tag,
        "features": dict(item.features),
        "after": item.after,
        "posHint": item.pos_hint,
    }


def char_script_runs() -> list[list]:
    """zimankit reads Unicode character names, which JavaScript cannot, so its answers are copied."""
    runs: list[list] = []
    for code in range(0x110000):
        script = text_helpers.char_script(chr(code))
        if script in ("other", "joiner"):
            continue
        if runs and runs[-1][1] == code - 1 and runs[-1][2] == script:
            runs[-1][1] = code
        else:
            runs.append([code, code, script])
    return runs


def render() -> str:
    lines = [
        f"// Generated by scripts/data/export_core_tables.py from zimankit {__version__}. Do not edit.",
        "",
    ]
    for module, names in TABLES.items():
        for name in names:
            text = json.dumps(plain(getattr(module, name)), ensure_ascii=True)
            lines.append(f"export const {name} = {text};")
    for module, names in REGEXES.items():
        for name in names:
            pattern = getattr(module, name)
            flags = "i" if pattern.flags & re.IGNORECASE else ""
            lines.append(f"export const {name.lstrip('_')} = {json.dumps([pattern.pattern, flags])};")
    for prefix, modules in PREFIXED.items():
        for module, names in modules.items():
            for name in names:
                text = json.dumps(plain(getattr(module, name)), ensure_ascii=True)
                lines.append(f"export const {prefix}_{name.lstrip('_')} = {text};")
    for prefix, modules in PREFIXED_REGEXES.items():
        for module, names in modules.items():
            for name in names:
                source = json.dumps([getattr(module, name).pattern, ""])
                lines.append(f"export const {prefix}_{name.lstrip('_')} = {source};")
    pairs = [[pattern.pattern, rep] for pattern, rep in ckb_orthography._INITIAL_ALEF_HAMZA]
    lines.append(f"export const CKB_INITIAL_ALEF_HAMZA = {json.dumps(pairs)};")
    pairs = [[pattern.pattern, rep] for pattern, rep in ckb_orthography._SQUEEZE]
    lines.append(f"export const CKB_SQUEEZE = {json.dumps(pairs)};")
    slots = [[name, [affix(item) for item in items]] for name, items in ckb_morphology.SLOTS]
    lines.append(f"export const CKB_SLOTS = {json.dumps(slots)};")
    for name in DATA_FILES:
        text = (resources.files("zimankit.data") / f"{name}.tsv").read_text(encoding="utf-8")
        lines.append(f"export const {name.upper()}_TSV = {json.dumps(text)};")
    lines.append(f"export const CHAR_SCRIPT_RUNS = {json.dumps(char_script_runs())};")
    features = {
        lang: [[pattern.pattern, weight] for pattern, weight in rows]
        for lang, rows in lid.REGEX_FEATURES.items()
    }
    lines.append(f"export const LID_REGEX_FEATURES = {json.dumps(features)};")
    return "\n".join(lines) + "\n"


def main() -> int:
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    TARGET.write_text(render(), encoding="utf-8", newline="\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
