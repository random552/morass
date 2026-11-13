// =============== DEBT SUMMARY ===============
function renderDebtSummary() {
  const debts = transactions.filter(t => t.status === 'debt');

  // Group by name
  const byName = {};
  debts.forEach(t => {
    if (!byName[t.name]) {
      byName[t.name] = { name: t.name, total: 0, count: 0, oldest: t.date, newest: t.date };
    }
    byName[t.name].total += t.amount;
    byName[t.name].count++;
    if (t.date < byName[t.name].oldest) byName[t.name].oldest = t.date;
    if (t.date > byName[t.name].newest) byName[t.name].newest = t.date;
  });

  const sorted = Object.values(byName).sort((a, b) => b.total - a.total);
  const totalSum = sorted.reduce((s, p) => s + p.total, 0);
  const paidDebtsSum = transactions.filter(t => t.status === 'paid' && t.wasDebt).reduce((s, t) => s + t.amount, 0);

  $('debtTotalSum').textContent = fmt(totalSum);
  $('debtPaidSum').textContent = fmt(paidDebtsSum);
  $('debtPeopleCount').textContent = sorted.length;

  const container = $('debtSummary');
  if (sorted.length === 0) {
    container.innerHTML = `
      <div class="card debt-empty" style="grid-column: 1 / -1;">
        <svg class="debt-empty-icon" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        <div>Žádné dluhy! Skvělé.</div>
      </div>`;
    return;
  }

  container.innerHTML = sorted.map(p => `
    <div class="debt-card">
      <div class="debt-card-clickable" onclick="showDebtDetail('${escapeHtml(p.name).replace(/'/g, "\\'")}')">
        <div class="debt-card-header">
          <div class="debt-card-name">${escapeHtml(p.name)}</div>
          <div class="debt-card-count">${p.count} ${p.count === 1 ? 'dluh' : (p.count < 5 ? 'dluhy' : 'dluhů')}</div>
        </div>
        <div class="debt-card-amount">${fmt(p.total)} <span class="unit">cr</span></div>
        <div class="debt-card-meta">
          <span>Od ${p.oldest}</span>
          <span>Posl. ${p.newest}</span>
        </div>
      </div>
      <button class="debt-card-pay-btn" onclick="markAllDebtsPaid('${escapeHtml(p.name).replace(/'/g, "\\'")}', event)">
        <svg class="icon" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
        ${p.count === 1 ? 'Označit jako zaplaceno' : `Zaplatit vše (${p.count})`}
      </button>
    </div>
  `).join('');
}

// Mark all debts of a specific person as paid
function markAllDebtsPaid(name, event) {
  if (event) event.stopPropagation();
  const debtsOfPerson = transactions.filter(t => t.status === 'debt' && t.name === name);
  if (debtsOfPerson.length === 0) return;
  const totalAmount = debtsOfPerson.reduce((s, t) => s + t.amount, 0);
  const msg = debtsOfPerson.length === 1
    ? `Označit dluh ${name} (${fmt(totalAmount)} cr) jako zaplaceno?`
    : `Označit všech ${debtsOfPerson.length} dluhů osoby ${name} (${fmt(totalAmount)} cr) jako zaplacené?`;
  if (!confirm(msg)) return;
  const now = new Date().toISOString();
  debtsOfPerson.forEach(t => {
    t.status = 'paid';
    t.wasDebt = true;
    t.paidAt = now;
  });
  saveTrans();
  render();
  showToast(`Zaplaceno ${fmt(totalAmount)} cr od${name}`);
}
window.markAllDebtsPaid = markAllDebtsPaid;

function showDebtDetail(name) {
  // Switch to history tab and filter by this person
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('[data-tab="history"]').classList.add('active');
  document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
  $('tab-history').classList.add('active');

  // Set search and filter
  $('searchInput').value = name;
  searchQuery = name;
  $('clearSearch').classList.add('visible');

  document.querySelectorAll('.filter-btn:not(.payers-sort)').forEach(b => b.classList.remove('active'));
  document.querySelector('[data-filter="debt"]').classList.add('active');
  activeFilter = 'debt';

  render();
  // Scroll up
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.showDebtDetail = showDebtDetail;
