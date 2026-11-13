// ===== RIPPLE EFFECT ON PRIMARY BUTTONS =====
document.addEventListener('click', e => {
  const btn = e.target.closest('.btn-primary');
  if (!btn) return;
  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  ripple.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - rect.left - size / 2}px;top:${e.clientY - rect.top - size / 2}px`;
  btn.appendChild(ripple);
  ripple.addEventListener('animationend', () => ripple.remove());
});

// ===== ANIMATED NUMBER COUNTER =====
function animateValue(el, to, duration = 700) {
  if (!el) return;
  const raw = el.textContent.replace(/[\s ]/g, '').replace(',', '.');
  const from = parseFloat(raw) || 0;
  if (from === to) return;
  const startTime = performance.now();
  function tick(now) {
    const p = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = fmt(Math.round(from + (to - from) * eased));
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// Hook into renderStats — watch for stat value changes
const statIds = ['totalPaid','totalDebt','totalItems','paidCount','debtCount',
                 'stockCurrent','stockTotalIn','stockTotalOut','debtTotalSum','debtPaidSum'];

const _observer = new MutationObserver(mutations => {
  mutations.forEach(m => {
    const el = m.target;
    const to = parseFloat(String(el.textContent).replace(/[\s ]/g, '').replace(',', '.'));
    if (!isNaN(to)) animateValue(el, to);
  });
});

window.addEventListener('load', () => {
  statIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) _observer.observe(el, { childList: true, characterData: true, subtree: true });
  });
});

// ===== CARD SUBTLE TILT ON HOVER =====
document.addEventListener('mousemove', e => {
  document.querySelectorAll('.stat-card').forEach(card => {
    const rect = card.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / rect.width;
    const dy = (e.clientY - cy) / rect.height;
    const inside = e.clientX >= rect.left && e.clientX <= rect.right &&
                   e.clientY >= rect.top  && e.clientY <= rect.bottom;
    if (inside) {
      card.style.transform = `translateY(-3px) rotateX(${-dy * 4}deg) rotateY(${dx * 4}deg)`;
      card.style.transition = 'transform 0.1s ease';
    } else {
      card.style.transform = '';
      card.style.transition = 'transform 0.4s ease, border-color 0.25s ease, box-shadow 0.25s ease';
    }
  });
});
