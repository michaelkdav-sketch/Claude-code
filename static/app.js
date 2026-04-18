// ── Core globals, formatters, Plaid Link, navigation, chart helpers ──

window.charts = {};
window.cache = {};

const PALETTE = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#14b8a6','#ec4899','#6366f1','#84cc16','#f97316','#06b6d4','#a855f7'];

function fmtUSD(n, opts = {}) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  const abs = Math.abs(n);
  const digits = opts.decimals ?? (abs >= 10000 ? 0 : 2);
  const s = abs.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return (n < 0 ? '-' : '') + '$' + s;
}

function fmtSignedUSD(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return (n >= 0 ? '+' : '') + fmtUSD(n);
}

function fmtPct(n, decimals = 1) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return n.toFixed(decimals) + '%';
}

function fmtDate(s) {
  if (!s) return '';
  return new Date(s + (s.length === 7 ? '-01' : '')).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtMonth(s) {
  if (!s) return '';
  return new Date(s + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function gainClass(n) {
  if (n > 0) return 'gain';
  if (n < 0) return 'loss';
  return '';
}

function destroyChart(id) {
  if (window.charts[id]) {
    window.charts[id].destroy();
    delete window.charts[id];
  }
}

function makeChart(id, canvasId, config) {
  destroyChart(id);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;
  window.charts[id] = new Chart(canvas, config);
  return window.charts[id];
}

function skeletonCards(n) {
  return Array.from({ length: n }, () => '<div class="skeleton skeleton-card"></div>').join('');
}

function skeletonRows(n) {
  return Array.from({ length: n }, () => '<div class="skeleton skeleton-row"></div>').join('');
}

function emptyState(title, msg) {
  return `<div class="card"><div class="empty-state">
    <h3>${title}</h3><p>${msg}</p>
    <button class="btn btn-primary" onclick="openPlaidLink()">+ Connect Account</button>
  </div></div>`;
}

function sectionEl(name) {
  return document.querySelector(`section[data-section="${name}"]`);
}

async function api(path) {
  if (window.cache[path]) return window.cache[path];
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  const data = await res.json();
  window.cache[path] = data;
  return data;
}

function invalidateCache() { window.cache = {}; }

async function apiPost(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

// ── Plaid Link ────────────────────────────────────────────────────────────

async function openPlaidLink() {
  try {
    const { link_token } = await apiPost('/api/create_link_token');
    const handler = Plaid.create({
      token: link_token,
      onSuccess: async (public_token, metadata) => {
        await apiPost('/api/exchange_public_token', {
          public_token,
          institution: metadata.institution || {},
        });
        invalidateCache();
        const active = document.querySelector('.nav-item.active');
        await loadSection(active ? active.dataset.section : 'overview', true);
      },
      onExit: (err) => { if (err) console.error('Plaid:', err); },
    });
    handler.open();
  } catch (e) {
    alert('Unable to open Plaid Link: ' + e.message);
  }
}

// ── Navigation & section loader ───────────────────────────────────────────

const RENDERERS = {}; // populated by render-basic.js / render-investing.js

async function loadSection(name, force = false) {
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.section === name);
  });
  document.querySelectorAll('section[data-section]').forEach(el => {
    el.hidden = el.dataset.section !== name;
  });

  const section = sectionEl(name);
  if (!section) return;

  if (!force && section.dataset.loaded === 'true') return;

  section.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">${titleFor(name)}</h1>
        <div class="page-subtitle">${subtitleFor(name)}</div>
      </div>
      <button class="btn btn-secondary" onclick="loadSection('${name}', true)">Refresh</button>
    </div>
    <div class="stat-grid">${skeletonCards(3)}</div>
    <div class="card"><div class="skeleton skeleton-card"></div></div>
  `;

  try {
    const renderer = RENDERERS[name];
    if (renderer) await renderer(section);
    section.dataset.loaded = 'true';
  } catch (e) {
    console.error(e);
    section.innerHTML = `<div class="card"><div class="empty-state">
      <h3>Something went wrong</h3><p>${e.message}</p>
      <button class="btn btn-secondary" onclick="loadSection('${name}', true)">Retry</button>
    </div></div>`;
  }
}

function titleFor(name) {
  return {
    overview: 'Overview', spending: 'Spending', investments: 'Investments',
    tax: 'Tax', optimization: 'Optimization', insights: 'AI Insights',
  }[name] || name;
}

function subtitleFor(name) {
  return {
    overview: 'Your net worth and recent activity at a glance',
    spending: 'Last 12 months of spending across all connected accounts',
    investments: 'Holdings, allocation, and portfolio performance',
    tax: 'Unrealized gains, harvesting opportunities, and RSU/ESPP status',
    optimization: 'Rebalancing, concentration risk, expenses, and cash drag',
    insights: 'Personalized analysis generated from your full financial picture',
  }[name] || '';
}

function bootstrap() {
  document.getElementById('connectBtn').onclick = openPlaidLink;
  document.querySelectorAll('.nav-item').forEach(el => {
    el.onclick = () => loadSection(el.dataset.section);
  });
  loadSection('overview');
}
