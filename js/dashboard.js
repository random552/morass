// =============== STATS ===============
function renderStats() {
  const totalPaid = transactions.filter(t => t.status === 'paid').reduce((s, t) => s + t.amount, 0);
  const totalDebt = transactions.filter(t => t.status === 'debt').reduce((s, t) => s + t.amount, 0);

  // Calculate current stock (in - out)
  const stock = getStockByName();
  const items = Object.values(stock);
  const currentItems = items.reduce((s, i) => s + Math.max(0, i.current), 0);
  const inStockTypes = items.filter(i => i.current > 0).length;
  const totalValue = items.reduce((s, i) => s + Math.max(0, i.currentValue), 0);

  $('totalPaid').textContent = fmt(totalPaid);
  $('totalDebt').textContent = fmt(totalDebt);
  $('totalItems').textContent = fmt(currentItems);
  $('paidCount').textContent = transactions.filter(t => t.status === 'paid').length;
  $('debtCount').textContent = transactions.filter(t => t.status === 'debt').length;
  $('invMeta').textContent = inStockTypes + ' položek · ' + fmt(totalValue) + ' cr';
}

// =============== CHARTS ===============
function renderCharts() {
  const tickColor = '#555';
  const gridColor = 'rgba(255,255,255,0.05)';
  const tooltipBg = '#050505';

  Object.values(charts).forEach(c => c && c.destroy());
  charts = {};

  // Chart 3: Top 5 names (each with unique color)
  const byName = {};
  transactions.forEach(t => { byName[t.name] = (byName[t.name] || 0) + t.amount; });
  const top = Object.entries(byName).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const top5Colors = ['#76b900', '#22d3ee', '#fbbf24', '#a78bfa', '#fb7185'];

  if (top.length > 0) {
    if (!$('chart3Wrap').querySelector('canvas')) {
      $('chart3Wrap').innerHTML = '<canvas id="chart3"></canvas>';
    }
    charts.c3 = new Chart($('chart3'), {
      type: 'bar',
      data: {
        labels: top.map(([n]) => n),
        datasets: [{
          data: top.map(([, v]) => v),
          backgroundColor: top.map((_, i) => top5Colors[i]),
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => fmt(ctx.parsed.x) + ' cr'
            }
          }
        },
        scales: {
          x: { ticks: { color: tickColor, font:{size:10} }, grid: { color: gridColor } },
          y: { ticks: { color: tickColor, font:{size:10} }, grid: { display: false } }
        }
      }
    });
  } else {
    $('chart3Wrap').innerHTML = '<div class="empty-chart">Žádná data k zobrazení</div>';
  }

  // Render the current month daily chart
  renderCurrentMonthChart();

  // Render the monthly overview chart
  renderMonthlyChart();

  // Render the cumulative chart (from beginning)
  renderCumulativeChart();
}

// =============== MONTHLY OVERVIEW CHART ===============
let monthlyMetric = 'amount'; // 'amount', 'count', 'quantity'

// Days excluded from monthly chart calculations (e.g. big imports that skew stats)
const EXCLUDED_DATES = new Set([
  '2026-05-13'  // Big CSV import day - skews monthly stats
]);

function isExcludedDate(dateStr) {
  return EXCLUDED_DATES.has(dateStr);
}

const MONTH_NAMES_CZ = ['Led', 'Úno', 'Bře', 'Dub', 'Kvě', 'Čer', 'Čvc', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro'];

function renderMonthlyChart() {
  const tickColor = '#555';
  const gridColor = 'rgba(255,255,255,0.05)';
  const tooltipBg = '#050505';

  // Aggregate ALL transactions by year-month (paid + debt)
  // Both count as sales - debt is just unpaid yet
  // Exclude specified dates (e.g. big imports)
  const allTransactions = transactions.filter(t =>
    !isExcludedDate(t.date)
  );

  if (allTransactions.length === 0) {
    $('monthlyChartWrap').innerHTML = '<div class="empty-chart">Zatím žádné prodeje</div>';
    $('monthlyBest').textContent = '—';
    $('monthlyBestSub').textContent = '—';
    $('monthlyAvg').textContent = '—';
    $('monthlyAvgSub').textContent = '—';
    $('monthlyTotal').textContent = '—';
    $('monthlyTotalSub').textContent = '—';
    return;
  }

  const byMonth = {};
  allTransactions.forEach(t => {
    if (!t.date) return;
    const d = new Date(t.date);
    if (isNaN(d.getTime())) return;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!byMonth[key]) {
      byMonth[key] = {
        key: key,
        year: d.getFullYear(),
        month: d.getMonth(),
        amount: 0,
        count: 0,
        quantity: 0
      };
    }
    byMonth[key].amount += t.amount;
    byMonth[key].count += 1;
    byMonth[key].quantity += (t.quantity || 0);
  });

  // Sort by date
  let monthsData = Object.values(byMonth).sort((a, b) => a.key.localeCompare(b.key));

  // Fill in missing months in between (so the chart shows gaps)
  if (monthsData.length > 1) {
    const filled = [];
    const first = monthsData[0];
    const last = monthsData[monthsData.length - 1];
    let cur = new Date(first.year, first.month, 1);
    const end = new Date(last.year, last.month, 1);
    while (cur <= end) {
      const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`;
      const existing = monthsData.find(m => m.key === key);
      filled.push(existing || {
        key, year: cur.getFullYear(), month: cur.getMonth(),
        amount: 0, count: 0, quantity: 0
      });
      cur.setMonth(cur.getMonth() + 1);
    }
    monthsData = filled;
  }

  // Limit to last 12 months max (so it doesn't get too wide)
  if (monthsData.length > 12) {
    monthsData = monthsData.slice(-12);
  }

  // Prepare metric values
  const metricValues = monthsData.map(m => m[monthlyMetric]);
  const labels = monthsData.map(m => `${MONTH_NAMES_CZ[m.month]} ${String(m.year).slice(2)}`);

  // Compute moving average (3-month trend line) - or just average for shorter series
  let trendValues;
  if (monthsData.length >= 3) {
    trendValues = monthsData.map((m, i) => {
      const start = Math.max(0, i - 1);
      const end = Math.min(monthsData.length, i + 2);
      const window = metricValues.slice(start, end);
      return window.reduce((s, v) => s + v, 0) / window.length;
    });
  } else {
    // Average flat line
    const avg = metricValues.reduce((s, v) => s + v, 0) / metricValues.length;
    trendValues = monthsData.map(() => avg);
  }

  // Find best month
  let bestIdx = 0;
  for (let i = 1; i < metricValues.length; i++) {
    if (metricValues[i] > metricValues[bestIdx]) bestIdx = i;
  }
  const bestMonth = monthsData[bestIdx];
  const totalSum = metricValues.reduce((s, v) => s + v, 0);
  const monthsWithData = monthsData.filter(m => m[monthlyMetric] > 0).length || 1;
  const avgValue = totalSum / monthsWithData;

  // Format helpers
  const unit = monthlyMetric === 'amount' ? 'cr' : (monthlyMetric === 'count' ? 'transakcí' : 'ks');
  const formatVal = (v) => {
    if (monthlyMetric === 'amount') return fmt(Math.round(v));
    return fmt(Math.round(v));
  };

  // Update stats cards
  $('monthlyBest').textContent = `${formatVal(metricValues[bestIdx])} ${unit}`;
  $('monthlyBestSub').textContent = `${MONTH_NAMES_CZ[bestMonth.month]} ${bestMonth.year}`;
  $('monthlyAvg').textContent = `${formatVal(avgValue)} ${unit}`;
  $('monthlyAvgSub').textContent = `${monthsWithData} ${monthsWithData === 1 ? 'měsíc' : (monthsWithData < 5 ? 'měsíce' : 'měsíců')} s daty`;
  $('monthlyTotal').textContent = `${formatVal(totalSum)} ${unit}`;
  $('monthlyTotalSub').textContent = `za ${monthsData.length} ${monthsData.length === 1 ? 'měsíc' : (monthsData.length < 5 ? 'měsíce' : 'měsíců')}`;

  // Destroy old chart
  if (charts.monthly) {
    charts.monthly.destroy();
    charts.monthly = null;
  }

  // Recreate canvas if needed
  let canvas = $('monthlyChart');
  if (!canvas) {
    $('monthlyChartWrap').innerHTML = '<canvas id="monthlyChart"></canvas>';
    canvas = $('monthlyChart');
  }

  // Bar colors - highlight best month
  const barColors = monthsData.map((m, i) => {
    if (i === bestIdx) return 'rgba(196, 245, 80, 0.85)';  // bright yellow-green for best
    return 'rgba(118, 185, 0, 0.55)';
  });
  const borderColors = monthsData.map((m, i) => {
    if (i === bestIdx) return '#c4f550';
    return '#76b900';
  });

  charts.monthly = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          type: 'bar',
          label: monthlyMetric === 'amount' ? 'Částka' : (monthlyMetric === 'count' ? 'Počet transakcí' : 'Počet kusů'),
          data: metricValues,
          backgroundColor: barColors,
          borderColor: borderColors,
          borderWidth: 1.5,
          borderRadius: 6,
          order: 2
        },
        {
          type: 'line',
          label: 'Trend',
          data: trendValues,
          borderColor: 'rgba(248, 113, 113, 0.8)',
          backgroundColor: 'rgba(248, 113, 113, 0.1)',
          borderWidth: 2,
          borderDash: [6, 4],
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointBackgroundColor: '#f87171',
          fill: false,
          order: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          align: 'end',
          labels: {
            color: '#a89889',
            font: { size: 11, family: 'Poppins' },
            usePointStyle: true,
            pointStyle: 'rect',
            padding: 12,
            boxWidth: 12,
            boxHeight: 12
          }
        },
        tooltip: {
          backgroundColor: tooltipBg,
          borderColor: 'rgba(118,185,0,0.3)',
          borderWidth: 1,
          titleColor: '#76b900',
          bodyColor: '#f5f1e8',
          padding: 12,
          callbacks: {
            label: (ctx) => {
              const v = Math.round(ctx.parsed.y);
              return `${ctx.dataset.label}: ${fmt(v)} ${unit}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: gridColor, drawBorder: false },
          ticks: { color: tickColor, font: { size: 11, family: 'Poppins' } }
        },
        y: {
          grid: { color: gridColor, drawBorder: false },
          ticks: {
            color: tickColor,
            font: { size: 11, family: 'Poppins' },
            callback: (v) => fmt(Math.round(v))
          },
          beginAtZero: true
        }
      }
    }
  });
}

// Wire up monthly toggles
document.querySelectorAll('.monthly-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.monthly-toggle').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    monthlyMetric = btn.dataset.metric;
    renderMonthlyChart();
  });
});

// =============== CURRENT MONTH DAILY CHART ===============
const MONTHS_FULL_CZ = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
                        'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'];

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function renderCurrentMonthChart() {
  const tickColor = '#555';
  const gridColor = 'rgba(255,255,255,0.05)';
  const tooltipBg = '#050505';

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const todayDay = now.getDate();
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);

  // Previous month
  let prevMonth = currentMonth - 1;
  let prevYear = currentYear;
  if (prevMonth < 0) { prevMonth = 11; prevYear--; }
  const daysInPrevMonth = getDaysInMonth(prevYear, prevMonth);

  // Update label
  $('currentMonthLabel').textContent = `(${MONTHS_FULL_CZ[currentMonth]} ${currentYear})`;
  $('currentMonthSub').textContent = `Denní prodej kusů (vč. dluhů) — porovnání s ${MONTHS_FULL_CZ[prevMonth].toLowerCase()}em`;

  // Filter all transactions for current and previous month (paid + debt)
  // Both paid and debt count as sales - debt is just unpaid yet
  // Exclude specified dates (e.g. big imports)
  const allTransactions = transactions.filter(t =>
    t.quantity > 0 && !isExcludedDate(t.date)
  );

  // Aggregate by day for current month
  const currentMonthData = new Array(daysInMonth).fill(0);
  const prevMonthData = new Array(daysInPrevMonth).fill(0);

  allTransactions.forEach(t => {
    if (!t.date) return;
    const d = new Date(t.date);
    if (isNaN(d.getTime())) return;
    const qty = t.quantity || 0;

    if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
      currentMonthData[d.getDate() - 1] += qty;
    } else if (d.getFullYear() === prevYear && d.getMonth() === prevMonth) {
      prevMonthData[d.getDate() - 1] += qty;
    }
  });

  // Build labels (1, 2, 3, ... up to daysInMonth)
  const labels = Array.from({ length: daysInMonth }, (_, i) => `${i + 1}.`);

  // For previous month data, take only same number of days as current month
  // (or pad with nulls if prev month is shorter)
  const prevMonthDataForChart = [];
  for (let i = 0; i < daysInMonth; i++) {
    prevMonthDataForChart.push(i < daysInPrevMonth ? prevMonthData[i] : null);
  }

  // Total for current month (up to today)
  const currentTotal = currentMonthData.slice(0, todayDay).reduce((s, v) => s + v, 0);
  // Total for previous month at same point (up to same day)
  const prevAtSamePoint = prevMonthData.slice(0, Math.min(todayDay, daysInPrevMonth)).reduce((s, v) => s + v, 0);
  // Total for whole previous month
  const prevTotalFull = prevMonthData.reduce((s, v) => s + v, 0);

  // Today's value
  const todayValue = currentMonthData[todayDay - 1] || 0;

  // Best day
  let bestIdx = 0;
  for (let i = 1; i < currentMonthData.length; i++) {
    if (currentMonthData[i] > currentMonthData[bestIdx]) bestIdx = i;
  }
  const bestValue = currentMonthData[bestIdx];

  // Average per day (active days only - up to today, only days with data)
  const activeDays = currentMonthData.slice(0, todayDay).filter(v => v > 0).length || 1;
  const avgValue = currentTotal / activeDays;

  // Calculate change vs prev month at same point
  let changeStr = '—';
  if (prevAtSamePoint > 0) {
    const pct = ((currentTotal - prevAtSamePoint) / prevAtSamePoint) * 100;
    const arrow = pct >= 0 ? '↑' : '↓';
    const color = pct >= 0 ? '#76b900' : '#f87171';
    changeStr = `<span style="color:${color}; font-weight:600;">${pct >= 0 ? '+' : ''}${pct.toFixed(0)}% ${arrow}</span>`;
  } else if (currentTotal > 0) {
    changeStr = `<span style="color:#76b900; font-weight:600;">NOVÉ</span>`;
  } else if (prevAtSamePoint === 0 && currentTotal === 0) {
    changeStr = '—';
  }

  // Update stats
  $('cmTotal').textContent = `${fmt(currentTotal)} ks`;
  $('cmTotalChange').innerHTML = `vs minulý měsíc: ${changeStr}`;

  $('cmToday').textContent = `${fmt(todayValue)} ks`;
  $('cmTodaySub').textContent = `${todayDay}. ${MONTHS_FULL_CZ[currentMonth].toLowerCase()}`;

  if (bestValue > 0) {
    $('cmBestDay').textContent = `${fmt(bestValue)} ks`;
    $('cmBestDaySub').textContent = `${bestIdx + 1}. ${MONTHS_FULL_CZ[currentMonth].toLowerCase()}`;
  } else {
    $('cmBestDay').textContent = '—';
    $('cmBestDaySub').textContent = '—';
  }

  $('cmAvg').textContent = `${fmt(Math.round(avgValue))} ks`;
  $('cmAvgSub').textContent = `z ${activeDays} ${activeDays === 1 ? 'aktivního dne' : (activeDays < 5 ? 'aktivních dnů' : 'aktivních dnů')}`;

  // Destroy old chart
  if (charts.currentMonth) {
    charts.currentMonth.destroy();
    charts.currentMonth = null;
  }

  // Recreate canvas if needed
  let canvas = $('currentMonthChart');
  if (!canvas) {
    $('currentMonthChartWrap').innerHTML = '<canvas id="currentMonthChart"></canvas>';
    canvas = $('currentMonthChart');
  }

  // Mask data after today (don't show future days)
  const currentMonthDataMasked = currentMonthData.map((v, i) =>
    (i < todayDay) ? v : null
  );

  // Datasets
  const datasets = [
    {
      label: `${MONTHS_FULL_CZ[currentMonth]} ${currentYear}`,
      data: currentMonthDataMasked,
      borderColor: '#76b900',
      backgroundColor: 'rgba(118, 185, 0, 0.15)',
      borderWidth: 2.5,
      tension: 0.3,
      pointRadius: 3,
      pointHoverRadius: 6,
      pointBackgroundColor: '#76b900',
      pointBorderColor: '#0a0a0a',
      pointBorderWidth: 2,
      fill: true,
      spanGaps: false
    },
    {
      label: `${MONTHS_FULL_CZ[prevMonth]} ${prevYear}`,
      data: prevMonthDataForChart,
      borderColor: 'rgba(107, 114, 128, 0.6)',
      backgroundColor: 'rgba(107, 114, 128, 0.05)',
      borderWidth: 1.5,
      borderDash: [5, 4],
      tension: 0.3,
      pointRadius: 0,
      pointHoverRadius: 4,
      fill: false,
      spanGaps: false
    }
  ];

  charts.currentMonth = new Chart(canvas, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          align: 'end',
          labels: {
            color: '#a89889',
            font: { size: 11, family: 'Poppins' },
            usePointStyle: true,
            pointStyle: 'rect',
            padding: 12,
            boxWidth: 12,
            boxHeight: 12
          }
        },
        tooltip: {
          backgroundColor: tooltipBg,
          borderColor: 'rgba(118,185,0,0.3)',
          borderWidth: 1,
          titleColor: '#76b900',
          bodyColor: '#f5f1e8',
          padding: 12,
          callbacks: {
            title: (ctx) => `${ctx[0].label} ${MONTHS_FULL_CZ[currentMonth].toLowerCase()}`,
            label: (ctx) => {
              const v = ctx.parsed.y;
              if (v === null) return null;
              return `${ctx.dataset.label}: ${fmt(v)} ks`;
            }
          }
        },
        // Today line annotation
        annotation: {
          annotations: {}
        }
      },
      scales: {
        x: {
          grid: { color: gridColor, drawBorder: false },
          ticks: {
            color: tickColor,
            font: { size: 10, family: 'Poppins' },
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 15
          }
        },
        y: {
          grid: { color: gridColor, drawBorder: false },
          ticks: {
            color: tickColor,
            font: { size: 11, family: 'Poppins' },
            callback: (v) => fmt(Math.round(v))
          },
          beginAtZero: true
        }
      }
    }
  });
}

// =============== CUMULATIVE CHART (from beginning) ===============
let cumulativeView = 'cumulative';

function renderCumulativeChart() {
  const tickColor = '#555';
  const gridColor = 'rgba(255,255,255,0.05)';
  const tooltipBg = '#050505';

  const allTx = transactions.filter(t =>
    t.quantity > 0 && t.date && !isExcludedDate(t.date)
  );

  if (allTx.length === 0) {
    $('cumulativeChartWrap').innerHTML = '<div class="empty-chart">Zatím žádné prodeje</div>';
    $('cumTotal').textContent = '—';
    $('cumTotalSub').textContent = '—';
    $('cumFirst').textContent = '—';
    $('cumFirstSub').textContent = '—';
    $('cumActiveDays').textContent = '—';
    $('cumActiveDaysSub').textContent = '—';
    $('cumAvg').textContent = '—';
    $('cumAvgSub').textContent = '—';
    $('cumAvgAll').textContent = '—';
    $('cumAvgAllSub').textContent = '—';
    return;
  }

  const byDay = {};
  allTx.forEach(t => {
    if (!byDay[t.date]) byDay[t.date] = 0;
    byDay[t.date] += (t.quantity || 0);
  });

  const sortedDays = Object.keys(byDay).sort();
  const firstDay = sortedDays[0];
  const lastDay = sortedDays[sortedDays.length - 1];

  const allDays = [];
  const dailyValues = [];
  const cumulativeValues = [];
  let runningTotal = 0;

  const start = new Date(firstDay);
  const end = new Date(lastDay);
  const cur = new Date(start);
  while (cur <= end) {
    const yyyy = cur.getFullYear();
    const mm = String(cur.getMonth() + 1).padStart(2, '0');
    const dd = String(cur.getDate()).padStart(2, '0');
    const key = `${yyyy}-${mm}-${dd}`;
    allDays.push(key);
    const dayVal = byDay[key] || 0;
    dailyValues.push(dayVal);
    runningTotal += dayVal;
    cumulativeValues.push(runningTotal);
    cur.setDate(cur.getDate() + 1);
  }

  const totalDays = allDays.length;
  const labels = allDays.map(d => {
    const dt = new Date(d);
    if (totalDays > 90) {
      return `${dt.getDate()}.${dt.getMonth() + 1}.${String(dt.getFullYear()).slice(2)}`;
    }
    return `${dt.getDate()}.${dt.getMonth() + 1}.`;
  });

  const totalSum = runningTotal;
  const activeDays = Object.keys(byDay).length;
  const avgPerActiveDay = totalSum / Math.max(activeDays, 1);
  const avgPerAllDays = totalSum / Math.max(totalDays, 1);

  const firstDate = new Date(firstDay);
  const firstDateStr = `${firstDate.getDate()}.${firstDate.getMonth() + 1}.${firstDate.getFullYear()}`;
  const daysSinceFirst = Math.floor((new Date() - firstDate) / (1000 * 60 * 60 * 24));

  $('cumTotal').textContent = `${fmt(totalSum)} ks`;
  $('cumTotalSub').textContent = `za ${totalDays} ${totalDays === 1 ? 'den' : (totalDays < 5 ? 'dny' : 'dnů')}`;

  $('cumFirst').textContent = firstDateStr;
  $('cumFirstSub').textContent = `před ${daysSinceFirst} ${daysSinceFirst === 1 ? 'dnem' : (daysSinceFirst < 5 ? 'dny' : 'dny')}`;

  $('cumActiveDays').textContent = `${fmt(activeDays)}`;
  $('cumActiveDaysSub').textContent = `z ${totalDays} celkem (${Math.round(activeDays/totalDays*100)}%)`;

  $('cumAvg').textContent = `${fmt(Math.round(avgPerActiveDay))} ks`;
  $('cumAvgSub').textContent = `jen dny s prodejem`;

  // Avg per ALL days (including days without any sales) - 1 decimal
  const avgAllRounded = Math.round(avgPerAllDays * 10) / 10;
  $('cumAvgAll').textContent = `${avgAllRounded.toLocaleString('cs-CZ', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ks`;
  $('cumAvgAllSub').textContent = `vč. prázdných dnů`;

  if (charts.cumulative) {
    charts.cumulative.destroy();
    charts.cumulative = null;
  }

  let canvas = $('cumulativeChart');
  if (!canvas) {
    $('cumulativeChartWrap').innerHTML = '<canvas id="cumulativeChart"></canvas>';
    canvas = $('cumulativeChart');
  }

  const chartData = cumulativeView === 'cumulative' ? cumulativeValues : dailyValues;
  const chartLabel = cumulativeView === 'cumulative' ? 'Kumulativní prodeje' : 'Denní prodeje';
  const chartType = cumulativeView === 'cumulative' ? 'line' : 'bar';

  $('cumulativeSub').textContent = cumulativeView === 'cumulative'
    ? 'Kumulativní součet prodaných kusů v čase (vč. dluhů)'
    : 'Denní prodané kusy v čase (vč. dluhů)';

  const dataset = cumulativeView === 'cumulative' ? {
    label: chartLabel,
    data: chartData,
    borderColor: '#76b900',
    backgroundColor: 'rgba(118, 185, 0, 0.15)',
    borderWidth: 2.5,
    tension: 0.3,
    pointRadius: 0,
    pointHoverRadius: 5,
    pointBackgroundColor: '#76b900',
    pointBorderColor: '#0a0a0a',
    pointBorderWidth: 2,
    fill: true
  } : {
    label: chartLabel,
    data: chartData,
    backgroundColor: 'rgba(118, 185, 0, 0.6)',
    borderColor: '#76b900',
    borderWidth: 1,
    borderRadius: 3
  };

  charts.cumulative = new Chart(canvas, {
    type: chartType,
    data: { labels, datasets: [dataset] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: tooltipBg,
          borderColor: 'rgba(118,185,0,0.3)',
          borderWidth: 1,
          titleColor: '#76b900',
          bodyColor: '#f5f1e8',
          padding: 12,
          callbacks: {
            label: (ctx) => `${chartLabel}: ${fmt(ctx.parsed.y)} ks`
          }
        }
      },
      scales: {
        x: {
          grid: { color: gridColor, drawBorder: false },
          ticks: {
            color: tickColor,
            font: { size: 10, family: 'Poppins' },
            maxRotation: 45,
            autoSkip: true,
            maxTicksLimit: 20
          }
        },
        y: {
          grid: { color: gridColor, drawBorder: false },
          ticks: {
            color: tickColor,
            font: { size: 11, family: 'Poppins' },
            callback: (v) => fmt(Math.round(v))
          },
          beginAtZero: true
        }
      }
    }
  });
}

document.querySelectorAll('.monthly-toggle[data-cum-view]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.monthly-toggle[data-cum-view]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    cumulativeView = btn.dataset.cumView;
    renderCumulativeChart();
  });
});

// =============== ALL PAYERS ===============
let payersSortBy = 'amount';

function renderAllPayers() {
  const container = $('allPayers');
  if (!container) return;

  // Aggregate by name
  const byName = {};
  transactions.forEach(t => {
    if (!byName[t.name]) {
      byName[t.name] = {
        name: t.name,
        total: 0,           // total all time (paid + debt)
        paidTotal: 0,
        debtTotal: 0,
        count: 0,
        paidCount: 0,
        debtCount: 0
      };
    }
    const p = byName[t.name];
    p.total += t.amount;
    p.count++;
    if (t.status === 'paid') {
      p.paidTotal += t.amount;
      p.paidCount++;
    } else {
      p.debtTotal += t.amount;
      p.debtCount++;
    }
  });

  let payers = Object.values(byName);

  // Sort
  if (payersSortBy === 'amount') {
    payers.sort((a, b) => b.total - a.total);
  } else if (payersSortBy === 'name') {
    payers.sort((a, b) => a.name.localeCompare(b.name, 'cs'));
  } else if (payersSortBy === 'count') {
    payers.sort((a, b) => b.count - a.count);
  }

  if (payers.length === 0) {
    container.innerHTML = '<div class="empty">Zatím žádní plátci</div>';
    return;
  }

  // Calculate top 5 ranking by amount (regardless of current sort)
  const topByAmount = [...payers].sort((a, b) => b.total - a.total).slice(0, 5);
  const topRank = new Map();
  topByAmount.forEach((p, i) => topRank.set(p.name, i + 1));

  container.innerHTML = `
    <div style="font-size:11px; color:#6b7280; margin-bottom:12px;">
      Celkem <strong style="color:#f5f1e8;">${payers.length}</strong> ${payers.length === 1 ? 'plátce' : (payers.length < 5 ? 'plátci' : 'plátců')}
      · Celková suma <strong style="color:#76b900;">${fmt(payers.reduce((s, p) => s + p.total, 0))} cr</strong>
    </div>
    <div class="payers-grid">
      ${payers.map((p, idx) => {
        const rank = topRank.get(p.name);
        const rankClass = rank ? `top-${rank}` : '';
        const debtInfo = p.debtTotal > 0
          ? ` · <span class="debt">dluží ${fmt(p.debtTotal)} cr</span>`
          : '';
        return `
          <div class="payer-row ${rankClass}" onclick="showPayerDetail('${escapeHtml(p.name).replace(/'/g, "\\'")}')">
            <div class="payer-rank">${rank || (idx + 1)}</div>
            <div class="payer-info">
              <div class="payer-name">${escapeHtml(p.name)}</div>
              <div class="payer-meta">${p.count} ${p.count === 1 ? 'transakce' : (p.count < 5 ? 'transakce' : 'transakcí')}${debtInfo}</div>
            </div>
            <div class="payer-amount">${fmt(p.total)} cr</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function showPayerDetail(name) {
  // Switch to history with search filter for this person
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('[data-tab="history"]').classList.add('active');
  document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
  $('tab-history').classList.add('active');

  $('searchInput').value = name;
  searchQuery = name;
  $('clearSearch').classList.add('visible');

  document.querySelectorAll('.filter-btn:not(.payers-sort)').forEach(b => b.classList.remove('active'));
  document.querySelector('[data-filter="all"]').classList.add('active');
  activeFilter = 'all';

  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.showPayerDetail = showPayerDetail;

// Wire up sort buttons
document.querySelectorAll('.payers-sort').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.payers-sort').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    payersSortBy = btn.dataset.sort;
    renderAllPayers();
  });
});
