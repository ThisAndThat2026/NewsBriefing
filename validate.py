#!/usr/bin/env python3
"""Checks News Brief data files before publishing. Prints OK or a list of problems."""
import json, os, re, sys, datetime
from urllib.parse import urlparse

ROOT = os.path.dirname(os.path.abspath(__file__))
D = os.path.join(ROOT, "data")
errors, warnings = [], []
optout = set()
try:
    optout = set(json.load(open(os.path.join(D, "optout.json"))))
except FileNotFoundError:
    pass

WIRE = {"reuters": "reuters.com", "ap": "apnews.com", "associated press": "apnews.com"}
today = datetime.date.today()

def check_story(f, i, s, coming=False):
    where = f"{f} #{i+1}"
    for k in (["h", "s", "date"] if coming else ["h", "s", "src", "u", "t", "impact"]):
        if k not in s or s[k] in ("", None):
            errors.append(f"{where}: missing '{k}'")
    if len(s.get("s", "").split()) > 45:
        errors.append(f"{where}: summary too long ({len(s['s'].split())} words, max 40)")
    if len(s.get("h", "").split()) > 14:
        warnings.append(f"{where}: long headline")
    u = s.get("u")
    if u:
        p = urlparse(u)
        host = p.netloc.lower().removeprefix("www.")
        if p.scheme not in ("http", "https"):
            errors.append(f"{where}: bad URL")
        if p.path in ("", "/"):
            errors.append(f"{where}: links to a homepage, not an article")
        if "cnn.com" in host:
            errors.append(f"{where}: CNN is excluded")
        if any(host == o or host.endswith("." + o) for o in optout):
            errors.append(f"{where}: {host} has opted out")
        src = s.get("src", "").lower().strip()
        if src in WIRE and WIRE[src] not in host:
            errors.append(f"{where}: says '{s['src']}' but links to {host}")
    if not coming and s.get("t"):
        try:
            age = (today - datetime.date.fromisoformat(s["t"][:10])).days
            if age > 3:
                warnings.append(f"{where}: story is {age} days old")
        except ValueError:
            errors.append(f"{where}: bad date '{s['t']}'")
    if not coming and s.get("impact") not in (1, 2, 3, 4, 5):
        errors.append(f"{where}: impact must be 1-5")

ed = json.load(open(os.path.join(D, "edition.json")))
for k in ("label", "updated", "coverage"):
    if k not in ed:
        errors.append(f"edition.json: missing '{k}'")

files = ["shared.json"]
cov = ed.get("coverage", {})
files += [f"state/{s}.json" for s in cov.get("states", [])]
slug = lambda x: re.sub(r"[^a-z0-9]+", "-", x.lower()).strip("-")
for st, cs in cov.get("counties", {}).items():
    files += [f"county/{st}/{slug(c)}.json" for c in cs]
files += [f"country/{slug(n)}.json" for n in cov.get("countries", [])]
files += [f"topic/{slug(t)}.json" for t in cov.get("topics", [])]

for f in files:
    path = os.path.join(D, f)
    if not os.path.exists(path):
        errors.append(f"{f}: missing file (listed in coverage)")
        continue
    try:
        data = json.load(open(path))
    except json.JSONDecodeError as e:
        errors.append(f"{f}: invalid JSON ({e})")
        continue
    for key, arr in data.items():
        if not isinstance(arr, list):
            errors.append(f"{f}: '{key}' must be a list")
            continue
        for i, s in enumerate(arr):
            check_story(f"{f}:{key}", i, s, coming=(key == "coming"))

for w in warnings:
    print("warning:", w)
if errors:
    for e in errors:
        print("ERROR:", e)
    sys.exit(1)
print("OK")
