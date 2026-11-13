// =============== STATE ===============
const STORAGE_KEY_TR = 'ledger_transactions';
const STORAGE_KEY_INV = 'ledger_inventory';
const PRODUCT_NAME = 'Zboží'; // Universal single-product name
let transactions = JSON.parse(localStorage.getItem(STORAGE_KEY_TR) || '[]');
let inventory = JSON.parse(localStorage.getItem(STORAGE_KEY_INV) || '[]');
let charts = {};
let currentStatus = 'paid';
let searchQuery = '';
let activeFilter = 'all';
let editContext = null; // { type: 'transaction'|'inventory', id: number }

// One-time migration: unify all inventory items under single PRODUCT_NAME
let migrated = false;
inventory.forEach(item => {
  if (item.name !== PRODUCT_NAME) {
    item.name = PRODUCT_NAME;
    migrated = true;
  }
});
if (migrated) {
  localStorage.setItem(STORAGE_KEY_INV, JSON.stringify(inventory));
}

// =============== UTIL ===============
const todayStr = () => new Date().toISOString().split('T')[0];
const fmt = n => Number(n).toLocaleString('cs-CZ');
const $ = id => document.getElementById(id);
let saveTrans = () => localStorage.setItem(STORAGE_KEY_TR, JSON.stringify(transactions));
let saveInv = () => localStorage.setItem(STORAGE_KEY_INV, JSON.stringify(inventory));

// =============== TOAST ===============
function showToast(msg, type = 'success') {
  const old = document.querySelector('.toast');
  if (old) old.remove();
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  const icon = type === 'error'
    ? '<svg class="icon toast-icon error" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>'
    : '<svg class="icon toast-icon success" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';
  t.innerHTML = icon + '<span>' + msg + '</span>';
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
}
