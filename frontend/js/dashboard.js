const API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000/api' : '/api';
const token = localStorage.getItem('token');

if (!token) {
  window.location.href = 'index.html';
}

function authHeaders() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

document.getElementById('logout-btn').addEventListener('click', () => {
  localStorage.removeItem('token');
  window.location.href = 'index.html';
});

// ── Date helpers ──
function toDateKey(d) {
  const dateObj = new Date(d);
  const tzOffset = dateObj.getTimezoneOffset() * 60000;
  return new Date(dateObj.getTime() - tzOffset).toISOString().slice(0, 10);
}
const todayKey = toDateKey(new Date());

document.getElementById('header-date').textContent = new Date().toLocaleDateString('en-US', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
});

const datePicker = document.getElementById('chart-date-picker');
datePicker.value = todayKey;

const CAFFEINE_WARN_THRESHOLD = 7;

// Global data stores
let allTriggers = [];
let allHearts = [];
let allSymptoms = [];
let allDailies = [];

// Chart Instances
let overlayChartInstance = null;
let histogramChartInstance = null;

// ═══════════════════════════════════════════════════════════
// 1. Fetch data
// ═══════════════════════════════════════════════════════════
async function fetchDashboardData() {
  try {
    const [dailyRes, trigRes, heartRes, sympRes] = await Promise.all([
      fetch(`${API}/daily`, { headers: authHeaders() }),
      fetch(`${API}/trigger`, { headers: authHeaders() }),
      fetch(`${API}/heart`, { headers: authHeaders() }),
      fetch(`${API}/symptom`, { headers: authHeaders() })
    ]);

    if (!dailyRes.ok) throw new Error('Failed to fetch data');

    allDailies = await dailyRes.json();
    allTriggers = await trigRes.json();
    allHearts = await heartRes.json();
    allSymptoms = await sympRes.json();

    populateSummaryCards(todayKey);
    checkWarnings();
    
    // Draw charts
    renderOverlayChart(datePicker.value);
    renderHistogramChart();
    
    // Populate Insight Cards
    generateInsights();

  } catch (err) {
    console.error(err);
  }
}

// ═══════════════════════════════════════════════════════════
// UI Updates
// ═══════════════════════════════════════════════════════════
function populateSummaryCards(dateKey) {
  const dateDailies = allDailies.filter(d => toDateKey(d.date) === dateKey);
  const dateTriggers = allTriggers.filter(t => toDateKey(t.timestamp) === dateKey);
  const dateHearts = allHearts.filter(h => toDateKey(h.timestamp) === dateKey);

  // Heart Rate Avg
  document.getElementById('stat-hr').textContent = '—';
  if (dateHearts.length > 0) {
    const avg = dateHearts.reduce((s, v) => s + v.heartRate, 0) / dateHearts.length;
    document.getElementById('stat-hr').textContent = Math.round(avg);
  }

  // BP (latest)
  document.getElementById('stat-bp').textContent = '—';
  const bps = dateHearts.filter(h => h.bloodPressureSys && h.bloodPressureDia);
  if (bps.length > 0) {
    const latest = bps[0]; // sorted desc from backend
    document.getElementById('stat-bp').textContent = `${latest.bloodPressureSys}/${latest.bloodPressureDia}`;
  }

  // Caffeine Max Severity
  document.getElementById('stat-caffeine').textContent = '—';
  const cafs = dateTriggers.filter(t => t.triggerType === 'caffeine');
  if (cafs.length > 0) {
    const max = Math.max(...cafs.map(c => c.severity));
    document.getElementById('stat-caffeine').textContent = `${max}/10`;
  }

  // Mood
  document.getElementById('stat-mood').textContent = '—';
  if (dateDailies.length > 0 && dateDailies[0].mood) {
    document.getElementById('stat-mood').textContent = dateDailies[0].mood.charAt(0).toUpperCase() + dateDailies[0].mood.slice(1);
  }
}

function checkWarnings() {
  const todayTriggers = allTriggers.filter(t => toDateKey(t.timestamp) === todayKey);
  const cafs = todayTriggers.filter(t => t.triggerType === 'caffeine');
  const max = cafs.length ? Math.max(...cafs.map(c => c.severity)) : 0;
  
  if (max >= CAFFEINE_WARN_THRESHOLD) {
    document.getElementById('caffeine-warning').classList.remove('hidden');
  }
}

// ═══════════════════════════════════════════════════════════
// Overlay Chart (Micro View)
// ═══════════════════════════════════════════════════════════
datePicker.addEventListener('change', () => {
  const newDateKey = datePicker.value;
  
  // Update header date display
  const dateObj = new Date(newDateKey + 'T12:00:00'); // Force local noon to avoid timezone shift
  document.getElementById('header-date').textContent = dateObj.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  populateSummaryCards(newDateKey);
  renderOverlayChart(newDateKey);
});

function getDecimalHours(dateStr) {
  const d = new Date(dateStr);
  return d.getHours() + (d.getMinutes() / 60);
}

function renderOverlayChart(dateKey) {
  const ctx = document.getElementById('chart-overlay').getContext('2d');
  if (overlayChartInstance) overlayChartInstance.destroy();

  const dayTriggers = allTriggers.filter(t => toDateKey(t.timestamp) === dateKey);
  const daySymptoms = allSymptoms.filter(s => toDateKey(s.timestamp) === dateKey);
  const dayHearts = allHearts.filter(h => toDateKey(h.timestamp) === dateKey);

  // 1. Caffeine Decay Curve
  const cafs = dayTriggers.filter(t => t.triggerType === 'caffeine');
  let caffeinePoints = [];
  
  // We want to draw a curve that spikes at intake and halves every 5 hours.
  // We'll generate points every 0.5 hours from 0 to 24.
  for (let h = 0; h <= 24; h += 0.5) {
    let level = 0;
    cafs.forEach(c => {
      const intakeHour = getDecimalHours(c.timestamp);
      if (h >= intakeHour) {
        // mg estimated from severity (severity * 40)
        const mg = c.severity * 40; 
        const hoursPassed = h - intakeHour;
        // Half life formula: N(t) = N0 * (1/2)^(t/t_half)
        level += mg * Math.pow(0.5, hoursPassed / 5);
      }
    });
    caffeinePoints.push({ x: h, y: level });
  }

  // 2. Symptom Markers
  const symptomData = daySymptoms.map(s => ({
    x: getDecimalHours(s.timestamp),
    y: s.severity * 20, // Scale it up roughly for the Y axis so it's visible
    symptomTypes: s.symptomTypes.join(', ')
  }));
  
  // 3. Heart Rates
  const hrData = dayHearts.map(h => ({
    x: getDecimalHours(h.timestamp),
    y: h.heartRate
  }));

  overlayChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [
        {
          label: 'Estimated Caffeine (mg) Decay',
          data: caffeinePoints,
          borderColor: 'rgba(59, 130, 246, 0.5)', // blue-500
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          pointRadius: 0,
          borderWidth: 2,
          tension: 0.4
        },
        {
          label: 'Heart Rate (bpm)',
          data: hrData,
          borderColor: 'rgba(16, 185, 129, 0.8)', // emerald
          backgroundColor: 'rgba(16, 185, 129, 0.8)',
          showLine: false,
          pointStyle: 'circle',
          pointRadius: 5
        },
        {
          label: 'Acute Symptoms',
          data: symptomData,
          borderColor: 'rgba(239, 68, 68, 1)', // heart-500 red
          backgroundColor: 'rgba(239, 68, 68, 1)',
          showLine: false,
          pointStyle: 'triangle',
          pointRadius: 12,
          pointHoverRadius: 15
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          type: 'linear',
          min: 0,
          max: 24,
          ticks: {
            stepSize: 2,
            callback: (val) => `${val}:00`
          },
          grid: { display: false }
        },
        y: {
          beginAtZero: true,
          suggestedMax: 200,
          grid: { color: 'rgba(0,0,0,0.05)' }
        }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx) => {
              if (ctx.datasetIndex === 2) { // Symptom
                return `🚨 Symptom: ${ctx.raw.symptomTypes} (Severity: ${ctx.raw.y/20}/10)`;
              }
              if (ctx.datasetIndex === 1) return `HR: ${ctx.raw.y} bpm`;
              return `Caffeine: ${Math.round(ctx.raw.y)} mg`;
            }
          }
        }
      }
    }
  });
}

// ═══════════════════════════════════════════════════════════
// Histogram Chart (Macro View)
// ═══════════════════════════════════════════════════════════
function renderHistogramChart() {
  const ctx = document.getElementById('chart-histogram').getContext('2d');
  
  // Buckets: 0-1h, 1-3h, 3-6h, >6h
  const buckets = { '0-1h': 0, '1-3h': 0, '3-6h': 0, '>6h': 0 };

  allSymptoms.forEach(s => {
    const sTime = new Date(s.timestamp);
    // Find triggers on the same day BEFORE the symptom
    const previousTriggers = allTriggers.filter(t => {
      const tTime = new Date(t.timestamp);
      return toDateKey(t.timestamp) === toDateKey(s.timestamp) && tTime < sTime;
    });

    if (previousTriggers.length > 0) {
      // Find the closest one
      previousTriggers.sort((a, b) => b.timestamp - a.timestamp);
      const closest = previousTriggers[0];
      const diffMs = sTime - new Date(closest.timestamp);
      const diffHours = diffMs / (1000 * 60 * 60);

      if (diffHours <= 1) buckets['0-1h']++;
      else if (diffHours <= 3) buckets['1-3h']++;
      else if (diffHours <= 6) buckets['3-6h']++;
      else buckets['>6h']++;
    }
  });

  histogramChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['0-1 Hour', '1-3 Hours', '3-6 Hours', '> 6 Hours'],
      datasets: [{
        label: 'Symptoms Logged',
        data: [buckets['0-1h'], buckets['1-3h'], buckets['3-6h'], buckets['>6h']],
        backgroundColor: 'rgba(239, 68, 68, 0.8)', // heart-500
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1 },
          grid: { color: 'rgba(0,0,0,0.05)' }
        },
        x: {
          grid: { display: false }
        }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}

// ═══════════════════════════════════════════════════════════
// Insight Engine
// ═══════════════════════════════════════════════════════════
function generateInsights() {
  document.getElementById('insights-loading').classList.add('hidden');
  document.getElementById('insights-cards').classList.remove('hidden');

  // Group data by dateKey
  const days = {};
  allDailies.forEach(d => {
    const k = toDateKey(d.date);
    if (!days[k]) days[k] = { hr: [], caf: false, alc: false, sleep: 8, symp: [] };
    const sleepMatch = (d.notes || '').match(/Sleep:\s*([\d.]+)h/i);
    if (sleepMatch) days[k].sleep = parseFloat(sleepMatch[1]);
  });
  allHearts.forEach(h => {
    const k = toDateKey(h.timestamp);
    if (!days[k]) days[k] = { hr: [], caf: false, alc: false, sleep: 8, symp: [] };
    days[k].hr.push(h.heartRate);
  });
  allTriggers.forEach(t => {
    const k = toDateKey(t.timestamp);
    if (!days[k]) days[k] = { hr: [], caf: false, alc: false, sleep: 8, symp: [] };
    if (t.triggerType === 'caffeine') days[k].caf = true;
    if (t.triggerType === 'alcohol') days[k].alc = true;
  });
  allSymptoms.forEach(s => {
    const k = toDateKey(s.timestamp);
    if (!days[k]) days[k] = { hr: [], caf: false, alc: false, sleep: 8, symp: [] };
    days[k].symp.push(...s.symptomTypes);
  });

  // Calculate Insights
  let cafHRs = [], alcHRs = [], baseHRs = [];
  let cafBadSleepHRs = [];
  const sympCounts = {};

  Object.values(days).forEach(day => {
    if (day.hr.length > 0) {
      const avgHR = day.hr.reduce((a,b)=>a+b,0)/day.hr.length;
      if (day.caf) cafHRs.push(avgHR);
      if (day.alc) alcHRs.push(avgHR);
      if (!day.caf && !day.alc) baseHRs.push(avgHR);
      if (day.caf && day.sleep < 6) cafBadSleepHRs.push(avgHR);
    }
    day.symp.forEach(s => {
      sympCounts[s] = (sympCounts[s] || 0) + 1;
    });
  });

  const avg = arr => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0;
  const baseAvg = avg(baseHRs) || 70; // Baseline
  const cafAvg = avg(cafHRs);
  const alcAvg = avg(alcHRs);

  // 1. Strongest Trigger
  if (cafAvg > alcAvg && cafAvg > baseAvg) {
    document.getElementById('insight-trigger-name').textContent = 'Caffeine';
    document.getElementById('insight-trigger-diff').textContent = `+${Math.round(cafAvg - baseAvg)} BPM`;
    document.getElementById('insight-trigger-msg').textContent = 'Your heart rate is significantly higher on days you consume caffeine.';
  } else if (alcAvg > baseAvg) {
    document.getElementById('insight-trigger-name').textContent = 'Alcohol';
    document.getElementById('insight-trigger-diff').textContent = `+${Math.round(alcAvg - baseAvg)} BPM`;
    document.getElementById('insight-trigger-msg').textContent = 'Your heart rate is elevated on days you consume alcohol.';
  } else {
    document.getElementById('insight-trigger-name').textContent = 'None Identified';
    document.getElementById('insight-trigger-diff').textContent = 'Stable';
    document.getElementById('insight-trigger-msg').textContent = 'Your heart rate remains stable regardless of triggers.';
  }

  // 2. Worst Combination
  const cafBadSleepAvg = avg(cafBadSleepHRs);
  if (cafBadSleepAvg > cafAvg + 5) {
    document.getElementById('insight-combo-name').textContent = 'Caffeine + <6h Sleep';
    document.getElementById('insight-combo-diff').textContent = `${Math.round(cafBadSleepAvg)} BPM`;
    document.getElementById('insight-combo-msg').textContent = 'When running on low sleep, caffeine spikes your HR far more than usual.';
  } else {
    document.getElementById('insight-combo-name').textContent = 'None Identified';
    document.getElementById('insight-combo-diff').textContent = '—';
    document.getElementById('insight-combo-msg').textContent = 'No significant detrimental combinations detected.';
  }

  // 3. Symptom Pattern
  const sympKeys = Object.keys(sympCounts);
  if (sympKeys.length > 0) {
    const topSymp = sympKeys.sort((a,b) => sympCounts[b] - sympCounts[a])[0];
    document.getElementById('insight-symptom-name').textContent = topSymp;
    document.getElementById('insight-symptom-count').textContent = `${sympCounts[topSymp]} events`;
    document.getElementById('insight-symptom-msg').textContent = 'This is your most frequently reported acute symptom.';
  } else {
    document.getElementById('insight-symptom-name').textContent = 'No Symptoms';
    document.getElementById('insight-symptom-count').textContent = '0';
    document.getElementById('insight-symptom-msg').textContent = "You haven't logged any acute symptoms.";
  }
}

// Boot
fetchDashboardData();
