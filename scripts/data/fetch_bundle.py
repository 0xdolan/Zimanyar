"""Download the pinned zimankit lexicon bundle and verify it.

The SHA-256 in packages/data/VERSION is checked before anything is unpacked, and every
unpacked file against the bundle's manifest. A wrong checksum stops the build.

    uv run scripts/data/fetch_bundle.py
"""

from __future__ import annotations

import hashlib
import json
import shutil
import sys
import tarfile
import urllib.request
from pathlib import Path

import zstandard
from common import BUILD, BUNDLE_DIR, read_version

RELEASE_URL = "https://github.com/0xdolan/zimankit/releases/download/v{version}/{name}"
# The largest size a bundle may unpack to, so a damaged or hostile file cannot fill the disk.
MAX_UNPACKED_BYTES = 512 * 1024 * 1024


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def download(url: str, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    partial = target.with_suffix(target.suffix + ".part")
    # The URL is built from a constant https prefix and the pinned VERSION file.
    with urllib.request.urlopen(url) as response, open(partial, "wb") as out:  # noqa: S310
        shutil.copyfileobj(response, out)
    partial.replace(target)


def unpack(archive: Path, target: Path) -> None:
    if target.exists():
        shutil.rmtree(target)
    target.mkdir(parents=True)
    with open(archive, "rb") as raw:
        reader = zstandard.ZstdDecompressor().stream_reader(raw)
        with tarfile.open(fileobj=reader, mode="r|") as tar:
            total = 0
            for member in tar:
                total += member.size
                if total > MAX_UNPACKED_BYTES:
                    raise ValueError("the bundle unpacks to more than the allowed size")
                # The data filter refuses absolute paths, links and anything outside the target.
                tar.extract(member, target, filter="data")


def verify_manifest(root: Path, zimankit_version: str) -> None:
    manifest = json.loads((root / "MANIFEST.json").read_text(encoding="utf-8"))
    if manifest["zimankit_version"] != zimankit_version:
        raise ValueError(f"bundle is for zimankit {manifest['zimankit_version']}, not {zimankit_version}")
    for name, entry in manifest["files"].items():
        path = root / name
        if path.stat().st_size != entry["size"] or sha256_of(path) != entry["sha256"]:
            raise ValueError(f"{name} does not match the bundle manifest")


def main() -> int:
    version = read_version()
    name, expected = version["bundle"], version["sha256"]
    archive = BUILD / "download" / name
    if not archive.exists() or sha256_of(archive) != expected:
        url = RELEASE_URL.format(version=version["zimankit"], name=name)
        print(f"downloading {url}", file=sys.stderr)
        download(url, archive)
    actual = sha256_of(archive)
    if actual != expected:
        archive.unlink()
        print(f"checksum mismatch for {name}: expected {expected}, got {actual}", file=sys.stderr)
        return 1
    unpack(archive, BUNDLE_DIR)
    root = BUNDLE_DIR / name.removesuffix(".tar.zst")
    verify_manifest(root, version["zimankit"])
    print(f"verified {name} ({expected})", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
