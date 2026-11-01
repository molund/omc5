"""Give every status note in status.yaml its own GitHub Discussion, ready for giscus.

Each update's thread is created here, before anyone comments, so its body can show the update itself (the note, then the
photo and its caption, as on the Trackside page) instead of giscus's plain link. The titles and bodies come from the site's
build (npm run build writes dist-ssr/threads.json, from src/trackside/prerender.js), so status.yaml is read in one place.
Threads are titled as the site asks giscus for them, "Update 2026-10-31 09:30" (Yukon time), and carry giscus's hidden sha1
marker, so giscus finds them in strict mode. A thread whose update has since been edited has its body brought up to date,
and threads older than the newest 30 are closed as outdated and locked. Needs GITHUB_TOKEN with discussions: write.
"""

import json
import os
import re
import sys
import urllib.error
import urllib.request

REPO_ID = "R_kgDOVbOMWA"
CATEGORY_ID = "DIC_kwDOVbOMWM4DKF3d"  # "Past Updates page comments"
# written by npm run build
THREADS = "dist-ssr/threads.json"


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
    """Fail once the category reaches `limit` threads: the Trackside page reads only GitHub's first 100."""
    n = len(existing())
    print(f"{n} comment threads")
    if n >= limit:
        sys.exit(
            f"::error::{n} comment threads: the Trackside page only reads the first {limit} for comment and reaction "
            "counts (src/trackside/TracksidePage.svelte). Time to decide how to handle more."
        )


def main():
    have = existing()
    for n in json.load(open(THREADS)):
        t, b = n["title"], n["body"]
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
    (the ones the Trackside page counts) and old threads can't collect spam. Newest by the update time in the title,
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
