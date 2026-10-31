"""Give every status note in status.yaml its own GitHub Discussion, ready for giscus.

Each update's thread is created here, before anyone comments, so its body can show the update itself (the note, then the
photo and its caption, as on the Past updates page) instead of giscus's plain link. Threads are titled as the site asks giscus
for them, "Update 2026-10-31 09:30" (Yukon time), and carry giscus's hidden sha1 marker, so giscus finds them in strict mode.
A thread whose update has since been edited has its body brought up to date, and threads older than the newest 30 are
closed as outdated and locked. Needs GITHUB_TOKEN with discussions: write.
"""

import hashlib
import json
import os
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

REPO_ID = "R_kgDOVbOMWA"
CATEGORY_ID = "DIC_kwDOVbOMWM4DKF3d"  # "Past Updates page comments"
SITE = "https://molund.github.io/omc5/"
PHOTOS = SITE + "images/sorry-im-a-shitty-photographer/"
TZ = ZoneInfo("America/Whitehorse")


def unquote(v):
    if re.fullmatch(r'".*"', v):
        return json.loads(v)
    if re.fullmatch(r"'.*'", v):
        return v[1:-1].replace("''", "'")
    return v


def notes(path="status.yaml"):
    """The notes with text, as dicts of time, text, photo (file, caption) and minor updates [(time, text)], as
    src/lib/status.js reads them."""
    out, section, photo = [], None, None
    for line in open(path).read().split("\n"):
        # notes are two spaces in; minor updates, further in under "minor:", get no thread of their own
        m = re.match(r"^ {2}-\s+(\S+):\s+(.*?)\s*$", line)
        if m:
            out.append(
                {"time": datetime.fromisoformat(m.group(1)), "text": unquote(m.group(2)), "photo": None, "more": [], "minor": []}
            )
            section = photo = None
            continue
        # under "more:", a photo ("- photo:" with its file and caption under it) or a paragraph
        if section == "more" and re.match(r"^ {3,}-\s+photo:\s*$", line):
            photo = {"file": None, "caption": ""}
            if out:
                out[-1]["more"].append({"photo": photo})
            continue
        m = section == "more" and re.match(r"^ {3,}-\s+(.*?)\s*$", line)
        if m:
            if out and unquote(m.group(1)):
                out[-1]["more"].append({"text": unquote(m.group(1))})
            continue
        if re.match(r"^\s+(more|minor|photo):\s*$", line):
            section = line.strip()[:-1]
        # a minor update, further in under "minor:"
        m = re.match(r"^ {3,}-\s+(\S+):\s+(.*?)\s*$", line)
        if m:
            if out and unquote(m.group(2)):
                out[-1]["minor"].append((datetime.fromisoformat(m.group(1)), unquote(m.group(2))))
            continue
        if section == "photo" and re.match(r"^\s+photo:\s*$", line) and out:
            out[-1]["photo"] = photo = {"file": None, "caption": ""}
            continue
        m = re.match(r"^\s+(file|caption):\s*(.*?)\s*$", line)
        if m and photo is not None:
            photo[m.group(1)] = unquote(m.group(2))
    for n in out:
        if n["photo"] and not n["photo"]["file"]:
            n["photo"] = None
        n["more"] = [m for m in n["more"] if m.get("text") or (m.get("photo") or {}).get("file")]
        n["minor"].sort(key=lambda m: m[0], reverse=True)
    return [n for n in out if n["text"]]


def title(t):
    return "Update " + t.astimezone(TZ).strftime("%Y-%m-%d %H:%M")


def as_of(t):
    """As the site shows it: "9:30 a.m. on Oct 31, 2026" (Yukon time)."""
    t = t.astimezone(TZ)
    period = "a.m." if t.hour < 12 else "p.m."
    return f"{(t.hour % 12) or 12}:{t.minute:02d} {period} on {t.strftime('%b')} {t.day}, {t.year}"


def minor_time(t, note):
    """As the Past updates page shows it: "11:45 a.m." on the same day as its note, otherwise in full."""
    full = as_of(t)
    return full.split(" on ")[0] if t.astimezone(TZ).date() == note.astimezone(TZ).date() else full


def body(n):
    anchor = n["time"].astimezone(timezone.utc).strftime("%Y-%m-%dT%H-%M")
    # no date line: the thread's title already has it
    parts = [n["text"]]

    def photo(p):
        parts.append(f"![{p['caption'] or 'Photo for this update'}]({PHOTOS}{p['file']})")
        if p["caption"]:
            parts.append(f"_{p['caption']}_")

    if n["photo"]:
        photo(n["photo"])
    # then the further paragraphs and photos, in order
    for m in n["more"]:
        if "photo" in m:
            photo(m["photo"])
        else:
            parts.append(m["text"])
    if n["minor"]:
        # as on the Past updates page: a Follow-ups list, each time in code style
        parts.append("### Follow-ups")
        parts.append("\n".join(f"- `{minor_time(t, n['time'])}` {text}" for t, text in n["minor"]))
    parts.append(f"[See it on the Clayton Clipper Tracker]({SITE}updates/#{anchor})")
    # giscus's strict-mode marker: the sha1 of the title it asks for
    parts.append(f"<!-- sha1: {hashlib.sha1(title(n['time']).encode()).hexdigest()} -->")
    return "\n\n".join(parts)


def graphql(query, soft=False, **variables):
    req = urllib.request.Request(
        "https://api.github.com/graphql",
        data=json.dumps({"query": query, "variables": variables}).encode(),
        headers={"Authorization": f"bearer {os.environ['GITHUB_TOKEN']}", "Content-Type": "application/json"},
    )
    try:
        res = json.load(urllib.request.urlopen(req))
    except urllib.error.HTTPError as e:
        sys.exit(f"::error::GitHub said {e.code}: {e.read().decode()[:300]}")
    if res.get("errors"):
        if soft:
            print(f"::warning::{res['errors'][0].get('message')}")
            return None
        sys.exit(f"::error::{res['errors']}")
    return res["data"]


def existing():
    """Threads already in the category, by title: (id, body, closed, locked, createdAt)."""
    found, after = {}, None
    while True:
        d = graphql(
            """query($id: ID!, $cat: ID!, $after: String) { node(id: $id) { ... on Repository {
                 discussions(first: 100, after: $after, categoryId: $cat) {
                   nodes { id title body closed locked createdAt } pageInfo { hasNextPage endCursor } } } } }""",
            id=REPO_ID,
            cat=CATEGORY_ID,
            after=after,
        )["node"]["discussions"]
        for x in d["nodes"]:
            found.setdefault(x["title"], (x["id"], x["body"], x["closed"], x["locked"], x["createdAt"]))
        if not d["pageInfo"]["hasNextPage"]:
            return found
        after = d["pageInfo"]["endCursor"]


def check_count(limit=100):
    """Fail once the category reaches `limit` threads: the Past updates page reads only GitHub's first 100."""
    n = len(existing())
    print(f"{n} comment threads")
    if n >= limit:
        sys.exit(
            f"::error::{n} comment threads: the Past updates page only reads the first {limit} for comment and reaction "
            "counts (src/UpdatesPage.svelte). Time to decide how to handle more."
        )


def main():
    have = existing()
    for n in notes():
        t, b = title(n["time"]), body(n)
        if t not in have:
            graphql(
                """mutation($repo: ID!, $cat: ID!, $title: String!, $body: String!) {
                     createDiscussion(input: {repositoryId: $repo, categoryId: $cat, title: $title, body: $body}) {
                       discussion { id } } }""",
                repo=REPO_ID,
                cat=CATEGORY_ID,
                title=t,
                body=b,
            )
            print(f"created {t}")
        elif have[t][1].strip() != b.strip():
            # a thread giscus started (on a first comment, before this ran) can't be edited by the workflow: leave it
            done = graphql(
                """mutation($id: ID!, $body: String!) {
                     updateDiscussion(input: {discussionId: $id, body: $body}) { discussion { id } } }""",
                soft=True,
                id=have[t][0],
                body=b,
            )
            print(f"updated {t}" if done else f"left {t} as it is (not ours to edit)")
    close_old(keep=30)


def close_old(keep):
    """Close as outdated and lock every thread older than the newest `keep`, so the open threads are the recent updates'
    (the ones the Past updates page counts) and old threads can't collect spam. Newest by the update time in the title,
    else by when the thread was made."""
    have = existing()

    def when(t):
        m = re.fullmatch(r"Update (\d{4}-\d\d-\d\d \d\d:\d\d)", t)
        return m.group(1) if m else have[t][4][:16].replace("T", " ")

    for t in sorted(have, key=when, reverse=True)[keep:]:
        tid, _, closed, locked, _ = have[t]
        if not closed:
            graphql(
                """mutation($id: ID!) { closeDiscussion(input: {discussionId: $id, reason: OUTDATED}) { discussion { id } } }""",
                soft=True,
                id=tid,
            )
            print(f"closed {t} as outdated")
        if not locked:
            graphql(
                """mutation($id: ID!) { lockLockable(input: {lockableId: $id, lockReason: RESOLVED}) { lockedRecord { locked } } }""",
                soft=True,
                id=tid,
            )
            print(f"locked {t}")


def delete_all():
    """Delete every thread in the category, comments and all (used once, to remake them under Mike's name)."""
    for t, (tid, *_) in existing().items():
        graphql(
            """mutation($id: ID!) { deleteDiscussion(input: {id: $id}) { discussion { id } } }""",
            id=tid,
        )
        print(f"deleted {t}")


if __name__ == "__main__":
    if "--check-count" in sys.argv:
        check_count()
    elif "--recreate" in sys.argv:
        delete_all()
        main()
    else:
        main()
