// ── Renderers: overview, spending, insights ──

RENDERERS.overview = async (section) => {
  const [inv, txn] = await Promise.all([api('/api/investments'), api('/api/transactions')]);

  const accounts = inv.accounts || [];
  if (accounts.length === 0) {
    section.innerHTML = `
      <div class="page-header"><h1 class="page-title">Welcome</h1></div>
      ${emptyState('No accounts connected yet', 'Connect your first bank, brokerage, or retirement account to see your complete financial picture.')}
    `;
    return;
  }

  const ytdGain = (inv.holdings || []).reduce((s, h) => {
    const cb = (h.cost_basis || 0) * (h.quantity || 0);
    return s + ((h.institution_value || 0) - cb);
  }, 0);

  section.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Overview</h1>
        <div class="page-subtitle">Your net worth and recent activity at a glance</div>
      </div>
      <button class="btn btn-secondary" onclick="loadSection('overview', true)">Refresh</button>
    </div>
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-label">Net Worth</div>
        <div class="stat-value">${fmtUSD(inv.net_worth)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Portfolio Value</div>
        <div class="stat-value">${fmtUSD((inv.holdings || []).reduce((s, h) => s + (h.institution_value || 0), 0))}</div>
        <div class="stat-delta ${gainClass(ytdGain)}">${fmtSignedUSD(ytdGain)} unrealized</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Avg Monthly Spend</div>
        <div class="stat-value">${fmtUSD(txn.avg_monthly_spend)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Accounts Linked</div>
        <div class="stat-value">${accounts.length}</div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <h3 class="card-title">Spending by category</h3>
        <div class="chart-wrap-sm"><canvas id="ovCategoryChart"></canvas></div>
      </div>
      <div class="card">
        <h3 class="card-title">Portfolio value (12mo)</h3>
        <div class="chart-wrap-sm"><canvas id="ovPortfolioChart"></canvas></div>
      </div>
    </div>

    <h2 class="section-header">Accounts</h2>
    <div class="card">${renderAccountRows(accounts)}</div>
  `;

  renderCategoryChart('ovCategoryChart', txn.by_category);
  renderPortfolioChart('ovPortfolioChart', inv.portfolio_history);
};

RENDERERS.spending = async (section) => {
  const txn = await api('/api/transactions');
  const accounts = (await api('/api/investments')).accounts || [];

  if (accounts.length === 0 || Object.keys(txn.by_category || {}).length === 0) {
    section.innerHTML = `<div class="page-header"><h1 class="page-title">Spending</h1></div>
      ${emptyState('No spending data yet', 'Connect a checking or credit card account to see your spending breakdown.')}`;
    return;
  }

  const months = Object.keys(txn.monthly_totals);
  const lastMonth = months[months.length - 1];
  const prevMonth = months[months.length - 2];
  const lastVal = txn.monthly_totals[lastMonth] || 0;
  const prevVal = txn.monthly_totals[prevMonth] || 0;
  const momChange = prevVal ? ((lastVal - prevVal) / prevVal) * 100 : 0;

  section.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Spending</h1>
        <div class="page-subtitle">Last 12 months across all connected accounts</div>
      </div>
      <button class="btn btn-secondary" onclick="loadSection('spending', true)">Refresh</button>
    </div>
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-label">Avg Monthly</div>
        <div class="stat-value">${fmtUSD(txn.avg_monthly_spend)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Last Month (${fmtMonth(lastMonth)})</div>
        <div class="stat-value">${fmtUSD(lastVal)}</div>
        <div class="stat-delta ${momChange > 0 ? 'loss' : 'gain'}">${momChange >= 0 ? '↑' : '↓'} ${fmtPct(Math.abs(momChange))} vs prior</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Top Category</div>
        <div class="stat-value" style="font-size:18px">${Object.keys(txn.by_category)[0] || '—'}</div>
        <div class="stat-delta">${fmtUSD(Object.values(txn.by_category)[0])}</div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <h3 class="card-title">By category</h3>
        <div class="chart-wrap"><canvas id="spCategoryChart"></canvas></div>
      </div>
      <div class="card">
        <h3 class="card-title">Monthly trend</h3>
        <div class="chart-wrap"><canvas id="spMonthlyChart"></canvas></div>
      </div>
    </div>

    <h2 class="section-header">Recent Transactions</h2>
    <div class="card" style="padding:0">
      <table class="table">
        <thead><tr><th>Date</th><th>Merchant</th><th>Category</th><th class="num">Amount</th></tr></thead>
        <tbody>
          ${(txn.transactions || []).slice(0, 40).map(t => `
            <tr>
              <td>${t.date}</td>
              <td>${t.merchant_name || t.name}</td>
              <td><span class="badge badge-neutral">${(t.category || [])[0] || 'Other'}</span></td>
              <td class="num ${t.amount > 0 ? '' : 'gain'}">${fmtSignedUSD(-t.amount)}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;

  renderCategoryChart('spCategoryChart', txn.by_category);
  renderMonthlyChart('spMonthlyChart', txn.monthly_totals);
};

RENDERERS.insights = async (section) => {
  section.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">AI Insights</h1>
        <div class="page-subtitle">Personalized analysis generated from your complete financial picture</div>
      </div>
      <button class="btn btn-secondary" onclick="regenerateInsights()">Regenerate</button>
    </div>
    <div class="card" id="insightsContainer">
      <div class="skeleton skeleton-row" style="width:90%"></div>
      <div class="skeleton skeleton-row" style="width:85%"></div>
      <div class="skeleton skeleton-row" style="width:95%"></div>
      <div class="skeleton skeleton-row" style="width:80%"></div>
      <div class="skeleton skeleton-row" style="width:88%"></div>
      <p style="color:var(--text-muted);margin-top:16px;font-size:12px">Analyzing your portfolio with Claude...</p>
    </div>
  `;

  const data = await api('/api/insights');
  const container = document.getElementById('insightsContainer');
  container.classList.remove('card');
  container.innerHTML = `<div class="insights-card">${escapeHtml(data.insights || 'No insights available.')}</div>`;
};

async function regenerateInsights() {
  delete window.cache['/api/insights'];
  await loadSection('insights', true);
}

// ── Shared helpers used by basic + investing renderers ──

function renderAccountRows(accounts) {
  if (!accounts.length) return '<div class="empty-state"><p>No accounts yet.</p></div>';
  return accounts.map(a => {
    const bal = a.balances?.current || 0;
    const subtype = (a.subtype || a.type || '').replace(/^AccountSubtype\./, '').replace(/^AccountType\./, '');
    return `<div class="account-row">
      <div>
        <div class="account-name">${a.name}</div>
        <div class="account-meta">${a.institution_name || ''} · ${subtype}</div>
      </div>
      <div class="account-balance ${bal < 0 ? 'loss' : ''}">${fmtUSD(bal)}</div>
    </div>`;
  }).join('');
}

function renderCategoryChart(canvasId, byCategory) {
  const entries = Object.entries(byCategory || {}).slice(0, 10);
  if (!entries.length) return;
  makeChart(canvasId, canvasId, {
    type: 'doughnut',
    data: {
      labels: entries.map(e => e[0]),
      datasets: [{
        data: entries.map(e => e[1]),
        backgroundColor: PALETTE,
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { font: { size: 11 }, boxWidth: 10 } },
        tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${fmtUSD(ctx.parsed)}` } },
      },
      cutout: '60%',
    },
  });
}

function renderMonthlyChart(canvasId, monthly) {
  const entries = Object.entries(monthly || {});
  if (!entries.length) return;
  makeChart(canvasId, canvasId, {
    type: 'line',
    data: {
      labels: entries.map(e => fmtMonth(e[0])),
      datasets: [{
        label: 'Monthly Spending',
        data: entries.map(e => e[1]),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59,130,246,0.08)',
        fill: true,
        tension: 0.3,
        pointRadius: 3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => fmtUSD(ctx.parsed.y) } },
      },
      scales: {
        y: { ticks: { callback: (v) => fmtUSD(v, { decimals: 0 }) } },
      },
    },
  });
}

function renderPortfolioChart(canvasId, history) {
  const entries = Object.entries(history || {});
  if (!entries.length) {
    const canvas = document.getElementById(canvasId);
    if (canvas) canvas.parentElement.innerHTML = '<div class="empty-state"><p>No historical data available</p></div>';
    return;
  }
  makeChart(canvasId, canvasId, {
    type: 'line',
    data: {
      labels: entries.map(e => fmtMonth(e[0])),
      datasets: [{
        label: 'Portfolio Value',
        data: entries.map(e => e[1]),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16,185,129,0.08)',
        fill: true,
        tension: 0.25,
        pointRadius: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => fmtUSD(ctx.parsed.y) } },
      },
      scales: { y: { ticks: { callback: (v) => fmtUSD(v, { decimals: 0 }) } } },
    },
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
