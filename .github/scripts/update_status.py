"""Update status.yaml for a deploy run started by hand or through the API.

The time is always set to now (BC time, UTC−7, rounded to the nearest quarter hour). SPAN, HUNG and NOTE (environment
variables) override the file's values when given:
- SPAN: the span the gantry is working on, 3-104 (it needs two spans behind it and one ahead). Moving to a new span without
  HUNG marks it not hung.
- HUNG: true or false (COMPLETE, its old name, is read too).
- NOTE: any text, added as the summary of an untitled note at the top of the notes list stamped with this update's time (older notes are kept; the site shows
  the newest); "-" adds an empty note, so none shows.
Prints a one-line summary for the commit message.
"""

import json
import os
import re
import sys
from datetime import datetime
from zoneinfo import ZoneInfo

PATH = "status.yaml"


def fail(msg):
    print(f"::error::{msg}", file=sys.stderr)
    sys.exit(1)


lines = open(PATH).read().split("\n")
values = {}
for line in lines:
    m = re.match(r"^([A-Za-z_]+):\s*(.*?)\s*$", line)
    if m:
        values[m.group(1)] = m.group(2)
values.pop("notes", None)  # the list header; its lines are left as they are

span = os.environ.get("SPAN", "").strip()
hung = (os.environ.get("HUNG", "") or os.environ.get("COMPLETE", "")).strip().lower()
note = os.environ.get("NOTE", "")

old_span = values.get("span", "")
if span:
    if not re.fullmatch(r"\d+", span) or not 3 <= int(span) <= 104:
        fail(f"span must be a whole number from 3 to 104, got '{span}'")
    values["span"] = str(int(span))
# the file's own name for it: hung (complete before Nov. 6, 2026)
key = "complete" if "complete" in values and "hung" not in values else "hung"
if hung:
    if hung not in ("true", "false"):
        fail(f"hung must be true or false, got '{hung}'")
    values[key] = hung
elif span and values["span"] != old_span:
    values[key] = "false"
# BC time is a whole number of hours off UTC, so rounding the timestamp to 15 minutes lands on local quarter hours
quarter = 15 * 60
now = round(datetime.now().timestamp() / quarter) * quarter
stamp = datetime.fromtimestamp(now, ZoneInfo("America/Dawson_Creek")).isoformat(timespec="minutes")
values["updated"] = stamp

out = []
for line in lines:
    m = re.match(r"^([A-Za-z_]+):", line)
    out.append(f"{m.group(1)}: {values[m.group(1)]}" if m and m.group(1) in values else line)
    # a new note goes first in the list, under the `notes:` line
    if m and m.group(1) == "notes" and note.strip():
        text = "" if note.strip() == "-" else note.strip()
        # an untitled note: the title is empty and the text is its summary
        out.append(f'  - {stamp}: ""')
        out.append(f"    summary: {json.dumps(text)}")
open(PATH, "w").write("\n".join(out))

state = "hung" if values.get(key) == "true" else "not hung"
print(f"Status: span {values.get('span')} {state}, as of {stamp}")
