"""Paths and the pinned data version shared by the data scripts."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "packages" / "data"
BUILD = DATA / "build"
BUNDLE_DIR = BUILD / "bundle"
RAW = BUILD / "raw"
LANGS = ("ckb", "kmr")


def read_version() -> dict[str, str]:
    lines = (DATA / "VERSION").read_text(encoding="utf-8").splitlines()
    return dict(line.split("=", 1) for line in lines if line.strip())
