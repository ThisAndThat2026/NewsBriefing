// Records a coverage request (an uncovered state, county, country or topic) as a GitHub issue.
// The scheduled News Brief run reads open "coverage-request" issues, adds the place or topic, and closes them.
// Needs the GITHUB_TOKEN environment variable in Vercel (fine-grained token, Issues: read & write, this repo only).
const PLACES = require('../places.json');
const TOPICS = require('../topics.json').topics;
const REPO = process.env.GITHUB_REPO || 'ThisAndThat2026/NewsBriefing';
const LABEL = 'coverage-request';

function titleFor(b) {
  const type = String(b.type || ''), name = String(b.name || ''), st = String(b.state || '');
  if (type === 'state' && PLACES.states[st]) return `Coverage request: state: ${st}`;
  if (type === 'county' && (PLACES.counties[st] || []).includes(name)) return `Coverage request: county: ${st} / ${name}`;
  if (type === 'country' && PLACES.countries.includes(name)) return `Coverage request: country: ${name}`;
  if (type === 'topic' && TOPICS.includes(name)) return `Coverage request: topic: ${name}`;
  return null;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const title = titleFor(body || {});
  if (!title) { res.statusCode = 400; return res.end('unknown place or topic'); }
  const token = process.env.GITHUB_TOKEN;
  if (!token) { res.statusCode = 503; return res.end('not configured'); }
  const gh = (path, opts = {}) => fetch(`https://api.github.com/repos/${REPO}${path}`, Object.assign({
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'news-brief' }
  }, opts));
  try {
    const open = await (await gh(`/issues?labels=${LABEL}&state=open&per_page=100`)).json();
    if (Array.isArray(open) && open.some((i) => i.title === title)) { res.statusCode = 200; return res.end('already requested'); }
    const r = await gh('/issues', { method: 'POST', body: JSON.stringify({ title, labels: [LABEL],
      body: 'Requested automatically from the News Brief site. The next scheduled run will add it to coverage and close this issue.' }) });
    res.statusCode = r.ok ? 201 : 502; return res.end(r.ok ? 'requested' : 'github error');
  } catch (e) { res.statusCode = 502; return res.end('error'); }
};
