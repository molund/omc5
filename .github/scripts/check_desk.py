"""Check the Status Desk's commits on the desk branch before they land on main (see .github/workflows/desk.yml).

The branch must be main plus one or more commits, none of them a merge, each of which only changes status.yaml or adds or
replaces photos in public/images/sorry-im-a-shitty-photographer/. Every photo it touches must be a JPEG at most 800 pixels
wide, with no metadata (no EXIF, XMP or comment segments), under 1 MB. Run from the repo root with origin/main fetched.
Writes count=<number of commits> to $GITHUB_OUTPUT (0 when the branch is already main) and exits 1 on the first problem.
"""

import os
import re
import subprocess
import sys

BASE = "origin/main"
STATUS = "status.yaml"
PHOTO = re.compile(r"^public/images/sorry-im-a-shitty-photographer/[a-z0-9][a-z0-9._-]*\.jpg$")
MAX_WIDTH = 800
MAX_BYTES = 1_000_000


def git(*args):
    return subprocess.run(["git", *args], check=True, capture_output=True, text=True).stdout


def fail(msg):
    print(f"::error::{msg}", file=sys.stderr)
    sys.exit(1)


def jpeg_problem(data):
    """What's wrong with a photo, or None."""
    if len(data) > MAX_BYTES:
        return f"is {len(data):,} bytes (the most is {MAX_BYTES:,})"
    if data[:3] != b"\xff\xd8\xff":
        return "isn't a JPEG"
    i = 2
    while i + 4 <= len(data):
        if data[i] != 0xFF:
            return "isn't a readable JPEG"
        marker = data[i + 1]
        if marker == 0xFF:  # fill byte
            i += 1
            continue
        if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:  # no length
            i += 2
            continue
        length = int.from_bytes(data[i + 2 : i + 4], "big")
        if 0xE1 <= marker <= 0xEF or marker == 0xFE:  # APP1-APP15 (EXIF, XMP, ...) and comments
            return "has metadata in it (strip it before pushing)"
        if marker in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):  # start of frame
            width = int.from_bytes(data[i + 7 : i + 9], "big")
            if width > MAX_WIDTH:
                return f"is {width} pixels wide (the most is {MAX_WIDTH})"
        if marker == 0xDA:  # start of scan: the image data follows, and the checks are done
            return None
        i += 2 + length
    return "isn't a readable JPEG"


if subprocess.run(["git", "merge-base", "--is-ancestor", BASE, "HEAD"]).returncode != 0:
    fail("The desk branch isn't on top of main (main has moved on). Push the changes again from the desk.")

commits = git("rev-list", "--reverse", f"{BASE}..HEAD").split()
photos = set()
for sha in commits:
    subject = git("log", "-1", "--format=%h %s", sha).strip()
    if len(git("rev-list", "--parents", "-1", sha).split()) != 2:
        fail(f"{subject}: a merge commit; the desk makes one plain commit per change")
    for line in git("diff-tree", "--no-commit-id", "--name-status", "-r", sha).splitlines():
        status, path = line.split("\t", 1)
        if path == STATUS and status == "M":
            continue
        if PHOTO.match(path) and status in ("A", "M"):
            photos.add(path)
            continue
        fail(f"{subject}: changes {path} ({status}); the desk may only change {STATUS} and add photos")

for path in sorted(photos):
    data = subprocess.run(["git", "show", f"HEAD:{path}"], check=True, capture_output=True).stdout
    problem = jpeg_problem(data)
    if problem:
        fail(f"{path} {problem}")

print(f"{len(commits)} commit(s) from the desk, {len(photos)} photo(s): ok")
for sha in commits:
    print("  " + git("log", "-1", "--format=%h %an: %s", sha).strip())
if os.environ.get("GITHUB_OUTPUT"):
    with open(os.environ["GITHUB_OUTPUT"], "a") as out:
        out.write(f"count={len(commits)}\n")
