# News Brief: generation instructions (for the scheduled Claude run)

You are refreshing the News Brief data files. The website is static: it only reads the JSON files in `data/`. Nothing else changes.

## When
- **Morning edition, 6:30 AM PT.** Always a full rebuild of every covered place (all steps below). Covers news from the last 24 hours.
- **Hourly check, every hour 7 AM–10 PM PT.** A light run. Follow "Hourly check" below and do NOT do a full rebuild.

## Hourly check (keep it cheap)
1. Read `data/edition.json` → `coverage`, and the current `h` and `u` of every story in `data/`.
2. Run at most **1–2 web searches per place** for breaking or practical news from the last few hours (e.g. "King County news today", "Washington road closure", "Israel breaking news"). One search is enough for U.S., World and Tech together. **Don't open articles yet.** Judge from the search results.
3. A section qualifies for an update only if a result is new (not already covered) AND either:
   - it would rank `impact` 4–5 (would make Top stories), or
   - it is practical (`act`): a closure, storm or weather warning, emergency, deadline or evacuation affecting the place today or tomorrow, or
   - it corrects or overtakes an existing story (e.g. a death toll changed, a deal was signed, a closure ended).
4. **If nothing qualifies: change no files, don't commit, stop.** Most hours should end here.
5. For each section that qualifies: fetch and verify only those new articles (same rules as a full rebuild), add the stories or update the existing ones, and drop the lowest-impact story if the section is over its cap. Leave every other section untouched.
6. Set `label` to "Updated <h:mm AM/PM>" and `updated` to now. Run `python3 validate.py`, then commit `Brief: <date> <time> update` and push. Don't archive on hourly updates.

## What to cover
Read `data/edition.json` → `coverage`. Generate one file per covered place:
- `data/shared.json`: `us`, `world`, `tech`, `talking` (national), `coming`
- `data/state/<ST>.json`: `stories`, `talking` (what people in that state are discussing), `coming`
- `data/county/<ST>/<county-slug>.json`: `stories`, `coming` (slug: lowercase, non-alphanumerics → `-`, e.g. `king-county`)
- `data/country/<country-slug>.json`: `stories`, `coming`

Then update `data/edition.json`: `label` ("Morning edition" / "Afternoon update"), `updated` (ISO time with offset).
Before overwriting, copy the current `data/` to `archive/<YYYY-MM-DD>-<am|pm>/` (keep 14 days, delete older).

## Story format
```json
{"h": "Headline, max ~10 words", "s": "One or two sentences in our own words, max 40 words.",
 "src": "Publisher name", "u": "https://direct-article-url", "t": "YYYY-MM-DD",
 "impact": 1-5, "act": true}
```
`coming` items: `{"h": "...", "s": "...", "date": "YYYY-MM-DD", "src": "...", "u": "..."}` (src/u optional for public-calendar facts such as holidays).

Per file: 4–6 stories for shared sections and states, 3–5 for counties and countries. Fewer is fine. **If a place has no significant news, write `"stories": []`.** The page then shows "No major updates." Never pad.

## How to research (search → fetch → verify → summarize)
1. Search the web for each place, limited to the last 24 hours. For counties, also check county and city government news pages, the county sheriff, the state DOT (traffic alerts), the National Weather Service (alerts), and school district pages.
2. Open (fetch) every article you plan to use. Only use what the article actually says. Never write news from memory.
3. Confirm the publish date is within 24 hours (counties: up to 72 hours, if still relevant).
4. Write the summary in your own words, using the facts only. Don't follow the article's sentence order or wording. Never quote more than a few words.

## Ranking
`impact` 5 = affects millions or changes daily life now; 4 = major regional consequence; 3 = notable; 2 = minor; 1 = trivia.
Rank by consequences (how many people, how long it lasts, whether it changes what the reader has to do), not by virality.
Set `act: true` when a story changes something the reader must do, or its timing, today or tomorrow: road or school closures, storms, deadlines, clock changes. Events 2–7 days out go in `coming` instead.

## Source rules (hard constraints)
- `src` must be the publisher whose page `u` links to. If a "Reuters"/"AP" story is found on a repost or aggregator site, find the original on reuters.com / apnews.com or the outlet that licensed it, or name the site actually linked (e.g. "KOMO (AP)").
- `u` must link to a specific article, never a homepage or a search page.
- Prefer original reporting, official sources (.gov), wire services and established local outlets. Avoid content farms, press-release mills and anonymous blogs.
- **Never use CNN** (owner's choice).
- Never bypass paywalls. A paywalled article is fine to link to if its headline and facts are visible or confirmed elsewhere.
- Never include photos or long quotes.
- Skip any domain listed in `data/optout.json` (publisher opt-outs and takedowns).

## Before publishing
Run `python3 validate.py`. It must print `OK`. Fix every error, then commit with the message `Brief: <date> <am|pm>` and push. Vercel deploys automatically.
