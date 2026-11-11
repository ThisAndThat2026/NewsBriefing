// News Brief — static client. Preferences live in localStorage + the URL hash only.
(function () {
  'use strict';
  const DEFAULT = { s: 'WA', c: ['King County', 'Snohomish County', 'Pierce County'], n: ['Israel'], t: [] };
  const REQ_KEY = 'newsbrief.requests.v1';
  const KEY = 'newsbrief.prefs.v1';
  const CAPS = { topic: 5, top: 5, counties: 5, state: 5, us: 6, world: 6, country: 5, tech: 6, talking: 5, coming: 2 };
  const $ = (id) => document.getElementById(id);
  let PLACES = null, TOPICS = [], EDITION = null, prefs = null, draft = null;

  // ---------- helpers ----------
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const safeUrl = (u) => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : null; } catch { return null; } };
  const store = {
    get() { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } },
    set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* private mode: URL still works */ } }
  };
  function toast(msg) { const t = $('toast'); t.textContent = msg; t.style.display = 'block'; setTimeout(() => (t.style.display = 'none'), 2200); }
  async function getJSON(path) { const r = await fetch(path, { cache: 'no-cache' }); if (!r.ok) throw new Error(r.status); return r.json(); }
  async function tryJSON(path) { try { return await getJSON(path); } catch { return null; } }

  // ---------- prefs: URL hash > localStorage > default ----------
  function fromHash() {
    const h = new URLSearchParams(location.hash.slice(1));
    if (!h.get('s')) return null;
    const list = (k) => (h.get(k) || '').split('|').filter(Boolean);
    return { s: h.get('s'), c: list('c'), n: list('n'), t: list('t') };
  }
  function toHash(p) {
    const h = new URLSearchParams();
    h.set('s', p.s); if (p.c.length) h.set('c', p.c.join('|')); if (p.n.length) h.set('n', p.n.join('|')); if (p.t && p.t.length) h.set('t', p.t.join('|'));
    return '#' + h.toString();
  }
  function validate(p) {
    if (!p || !PLACES.states[p.s]) return null;
    const cs = PLACES.counties[p.s] || [];
    return { s: p.s, c: p.c.filter((x) => cs.includes(x)).slice(0, 6), n: (p.n || []).filter((x) => PLACES.countries.includes(x)).slice(0, 4), t: (p.t || []).filter((x) => TOPICS.includes(x)).slice(0, 5) };
  }

  // ---------- coverage requests: only the name of an uncovered place/topic is sent ----------
  function requestCoverage(items) {
    let done = {}; try { done = JSON.parse(localStorage.getItem(REQ_KEY)) || {}; } catch { /* ignore */ }
    const now = Date.now();
    items.forEach((it) => {
      const key = [it.type, it.state || '', it.name || ''].join('|');
      if (done[key] && now - done[key] < 864e5) return;
      done[key] = now;
      fetch('api/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(it), keepalive: true }).catch(() => {});
    });
    try { localStorage.setItem(REQ_KEY, JSON.stringify(done)); } catch { /* ignore */ }
  }

  // ---------- rendering ----------
  function timeAgo(t) {
    const d = new Date(/T/.test(t) ? t : t + 'T12:00:00'); if (isNaN(d)) return '';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  function storyNode(st, lead) {
    const box = el('article', lead ? 'story lead' : 'story');
    const url = safeUrl(st.u);
    const h = el('a', 'h', st.h);
    if (url) { h.href = url; h.target = '_blank'; h.rel = 'noopener'; }
    const top = el('div');
    if (st.act) top.appendChild(el('span', 'tag act', 'Action'));
    if (st.place) top.appendChild(el('span', 'tag', st.place));
    top.appendChild(h);
    box.appendChild(top);
    if (st.s) box.appendChild(el('p', null, st.s));
    const when = st.t ? (st.src ? ' · ' : '') + timeAgo(st.t) : '';
    box.appendChild(el('div', 'src', (st.src || '') + when));
    return box;
  }
  function comingNode(c) {
    const box = el('article', 'story');
    const d = new Date(c.date + 'T12:00:00');
    box.appendChild(el('span', 'date', isNaN(d) ? c.date : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })));
    const url = safeUrl(c.u);
    const h = el('a', 'h', c.h); if (url) { h.href = url; h.target = '_blank'; h.rel = 'noopener'; }
    box.appendChild(h);
    if (c.s) box.appendChild(el('p', null, c.s));
    if (c.src) box.appendChild(el('div', 'src', c.src));
    return box;
  }
  function section(title, items, cap, emptyMsg, isComing) {
    const sec = el('section', 'sec');
    sec.appendChild(el('h2', null, title));
    const list = (items || []).slice(0, cap);
    if (!list.length) sec.appendChild(el('p', 'none', emptyMsg || 'No major updates.'));
    list.forEach((it) => sec.appendChild(isComing ? comingNode(it) : storyNode(it)));
    return sec;
  }

  async function render() {
    const main = $('brief'); main.textContent = '';
    const p = prefs, cov = EDITION.coverage || {};
    const stName = PLACES.states[p.s];
    const up = new Date(EDITION.updated);
    const dateStr = up.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/Los_Angeles' });
    const timeStr = up.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' });
    $('meta').textContent = `${dateStr} · ${timeStr} PT · ${EDITION.label || ''}`;
    tryJSON('data/status.json').then((st) => {
      if (!st || !st.checked) return;
      const c = new Date(st.checked); if (isNaN(c)) return;
      $('meta').textContent += ` · Checked ${c.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' })}`;
    });
    document.title = `${dateStr} · News Brief`;
    const deck = el('p', 'deck'); main.appendChild(deck);
    main.appendChild(el('p', 'for', 'For ' + [stName].concat(p.c.map((c) => c.replace(/ County$/, ''))).concat(p.n, p.t).join(' · ')));

    // load shared + place files in parallel
    const shared = (await tryJSON('data/shared.json')) || {};
    const stateCovered = (cov.states || []).includes(p.s);
    const coveredCounties = (cov.counties && cov.counties[p.s]) || [];
    const [stateData, countyData, countryData] = await Promise.all([
      stateCovered ? tryJSON(`data/state/${p.s}.json`) : null,
      Promise.all(p.c.map((c) => coveredCounties.includes(c) ? tryJSON(`data/county/${p.s}/${slug(c)}.json`) : null)),
      Promise.all(p.n.map((n) => (cov.countries || []).includes(n) ? tryJSON(`data/country/${slug(n)}.json`) : null))
    ]);
    const topicData = await Promise.all(p.t.map((t) => (cov.topics || []).includes(t) ? tryJSON(`data/topic/${slug(t)}.json`) : null));

    // ask for anything not covered yet; the next scheduled run adds it
    const missing = [];
    if (!stateCovered) missing.push({ type: 'state', state: p.s });
    p.c.forEach((c) => { if (!coveredCounties.includes(c)) missing.push({ type: 'county', state: p.s, name: c }); });
    p.n.forEach((n) => { if (!(cov.countries || []).includes(n)) missing.push({ type: 'country', name: n }); });
    p.t.forEach((t) => { if (!(cov.topics || []).includes(t)) missing.push({ type: 'topic', name: t }); });
    if (missing.length) requestCoverage(missing);

    // tag every story with its home section
    const tag = (arr, key, place) => (arr || []).map((s) => Object.assign({}, s, { _sec: key, place }));
    const pools = {
      counties: [].concat(...p.c.map((c, i) => tag(countyData[i] && countyData[i].stories, 'counties', c.replace(/ County$| Parish$| Borough$/, '')))),
      state: tag(stateData && stateData.stories, 'state'),
      us: tag(shared.us, 'us'), world: tag(shared.world, 'world'), tech: tag(shared.tech, 'tech')
    };
    p.n.forEach((n, i) => (pools['country:' + n] = tag(countryData[i] && countryData[i].stories, 'country:' + n)));
    p.t.forEach((t, i) => (pools['topic:' + t] = tag(topicData[i] && topicData[i].stories, 'topic:' + t)));

    // de-duplicate by URL across sections
    const seen = new Set();
    Object.keys(pools).forEach((k) => (pools[k] = pools[k].filter((s) => { const u = s.u || s.h; if (seen.has(u)) return false; seen.add(u); return true; })));
    Object.values(pools).forEach((arr) => arr.sort((a, b) => (b.impact || 0) - (a.impact || 0)));

    // Top stories: "Action" items first (practical-impact rule), then highest impact
    const all = [].concat(...Object.values(pools));
    const ranked = all.slice().sort((a, b) => (b.act ? 1 : 0) - (a.act ? 1 : 0) || (b.impact || 0) - (a.impact || 0));
    const top = ranked.filter((s) => s.act || (s.impact || 0) >= 4).slice(0, CAPS.top);
    if (top.length < 3) ranked.forEach((s) => { if (top.length < 3 && !top.includes(s)) top.push(s); });
    const topSet = new Set(top);
    deck.textContent = top.slice(0, 3).map((s) => s.h).join('; ') + (top.length ? '.' : '');
    Object.keys(pools).forEach((k) => (pools[k] = pools[k].filter((s) => !topSet.has(s))));

    // Top stories section with lead card
    const topSec = el('section', 'sec');
    topSec.appendChild(el('h2', null, 'Top stories'));
    if (!top.length) topSec.appendChild(el('p', 'none', 'No major updates.'));
    top.forEach((s, i) => { const label = s._sec === 'counties' ? s.place : null; topSec.appendChild(storyNode(Object.assign({}, s, { place: label }), i === 0)); });
    main.appendChild(topSec);

    const notCovered = (what) => `Not covered yet. ${what} has been requested and will be added in the next refresh.`;
    const uncoveredCounties = p.c.filter((c) => !coveredCounties.includes(c));
    const countyMsg = p.c.length === 0 ? 'No counties chosen. Tap “My places” to add some.'
      : countyData.every((d) => !d) ? `Not covered yet. ${uncoveredCounties.length > 1 ? 'Your counties have' : uncoveredCounties[0] + ' has'} been requested and will be added in the next refresh.` : 'No major updates.';
    const countySec = section('Your counties', pools.counties, CAPS.counties, countyMsg);
    if (uncoveredCounties.length && countyData.some((d) => d)) countySec.appendChild(el('p', 'none', `Not covered yet: ${uncoveredCounties.join(', ')}. Requested; coming in the next refresh.`));
    main.appendChild(countySec);
    main.appendChild(section(stName, pools.state, CAPS.state, stateCovered ? 'No major updates.' : notCovered(stName)));
    main.appendChild(section('U.S.', pools.us, CAPS.us));
    main.appendChild(section('World', pools.world, CAPS.world));
    p.n.forEach((n, i) => main.appendChild(section(n, pools['country:' + n], CAPS.country, countryData[i] ? 'No major updates.' : notCovered(n))));
    main.appendChild(section('Tech', pools.tech, CAPS.tech));
    p.t.forEach((t, i) => main.appendChild(section(t, pools['topic:' + t], CAPS.topic, topicData[i] ? 'No major updates.' : notCovered(t))));
    const talking = [].concat(stateData && stateData.talking || [], shared.talking || []);
    main.appendChild(section('What people are talking about', talking, CAPS.talking));

    // Coming up: 2–7 days out, from user's places + national
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const coming = [].concat(...countyData.map((d) => (d && d.coming) || []), (stateData && stateData.coming) || [], shared.coming || [])
      .filter((c) => { const d = new Date(c.date + 'T12:00:00'); const days = (d - today) / 864e5; return days >= 1 && days <= 8; })
      .sort((a, b) => a.date.localeCompare(b.date));
    main.appendChild(section('Coming up', coming, CAPS.coming, 'Nothing scheduled that needs action this week.', true));
  }

  // ---------- settings sheet ----------
  function fillCounties() {
    const list = $('countyList'), f = $('countyFilter').value.toLowerCase();
    list.textContent = '';
    const cs = (PLACES.counties[draft.s] || []).filter((c) => c.toLowerCase().includes(f));
    cs.filter((c) => draft.c.includes(c)).concat(cs.filter((c) => !draft.c.includes(c))).forEach((c) => {
      const lab = el('label'); const cb = el('input'); cb.type = 'checkbox'; cb.checked = draft.c.includes(c);
      cb.onchange = () => { if (cb.checked) { if (draft.c.length >= 6) { cb.checked = false; return toast('Up to 6 counties'); } draft.c.push(c); } else draft.c = draft.c.filter((x) => x !== c); $('countyCount').textContent = draft.c.length + ' chosen'; };
      lab.append(cb, document.createTextNode(c)); list.appendChild(lab);
    });
    $('countyCount').textContent = draft.c.length + ' chosen';
  }
  function fillCountries() {
    const list = $('countryList'), f = $('countryFilter').value.toLowerCase();
    list.textContent = '';
    const ns = PLACES.countries.filter((c) => c.toLowerCase().includes(f));
    ns.filter((c) => draft.n.includes(c)).concat(ns.filter((c) => !draft.n.includes(c))).forEach((c) => {
      const lab = el('label'); const cb = el('input'); cb.type = 'checkbox'; cb.checked = draft.n.includes(c);
      cb.onchange = () => { if (cb.checked) { if (draft.n.length >= 4) { cb.checked = false; return toast('Up to 4 countries'); } draft.n.push(c); } else draft.n = draft.n.filter((x) => x !== c); chips(); };
      lab.append(cb, document.createTextNode(c)); list.appendChild(lab);
    });
    chips();
  }
  function fillTopics() {
    const list = $('topicList'); list.textContent = '';
    TOPICS.forEach((t) => {
      const lab = el('label'); const cb = el('input'); cb.type = 'checkbox'; cb.checked = draft.t.includes(t);
      cb.onchange = () => { if (cb.checked) { if (draft.t.length >= 5) { cb.checked = false; return toast('Up to 5 topics'); } draft.t.push(t); } else draft.t = draft.t.filter((x) => x !== t); };
      lab.append(cb, document.createTextNode(t)); list.appendChild(lab);
    });
  }
  function chips() { const ch = $('countryChips'); ch.textContent = ''; draft.n.forEach((n) => ch.appendChild(el('span', 'chip', n))); }
  function openSheet() {
    draft = JSON.parse(JSON.stringify(prefs));
    const sel = $('selState'); sel.textContent = '';
    Object.entries(PLACES.states).forEach(([k, v]) => { const o = el('option', null, v); o.value = k; sel.appendChild(o); });
    sel.value = draft.s;
    sel.onchange = () => { draft.s = sel.value; draft.c = []; $('countyFilter').value = ''; fillCounties(); };
    $('countyFilter').value = ''; $('countryFilter').value = '';
    fillCounties(); fillCountries(); fillTopics();
    $('sheet').classList.add('open');
  }
  function closeSheet() { $('sheet').classList.remove('open'); }

  // ---------- boot ----------
  async function boot() {
    try {
      let tp; [PLACES, EDITION, tp] = await Promise.all([getJSON('places.json'), getJSON('data/edition.json'), tryJSON('topics.json')]);
      TOPICS = (tp && tp.topics) || [];
    } catch (e) { $('meta').textContent = 'Could not load today’s briefing. Please try again shortly.'; return; }
    prefs = validate(fromHash()) || validate(store.get()) || DEFAULT;
    store.set(prefs);
    history.replaceState(null, '', toHash(prefs));
    $('btnPlaces').onclick = openSheet;
    $('btnCancel').onclick = closeSheet;
    $('sheet').onclick = (e) => { if (e.target.id === 'sheet') closeSheet(); };
    $('countyFilter').oninput = fillCounties;
    $('countryFilter').oninput = fillCountries;
    $('btnSave').onclick = () => { prefs = validate(draft) || prefs; store.set(prefs); history.replaceState(null, '', toHash(prefs)); closeSheet(); render(); window.scrollTo(0, 0); };
    $('btnShare').onclick = async () => {
      const url = location.href;
      if (navigator.share) { try { await navigator.share({ title: 'My News Brief', url }); return; } catch { /* cancelled */ } }
      try { await navigator.clipboard.writeText(url); toast('Link copied'); } catch { toast('Copy the address from your browser bar'); }
    };
    window.addEventListener('hashchange', () => { const h = validate(fromHash()); if (h) { prefs = h; store.set(prefs); render(); } });
    render();
  }
  boot();
})();
