// =============== TABS ===============
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
    $('tab-' + tab).classList.add('active');
    // Re-trigger stagger
    const section = $('tab-' + tab);
    section.querySelectorAll('.stagger > *').forEach(el => {
      el.style.animation = 'none';
      el.offsetHeight;
      el.style.animation = '';
    });
    if (window.innerWidth < 768) $('navInner').classList.add('collapsed');
    if (tab === 'dashboard') renderCharts();
  });
});
$('menuBtn').addEventListener('click', () => {
  $('navInner').classList.toggle('collapsed');
  setTimeout(updateTopSpacer, 50);
});

// =============== FLOATING NAV BUTTON (FAB) ===============
function closeFab() {
  $('fabNav').classList.remove('open');
  $('fabMenu').classList.remove('open');
  $('fabBackdrop').classList.remove('open');
}
function toggleFab() {
  const isOpen = $('fabNav').classList.contains('open');
  if (isOpen) {
    closeFab();
  } else {
    $('fabNav').classList.add('open');
    $('fabMenu').classList.add('open');
    $('fabBackdrop').classList.add('open');
    document.querySelectorAll('.fab-menu-item').forEach(item => {
      const tab = item.dataset.fabTab;
      const section = $('tab-' + tab);
      if (section && section.classList.contains('active')) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }
}
$('fabNav').addEventListener('click', (e) => {
  e.stopPropagation();
  toggleFab();
});
$('fabBackdrop').addEventListener('click', closeFab);

document.querySelectorAll('.fab-menu-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.stopPropagation();
    const tab = item.dataset.fabTab;
    const navBtn = document.querySelector(`.tab-btn[data-tab="${tab}"]`);
    if (navBtn) navBtn.click();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    closeFab();
  });
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && $('fabNav').classList.contains('open')) {
    closeFab();
  }
});

// =============== EDIT MODAL ===============
function openEditModal(type, id) {
  editContext = { type, id };
  const modal = $('editModal');
  const title = $('modalTitle');
  const body = $('modalBody');

  if (type === 'transaction') {
    const t = transactions.find(x => x.id === id);
    if (!t) return;
    title.textContent = 'Upravit transakci';
    body.innerHTML = `
      <div class="form-grid">
        <div>
          <label class="field-label">Jméno</label>
          <input type="text" id="editName" value="${escapeHtml(t.name)}">
        </div>
        <div>
          <label class="field-label">Částka (cr)</label>
          <input type="number" id="editAmount" value="${t.amount}">
        </div>
        <div>
          <label class="field-label">Počet kusů <span style="color:#565656; text-transform:none;">(volitelné)</span></label>
          <input type="number" id="editQuantity" value="${t.quantity || ''}" min="1">
        </div>
        <div>
          <label class="field-label">Status</label>
          <div class="status-buttons">
            <button class="status-btn paid${t.status === 'paid' ? ' active' : ''}" id="editStatusPaid">Zaplaceno</button>
            <button class="status-btn debt${t.status === 'debt' ? ' active' : ''}" id="editStatusDebt">Dluh</button>
          </div>
        </div>
        <div>
          <label class="field-label">Datum</label>
          <input type="date" id="editDate" value="${t.date}">
        </div>
        <div class="col-span-2">
          <label class="field-label">Poznámka</label>
          <textarea id="editNote" rows="2">${escapeHtml(t.note || '')}</textarea>
        </div>
      </div>
    `;
    // Setup status button events
    let editStatus = t.status;
    $('editStatusPaid').addEventListener('click', () => {
      editStatus = 'paid';
      $('editStatusPaid').classList.add('active');
      $('editStatusDebt').classList.remove('active');
    });
    $('editStatusDebt').addEventListener('click', () => {
      editStatus = 'debt';
      $('editStatusDebt').classList.add('active');
      $('editStatusPaid').classList.remove('active');
    });
    editContext.getStatus = () => editStatus;
  } else if (type === 'inventory') {
    const i = inventory.find(x => x.id === id);
    if (!i) return;
    const isOut = i.type === 'out';
    title.textContent = isOut ? 'Upravit odpis' : 'Upravit naskladnění';
    body.innerHTML = `
      <div class="form-grid">
        <div>
          <label class="field-label">POČET KUSŮ</label>
          <input type="number" id="editQty" value="${i.quantity}">
        </div>
        ${!isOut ? `
        <div>
          <label class="field-label">CENA ZA KUS (cr)</label>
          <input type="number" step="0.01" id="editPrice" value="${i.pricePerUnit || 0}">
        </div>` : ''}
        <div>
          <label class="field-label">DATUM</label>
          <input type="date" id="editDate" value="${i.date}">
        </div>
        ${isOut ? `
        <div class="col-span-2">
          <label class="field-label">DŮVOD</label>
          <input type="text" id="editReason" value="${escapeHtml(i.reason || '')}">
        </div>` : ''}
      </div>
    `;
    editContext.isOut = isOut;
  }

  modal.classList.add('active');
  setTimeout(() => {
    const firstInput = $('editName') || $('editQty');
    if (firstInput) firstInput.focus();
  }, 100);
}

function closeEditModal() {
  $('editModal').classList.remove('active');
  editContext = null;
  // Reset modal buttons (in case Info modal hid them)
  const saveBtn = $('modalSave');
  const cancelBtn = $('modalCancel');
  if (saveBtn) saveBtn.style.display = '';
  if (cancelBtn) cancelBtn.textContent = 'Zrušit';
}

function saveEdit() {
  if (!editContext) return;
  const { type, id } = editContext;

  // Info modal has nothing to save
  if (type === 'info') {
    closeEditModal();
    return;
  }

  const name = $('editName').value.trim();
  const date = $('editDate').value;

  if (!name || !date) {
    showToast('Vyplňte všechna povinná pole', 'error');
    return;
  }

  if (type === 'transaction') {
    const amount = parseFloat($('editAmount').value);
    if (!amount || amount <= 0) {
      showToast('Neplatná částka', 'error');
      return;
    }
    const quantityEl = $('editQuantity');
    const quantity = quantityEl ? parseInt(quantityEl.value) : NaN;
    const newQty = (!isNaN(quantity) && quantity > 0) ? quantity : null;
    const t = transactions.find(x => x.id === id);
    if (t) {
      const oldQty = t.quantity;
      t.name = name;
      t.amount = amount;
      t.quantity = newQty;
      t.status = editContext.getStatus();
      t.date = date;
      t.note = $('editNote').value.trim();
      t.updatedAt = new Date().toISOString();
      saveTrans();

      // Update linked stock withdrawal if quantity changed
      if (oldQty !== newQty) {
        // Remove old auto-withdrawal
        removeAutoWithdrawal(id);
        // Create new one if quantity is set
        if (newQty) {
          const productName = getPrimaryProductName();
          if (productName) {
            autoWithdrawFromStock(id, productName, newQty, date);
          }
        }
      } else if (newQty) {
        // Quantity same but date might have changed - update linked record
        const linked = inventory.find(i => i.linkedTransactionId === id);
        if (linked) {
          linked.date = date;
          saveInv();
        }
      }
    }
  } else if (type === 'inventory') {
    const qty = parseInt($('editQty').value);
    if (!qty || qty <= 0) {
      showToast('Neplatný počet kusů', 'error');
      return;
    }
    const i = inventory.find(x => x.id === id);
    if (i) {
      i.name = name;
      i.quantity = qty;
      i.date = date;
      if (editContext.isOut) {
        const reasonEl = $('editReason');
        if (reasonEl) i.reason = reasonEl.value.trim();
      } else {
        const priceEl = $('editPrice');
        if (priceEl) {
          const price = parseFloat(priceEl.value);
          i.pricePerUnit = isNaN(price) ? 0 : price;
        }
      }
      i.updatedAt = new Date().toISOString();
      saveInv();
    }
  }

  closeEditModal();
  render();
  showToast('Změny uloženy');
}

window.openEditModal = openEditModal;
$('modalClose').addEventListener('click', closeEditModal);
$('modalCancel').addEventListener('click', closeEditModal);
$('modalSave').addEventListener('click', saveEdit);
$('editModal').addEventListener('click', e => {
  if (e.target.id === 'editModal') closeEditModal();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && $('editModal').classList.contains('active')) closeEditModal();
});

// =============== MAIN RENDER ===============
function render() {
  renderStats();
  updateHeaderStatus();

  // Transaction list (limited - tab transactions)
  const trListEl = $('trList');
  if (transactions.length === 0) {
    trListEl.innerHTML = '<div class="empty">Zatím žádné transakce</div>';
  } else {
    trListEl.innerHTML = transactions.slice(0, 20).map(renderTransRow).join('');
  }
  $('trCount').textContent = transactions.length;

  // Transaction list (history - filtered)
  const filteredTrans = filterTransactions(transactions);
  const trHistEl = $('trListHist');
  if (filteredTrans.length === 0) {
    trHistEl.innerHTML = '<div class="empty">' + (transactions.length === 0 ? 'Žádná data' : 'Nic neodpovídá filtru') + '</div>';
  } else {
    trHistEl.innerHTML = filteredTrans.map(renderTransRow).join('');
  }
  $('trCountHist').textContent = filteredTrans.length;

  // Inventory list (limited - tab inventory)
  const invListEl = $('invList');
  if (inventory.length === 0) {
    invListEl.innerHTML = '<div class="empty">Sklad je prázdný</div>';
  } else {
    invListEl.innerHTML = inventory.slice(0, 20).map(renderInvRow).join('');
  }
  $('invCount').textContent = inventory.length;

  // Inventory list (history - filtered)
  const filteredInv = filterInventory(inventory);
  const invHistEl = $('invListHist');
  if (filteredInv.length === 0) {
    invHistEl.innerHTML = '<div class="empty">' + (inventory.length === 0 ? 'Žádná data' : 'Nic neodpovídá filtru') + '</div>';
  } else {
    invHistEl.innerHTML = filteredInv.map(renderInvRow).join('');
  }
  $('invCountHist').textContent = filteredInv.length;

  // Debt summary
  renderDebtSummary();

  // Stock summary (current state per item)
  renderStockSummary();

  // All payers list (dashboard)
  renderAllPayers();

  // Re-render charts if dashboard active
  if ($('tab-dashboard').classList.contains('active')) {
    renderCharts();
  }
}

// =============== INTERACTIVE BACKGROUND ===============
const canvas = $('bgCanvas');
const ctx = canvas.getContext('2d');
let particles = [];
const mouse = { x: -1000, y: -1000 };

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const count = Math.min(80, Math.floor((canvas.width * canvas.height) / 22000));
  particles = Array.from({ length: count }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    vx: (Math.random() - 0.5) * 0.3,
    vy: (Math.random() - 0.5) * 0.3,
    radius: Math.random() * 1.5 + 0.5,
  }));
}
window.addEventListener('resize', resizeCanvas);
window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
window.addEventListener('mouseleave', () => { mouse.x = -1000; mouse.y = -1000; });
resizeCanvas();

function animate() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  particles.forEach(p => {
    const dx = mouse.x - p.x;
    const dy = mouse.y - p.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < 150 && dist > 0) {
      const force = (150 - dist) / 150 * 0.05;
      p.vx += (dx / dist) * force;
      p.vy += (dy / dist) * force;
    }
    p.vx *= 0.98; p.vy *= 0.98;
    p.vx += (Math.random() - 0.5) * 0.02;
    p.vy += (Math.random() - 0.5) * 0.02;
    p.x += p.vx; p.y += p.vy;
    if (p.x < 0) p.x = canvas.width;
    if (p.x > canvas.width) p.x = 0;
    if (p.y < 0) p.y = canvas.height;
    if (p.y > canvas.height) p.y = 0;

    const mDist = Math.sqrt((mouse.x - p.x)**2 + (mouse.y - p.y)**2);
    const glow = mDist < 200 ? (200 - mDist) / 200 : 0;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius + glow * 1.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(118,185,0,' + (0.3 + glow * 0.5) + ')';
    ctx.fill();
  });

  for (let i = 0; i < particles.length; i++) {
    for (let j = i+1; j < particles.length; j++) {
      const dx = particles[i].x - particles[j].x;
      const dy = particles[i].y - particles[j].y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < 120) {
        const opacity = (1 - dist/120) * 0.15;
        ctx.beginPath();
        ctx.moveTo(particles[i].x, particles[i].y);
        ctx.lineTo(particles[j].x, particles[j].y);
        ctx.strokeStyle = 'rgba(118,185,0,' + opacity + ')';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }
  }
  requestAnimationFrame(animate);
}
animate();

// =============== HEADER MENU ===============
const headerMenuBtn = $('headerMenuBtn');
const headerDropdown = $('headerDropdown');
if (headerMenuBtn && headerDropdown) {
  headerMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    headerDropdown.classList.toggle('open');
  });
  document.addEventListener('click', (e) => {
    if (!headerDropdown.contains(e.target) && e.target !== headerMenuBtn) {
      headerDropdown.classList.remove('open');
    }
  });
}

// Export data to JSON file
function exportData() {
  const data = {
    appName: '552',
    version: '1.0',
    exportDate: new Date().toISOString(),
    transactions: transactions,
    inventory: inventory
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().split('T')[0];
  a.href = url;
  a.download = `552-zaloha-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Záloha stažena');
  if (headerDropdown) headerDropdown.classList.remove('open');
}

// Import data from JSON file
function importData(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!Array.isArray(data.transactions) || !Array.isArray(data.inventory)) {
        showToast('Neplatný soubor zálohy', 'error');
        return;
      }
      const trCount = data.transactions.length;
      const invCount = data.inventory.length;
      const msg = `Načíst zálohu?\n\nStávající data (${transactions.length} transakcí, ${inventory.length} pohybů skladu) BUDOU NAHRAZENA.\n\nNová data: ${trCount} transakcí, ${invCount} pohybů skladu.`;
      if (!confirm(msg)) return;
      transactions = data.transactions;
      inventory = data.inventory;
      // Migrate inventory names to PRODUCT_NAME
      inventory.forEach(item => { if (item.name !== PRODUCT_NAME) item.name = PRODUCT_NAME; });
      saveTrans();
      saveInv();
      render();
      showToast(`Načteno ${trCount} transakcí, ${invCount} pohybů`);
    } catch (err) {
      console.error(err);
      showToast('Chyba při čtení souboru', 'error');
    }
  };
  reader.readAsText(file, 'UTF-8');
}

// Show app info modal
function showAppInfo() {
  if (headerDropdown) headerDropdown.classList.remove('open');
  const totalSum = transactions.reduce((s, t) => s + t.amount, 0);
  const totalDebt = transactions.filter(t => t.status === 'debt').reduce((s, t) => s + t.amount, 0);
  const totalPaid = transactions.filter(t => t.status === 'paid').reduce((s, t) => s + t.amount, 0);
  const stock = getStockByName();
  const currentStock = Object.values(stock).reduce((s, i) => s + Math.max(0, i.current), 0);

  $('modalTitle').textContent = 'O aplikaci 552';
  $('modalBody').innerHTML = `
    <div style="text-align:center; padding: 16px 0;">
      <div style="font-family: 'Orbitron', sans-serif; font-size: 48px; font-weight: 900; letter-spacing: 0.15em; background: linear-gradient(180deg, #c4f550 0%, #76b900 60%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; margin-bottom: 8px;">552</div>
      <div style="font-size: 11px; color: #6b7280; letter-spacing: 0.2em; margin-bottom: 20px;">FIKTIVNÍ ÚČETNICTVÍ</div>
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
      <div style="padding: 12px; background: rgba(118,185,0,0.05); border: 1px solid rgba(118,185,0,0.15); border-radius: 8px;">
        <div style="font-size: 10px; color: rgba(118,185,0,0.7); letter-spacing: 0.15em; margin-bottom: 4px;">ZAPLACENO</div>
        <div style="font-size: 16px; font-weight: 700; color: #76b900;">${fmt(totalPaid)} cr</div>
      </div>
      <div style="padding: 12px; background: rgba(248,113,113,0.05); border: 1px solid rgba(248,113,113,0.15); border-radius: 8px;">
        <div style="font-size: 10px; color: rgba(248,113,113,0.7); letter-spacing: 0.15em; margin-bottom: 4px;">DLUHY</div>
        <div style="font-size: 16px; font-weight: 700; color: #f87171;">${fmt(totalDebt)} cr</div>
      </div>
      <div style="padding: 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px;">
        <div style="font-size: 10px; color: #6b7280; letter-spacing: 0.15em; margin-bottom: 4px;">TRANSAKCÍ</div>
        <div style="font-size: 16px; font-weight: 700; color: #f5f1e8;">${transactions.length}</div>
      </div>
      <div style="padding: 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px;">
        <div style="font-size: 10px; color: #6b7280; letter-spacing: 0.15em; margin-bottom: 4px;">NA SKLADĚ</div>
        <div style="font-size: 16px; font-weight: 700; color: #f5f1e8;">${fmt(currentStock)} ks</div>
      </div>
    </div>
    <div style="margin-top: 16px; padding: 12px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; font-size: 12px; color: #a89889; line-height: 1.6;">
      Data jsou uložena lokálně v prohlížeči. Pro zálohu použijte <strong style="color:#76b900;">Exportovat zálohu</strong> v menu (3 tečky).
    </div>
  `;
  $('modalSave').style.display = 'none';
  $('modalCancel').textContent = 'ZAVŘÍT';
  editContext = { type: 'info' };
  $('editModal').classList.add('active');
}

// Wire up menu items
const menuExportBtn = $('menuExport');
const menuImportBtn = $('menuImport');
const menuImportFile = $('menuImportFile');
const menuInfoBtn = $('menuInfo');
if (menuExportBtn) menuExportBtn.addEventListener('click', exportData);
if (menuImportBtn) menuImportBtn.addEventListener('click', () => menuImportFile && menuImportFile.click());
if (menuImportFile) menuImportFile.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) importData(file);
  e.target.value = '';
});
if (menuInfoBtn) menuInfoBtn.addEventListener('click', showAppInfo);

// =============== HEADER STATUS ===============
function updateHeaderStatus() {
  const el1 = $('hdrTransCount');
  const el3 = $('hdrToday');
  if (el1) el1.textContent = transactions.length;
  if (el3) {
    const now = new Date();
    el3.textContent = now.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' });
  }
}

// Update date every minute (in case user keeps app open across midnight)
setInterval(() => {
  const el = $('hdrToday');
  if (el) {
    const now = new Date();
    el.textContent = now.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' });
  }
}, 60000);

// =============== HEADER SPACER ===============
// Header is fixed - spacer pushes content down so it isn't hidden behind header
function updateTopSpacer() {
  const header = document.querySelector('header');
  const spacer = $('topSpacer');
  if (header && spacer) {
    const h = header.offsetHeight;
    spacer.style.height = h + 'px';
  }
}
window.addEventListener('load', updateTopSpacer);
window.addEventListener('resize', updateTopSpacer);
setTimeout(updateTopSpacer, 100);
setTimeout(updateTopSpacer, 500);
setTimeout(updateTopSpacer, 1000);

// =============== SERVICE WORKER (PWA) ===============
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js')
      .then(reg => console.log('[PWA] Service Worker registered:', reg.scope))
      .catch(err => console.log('[PWA] Service Worker registration failed:', err));
  });
}

// Listen for install prompt
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  console.log('[PWA] Aplikaci lze nainstalovat');
});

window.addEventListener('appinstalled', () => {
  console.log('[PWA] Aplikace nainstalována');
  deferredInstallPrompt = null;
});

// =============== INIT ===============

// Collapse mobile nav on startup
if (window.innerWidth < 768) {
  $('navInner').classList.add('collapsed');
}

render();
updateTopSpacer();

// Re-render charts on resize
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if ($('tab-dashboard').classList.contains('active')) renderCharts();
  }, 250);
});
