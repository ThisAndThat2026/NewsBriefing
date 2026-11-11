# News Brief

Live site: https://mynewsbrief.vercel.app

A free, phone-first daily news briefing for your state, counties and the countries you follow. Static site (no build step, no accounts). Preferences live only in the reader's browser and the share link.

- `index.html`, `app.js`, `style.css`, `about.html`: the site
- `places.json`: all U.S. states, counties, and the countries readers can follow
- `data/`: today's briefing, one JSON file per place (written by the scheduled Claude task)
- `GENERATE.md`: instructions the scheduled task follows (~5:45 AM full edition, hourly checks 7 AM–10 PM PT)
- `validate.py`: must print `OK` before any publish
