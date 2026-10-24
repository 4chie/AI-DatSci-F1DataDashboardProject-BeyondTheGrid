/**
 * script.js — Beyond the Grid
 * Modular: loadData → populateFilters → applyFilters → renderKPI + renderCharts
 */

// ── Constants ─────────────────────────────────────────────────────────────────
const DATA_FILES = {
  results:      'data/race_results_full.json',
  standings:    'data/driver_standings.json',
  conStandings: 'data/constructor_standings.json',
  qualifying:   'data/qualifying.json',
  meta:         'data/meta.json',
};

// F1-themed consistent driver color palette
const DRIVER_COLORS = [
  '#E10600', // F1 red
  '#00D2BE', // Mercedes teal
  '#FF8000', // McLaren orange
  '#0067FF', // Williams blue
  '#358C75', // Aston Martin
  '#FFD700', // gold
  '#C92D4B', // Alfa Romeo
  '#B6BABD', // Haas silver
  '#6366f1', // indigo
  '#f97316', // orange-500
];

// ── Global state ──────────────────────────────────────────────────────────────
let DATA = {};
let charts = {};
let selectedDriverIds = []; // ordered array, max 3

// ── 1. Data loading ───────────────────────────────────────────────────────────
async function loadData() {
  showLoading(true);
  try {
    const [results, standings, conStandings, qualifying, meta] = await Promise.all([
      fetch(DATA_FILES.results).then(r => r.json()),
      fetch(DATA_FILES.standings).then(r => r.json()),
      fetch(DATA_FILES.conStandings).then(r => r.json()),
      fetch(DATA_FILES.qualifying).then(r => r.json()),
      fetch(DATA_FILES.meta).then(r => r.json()),
    ]);
    DATA = { results, standings, conStandings, qualifying, meta };
    populateFilters();
    applyFilters();
  } catch (err) {
    console.error('Failed to load data', err);
    document.querySelector('main').innerHTML =
      '<p class="text-red-400 p-8">Gagal memuat data. Jalankan via: python -m http.server</p>';
  } finally {
    showLoading(false);
  }
}

// ── 2. Populate filters ───────────────────────────────────────────────────────
function populateFilters() {
  const { years, drivers } = DATA.meta;

  // Season dropdown
  const selSeason = document.getElementById('sel-season');
  years.forEach(y => {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = y;
    selSeason.appendChild(opt);
  });
  selSeason.addEventListener('change', () => {
    applyFilters();
    rebuildDriverPicker(); // re-sort pills when season changes
  });

  // Build initial driver picker (alphabetical, no season selected)
  buildDriverPicker(getDriversForSeason(null));

  // Search filter
  document.getElementById('driver-search').addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll('.driver-pill').forEach(pill => {
      pill.classList.toggle('hidden-pill', !pill.dataset.name.includes(q));
    });
  });

  // Reset button
  document.getElementById('btn-reset').addEventListener('click', resetFilters);
}

/**
 * Return sorted driver list for the picker.
 * With season: sorted by final standings position in that season.
 * Without season: alphabetical.
 */
function getDriversForSeason(season) {
  const { drivers } = DATA.meta;
  if (!season) {
    // Alphabetical
    return [...drivers].sort((a, b) => a.driver_name.localeCompare(b.driver_name));
  }

  // Get final round standings for this season
  const seasonStandings = DATA.standings.filter(s => s.year === season);
  if (seasonStandings.length === 0) return [...drivers].sort((a, b) => a.driver_name.localeCompare(b.driver_name));

  const maxRound = Math.max(...seasonStandings.map(s => s.round));
  const finalRound = seasonStandings.filter(s => s.round === maxRound);

  // Build position map: driverId → final position
  const posMap = {};
  finalRound.forEach(s => { posMap[s.driverId] = s.position ?? 999; });

  // Drivers who raced this season first (sorted by position), then the rest alphabetically
  const inSeason  = drivers.filter(d => posMap[d.driverId] !== undefined)
                           .sort((a, b) => posMap[a.driverId] - posMap[b.driverId]);
  const notInSeason = drivers.filter(d => posMap[d.driverId] === undefined)
                             .sort((a, b) => a.driver_name.localeCompare(b.driver_name));

  return [...inSeason, ...notInSeason];
}

/** Rebuild driver picker with current season sort, preserving selections */
function rebuildDriverPicker() {
  const season = Number(document.getElementById('sel-season').value) || null;
  const sorted = getDriversForSeason(season);
  buildDriverPicker(sorted);
}

/** Build clickable pill grid */
function buildDriverPicker(drivers) {
  const container = document.getElementById('driver-picker');
  container.innerHTML = '';

  drivers.forEach((d, i) => {
    const pill = document.createElement('button');
    pill.className = 'driver-pill';
    pill.dataset.id   = d.driverId;
    pill.dataset.name = d.driver_name.toLowerCase();

    // Restore selected state if this driver was already picked
    const selIdx = selectedDriverIds.indexOf(d.driverId);
    if (selIdx !== -1) {
      const color = DRIVER_COLORS[selIdx];
      pill.classList.add('selected');
      pill.style.borderColor = color;
      pill.style.background  = color + '22';
      pill.innerHTML = `<span class="dot" style="background:${color}"></span>${d.driver_name}`;
    } else {
      pill.innerHTML = `<span class="dot" style="background:#374151"></span>${d.driver_name}`;
    }

    pill.addEventListener('click', () => toggleDriver(d.driverId, pill));
    container.appendChild(pill);
  });
}

/** Toggle a driver's selection (max 3) */
function toggleDriver(driverId, pill) {
  const idx = selectedDriverIds.indexOf(driverId);
  if (idx !== -1) {
    // Deselect
    selectedDriverIds.splice(idx, 1);
    pill.classList.remove('selected');
    pill.style.borderColor = '#374151';
    pill.style.background  = '#1e1e24';
    pill.querySelector('.dot').style.background = '#374151';
  } else {
    // Select — max 3
    if (selectedDriverIds.length >= 3) return;
    selectedDriverIds.push(driverId);
    const color = DRIVER_COLORS[selectedDriverIds.indexOf(driverId)];
    pill.classList.add('selected');
    pill.style.borderColor = color;
    pill.style.background  = color + '22';
    pill.querySelector('.dot').style.background = color;
  }
  updateDriverBadge();
  applyFilters();
}

/** Update selected count badge */
function updateDriverBadge() {
  const badge = document.getElementById('driver-count-badge');
  const num   = document.getElementById('driver-count-num');
  const count = selectedDriverIds.length;
  badge.classList.toggle('hidden', count === 0);
  num.textContent = count;
}

// ── 3. Get current filters ────────────────────────────────────────────────────
function getFilters() {
  const season = document.getElementById('sel-season').value;
  return {
    season:    season ? Number(season) : null,
    driverIds: [...selectedDriverIds],
  };
}

function resetFilters() {
  document.getElementById('sel-season').value = '';
  document.getElementById('driver-search').value = '';
  selectedDriverIds = [];
  updateDriverBadge();
  // Rebuild pills alphabetically (season cleared) — no need to reset individually
  buildDriverPicker(getDriversForSeason(null));
  applyFilters();
}

// ── 4. Apply filters → render all ────────────────────────────────────────────
function applyFilters() {
  const { season, driverIds } = getFilters();

  let filtered = DATA.results;
  if (season)               filtered = filtered.filter(r => r.year === season);
  if (driverIds.length > 0) filtered = filtered.filter(r => driverIds.includes(r.driverId));

  renderKPI(filtered);
  renderProgressionChart(season, driverIds);
  renderScatterChart(filtered, driverIds);
  renderConstructorChart(season);
  renderWinsChart(filtered, driverIds);
  renderH2H(filtered, driverIds);
  renderQualifyingDelta(season, driverIds);
}

// ── 5. KPI ────────────────────────────────────────────────────────────────────
function renderKPI(data) {
  const totalRaces   = data.length;
  const totalWins    = data.filter(r => r.positionOrder === 1).length;
  const totalPodiums = data.filter(r => r.positionOrder != null && r.positionOrder <= 3).length;
  const totalPoints  = data.reduce((s, r) => s + (r.points || 0), 0);
  const dnfCount     = data.filter(r => r.dnf === 1).length;
  const dnfRate      = totalRaces > 0 ? ((dnfCount / totalRaces) * 100).toFixed(1) + '%' : '—';

  document.getElementById('kpi-races-val').textContent   = totalRaces.toLocaleString();
  document.getElementById('kpi-wins-val').textContent    = totalWins.toLocaleString();
  document.getElementById('kpi-podiums-val').textContent = totalPodiums.toLocaleString();
  document.getElementById('kpi-points-val').textContent  = totalPoints.toLocaleString();
  document.getElementById('kpi-dnf-val').textContent     = dnfRate;
}

// ── 6. Chart helpers ──────────────────────────────────────────────────────────
function getCtx(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
  return document.getElementById(id).getContext('2d');
}

function toggleEmpty(chartId, emptyId, isEmpty) {
  document.getElementById(chartId).parentElement.style.display = isEmpty ? 'none' : 'block';
  document.getElementById(emptyId).classList.toggle('hidden', !isEmpty);
}

/** Return color for a driverId based on selection order */
function colorFor(driverId) {
  const idx = selectedDriverIds.indexOf(driverId);
  return idx !== -1 ? DRIVER_COLORS[idx] : DRIVER_COLORS[0];
}

const CHART_DEFAULTS = {
  plugins: { legend: { labels: { color: '#d1d5db', boxWidth: 12, font: { size: 11 } } } },
  scales: {
    x: { ticks: { color: '#9ca3af', font: { size: 10 } }, grid: { color: '#1f2937' } },
    y: { ticks: { color: '#9ca3af', font: { size: 10 } }, grid: { color: '#1f2937' } },
  },
};

// ── 7. Championship Progression ───────────────────────────────────────────────
function renderProgressionChart(season, driverIds) {
  // Butuh setidaknya season dipilih
  if (!season) {
    toggleEmpty('chart-progression', 'empty-progression', true);
    document.getElementById('empty-progression').textContent =
      'Pilih season untuk melihat championship progression.';
    return;
  }

  const seasonStandings = DATA.standings
    .filter(s => s.year === season)
    .sort((a, b) => a.round - b.round);

  if (seasonStandings.length === 0) {
    toggleEmpty('chart-progression', 'empty-progression', true);
    return;
  }

  const rounds = [...new Set(seasonStandings.map(s => s.round))].sort((a, b) => a - b);

  // Jika tidak ada driver dipilih → tampilkan top 5 winner di musim itu
  let targetIds = driverIds;
  if (targetIds.length === 0) {
    // Ambil driver dengan poin tertinggi di round terakhir
    const lastRound = Math.max(...rounds);
    const finalStandings = seasonStandings
      .filter(s => s.round === lastRound)
      .sort((a, b) => b.points - a.points)
      .slice(0, 5);
    targetIds = finalStandings.map(s => s.driverId);
  }

  const datasets = targetIds.map((dId, i) => {
    const driverRows = seasonStandings.filter(s => s.driverId === dId);
    const name = driverRows[0]?.driver_name || `Driver ${dId}`;
    // gunakan warna dari selection order jika dipilih, atau palet default
    const color = driverIds.includes(dId) ? colorFor(dId) : DRIVER_COLORS[i % DRIVER_COLORS.length];
    const pointsByRound = Object.fromEntries(driverRows.map(s => [s.round, s.points]));
    return {
      label: name,
      data: rounds.map(r => pointsByRound[r] ?? null),
      borderColor: color,
      backgroundColor: color + '22',
      tension: 0.3,
      pointRadius: 3,
      fill: false,
      spanGaps: true,
    };
  });

  toggleEmpty('chart-progression', 'empty-progression', false);
  const ctx = getCtx('chart-progression');
  charts['chart-progression'] = new Chart(ctx, {
    type: 'line',
    data: { labels: rounds, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      ...CHART_DEFAULTS,
      plugins: { ...CHART_DEFAULTS.plugins, tooltip: { mode: 'index', intersect: false } },
      scales: {
        x: { ...CHART_DEFAULTS.scales.x, title: { display: true, text: 'Round', color: '#6b7280', font: { size: 10 } } },
        y: { ...CHART_DEFAULTS.scales.y, title: { display: true, text: 'Points', color: '#6b7280', font: { size: 10 } } },
      },
    },
  });
}

// ── 8. Grid vs Finish Position (scatter) ─────────────────────────────────────
function renderScatterChart(filtered, driverIds) {
  const rows = filtered.filter(r => r.grid != null && r.positionOrder != null);
  toggleEmpty('chart-scatter', 'empty-scatter', rows.length === 0);
  if (rows.length === 0) return;

  let datasets;
  if (driverIds.length > 0) {
    datasets = driverIds.map(dId => {
      const dr = rows.filter(r => r.driverId === dId);
      const color = colorFor(dId);
      return {
        label: dr[0]?.driver_name || `Driver ${dId}`,
        data: dr.map(r => ({ x: r.grid, y: r.positionOrder })),
        backgroundColor: color + 'cc',
        pointRadius: 5,
      };
    });
  } else {
    datasets = [{
      label: 'All Drivers',
      data: rows.map(r => ({ x: r.grid, y: r.positionOrder })),
      backgroundColor: '#E10600aa',
      pointRadius: 3,
    }];
  }

  const ctx = getCtx('chart-scatter');
  charts['chart-scatter'] = new Chart(ctx, {
    type: 'scatter',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      ...CHART_DEFAULTS,
      scales: {
        x: { ...CHART_DEFAULTS.scales.x, title: { display: true, text: 'Grid', color: '#6b7280', font: { size: 10 } } },
        y: { ...CHART_DEFAULTS.scales.y, title: { display: true, text: 'Finish', color: '#6b7280', font: { size: 10 } } },
      },
    },
  });
}

// ── 9. Constructor Points (bar) ───────────────────────────────────────────────
function renderConstructorChart(season) {
  let top10;
  if (season) {
    const seasonData = DATA.conStandings.filter(s => s.year === season);
    if (seasonData.length === 0) { toggleEmpty('chart-constructor', 'empty-constructor', true); return; }
    const maxRound = Math.max(...seasonData.map(s => s.round));
    top10 = seasonData
      .filter(s => s.round === maxRound)
      .sort((a, b) => b.points - a.points)
      .slice(0, 10);
  } else {
    const totals = {};
    DATA.conStandings.forEach(s => {
      const k = s.constructorRef || s.constructorId;
      if (!totals[k]) totals[k] = { name: s.constructor_name || k, points: 0 };
      totals[k].points += (s.points || 0);
    });
    top10 = Object.values(totals).sort((a, b) => b.points - a.points).slice(0, 10);
  }

  toggleEmpty('chart-constructor', 'empty-constructor', top10.length === 0);
  if (top10.length === 0) return;

  const ctx = getCtx('chart-constructor');
  charts['chart-constructor'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: top10.map(c => c.constructor_name || c.name),
      datasets: [{
        label: season ? `Points (${season})` : 'Total Points',
        data: top10.map(c => c.points),
        backgroundColor: top10.map((_, i) => DRIVER_COLORS[i % DRIVER_COLORS.length] + 'cc'),
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      ...CHART_DEFAULTS,
      plugins: { ...CHART_DEFAULTS.plugins, legend: { display: false } },
      scales: {
        x: { ...CHART_DEFAULTS.scales.x, ticks: { ...CHART_DEFAULTS.scales.x.ticks, maxRotation: 35 } },
        y: { ...CHART_DEFAULTS.scales.y, title: { display: true, text: 'Points', color: '#6b7280', font: { size: 10 } } },
      },
    },
  });
}

// ── 10. Wins per Driver Top 10 (horizontal bar) ───────────────────────────────
function renderWinsChart(filtered, driverIds) {
  if (filtered.length === 0) { toggleEmpty('chart-wins', 'empty-wins', true); return; }

  const winMap = {};
  filtered.filter(r => r.positionOrder === 1).forEach(r => {
    if (!winMap[r.driverId]) winMap[r.driverId] = { name: r.driver_name || r.driverRef, wins: 0, id: r.driverId };
    winMap[r.driverId].wins++;
  });

  const top = Object.values(winMap).sort((a, b) => b.wins - a.wins).slice(0, 10);
  toggleEmpty('chart-wins', 'empty-wins', top.length === 0);
  if (top.length === 0) return;

  const ctx = getCtx('chart-wins');
  charts['chart-wins'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: top.map(d => d.name),
      datasets: [{
        label: 'Wins',
        data: top.map(d => d.wins),
        backgroundColor: top.map((d, i) =>
          driverIds.includes(d.id) ? colorFor(d.id) + 'cc' : DRIVER_COLORS[i % DRIVER_COLORS.length] + 'cc'
        ),
        borderRadius: 4,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      ...CHART_DEFAULTS,
      plugins: { ...CHART_DEFAULTS.plugins, legend: { display: false } },
      scales: {
        x: { ...CHART_DEFAULTS.scales.x, title: { display: true, text: 'Wins', color: '#6b7280', font: { size: 10 } } },
        y: { ...CHART_DEFAULTS.scales.y },
      },
    },
  });
}

// ── 11. Head-to-Head Driver Comparison ───────────────────────────────────────
function renderH2H(filtered, driverIds) {
  const tableEl = document.getElementById('h2h-table');
  const emptyEl = document.getElementById('empty-h2h');

  if (driverIds.length < 2) {
    tableEl.classList.add('hidden');
    emptyEl.classList.remove('hidden');
    emptyEl.textContent = 'Pilih 2–3 driver untuk melihat perbandingan.';
    return;
  }

  // Hitung statistik per driver dari data yang sudah difilter
  const stats = driverIds.map(dId => {
    const rows = filtered.filter(r => r.driverId === dId);
    const name = rows[0]?.driver_name || `Driver ${dId}`;
    const races    = rows.length;
    const wins     = rows.filter(r => r.positionOrder === 1).length;
    const podiums  = rows.filter(r => r.positionOrder != null && r.positionOrder <= 3).length;
    const points   = rows.reduce((s, r) => s + (r.points || 0), 0);
    const dnfs     = rows.filter(r => r.dnf === 1).length;
    const avgFinish = rows.filter(r => r.positionOrder != null)
                          .reduce((s, r, _, a) => s + r.positionOrder / a.length, 0);
    return {
      dId, name, races,
      wins,
      winRate:   races > 0 ? ((wins / races) * 100).toFixed(1) + '%' : '—',
      podiums,
      podiumRate: races > 0 ? ((podiums / races) * 100).toFixed(1) + '%' : '—',
      points:    points.toFixed(0),
      ptsPerRace: races > 0 ? (points / races).toFixed(2) : '—',
      dnfRate:   races > 0 ? ((dnfs / races) * 100).toFixed(1) + '%' : '—',
      avgFinish: avgFinish > 0 ? avgFinish.toFixed(1) : '—',
    };
  });

  // Metrik yang ditampilkan: [label, key, lowerIsBetter]
  const metrics = [
    ['Races',        'races',      false],
    ['Wins',         'wins',       false],
    ['Win Rate',     'winRate',    false],
    ['Podiums',      'podiums',    false],
    ['Podium Rate',  'podiumRate', false],
    ['Total Points', 'points',     false],
    ['Pts / Race',   'ptsPerRace', false],
    ['DNF Rate',     'dnfRate',    true ],
    ['Avg Finish',   'avgFinish',  true ],
  ];

  // Bangun tabel HTML
  let html = '<table class="h2h-table"><thead><tr><th class="metric-col">Metrik</th>';
  stats.forEach((s, i) => {
    const color = colorFor(s.dId) || DRIVER_COLORS[i];
    html += `<th><span class="h2h-driver-dot" style="background:${color}"></span>${s.name}</th>`;
  });
  html += '</tr></thead><tbody>';

  metrics.forEach(([label, key, lowerBetter]) => {
    // Tentukan nilai terbaik untuk highlight
    const vals = stats.map(s => parseFloat(s[key]));
    const validVals = vals.filter(v => !isNaN(v));
    const best = validVals.length > 0
      ? (lowerBetter ? Math.min(...validVals) : Math.max(...validVals))
      : null;

    html += `<tr><td class="metric-name">${label}</td>`;
    stats.forEach(s => {
      const numVal = parseFloat(s[key]);
      const isBest = best !== null && !isNaN(numVal) && numVal === best && validVals.length > 1;
      html += `<td class="${isBest ? 'best-val' : ''}">${s[key]}</td>`;
    });
    html += '</tr>';
  });

  html += '</tbody></table>';

  tableEl.innerHTML = html;
  tableEl.classList.remove('hidden');
  emptyEl.classList.add('hidden');
}

// ── 12. Qualifying vs Race Position Delta (bar chart) ────────────────────────
function renderQualifyingDelta(season, driverIds) {
  const emptyEl = document.getElementById('empty-delta');

  if (!season) {
    toggleEmpty('chart-delta', 'empty-delta', true);
    emptyEl.textContent = 'Pilih season untuk melihat data qualifying.';
    return;
  }

  // Qualifying data untuk season ini
  const qData = DATA.qualifying.filter(q => q.year === season);
  if (qData.length === 0) {
    toggleEmpty('chart-delta', 'empty-delta', true);
    emptyEl.textContent = 'Data qualifying tidak tersedia untuk musim ini.';
    return;
  }

  // Race finish data untuk season ini
  const raceData = DATA.results.filter(r => r.year === season);

  // Tentukan target driver: yang dipilih, atau top 10 dengan qualifying terbanyak
  let targetIds = driverIds;
  if (targetIds.length === 0) {
    const counts = {};
    qData.forEach(q => { counts[q.driverId] = (counts[q.driverId] || 0) + 1; });
    targetIds = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id]) => Number(id));
  }

  // Hitung rata-rata delta (qualiPos - finishPos) per driver
  // positif = naik posisi (lebih baik dari qualifying), negatif = turun
  const deltas = targetIds.map(dId => {
    const qRows = qData.filter(q => q.driverId === dId && q.position != null);
    const rRows = raceData.filter(r => r.driverId === dId && r.positionOrder != null);

    // Match per raceId
    const matched = qRows.map(q => {
      const r = rRows.find(r => r.raceId === q.raceId);
      if (!r) return null;
      return q.position - r.positionOrder; // positif = naik posisi
    }).filter(v => v !== null);

    const avg = matched.length > 0
      ? matched.reduce((s, v) => s + v, 0) / matched.length
      : null;

    const name = qRows[0]?.driver_name || `Driver ${dId}`;
    return { dId, name, avg, count: matched.length };
  }).filter(d => d.avg !== null);

  if (deltas.length === 0) {
    toggleEmpty('chart-delta', 'empty-delta', true);
    emptyEl.textContent = 'Data qualifying tidak cukup untuk musim ini.';
    return;
  }

  // Urutkan dari delta terbesar ke terkecil
  deltas.sort((a, b) => b.avg - a.avg);

  toggleEmpty('chart-delta', 'empty-delta', false);
  const ctx = getCtx('chart-delta');
  charts['chart-delta'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: deltas.map(d => d.name),
      datasets: [{
        label: 'Avg Position Gained',
        data: deltas.map(d => parseFloat(d.avg.toFixed(2))),
        backgroundColor: deltas.map((d, i) =>
          driverIds.includes(d.dId)
            ? colorFor(d.dId) + 'cc'
            : (d.avg >= 0 ? '#00D2BE99' : '#E1060099')  // teal=naik, merah=turun
        ),
        borderRadius: 4,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      ...CHART_DEFAULTS,
      plugins: {
        ...CHART_DEFAULTS.plugins,
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const d = deltas[ctx.dataIndex];
              const sign = d.avg >= 0 ? '+' : '';
              return ` ${sign}${d.avg.toFixed(2)} pos (${d.count} races)`;
            }
          }
        }
      },
      scales: {
        x: {
          ...CHART_DEFAULTS.scales.x,
          title: { display: true, text: 'Avg Positions Gained (+) / Lost (−)', color: '#6b7280', font: { size: 10 } },
        },
        y: { ...CHART_DEFAULTS.scales.y },
      },
    },
  });
}

// ── Utility ───────────────────────────────────────────────────────────────────
function showLoading(show) {
  document.getElementById('loading-indicator').classList.toggle('hidden', !show);
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', loadData);
