"""Give every status note in status.yaml its own GitHub Discussion, ready for giscus.

Each update's thread is created here, before anyone comments, so its body can show the update itself (the note, then the
photo and its caption, as on the Past updates page) instead of giscus's plain link. Threads are titled as the site asks giscus
for them, "Update 2026-10-31 09:30" (Yukon time), and carry giscus's hidden sha1 marker, so giscus finds them in strict mode.
A thread whose update has since been edited has its body brought up to date. Needs GITHUB_TOKEN with discussions: write.
"""

import hashlib
import json
import os
import re
import sys
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
    """The notes with text, as dicts of time, text and photo (file, caption), as src/lib/status.js reads them."""
    out = []
    for line in open(path).read().split("\n"):
        m = re.match(r"^\s+-\s+(\S+):\s+(.*?)\s*$", line)
        if m:
            out.append({"time": datetime.fromisoformat(m.group(1)), "text": unquote(m.group(2)), "photo": None})
            continue
        if re.match(r"^\s+photo:\s*$", line) and out:
            out[-1]["photo"] = {"file": None, "caption": ""}
            continue
        m = re.match(r"^\s+(file|caption):\s*(.*?)\s*$", line)
        if m and out and out[-1]["photo"] is not None:
            out[-1]["photo"][m.group(1)] = unquote(m.group(2))
    for n in out:
        if n["photo"] and not n["photo"]["file"]:
            n["photo"] = None
    return [n for n in out if n["text"]]


def title(t):
    return "Update " + t.astimezone(TZ).strftime("%Y-%m-%d %H:%M")


def as_of(t):
    """As the site shows it: "9:30 a.m. on Oct 31, 2026" (Yukon time)."""
    t = t.astimezone(TZ)
    period = "a.m." if t.hour < 12 else "p.m."
    return f"{(t.hour % 12) or 12}:{t.minute:02d} {period} on {t.strftime('%b')} {t.day}, {t.year}"


def body(n):
    anchor = n["time"].astimezone(timezone.utc).strftime("%Y-%m-%dT%H-%M")
    parts = [f"**{as_of(n['time'])}**", n["text"]]
    if n["photo"]:
        caption = n["photo"]["caption"]
        parts.append(f"![{caption or 'Photo for this update'}]({PHOTOS}{n['photo']['file']})")
        if caption:
            parts.append(f"_{caption}_")
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
    res = json.load(urllib.request.urlopen(req))
    if res.get("errors"):
        if soft:
            print(f"::warning::{res['errors'][0].get('message')}")
            return None
        sys.exit(f"::error::{res['errors']}")
    return res["data"]


def existing():
    """Threads already in the category, by title: (id, body)."""
    found, after = {}, None
    while True:
        d = graphql(
            """query($id: ID!, $cat: ID!, $after: String) { node(id: $id) { ... on Repository {
                 discussions(first: 100, after: $after, categoryId: $cat) {
                   nodes { id title body } pageInfo { hasNextPage endCursor } } } } }""",
            id=REPO_ID,
            cat=CATEGORY_ID,
            after=after,
        )["node"]["discussions"]
        for x in d["nodes"]:
            found.setdefault(x["title"], (x["id"], x["body"]))
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


if __name__ == "__main__":
    check_count() if "--check-count" in sys.argv else main()
