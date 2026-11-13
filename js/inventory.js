// =============== INVENTORY TOTAL PREVIEW ===============
function updateInvPreview() {
  const q = parseFloat($('invQty').value);
  const p = parseFloat($('invPrice').value);
  if (q && p) {
    $('invTotalValue').textContent = fmt(q * p) + ' cr';
    $('invTotalPreview').style.display = 'block';
  } else {
    $('invTotalPreview').style.display = 'none';
  }
}
$('invQty').addEventListener('input', updateInvPreview);
$('invPrice').addEventListener('input', updateInvPreview);

// =============== ADD INVENTORY ===============
$('addInv').addEventListener('click', () => {
  const qty = parseInt($('invQty').value);
  const price = parseFloat($('invPrice').value);
  if (!qty || qty <= 0) {
    showToast('Vyplňte počet kusů', 'error');
    return;
  }
  inventory.unshift({
    id: Date.now(),
    name: PRODUCT_NAME,
    quantity: qty,
    pricePerUnit: isNaN(price) ? 0 : price,
    type: 'in',
    date: $('invDate').value || todayStr(),
    createdAt: new Date().toISOString()
  });
  saveInv();
  $('invQty').value = '';
  $('invPrice').value = '';
  $('invDate').value = todayStr();
  updateInvPreview();
  render();
  showToast('Zboží naskladněno');
});

// =============== ACTIONS (inventory) ===============
function deleteInventory(id) {
  const item = inventory.find(i => i.id === id);
  if (item && item.linkedTransactionId) {
    showToast('Tento odpis je propojen s transakcí, nelze smazat', 'error');
    return;
  }
  inventory = inventory.filter(i => i.id !== id);
  saveInv();
  render();
  showToast('Smazáno');
}
window.deleteInventory = deleteInventory;

// =============== RENDER INV ROW ===============
function renderInvRow(i) {
  const isOut = i.type === 'out';
  const isAuto = !!i.linkedTransactionId;
  const totalValue = i.quantity * (i.pricePerUnit || 0);
  let badge;
  if (isOut && isAuto) {
    badge = '<span class="movement-badge out">−ODPIS</span> <span class="movement-badge" style="background:rgba(118,185,0,0.12); color:#76b900;">AUTO</span>';
  } else if (isOut) {
    badge = '<span class="movement-badge out">−ODPIS</span>';
  } else {
    badge = '<span class="movement-badge in">+SKLAD</span>';
  }
  const sign = isOut ? '−' : '+';
  const amountClass = isOut ? 'debt' : 'paid';
  const iconColor = isOut ? '#f87171' : '#76b900';
  const iconBg = isOut ? 'rgba(248,113,113,0.08)' : 'rgba(118,185,0,0.08)';

  // Title: linked transaction name, manual reason, or default
  let titleText;
  if (isAuto && i.linkedTransactionId) {
    const linkedTrans = transactions.find(t => t.id === i.linkedTransactionId);
    titleText = linkedTrans ? `Prodej · ${linkedTrans.name}` : 'Auto-odpis';
  } else if (isOut) {
    titleText = i.reason || 'Ruční odpis';
  } else {
    titleText = 'Naskladnění';
  }

  const valueLine = !isOut && i.pricePerUnit !== undefined && i.pricePerUnit > 0
    ? '<div class="row-secondary">' + fmt(totalValue) + ' cr</div>'
    : '';
  const priceMeta = !isOut && i.pricePerUnit !== undefined && i.pricePerUnit > 0
    ? '<span style="color:rgba(118,185,0,0.6);">· ' + fmt(i.pricePerUnit) + ' cr/ks</span>'
    : '';

  return `
    <div class="row">
      <div class="row-icon-box" style="background:${iconBg}; color:${iconColor};">
        ${isOut
          ? '<svg class="icon-lg" style="width:20px;height:20px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 13l-5 5m0 0l-5-5m5 5V6"/></svg>'
          : '<svg class="icon-lg" style="width:20px;height:20px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0v10l-8 4m8-14l-8 4m0 0L4 7m8 4v10"/></svg>'
        }
      </div>
      <div class="row-content">
        <div class="row-name">
          <span class="row-name-text" style="color:#f5f1e8;">${escapeHtml(titleText)}</span>
          ${badge}
        </div>
        <div class="row-meta">
          <span style="display:flex;align-items:center;gap:4px;">
            <svg class="icon" style="width:12px;height:12px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
            ${i.date}
          </span>
          ${priceMeta}
        </div>
      </div>
      <div class="row-right">
        <div class="row-amount ${amountClass}" style="font-size:16px;font-weight:600;">
          ${sign}${fmt(i.quantity)} <span style="font-size:11px;color:#6b7280;">ks</span>
        </div>
        ${valueLine}
        <div class="row-actions">
          <button class="row-action-btn edit" onclick="openEditModal('inventory', ${i.id})" title="Upravit">
            <svg class="icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
          </button>
          <button class="row-action-btn delete" onclick="deleteInventory(${i.id})">
            <svg class="icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3"/></svg>
          </button>
        </div>
      </div>
    </div>`;
}

// =============== AUTO STOCK LINKING ===============
// Always returns the universal product name (single-product setup)
function getPrimaryProductName() {
  return PRODUCT_NAME;
}

// Auto-create a stock OUT movement linked to a transaction
function autoWithdrawFromStock(transId, productName, qty, date) {
  if (!productName || !qty || qty <= 0) return null;
  const outRecord = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    name: productName,
    quantity: qty,
    type: 'out',
    reason: 'Auto-odpis (transakce)',
    date: date,
    linkedTransactionId: transId,
    createdAt: new Date().toISOString()
  };
  inventory.unshift(outRecord);
  saveInv();
  return outRecord.id;
}

// Remove auto-withdrawal linked to a transaction (when transaction is deleted)
function removeAutoWithdrawal(transId) {
  const before = inventory.length;
  inventory = inventory.filter(i => i.linkedTransactionId !== transId);
  const removed = before - inventory.length;
  if (removed > 0) saveInv();
  return removed;
}

// =============== STOCK SUMMARY ===============
// Inventory items have type: 'in' (default for old data) or 'out' (withdrawal)
// quantity is always positive, type determines direction

function getStockByName() {
  const stock = {};
  inventory.forEach(item => {
    if (!stock[item.name]) {
      stock[item.name] = {
        name: item.name,
        totalIn: 0,
        totalOut: 0,
        valueIn: 0,
        lastPrice: 0,
        lastDate: item.date,
        firstDate: item.date
      };
    }
    const s = stock[item.name];
    if (item.type === 'out') {
      s.totalOut += item.quantity;
    } else {
      s.totalIn += item.quantity;
      if (item.pricePerUnit) {
        s.valueIn += item.quantity * item.pricePerUnit;
        s.lastPrice = item.pricePerUnit;
      }
    }
    if (item.date > s.lastDate) s.lastDate = item.date;
    if (item.date < s.firstDate) s.firstDate = item.date;
  });
  // Calculate current quantity
  Object.values(stock).forEach(s => {
    s.current = s.totalIn - s.totalOut;
    s.currentValue = s.current * s.lastPrice;
  });
  return stock;
}

function renderStockSummary() {
  const stock = getStockByName();
  const items = Object.values(stock).sort((a, b) => {
    // Sort: in stock first (highest current), then empty
    if (a.current > 0 && b.current <= 0) return -1;
    if (a.current <= 0 && b.current > 0) return 1;
    return b.current - a.current;
  });

  // Summary stats
  const totalCurrent = items.reduce((s, i) => s + Math.max(0, i.current), 0);
  const totalIn = items.reduce((s, i) => s + i.totalIn, 0);
  const totalOut = items.reduce((s, i) => s + i.totalOut, 0);
  const currentValue = items.reduce((s, i) => s + Math.max(0, i.currentValue), 0);
  const inStockTypes = items.filter(i => i.current > 0).length;

  $('stockCurrent').textContent = fmt(totalCurrent);
  $('stockTypes').textContent = inStockTypes;
  $('stockCurrentValue').textContent = fmt(currentValue);
  $('stockTotalIn').textContent = fmt(totalIn);
  $('stockTotalOut').textContent = fmt(totalOut);

  // Stock grid - simplified for single product
  const grid = $('stockGrid');
  if (items.length === 0) {
    grid.innerHTML = '<div class="empty" style="grid-column: 1 / -1;">Sklad je prázdný — naskladněte zboží níže</div>';
  } else {
    grid.innerHTML = items.map(s => {
      const isEmpty = s.current <= 0;
      const isNegative = s.current < 0;
      const disabled = isEmpty ? 'disabled' : '';
      const statusBadge = isNegative
        ? '<span class="movement-badge out">⚠ Mínusový stav</span>'
        : isEmpty
          ? '<span class="movement-badge out">Sklad prázdný</span>'
          : '<span class="movement-badge in">Skladem</span>';
      return `
        <div class="stock-card ${isEmpty ? 'empty' : ''}" style="grid-column: 1 / -1;">
          <div class="stock-card-header">
            <div class="stock-card-name">${statusBadge}</div>
            <div class="stock-card-current" style="font-size: 36px;">
              ${fmt(s.current)} <span class="unit">ks</span>
            </div>
          </div>
          <div class="stock-card-stats">
            <div>
              <div class="stock-stat-label">Naskladněno celkem</div>
              <div class="stock-stat-value in">+${fmt(s.totalIn)} ks</div>
            </div>
            <div>
              <div class="stock-stat-label">Odepsáno celkem</div>
              <div class="stock-stat-value out">−${fmt(s.totalOut)} ks</div>
            </div>
          </div>
          <button class="stock-card-action" ${disabled} onclick="openWithdrawModal('${escapeHtml(s.name).replace(/'/g, "\\'")}')">
            <svg class="icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 13l-5 5m0 0l-5-5m5 5V6"/></svg>
            Ruční odpis kusů
          </button>
        </div>`;
    }).join('');
  }

  // Update datalists for autocomplete
  const invDl = $('invNamesList');
  if (invDl) {
    invDl.innerHTML = Object.keys(stock).map(name => `<option value="${escapeHtml(name)}">`).join('');
  }
  const trDl = $('trNamesList');
  if (trDl) {
    const uniqueNames = [...new Set(transactions.map(t => t.name))];
    trDl.innerHTML = uniqueNames.map(name => `<option value="${escapeHtml(name)}">`).join('');
  }
}

// =============== WITHDRAW MODAL ===============
function openWithdrawModal(name) {
  const stock = getStockByName();
  const s = stock[name];
  if (!s || s.current <= 0) return;

  $('withdrawBody').innerHTML = `
    <div style="margin-bottom: 16px; padding: 12px; border-radius: 8px; background: rgba(118,185,0,0.05); border: 1px solid rgba(118,185,0,0.2);">
      <div style="font-size: 11px; color: rgba(118,185,0,0.7); letter-spacing: 0.1em; margin-bottom: 4px;">POLOŽKA</div>
      <div style="font-size: 18px; font-weight: 600; color: #f5f1e8; margin-bottom: 8px;">${escapeHtml(s.name)}</div>
      <div style="font-size: 13px; color: #6b7280;">Aktuálně k dispozici: <span style="color: #76b900; font-weight: 600;">${fmt(s.current)} ks</span></div>
    </div>
    <div class="form-grid">
      <div>
        <label class="field-label">Počet k odepsání</label>
        <input type="number" id="wdQty" placeholder="1" min="1" max="${s.current}" value="1">
      </div>
      <div>
        <label class="field-label">Datum</label>
        <input type="date" id="wdDate" value="${todayStr()}">
      </div>
      <div class="col-span-2">
        <label class="field-label">Důvod <span style="color:#565656; text-transform:none;">(volitelné)</span></label>
        <input type="text" id="wdReason" placeholder="Např. prodej, použito, ztráta…">
      </div>
    </div>
  `;
  $('withdrawModal').dataset.itemName = name;
  $('withdrawModal').classList.add('active');
  setTimeout(() => $('wdQty').focus(), 100);
}

function saveWithdraw() {
  const name = $('withdrawModal').dataset.itemName;
  const qty = parseInt($('wdQty').value);
  const date = $('wdDate').value;
  const reason = $('wdReason').value.trim();

  if (!qty || qty <= 0) {
    showToast('Zadejte platný počet', 'error');
    return;
  }

  const stock = getStockByName();
  if (qty > stock[name].current) {
    showToast('Nelze odepsat více než je k dispozici', 'error');
    return;
  }

  inventory.unshift({
    id: Date.now(),
    name,
    quantity: qty,
    type: 'out',
    reason,
    date: date || todayStr(),
    createdAt: new Date().toISOString()
  });
  saveInv();
  $('withdrawModal').classList.remove('active');
  render();
  showToast(`Odepsáno ${qty} ks ${name}`);
}

window.openWithdrawModal = openWithdrawModal;
$('withdrawClose').addEventListener('click', () => $('withdrawModal').classList.remove('active'));
$('withdrawCancel').addEventListener('click', () => $('withdrawModal').classList.remove('active'));
$('withdrawSave').addEventListener('click', saveWithdraw);
$('withdrawModal').addEventListener('click', e => {
  if (e.target.id === 'withdrawModal') $('withdrawModal').classList.remove('active');
});

// Date initialization
$('invDate').value = todayStr();
