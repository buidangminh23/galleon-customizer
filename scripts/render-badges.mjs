#!/usr/bin/env node
// Render the README badges (same look as codex-mcp-bridge) into a folder.
//   node scripts/render-badges.mjs <out-dir>
// Env: GITHUB_REPOSITORY (owner/name), GH_TOKEN (repo data),
//      ANALYTICS_TOKEN (optional, push access: traffic views and clones).
// A badge whose source fails is not written, so the copy already in <out-dir> stays.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = process.env.GITHUB_REPOSITORY || 'buidangminh23/galleon-customizer';
const out = process.argv[2] || 'badges';
const checked = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';

const escapeXml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
const format = value => new Intl.NumberFormat('en-US').format(value);

export function renderBadge(label, message, color, detail) {
  const labelWidth = Math.ceil([...label].length * 7.2 + 16);
  const messageWidth = Math.ceil([...message].length * 7.2 + 16);
  const width = labelWidth + messageWidth;
  const accessible = `${label}: ${message}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width * 20 / 24}" height="20" viewBox="0 0 ${width} 24" role="img" aria-label="${escapeXml(accessible)}"><title>${escapeXml(`${accessible}. ${detail}`)}</title><rect width="${width}" height="24" rx="4" fill="#555"/><path d="M${labelWidth} 0H${width - 4}Q${width} 0 ${width} 4V20Q${width} 24 ${width - 4} 24H${labelWidth}Z" fill="${color}"/><g fill="#fff" font-family="DejaVu Sans Mono,monospace" font-size="12" text-anchor="middle"><text x="${labelWidth / 2}" y="16">${escapeXml(label)}</text><text x="${labelWidth + messageWidth / 2}" y="16">${escapeXml(message)}</text></g></svg>\n`;
}

async function github(endpoint, token) {
  const headers = { accept: 'application/vnd.github+json', 'user-agent': 'galleon-customizer-badges' };
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(`https://api.github.com/${endpoint}`, { headers });
  if (!response.ok) throw new Error(`${endpoint}: HTTP ${response.status}`);
  return response.json();
}

function traffic(kind, token) {
  // A missing token gives a grey "Unavailable" badge, as on codex-mcp-bridge.
  if (!token) return { label: `GitHub ${kind} / 14d`, message: 'Unavailable', color: '#555', detail: 'Needs the ANALYTICS_TOKEN secret (push access) to read GitHub traffic.' };
  return github(`repos/${repo}/traffic/${kind}`, token).then(data => {
    const rows = data[kind] || [];
    const days = rows.length ? Math.round((Date.parse(rows.at(-1).timestamp) - Date.parse(rows[0].timestamp)) / 86400000) + 1 : 14;
    const window = rows.length ? `${rows[0].timestamp.slice(0, 10)} to ${rows.at(-1).timestamp.slice(0, 10)} UTC` : 'last 14 days';
    return { label: `GitHub ${kind} / ${days}d`, message: format(data.count), color: '#0369a1', detail: `${window}. Last successful check: ${checked}. Refreshed hourly.` };
  });
}

const npmName = '@minhspark/galleon-customizer';

async function npmJson(url) {
  const response = await fetch(url, { headers: { 'user-agent': 'galleon-customizer-badges' } });
  if (response.status === 404) return null; // not published yet: grey "Unavailable"
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

const unpublished = label => ({ label, message: 'Unavailable', color: '#555', detail: `${npmName} is not on npm yet.` });

async function npmDownloads(range, label) {
  const today = new Date().toISOString().slice(0, 10);
  const data = await npmJson(`https://api.npmjs.org/downloads/point/${range === 'all' ? `2015-01-10:${today}` : range}/${npmName}`);
  if (!data) return unpublished(label);
  return { label, message: format(data.downloads), color: '#CB3837', detail: `${data.start} to ${data.end} UTC, npm downloads API. Last successful check: ${checked}. Refreshed hourly.` };
}

const sources = {
  'stats-npm-version.svg': async () => {
    const data = await npmJson(`https://registry.npmjs.org/${npmName.replace('/', '%2f')}/latest`);
    if (!data) return unpublished('npm');
    return { label: 'npm', message: `v${data.version}`, color: '#CB3837', detail: `npm registry latest dist-tag. Last successful check: ${checked}. Refreshed hourly.` };
  },
  'stats-npm-downloads.svg': () => npmDownloads('all', 'npm downloads'),
  'stats-npm-downloads-month.svg': () => npmDownloads('last-month', 'npm downloads / 30d'),
  'stats-stars.svg': async () => {
    const data = await github(`repos/${repo}`, process.env.GH_TOKEN);
    return { label: 'stars', message: format(data.stargazers_count), color: '#0969da', detail: `GitHub stargazers. Last successful check: ${checked}. Refreshed hourly.` };
  },
  'stats-last-commit.svg': async () => {
    const [commit] = await github(`repos/${repo}/commits?per_page=1`, process.env.GH_TOKEN);
    return { label: 'last commit', message: commit.commit.committer.date.slice(0, 10), color: '#6f42c1', detail: `Latest commit on the default branch. Last successful check: ${checked}.` };
  },
  'stats-github-views.svg': () => traffic('views', process.env.ANALYTICS_TOKEN),
  'stats-github-clones.svg': () => traffic('clones', process.env.ANALYTICS_TOKEN),
  'stats-platform.svg': async () => ({ label: 'platform', message: 'Linux · GNOME', color: '#E95420', detail: 'Tested on Ubuntu 26.04 (GNOME, Wayland).' }),
  'stats-license.svg': async () => ({ label: 'license', message: 'GPL-3.0', color: '#007ec6', detail: 'GPL-3.0-or-later.' }),
};

mkdirSync(out, { recursive: true });
let failed = 0;
for (const [file, source] of Object.entries(sources)) {
  try {
    const { label, message, color, detail } = await source();
    writeFileSync(join(out, file), renderBadge(label, message, color, detail));
    console.log(`${file}: ${label}: ${message}`);
  } catch (error) {
    failed += 1;
    console.warn(`::warning::${file} kept its previous value: ${error.message}`);
  }
}
if (failed) process.exitCode = 1;
