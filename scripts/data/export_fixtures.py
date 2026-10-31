"""Export input and output pairs from zimankit, to prove the TypeScript port behaves the same.

The full fixtures go to packages/data/build/fixtures/ and a small sample of each is committed
to packages/data/fixtures/, so the parity tests run without a download. Everything is seeded and
sorted, so the same zimankit and the same bundle give the same files.

The corpus behind zimankit is private, so sentences here are built from the public lexicon.

    uv run scripts/data/export_fixtures.py
"""

# Seeded generators make the fixtures reproducible; nothing here is cryptographic.
# ruff: noqa: S311
from __future__ import annotations

import json
import random
import sys
from collections.abc import Callable, Iterable
from dataclasses import asdict

import pyarrow.parquet as pq
import zimankit
from common import BUILD, BUNDLE_DIR, DATA, read_version
from zimankit.shared_utils import lid, normalizer, text_helpers, tokenizer
from zimankit.shared_utils.schema import SimpleLexicon
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

SEED = 20261031
SAMPLE_LINES = 150
SAMPLE_BYTES = 100_000
SIZES = {
    "normalize": 45_000,
    "corrupted": 5_000,
    "phonology": 20_000,
    "lexicon_verbs": 500,
    "nouns": 2_000,
    "analyze": 30_000,
    "alignment": 2_000,
    "lid": 5_000,
    "text": 2_000,
}
# Letters that writers really confuse, from the rule catalogue.
CKB_CORRUPTIONS = "كيىةھۀهرلویڕڵێۆ‌"
KMR_CORRUPTIONS = "ıİğöüéèëíìúùēīūșščÉÎŞ'’"  # noqa: RUF001
# Short samples of the languages that must be recognised and left alone.
OTHER_LANGUAGE_SAMPLES = {
    "fas": "این کتاب را من دیروز خریدم و خیلی خوب است که می‌خواهم آن را بخوانم",
    "arb": "ذهب الولد إلى المدرسة في الصباح وكان الطقس جميلا جدا في ذلك اليوم",
    "tur": "Bugün hava çok güzel ve çocuklar okuldan sonra parkta oynamak istiyorlar",
    "eng": "The children went to school this morning and the weather was very nice",
    "zza": "Ez nika şina keye. Ti koti ra yena? Mi va ke to rê kitab biyaro",
    "hac": "من مەشوو پەی کارێ وێم و ئەو ئامانێ پەی لای ئێمە نیشتەنێ",
}


def write(name: str, records: Iterable[dict]) -> int:
    """Write the whole fixture to the build folder and an even sample of it to the package."""
    rows = [json.dumps(r, ensure_ascii=False, sort_keys=True, separators=(",", ":")) for r in records]
    full = BUILD / "fixtures" / f"{name}.jsonl"
    full.parent.mkdir(parents=True, exist_ok=True)
    full.write_text("".join(f"{r}\n" for r in rows), encoding="utf-8")
    # Some lines are whole verb paradigms, so the sample is limited in bytes as well as lines.
    average = max(1, sum(len(r.encode("utf-8")) for r in rows) // max(1, len(rows)))
    wanted = max(1, min(SAMPLE_LINES, SAMPLE_BYTES // average))
    sample = rows[:: max(1, len(rows) // wanted)][:wanted]
    (DATA / "fixtures" / f"{name}.jsonl").write_text("".join(f"{r}\n" for r in sample), encoding="utf-8")
    print(f"{name}: {len(rows)} lines", file=sys.stderr)
    return len(rows)


def rounded(value: float) -> float:
    # Scores are compared to six places: exact floats differ between languages for no real reason.
    return round(value, 6)


def public_lexicon(rows: list[dict]) -> SimpleLexicon:
    """zimankit's own in-memory lexicon, filled from the published lemma table."""
    entries = {r["lemma"]: {"pos": {r["upos"]}, "gender": r["gender"]} for r in rows}
    return SimpleLexicon(entries, {r["lemma"]: r["frequency"] or 0 for r in rows})


def corrupt(rng: random.Random, word: str, letters: str) -> str:
    position = rng.randrange(len(word))
    match rng.randrange(4):
        case 0:
            return word[:position] + rng.choice(letters) + word[position + 1 :]
        case 1:
            return word[:position] + rng.choice(letters) + word[position:]
        case 2:
            return word[:position] + word[position + 1 :]
        case _:
            return word[:position] + word[position] * 2 + word[position + 1 :]


def analysis(a) -> dict:
    return {
        "surface": a.surface,
        "lemma": a.lemma,
        "pos": a.pos,
        "features": a.features,
        "segments": [list(segment) for segment in a.segments],
        "score": rounded(a.score),
    }


def verb_record(verb, conjugate: Callable) -> dict:
    return {
        "verb": asdict(verb),
        "forms": [[f.form, f.lemma, f.features] for f in conjugate(verb)],
    }


def export_ckb(words: list[dict], lemmas: list[dict], rng: random.Random) -> None:
    frequent = [r["word"] for r in words]
    inputs = frequent[: SIZES["normalize"]]
    corrupted = [corrupt(rng, w, CKB_CORRUPTIONS) for w in rng.sample(frequent, SIZES["corrupted"])]
    write(
        "ckb_orthography",
        (
            {
                "input": w,
                "normalize": ckb_orthography.normalize(w),
                "normalize_word": ckb_orthography.normalize_word(w),
                "validate_word": ckb_orthography.validate_word(w),
                "is_legacy_encoded": ckb_orthography.is_legacy_encoded(w),
                "spelling_variants": ckb_orthography.spelling_variants(w),
            }
            for w in [*inputs, *corrupted]
        ),
    )
    write(
        "ckb_phonology",
        (
            {
                "input": w,
                "ipa": ckb_phonology.to_ipa(w),
                "syllables": ckb_phonology.syllables(w),
                "latin": ckb_phonology.to_latin(w),
                "segments": [list(s) for s in ckb_phonology.segments(w)],
            }
            for w in frequent[: SIZES["phonology"]]
        ),
    )
    core = ckb_verbs.load_core_verbs()
    known = {v.infinitive: v for v in core}
    verbs = [r for r in lemmas if r["upos"] == "VERB" and r["lemma"] not in known]
    made = (
        ckb_verbs.make_verb(r["lemma"], r["transitivity"] == "transitive", r["present_stem"], known=known)
        for r in verbs[: SIZES["lexicon_verbs"]]
    )
    write("ckb_verbs", (verb_record(v, ckb_verbs.conjugate) for v in [*core, *(m for m in made if m)]))
    nouns = [r["lemma"] for r in lemmas if r["upos"] == "NOUN"][: SIZES["nouns"]]
    write("ckb_decline", ({"stem": n, "forms": [list(f) for f in ckb_morphology.decline(n)]} for n in nouns))
    analyzer = ckb_morphology.CkbAnalyzer(public_lexicon(lemmas))
    write(
        "ckb_analyze",
        (
            {"input": w, "readings": [analysis(a) for a in analyzer.analyze(w)[:3]]}
            for w in frequent[: SIZES["analyze"]]
        ),
    )


def export_kmr(words: list[dict], lemmas: list[dict], rng: random.Random) -> None:
    frequent = [r["word"] for r in words]
    inputs = frequent[: SIZES["normalize"]]
    corrupted = [corrupt(rng, w, KMR_CORRUPTIONS) for w in rng.sample(frequent, SIZES["corrupted"])]
    write(
        "kmr_orthography",
        (
            {
                "input": w,
                "lower": kmr_orthography.lower(w),
                "upper": kmr_orthography.upper(w),
                "normalize": kmr_orthography.normalize(w),
                "normalize_word": kmr_orthography.normalize_word(w),
                "validate_word": kmr_orthography.validate_word(w),
            }
            for w in [*inputs, *corrupted]
        ),
    )
    narrow = kmr_phonology.KmrG2POptions(narrow=True)
    write(
        "kmr_phonology",
        (
            {
                "input": w,
                "ipa": kmr_phonology.to_ipa(w),
                "ipa_narrow": kmr_phonology.to_ipa(w, narrow),
                "syllables": kmr_phonology.syllables(w),
                "arabic": kmr_translit.to_arabic(w),
                "segments": [list(s) for s in kmr_phonology.segments(w)],
            }
            for w in frequent[: SIZES["phonology"]]
        ),
    )
    core = kmr_verbs.load_core_verbs()
    known = {v.infinitive: v for v in core}
    verbs = [r for r in lemmas if r["upos"] == "VERB" and r["lemma"] not in known]
    made = (
        kmr_verbs.make_verb(r["lemma"], r["transitivity"] == "transitive", r["present_stem"], known=known)
        for r in verbs[: SIZES["lexicon_verbs"]]
    )
    write("kmr_verbs", (verb_record(v, kmr_verbs.conjugate) for v in [*core, *(m for m in made if m)]))
    nouns = [r for r in lemmas if r["upos"] == "NOUN" and r["gender"] in ("f", "m")][: SIZES["nouns"]]
    write(
        "kmr_decline",
        (
            {
                "stem": n["lemma"],
                "gender": n["gender"],
                "forms": [list(f) for f in kmr_morphology.decline(n["lemma"], n["gender"])],
            }
            for n in nouns
        ),
    )
    analyzer = kmr_morphology.KmrAnalyzer(public_lexicon(lemmas))
    write(
        "kmr_analyze",
        (
            {"input": w, "readings": [analysis(a) for a in analyzer.analyze(w)[:3]]}
            for w in frequent[: SIZES["analyze"]]
        ),
    )
    export_alignment(core, lemmas, analyzer, rng)


def export_alignment(core: list, lemmas: list[dict], analyzer, rng: random.Random) -> None:
    """Sentences of every shape the ergativity checker meets: right, wrong, and pro-drop."""
    direct = sorted(kmr_syntax.DIRECT_PRONOUNS)
    oblique = sorted(kmr_syntax.OBLIQUE_PRONOUNS)
    nouns = [r["lemma"] for r in lemmas if r["upos"] == "NOUN"][:200]
    sentences: list[str] = []
    forms = {v.infinitive: [f.form for f in kmr_verbs.conjugate(v)] for v in core}
    infinitives = sorted(forms)
    while len(sentences) < SIZES["alignment"]:
        verb = rng.choice(forms[rng.choice(infinitives)])
        subject = rng.choice(direct + oblique + nouns)
        shape = rng.randrange(3)
        if shape == 0:
            words = [verb]
        elif shape == 1:
            words = [subject, verb]
        else:
            words = [subject, rng.choice(direct + oblique + nouns), verb]
        sentences.append(" ".join(words).capitalize() + ".")
    write("kmr_alignment", (kmr_syntax.detect_alignment(s, analyzer).to_dict() for s in sentences))


def export_shared(ckb: list[str], kmr: list[str], rng: random.Random) -> None:
    def sentence(pool: list[str], low: int = 3, high: int = 14) -> str:
        return " ".join(rng.choice(pool) for _ in range(rng.randint(low, high)))

    texts = []
    punctuation = [
        ".",
        "!",
        "?",
        "؟",
        "،",
        ",",
        ":",
        " - ",
        " (",
        ") ",
        "\n",
        "\n\n",
        "  ",
        "‌",
        " 12 ",
        " ٣٤ ",
    ]
    for _ in range(SIZES["text"]):
        pool = rng.choice((ckb, kmr))
        texts.append(
            "".join(sentence(pool, 1, 5) + rng.choice(punctuation) for _ in range(rng.randint(1, 4)))
        )
    write(
        "shared_text",
        (
            {
                "input": t,
                "normalize_text": normalizer.normalize_text(t),
                "clean_zwnj": normalizer.clean_zwnj(t),
                "tokens": [[k.text, k.kind, k.start, k.end] for k in tokenizer.tokenize(t)],
                "tokens_hyphen": [
                    [k.text, k.kind, k.start, k.end] for k in tokenizer.tokenize(t, keep_hyphen=True)
                ],
                "words": list(tokenizer.words(t)),
                "sentences": tokenizer.sentences(t),
                "script": text_helpers.detect_script(t),
            }
            for t in texts
        ),
    )
    pairs = []
    for _ in range(SIZES["text"]):
        pool = rng.choice((ckb, kmr))
        word = rng.choice(pool)
        letters = CKB_CORRUPTIONS if pool is ckb else KMR_CORRUPTIONS
        pairs.append((word, corrupt(rng, word, letters)))
    write(
        "shared_distance",
        (
            {
                "a": a,
                "b": b,
                "levenshtein": text_helpers.levenshtein(a, b),
                "damerau": text_helpers.damerau_levenshtein(a, b),
                "weighted": rounded(text_helpers.weighted_distance(a, b)),
            }
            for a, b in pairs
        ),
    )
    paragraphs = []
    for _ in range(SIZES["lid"]):
        match rng.randrange(4):
            case 0:
                paragraphs.append(sentence(ckb))
            case 1:
                paragraphs.append(sentence(kmr))
            case 2:
                # A sentence in another language, cut at a random length.
                text = rng.choice(sorted(OTHER_LANGUAGE_SAMPLES.values())).split()
                paragraphs.append(" ".join(text[: rng.randint(2, len(text))]))
            case _:
                # Mixed text: the case the checker must be careful with.
                other = rng.choice(sorted(OTHER_LANGUAGE_SAMPLES.values())).split()
                paragraphs.append(
                    " ".join(rng.sample(other, min(3, len(other))))
                    + " "
                    + sentence(rng.choice((ckb, kmr)), 1, 4)
                )
    write("shared_lid", (lid_record(p) for p in paragraphs))


def lid_record(text: str) -> dict:
    result = lid.identify(text)
    return {
        "input": text,
        "lang": result.lang,
        "script": result.script,
        "confidence": rounded(result.confidence),
        "scores": {k: rounded(v) for k, v in sorted(result.scores.items())},
    }


def read_table(bundle, name: str, columns: list[str], key: str) -> list[dict]:
    rows = pq.read_table(bundle / name, columns=columns).to_pylist()
    return sorted(rows, key=lambda r: (-(r[key] or 0), r[columns[0]]))


def main() -> int:
    version = read_version()
    if zimankit.__version__ != version["zimankit"]:
        print(
            f"zimankit {zimankit.__version__} is installed, VERSION asks for {version['zimankit']}",
            file=sys.stderr,
        )
        return 1
    bundle = BUNDLE_DIR / version["bundle"].removesuffix(".tar.zst")
    word_columns = ["word", "frequency"]
    lemma_columns = ["lemma", "upos", "gender", "transitivity", "present_stem", "frequency"]
    tables = {}
    for lang in ("ckb", "kmr"):
        tables[lang] = (
            read_table(bundle, f"kurdish_words_{lang}.parquet", word_columns, "frequency"),
            read_table(bundle, f"kurdish_lemmas_{lang}.parquet", lemma_columns, "frequency"),
        )
    export_ckb(*tables["ckb"], random.Random(SEED))
    export_kmr(*tables["kmr"], random.Random(SEED + 1))
    export_shared(
        [r["word"] for r in tables["ckb"][0][:5000]],
        [r["word"] for r in tables["kmr"][0][:5000]],
        random.Random(SEED + 2),
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
