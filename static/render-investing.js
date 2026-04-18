// ── Renderers: investments, tax, optimization ──

RENDERERS.investments = async (section) => {
  const inv = await api('/api/investments');
  const accounts = inv.accounts || [];

  if (accounts.length === 0) {
    section.innerHTML = `<div class="page-header"><h1 class="page-title">Investments</h1></div>
      ${emptyState('No accounts connected yet', 'Connect a brokerage or retirement account to see your holdings and performance.')}`;
    return;
  }

  if (!inv.has_investments) {
    section.innerHTML = `<div class="page-header"><h1 class="page-title">Investments</h1></div>
      <div class="card"><div class="empty-state">
        <h3>No investment accounts detected</h3>
        <p>Your connected accounts don't appear to have investment holdings. Link a brokerage or IRA to see this section.</p>
        <button class="btn btn-primary" onclick="openPlaidLink()">+ Connect Brokerage</button>
      </div></div>`;
    return;
  }

  const holdings = inv.holdings || [];
  const totalInvested = holdings.reduce((s, h) => s + (h.institution_value || 0), 0);
  const totalCost = holdings.reduce((s, h) => s + ((h.cost_basis || 0) * (h.quantity || 0)), 0);
  const unrealized = totalInvested - totalCost;
  const returnPct = totalCost > 0 ? (unrealized / totalCost) * 100 : 0;

  section.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Investments</h1>
        <div class="page-subtitle">Holdings, allocation, and portfolio performance</div>
      </div>
      <button class="btn btn-secondary" onclick="loadSection('investments', true)">Refresh</button>
    </div>
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-label">Net Worth</div>
        <div class="stat-value">${fmtUSD(inv.net_worth)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Invested</div>
        <div class="stat-value">${fmtUSD(totalInvested)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Unrealized Gain</div>
        <div class="stat-value ${gainClass(unrealized)}">${fmtSignedUSD(unrealized)}</div>
        <div class="stat-delta ${gainClass(returnPct)}">${returnPct >= 0 ? '+' : ''}${fmtPct(returnPct)}</div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <h3 class="card-title">Allocation</h3>
        <div class="chart-wrap"><canvas id="invAllocationChart"></canvas></div>
      </div>
      <div class="card">
        <h3 class="card-title">Portfolio value (12mo)</h3>
        <div class="chart-wrap"><canvas id="invPortfolioChart"></canvas></div>
      </div>
    </div>

    <h2 class="section-header">Holdings</h2>
    <div class="card" style="padding:0">
      <table class="table">
        <thead><tr>
          <th>Ticker</th><th>Name</th><th class="num">Qty</th>
          <th class="num">Value</th><th class="num">Cost Basis</th><th class="num">Gain/Loss</th>
        </tr></thead>
        <tbody>
          ${renderHoldingsRows(holdings)}
        </tbody>
      </table>
    </div>

    <h2 class="section-header">Accounts</h2>
    <div class="card">${renderAccountRows(accounts)}</div>
  `;

  renderAllocationChart('invAllocationChart', inv.allocation);
  renderPortfolioChart('invPortfolioChart', inv.portfolio_history);
};

RENDERERS.tax = async (section) => {
  const tax = await api('/api/tax');
  const accounts = (await api('/api/investments')).accounts || [];

  if (accounts.length === 0) {
    section.innerHTML = `<div class="page-header"><h1 class="page-title">Tax</h1></div>
      ${emptyState('No investment accounts yet', 'Connect a brokerage or retirement account to see tax analysis.')}`;
    return;
  }

  const gl = tax.gains_and_losses || [];
  const totalUnrealized = gl.reduce((s, g) => s + g.unrealized_gain, 0);
  const tlh = tax.tax_loss_harvesting || [];
  const totalHarvestable = tlh.reduce((s, g) => s + Math.abs(g.unrealized_gain), 0);
  const realized = tax.realized_gains || {};

  section.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Tax</h1>
        <div class="page-subtitle">Unrealized gains, harvesting opportunities, and RSU/ESPP status</div>
      </div>
      <button class="btn btn-secondary" onclick="loadSection('tax', true)">Refresh</button>
    </div>
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-label">Unrealized Gain/Loss</div>
        <div class="stat-value ${gainClass(totalUnrealized)}">${fmtSignedUSD(totalUnrealized)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Harvestable Losses</div>
        <div class="stat-value ${totalHarvestable > 0 ? 'loss' : ''}">${fmtUSD(totalHarvestable)}</div>
        <div class="stat-delta">${tlh.length} position${tlh.length === 1 ? '' : 's'}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Realized YTD</div>
        <div class="stat-value ${gainClass(realized.total_gains)}">${fmtSignedUSD(realized.total_gains)}</div>
        <div class="stat-delta">Est. tax ${fmtUSD((realized.estimated_tax_short || 0) + (realized.estimated_tax_long || 0))}</div>
      </div>
    </div>

    ${renderTLHSection(tlh)}
    ${renderAssetLocationSection(tax.asset_location_flags || [])}
    ${renderESPPSection(tax.espp_status || [])}

    <h2 class="section-header">Unrealized Gains & Losses</h2>
    <div class="card" style="padding:0">
      <table class="table">
        <thead><tr>
          <th>Ticker</th><th>Name</th><th class="num">Value</th>
          <th class="num">Cost</th><th class="num">Gain/Loss</th><th>Term</th><th class="num">Est. Tax</th>
        </tr></thead>
        <tbody>
          ${gl.slice().sort((a, b) => b.unrealized_gain - a.unrealized_gain).map(g => `
            <tr>
              <td><strong>${g.ticker || '—'}</strong>${g.cost_basis_warning ? ' <span class="badge badge-warn" title="Cost basis may be inaccurate (RSU/ESPP)">⚠</span>' : ''}</td>
              <td style="color:var(--text-muted);font-size:12px">${g.security_name || ''}</td>
              <td class="num">${fmtUSD(g.institution_value)}</td>
              <td class="num">${fmtUSD(g.total_cost)}</td>
              <td class="num ${gainClass(g.unrealized_gain)}">${fmtSignedUSD(g.unrealized_gain)}</td>
              <td><span class="badge ${g.is_long_term ? 'badge-gain' : 'badge-neutral'}">${g.is_long_term ? 'Long' : 'Short'}</span></td>
              <td class="num">${fmtUSD(g.estimated_tax)}</td>
            </tr>`).join('') || '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:24px">No holdings to display</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
};

RENDERERS.optimization = async (section) => {
  const opt = await api('/api/optimization');
  const accounts = (await api('/api/investments')).accounts || [];

  if (accounts.length === 0 || opt.total_portfolio_value === 0) {
    section.innerHTML = `<div class="page-header"><h1 class="page-title">Optimization</h1></div>
      ${emptyState('No investment accounts yet', 'Connect a brokerage to see portfolio optimization recommendations.')}`;
    return;
  }

  const conc = opt.concentration_flags || [];
  const hc = opt.high_cost_funds || [];
  const cash = opt.cash_drag || {};
  const rebal = opt.rebalance_suggestion || {};
  const totalDrag = hc.reduce((s, f) => s + (f.annual_drag || 0), 0);

  section.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Optimization</h1>
        <div class="page-subtitle">Rebalancing, concentration risk, expenses, and cash drag</div>
      </div>
      <button class="btn btn-secondary" onclick="loadSection('optimization', true)">Refresh</button>
    </div>
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-label">Concentration Flags</div>
        <div class="stat-value ${conc.length ? 'warn' : ''}">${conc.length}</div>
        <div class="stat-delta">${conc.length ? 'position(s) over threshold' : 'None flagged'}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Annual Expense Drag</div>
        <div class="stat-value ${totalDrag > 0 ? 'warn' : ''}">${fmtUSD(totalDrag)}</div>
        <div class="stat-delta">${hc.length} high-cost fund${hc.length === 1 ? '' : 's'}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Cash Drag</div>
        <div class="stat-value ${cash.flagged ? 'warn' : ''}">${fmtUSD(cash.total_cash)}</div>
        <div class="stat-delta">${fmtPct(cash.pct)} of brokerage</div>
      </div>
    </div>

    ${renderRebalanceSection(rebal)}
    ${renderConcentrationSection(conc, opt.sector_flags || [])}
    ${renderHighCostSection(hc)}
  `;
};

// ── Helpers ──

function renderHoldingsRows(holdings) {
  if (!holdings.length) return '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:24px">No holdings</td></tr>';
  return holdings.slice().sort((a, b) => (b.institution_value || 0) - (a.institution_value || 0)).map(h => {
    const cost = (h.cost_basis || 0) * (h.quantity || 0);
    const gl = (h.institution_value || 0) - cost;
    return `<tr>
      <td><strong>${h.ticker || '—'}</strong></td>
      <td style="color:var(--text-muted);font-size:12px">${h.security_name || ''}</td>
      <td class="num">${(h.quantity || 0).toLocaleString('en-US', { maximumFractionDigits: 4 })}</td>
      <td class="num">${fmtUSD(h.institution_value)}</td>
      <td class="num">${fmtUSD(cost)}</td>
      <td class="num ${gainClass(gl)}">${fmtSignedUSD(gl)}</td>
    </tr>`;
  }).join('');
}

function renderAllocationChart(canvasId, allocation) {
  const entries = Object.entries(allocation || {}).slice(0, 12);
  if (!entries.length) return;
  makeChart(canvasId, canvasId, {
    type: 'doughnut',
    data: {
      labels: entries.map(e => e[0]),
      datasets: [{ data: entries.map(e => e[1]), backgroundColor: PALETTE, borderWidth: 0 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { font: { size: 11 }, boxWidth: 10 } },
        tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${fmtUSD(ctx.parsed)}` } },
      },
      cutout: '60%',
    },
  });
}

function renderTLHSection(tlh) {
  if (!tlh.length) return '';
  return `<h2 class="section-header">Tax-Loss Harvesting Opportunities</h2>
    <div>${tlh.slice(0, 5).map(c => `
      <div class="flag flag-loss-bg">
        <div class="flag-icon">📉</div>
        <div class="flag-body">
          <div class="flag-title">${c.ticker || 'Unknown'} — ${fmtSignedUSD(c.unrealized_gain)} unrealized loss</div>
          <div class="flag-subtitle">
            ${c.wash_sale_risk ? '<strong class="loss">Wash sale risk</strong> — this security was bought in the last 30 days. ' : ''}
            Selling this position could offset capital gains this year.
          </div>
        </div>
      </div>`).join('')}</div>`;
}

function renderAssetLocationSection(flags) {
  if (!flags.length) return '';
  return `<h2 class="section-header">Asset Location Issues</h2>
    <div>${flags.slice(0, 5).map(f => `
      <div class="flag">
        <div class="flag-icon">📍</div>
        <div class="flag-body">
          <div class="flag-title">${f.ticker || f.security_name} in ${f.account_name}</div>
          <div class="flag-subtitle">${f.reason} · Currently holding ${fmtUSD(f.institution_value)}</div>
        </div>
      </div>`).join('')}</div>`;
}

function renderESPPSection(espp) {
  if (!espp.length) return '';
  return `<h2 class="section-header">ESPP Disposition Status</h2>
    <div>${espp.map(e => `
      <div class="flag ${e.qualifying_disposition ? '' : 'flag-loss-bg'}">
        <div class="flag-icon">${e.qualifying_disposition ? '✓' : '⏱'}</div>
        <div class="flag-body">
          <div class="flag-title">${e.ticker} purchased ${e.purchase_date}</div>
          <div class="flag-subtitle">${e.note}</div>
        </div>
      </div>`).join('')}</div>`;
}

function renderRebalanceSection(rebal) {
  const entries = Object.entries(rebal || {});
  if (!entries.length) return '';
  return `<h2 class="section-header">Target Allocation</h2>
    <div class="card">
      ${entries.map(([cls, r]) => {
        const maxPct = Math.max(r.current_pct, r.target_pct, 100);
        const targetLeft = (r.target_pct / maxPct) * 100;
        const onTarget = r.action === 'on target';
        return `<div class="progress-row">
          <div class="progress-label">${cls.replace(/_/g, ' ')}</div>
          <div class="progress-bar">
            <div class="progress-fill" style="width:${Math.min(r.current_pct, 100)}%; background: ${onTarget ? 'var(--gain)' : 'var(--primary)'}"></div>
            <div class="progress-target-marker" style="left:${Math.min(targetLeft, 99)}%"></div>
          </div>
          <div class="progress-stats">
            ${fmtPct(r.current_pct)} / ${fmtPct(r.target_pct)}<br>
            <span class="${onTarget ? 'gain' : 'warn'}">${r.action}${onTarget ? '' : ' ' + fmtUSD(r.suggested_trade_usd, { decimals: 0 })}</span>
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

function renderConcentrationSection(conc, sectorFlags) {
  if (!conc.length && !sectorFlags.length) return '';
  let html = '<h2 class="section-header">Concentration Risk</h2><div>';
  conc.forEach(c => {
    html += `<div class="flag">
      <div class="flag-icon">${c.is_employer ? '🏢' : '⚠'}</div>
      <div class="flag-body">
        <div class="flag-title">${c.ticker} — ${fmtPct(c.pct)} of portfolio${c.is_employer ? ' (employer stock)' : ''}</div>
        <div class="flag-subtitle">Holding ${fmtUSD(c.value)}. ${c.is_employer ? 'Employer equity concentration adds correlated career + investment risk.' : 'Consider trimming to reduce single-position risk.'}</div>
      </div>
    </div>`;
  });
  sectorFlags.forEach(s => {
    html += `<div class="flag">
      <div class="flag-icon">🏭</div>
      <div class="flag-body">
        <div class="flag-title">${s.sector} sector: ${fmtPct(s.pct)}</div>
        <div class="flag-subtitle">Sector concentration above threshold. Consider diversifying across sectors.</div>
      </div>
    </div>`;
  });
  return html + '</div>';
}

function renderHighCostSection(hc) {
  if (!hc.length) return '';
  return `<h2 class="section-header">High-Cost Funds</h2>
    <div class="card" style="padding:0">
      <table class="table">
        <thead><tr><th>Ticker</th><th>Name</th><th class="num">Expense Ratio</th><th class="num">Value</th><th class="num">Annual Drag</th></tr></thead>
        <tbody>
          ${hc.map(f => `<tr>
            <td><strong>${f.ticker || '—'}</strong></td>
            <td style="color:var(--text-muted);font-size:12px">${f.security_name || ''}</td>
            <td class="num warn">${fmtPct((f.expense_ratio || 0) * 100, 2)}</td>
            <td class="num">${fmtUSD(f.institution_value)}</td>
            <td class="num loss">${fmtUSD(f.annual_drag)}/yr</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}
