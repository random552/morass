// =============== STATUS BUTTONS ===============
$('statusPaid').addEventListener('click', () => {
  currentStatus = 'paid';
  $('statusPaid').classList.add('active');
  $('statusDebt').classList.remove('active');
});
$('statusDebt').addEventListener('click', () => {
  currentStatus = 'debt';
  $('statusDebt').classList.add('active');
  $('statusPaid').classList.remove('active');
});

// =============== DATE FIELDS ===============
$('trDate').value = todayStr();

$('trDate').addEventListener('change', () => {
  $('todayBtn').style.display = $('trDate').value === todayStr() ? 'none' : 'inline-block';
});
$('todayBtn').addEventListener('click', () => {
  $('trDate').value = todayStr();
  $('todayBtn').style.display = 'none';
});

// =============== ADD TRANSACTION ===============
$('addTrans').addEventListener('click', () => {
  const name = $('trName').value.trim();
  const amount = parseFloat($('trAmount').value);
  const quantity = parseInt($('trQuantity').value);
  if (!name || !amount) {
    showToast('Vyplňte jméno a částku', 'error');
    return;
  }
  const hasQuantity = !isNaN(quantity) && quantity > 0;
  const transId = Date.now();

  transactions.unshift({
    id: transId,
    name,
    amount,
    quantity: hasQuantity ? quantity : null,
    status: currentStatus,
    date: $('trDate').value || todayStr(),
    note: $('trNote').value.trim(),
    createdAt: new Date().toISOString()
  });
  saveTrans();

  // Auto-withdraw from stock if quantity is set
  let stockMessage = '';
  console.log('[Auto-stock] hasQuantity:', hasQuantity, 'quantity:', quantity);
  if (hasQuantity) {
    const productName = getPrimaryProductName();
    console.log('[Auto-stock] productName:', productName, 'inventory length:', inventory.length);
    if (productName) {
      autoWithdrawFromStock(transId, productName, quantity, $('trDate').value || todayStr());
      console.log('[Auto-stock] Withdrawal created');
      // Check stock level after withdrawal
      const stock = getStockByName();
      const current = stock[productName]?.current ?? 0;
      if (current < 0) {
        stockMessage = ` · ⚠ Sklad v mínusu: ${current} ks`;
      } else {
        stockMessage = ` · Sklad: ${current} ks`;
      }
    } else {
      stockMessage = ' · ⚠ Žádný sklad neexistuje';
    }
  }

  $('trName').value = '';
  $('trAmount').value = '';
  $('trQuantity').value = '';
  $('trNote').value = '';
  $('trDate').value = todayStr();
  $('todayBtn').style.display = 'none';
  currentStatus = 'paid';
  $('statusPaid').classList.add('active');
  $('statusDebt').classList.remove('active');
  render();
  showToast('Transakce přidána' + stockMessage);
});

// =============== ACTIONS (transactions) ===============
function deleteTransaction(id) {
  // Remove linked stock auto-withdrawal first (returns items to stock)
  const removed = removeAutoWithdrawal(id);
  transactions = transactions.filter(t => t.id !== id);
  saveTrans();
  render();
  if (removed > 0) {
    showToast('Smazáno · kusy vráceny do skladu');
  } else {
    showToast('Smazáno');
  }
}
function markAsPaid(id) {
  const t = transactions.find(x => x.id === id);
  if (t) {
    t.status = 'paid';
    t.wasDebt = true;
    t.paidAt = new Date().toISOString();
    saveTrans();
    render();
    showToast('Označeno jako zaplaceno');
  }
}
window.deleteTransaction = deleteTransaction;
window.markAsPaid = markAsPaid;

// =============== RENDER TRANS ROW ===============
function renderTransRow(t) {
  let badge;
  if (t.status === 'paid' && t.wasDebt) {
    badge = '<span class="row-badge was-debt"><svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>Bývalý dluh</span>';
  } else if (t.status === 'paid') {
    badge = '<span class="row-badge paid">Zaplaceno</span>';
  } else {
    badge = '<span class="row-badge debt">Dluh</span>';
  }
  const note = t.note
    ? '<div class="row-note">' + escapeHtml(t.note) + '</div>'
    : '';
  const markPaidBtn = t.status === 'debt'
    ? '<button class="row-action-btn mark-paid" onclick="markAsPaid(' + t.id + ')" title="Označit jako zaplaceno"><svg class="icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></button>'
    : '';
  // Format paidAt date if exists
  let paidInfo = '';
  if (t.wasDebt && t.paidAt) {
    const paidDate = new Date(t.paidAt).toLocaleDateString('cs-CZ');
    paidInfo = '<span style="color:rgba(118,185,0,0.7);">· zaplaceno ' + paidDate + '</span>';
  }
  // Quantity info
  let qtyInfo = '';
  let qtySubline = '';
  if (t.quantity && t.quantity > 0) {
    qtyInfo = '<span style="color:rgba(118,185,0,0.7);">· ' + fmt(t.quantity) + ' ks</span>';
    const perUnit = t.amount / t.quantity;
    qtySubline = '<div style="font-size:11px; color:#6b7280; margin-top:2px;">' + fmt(perUnit.toFixed(2)) + ' cr/ks</div>';
  }
  // Bar color: green for paid (incl. wasDebt), red for active debt
  const barColor = t.status === 'paid' ? '#76b900' : '#f87171';
  return `
    <div class="row">
      <div class="row-bar" style="background: ${barColor}"></div>
      <div class="row-content">
        <div class="row-name">
          <span class="row-name-text">${escapeHtml(t.name)}</span>
          ${badge}
        </div>
        <div class="row-meta">
          <svg class="icon" style="width:12px;height:12px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
          ${t.date}
          ${qtyInfo}
          ${paidInfo}
        </div>
        ${note}
      </div>
      <div class="row-right">
        <div class="row-amount ${t.status}">${fmt(t.amount)} cr</div>
        ${qtySubline}
        <div class="row-actions">
          ${markPaidBtn}
          <button class="row-action-btn edit" onclick="openEditModal('transaction', ${t.id})" title="Upravit">
            <svg class="icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
          </button>
          <button class="row-action-btn delete" onclick="deleteTransaction(${t.id})">
            <svg class="icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3"/></svg>
          </button>
        </div>
      </div>
    </div>`;
}

// =============== CSV IMPORT ===============
let pendingImport = null; // Array of {name, amount} ready to be imported

// Parse CSV line respecting quoted fields
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i+1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// Parse Czech currency: "300,00 g" → 300, "1 500,50" → 1500.5, etc.
function parseCzechAmount(str) {
  if (!str) return NaN;
  // Remove "g", spaces (incl non-breaking), other currency symbols
  let cleaned = String(str).replace(/[Kk]č|CZK|\s| /g, '').trim();
  // Replace Czech decimal comma with dot, but only if there's no dot already
  // Handle thousand separators: "1.500,50" → "1500.50"
  if (cleaned.indexOf(',') >= 0 && cleaned.indexOf('.') >= 0) {
    // Both present: dot is thousand separator, comma is decimal
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (cleaned.indexOf(',') >= 0) {
    cleaned = cleaned.replace(',', '.');
  }
  return parseFloat(cleaned);
}

function parseCSV(text) {
  // Strip BOM
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  // Split lines (handle both \n and \r\n)
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return [];

  // Detect separator (comma vs semicolon — Sheets CSV uses comma, Excel CZ exports use semicolon)
  const firstLine = lines[0];
  const semicolons = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  const sep = semicolons > commas ? ';' : ',';

  // If using semicolons, replace with commas for our parser
  const parsed = lines.map(line => {
    if (sep === ';') {
      // Simple replace OK because we handle quotes in parseCSVLine
      // but be safe: parse with semicolon directly
      const cells = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i+1] === '"') { current += '"'; i++; }
          else inQuotes = !inQuotes;
        } else if (ch === ';' && !inQuotes) {
          cells.push(current);
          current = '';
        } else {
          current += ch;
        }
      }
      cells.push(current);
      return cells;
    }
    return parseCSVLine(line);
  });

  return parsed;
}

function processImportFile(text) {
  const rows = parseCSV(text);
  if (rows.length === 0) {
    showToast('Soubor je prázdný', 'error');
    return;
  }

  // Detect header: if first row has non-numeric in column C (index 2), it's a header
  let startIdx = 0;
  if (rows[0].length >= 3) {
    const possibleAmount = parseCzechAmount(rows[0][2]);
    if (isNaN(possibleAmount)) startIdx = 1; // Header row
  }

  const items = [];
  const errors = [];
  for (let i = startIdx; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 3) {
      errors.push(`Řádek ${i+1}: chybí sloupce`);
      continue;
    }
    const name = (row[1] || '').trim().replace(/^"|"$/g, '');
    const amount = parseCzechAmount(row[2]);

    if (!name) {
      errors.push(`Řádek ${i+1}: chybí jméno`);
      continue;
    }
    if (isNaN(amount) || amount <= 0) {
      errors.push(`Řádek ${i+1}: neplatná částka "${row[2]}"`);
      continue;
    }
    items.push({ name, amount });
  }

  if (items.length === 0) {
    showToast('Nenalezeny žádné platné řádky', 'error');
    return;
  }

  pendingImport = items;
  showImportPreview(items, errors);
}

function showImportPreview(items, errors) {
  const totalSum = items.reduce((s, i) => s + i.amount, 0);
  const previewItems = items.slice(0, 50);
  const truncated = items.length > 50;

  const errorsHtml = errors.length > 0
    ? `<div class="import-warning">
         <svg class="icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
         <div><strong>${errors.length}</strong> řádků přeskočeno (chybí jméno nebo neplatná částka)</div>
       </div>`
    : '';

  $('importBody').innerHTML = `
    <p style="color:#a89889; font-size:13px; margin-bottom:16px;">
      Náhled importu — všechny záznamy budou označené jako <strong style="color:#76b900;">PAID</strong>.
      <br><strong style="color:#f87171;">Stávající transakce budou smazány a nahrazeny.</strong>
    </p>
    <div class="import-stats">
      <div class="import-stat">
        <div class="import-stat-label">Počet</div>
        <div class="import-stat-value">${items.length}</div>
      </div>
      <div class="import-stat">
        <div class="import-stat-label">Celkem</div>
        <div class="import-stat-value">${fmt(totalSum)} cr</div>
      </div>
    </div>
    ${errorsHtml}
    <div style="font-size:11px; color:var(--muted); margin-bottom:6px;">
      Náhled ${truncated ? '(prvních 50)' : ''}:
    </div>
    <div class="import-preview-list">
      ${previewItems.map(it => `
        <div class="import-preview-row">
          <span class="name">${escapeHtml(it.name)}</span>
          <span class="amount">${fmt(it.amount)} cr</span>
        </div>
      `).join('')}
    </div>
  `;

  $('importModal').classList.add('active');
}

function confirmImport() {
  if (!pendingImport || pendingImport.length === 0) return;

  const today = todayStr();
  const baseTime = Date.now();

  // Replace all transactions
  transactions = pendingImport.map((item, idx) => ({
    id: baseTime + idx,
    name: item.name,
    amount: item.amount,
    status: 'paid',
    date: today,
    note: '',
    createdAt: new Date().toISOString(),
    importedAt: new Date().toISOString()
  }));

  saveTrans();
  pendingImport = null;
  $('importModal').classList.remove('active');
  render();
  showToast(`Naimportováno ${transactions.length} transakcí`);
}

// Wire up import flow
$('importBtn').addEventListener('click', () => $('importFile').click());
$('importFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      processImportFile(evt.target.result);
    } catch (err) {
      console.error(err);
      showToast('Chyba při čtení souboru', 'error');
    }
  };
  reader.onerror = () => showToast('Soubor se nepodařilo načíst', 'error');
  reader.readAsText(file, 'UTF-8');
  e.target.value = ''; // Reset so same file can be selected again
});
$('importClose').addEventListener('click', () => {
  $('importModal').classList.remove('active');
  pendingImport = null;
});
$('importCancel').addEventListener('click', () => {
  $('importModal').classList.remove('active');
  pendingImport = null;
});
$('importConfirm').addEventListener('click', confirmImport);
$('importModal').addEventListener('click', e => {
  if (e.target.id === 'importModal') {
    $('importModal').classList.remove('active');
    pendingImport = null;
  }
});
