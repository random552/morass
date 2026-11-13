// =============== FILTERS & SEARCH ===============
function filterTransactions(items) {
  let result = items;

  // Status filter
  if (activeFilter === 'paid') {
    result = result.filter(t => t.status === 'paid');
  } else if (activeFilter === 'debt') {
    result = result.filter(t => t.status === 'debt');
  } else if (activeFilter === 'wasdebt') {
    result = result.filter(t => t.wasDebt === true);
  } else if (activeFilter === 'month' || activeFilter === 'lastmonth' || activeFilter === 'year') {
    const now = new Date();
    result = result.filter(t => {
      const d = new Date(t.date);
      if (activeFilter === 'month') {
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      } else if (activeFilter === 'lastmonth') {
        const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear();
      } else if (activeFilter === 'year') {
        return d.getFullYear() === now.getFullYear();
      }
      return true;
    });
  }

  // Search
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    result = result.filter(t =>
      t.name.toLowerCase().includes(q) ||
      (t.note && t.note.toLowerCase().includes(q))
    );
  }

  return result;
}

function filterInventory(items) {
  let result = items;

  // Date filters apply to inventory too
  if (activeFilter === 'month' || activeFilter === 'lastmonth' || activeFilter === 'year') {
    const now = new Date();
    result = result.filter(i => {
      const d = new Date(i.date);
      if (activeFilter === 'month') {
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      } else if (activeFilter === 'lastmonth') {
        const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear();
      } else if (activeFilter === 'year') {
        return d.getFullYear() === now.getFullYear();
      }
      return true;
    });
  }
  // Paid/debt/wasdebt doesn't apply to inventory; show empty when those filters active
  if (activeFilter === 'paid' || activeFilter === 'debt' || activeFilter === 'wasdebt') {
    return [];
  }

  // Search
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    result = result.filter(i => i.name.toLowerCase().includes(q));
  }

  return result;
}

// Search input handler
$('searchInput').addEventListener('input', e => {
  searchQuery = e.target.value;
  $('clearSearch').classList.toggle('visible', searchQuery.length > 0);
  render();
});
$('clearSearch').addEventListener('click', () => {
  $('searchInput').value = '';
  searchQuery = '';
  $('clearSearch').classList.remove('visible');
  render();
});

// Filter buttons (history filters - exclude payers-sort buttons)
document.querySelectorAll('.filter-btn:not(.payers-sort)').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn:not(.payers-sort)').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.filter;
    render();
  });
});
