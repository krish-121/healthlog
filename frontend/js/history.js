const API = 'https://healthlog-backend-l0u0.onrender.com/api';
const token = localStorage.getItem('token');

// ── Guard ──
if (!token) window.location.href = 'index.html';

function authHeaders() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

// Helper: Get local YMD string
function toDateKey(d) {
  const dateObj = new Date(d);
  const tzOffset = dateObj.getTimezoneOffset() * 60000;
  return new Date(dateObj.getTime() - tzOffset).toISOString().slice(0, 10);
}

// Format time (e.g. 08:30 AM)
function formatTime(d) {
  return new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function avg(arr) {
  if (!arr.length) return null;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

// ═══════════════════════════════════════════════
// Fetch & Process Data
// ═══════════════════════════════════════════════
let allBuckets = {};  // dateKey -> { mood, notes, events[], heartRates[], bpSys[], bpDia[] }

async function fetchAll() {
  try {
    const [dailyRes, triggerRes, heartRes, symptomRes] = await Promise.all([
      fetch(`${API}/daily`,   { headers: authHeaders() }),
      fetch(`${API}/trigger`, { headers: authHeaders() }),
      fetch(`${API}/heart`,   { headers: authHeaders() }),
      fetch(`${API}/symptom`, { headers: authHeaders() })
    ]);

    if (!dailyRes.ok || !triggerRes.ok || !heartRes.ok || !symptomRes.ok) throw new Error('fetch failed');

    const [dailyLogs, triggerLogs, heartLogs, symptomLogs] = await Promise.all([
      dailyRes.json(), triggerRes.json(), heartRes.json(), symptomRes.json()
    ]);

    allBuckets = {};

    function getBucket(key) {
      if (!allBuckets[key]) {
        allBuckets[key] = { mood: '', notes: '', events: [], heartRates: [], bpSys: [], bpDia: [], symptomCount: 0 };
      }
      return allBuckets[key];
    }

    // Seed buckets from daily logs
    for (const d of dailyLogs) {
      const key = toDateKey(d.date);
      const b = getBucket(key);
      b.mood  = d.mood || '';
      b.notes = d.notes || '';
    }

    // Triggers
    for (const t of triggerLogs) {
      const key = toDateKey(t.timestamp);
      const b = getBucket(key);
      b.events.push({
        timestamp: new Date(t.timestamp),
        type: t.triggerType === 'caffeine' ? 'Caffeine' : 'Alcohol',
        detail: t.description || `Severity ${t.severity}/10`,
        severity: t.severity
      });
    }

    // Heart
    for (const h of heartLogs) {
      const key = toDateKey(h.timestamp);
      const b = getBucket(key);
      b.heartRates.push(h.heartRate);
      if (h.bloodPressureSys) b.bpSys.push(h.bloodPressureSys);
      if (h.bloodPressureDia) b.bpDia.push(h.bloodPressureDia);
      
      b.events.push({
        timestamp: new Date(h.timestamp),
        type: 'Heart Rate',
        detail: `${h.heartRate} bpm${h.bloodPressureSys ? ` (${h.bloodPressureSys}/${h.bloodPressureDia})` : ''}`,
        severity: null
      });
    }

    // Symptoms
    for (const s of symptomLogs) {
      const key = toDateKey(s.timestamp);
      const b = getBucket(key);
      b.symptomCount++;
      b.events.push({
        timestamp: new Date(s.timestamp),
        type: 'Symptom',
        detail: s.symptomTypes.join(', '),
        redFlags: s.redFlags,
        severity: s.severity,
        duration: s.duration,
        activity: s.activity,
        notes: s.notes
      });
    }

    // Sort events in each bucket chronologically
    for (const key in allBuckets) {
      allBuckets[key].events.sort((a, b) => a.timestamp - b.timestamp);
    }

    render(activeDays);
  } catch (err) {
    console.error(err);
    document.getElementById('loading').innerHTML = '<p class="text-heart-600">Failed to load data. Is the server running?</p>';
  }
}

// ═══════════════════════════════════════════════
// Render table for N-day window
// ═══════════════════════════════════════════════
let activeDays = 7;

function render(days) {
  activeDays = days;

  const allKeys = Object.keys(allBuckets).sort((a, b) => b.localeCompare(a));

  const loading = document.getElementById('loading');
  const empty   = document.getElementById('empty-state');
  const wrap    = document.getElementById('table-wrap');
  const tbody   = document.getElementById('history-body');
  const count   = document.getElementById('row-count');

  loading.classList.add('hidden');

  if (!allKeys.length) {
    empty.classList.remove('hidden');
    wrap.classList.add('hidden');
    count.textContent = '';
    return;
  }

  const mostRecentStr = allKeys[0];
  const cutoff = new Date(mostRecentStr + 'T00:00:00');
  cutoff.setDate(cutoff.getDate() - (days - 1));
  const cutoffKey = toDateKey(cutoff);

  const sortedKeys = allKeys.filter(k => k >= cutoffKey);

  empty.classList.add('hidden');
  wrap.classList.remove('hidden');
  count.textContent = `${sortedKeys.length} day${sortedKeys.length > 1 ? 's' : ''}`;

  tbody.innerHTML = '';

  for (const key of sortedKeys) {
    const b = allBuckets[key];
    const isSymptom = b.symptomCount > 0;

    const avgHr  = avg(b.heartRates);
    const avgSys = avg(b.bpSys);
    const avgDia = avg(b.bpDia);

    const moodMap = { great:'😊', good:'🙂', tired:'😴', stressed:'😰', bad:'😟', neutral:'😐' };
    const moodEmoji = moodMap[b.mood] || '';
    const dateFormatted = new Date(key + 'T00:00:00').toLocaleDateString('en-US', { month:'short', day:'numeric', weekday:'short' });

    // Main Row
    const tr = document.createElement('tr');
    tr.className = `cursor-pointer hover:bg-gray-50/80 transition ${isSymptom ? 'bg-heart-50/30' : ''}`;
    
    // We modify the columns slightly to fit the new Timeline paradigm
    tr.innerHTML = `
      <td class="px-5 py-4 font-medium text-navy-800 whitespace-nowrap">
        <div class="flex items-center gap-2">
          <svg class="w-4 h-4 text-gray-400 transform transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>
          ${dateFormatted}
        </div>
      </td>
      <td class="px-5 py-4 whitespace-nowrap">
        <span class="text-base mr-1">${moodEmoji}</span>
        <span class="text-gray-500 text-xs capitalize">${b.mood || '—'}</span>
      </td>
      <td class="px-5 py-4 text-gray-500 text-xs max-w-[200px] truncate">${b.notes || '—'}</td>
      <td class="px-5 py-4 text-center">
        <span class="inline-block px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 text-gray-600">${b.events.length} Events</span>
      </td>
      <td class="px-5 py-4 text-center font-mono text-sm ${avgHr && avgHr > 100 ? 'text-heart-600 font-semibold' : 'text-navy-900'}">
        ${avgHr ? Math.round(avgHr) + ' bpm' : '<span class="text-gray-400">—</span>'}
      </td>
    `;

    // Expanded Row (hidden by default)
    const trExp = document.createElement('tr');
    trExp.className = 'hidden bg-gray-50';
    
    // Build Timeline HTML
    let timelineHtml = '<div class="p-6 border-t border-gray-100"><h3 class="text-sm font-semibold text-navy-900 mb-4">Chronological Timeline</h3><div class="relative border-l border-gray-200 ml-3 space-y-6">';
    
    if (b.events.length === 0) {
      timelineHtml += '<p class="text-xs text-gray-500 ml-4">No events logged on this day.</p>';
    } else {
      b.events.forEach(ev => {
        const time = formatTime(ev.timestamp);
        let iconHtml = '';
        let contentHtml = '';
        
        if (ev.type === 'Caffeine') {
          iconHtml = `<div class="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-blue-100 border-2 border-white flex items-center justify-center"></div>`;
          contentHtml = `<p class="text-sm font-medium text-navy-900">☕ Caffeine Intake <span class="text-gray-400 font-normal ml-2">${time}</span></p>
                         <p class="text-xs text-gray-600 mt-0.5">${ev.detail}</p>`;
        } else if (ev.type === 'Alcohol') {
          iconHtml = `<div class="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-amber-100 border-2 border-white flex items-center justify-center"></div>`;
          contentHtml = `<p class="text-sm font-medium text-navy-900">🍺 Alcohol Intake <span class="text-gray-400 font-normal ml-2">${time}</span></p>
                         <p class="text-xs text-gray-600 mt-0.5">${ev.detail}</p>`;
        } else if (ev.type === 'Heart Rate') {
          iconHtml = `<div class="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-emerald-100 border-2 border-white flex items-center justify-center"></div>`;
          contentHtml = `<p class="text-sm font-medium text-navy-900">❤️ Heart Rate Log <span class="text-gray-400 font-normal ml-2">${time}</span></p>
                         <p class="text-xs text-gray-600 mt-0.5 font-mono">${ev.detail}</p>`;
        } else if (ev.type === 'Symptom') {
          iconHtml = `<div class="absolute -left-[11px] top-0.5 w-5 h-5 rounded-full bg-heart-500 border-2 border-white flex items-center justify-center"><div class="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div></div>`;
          
          let redFlagsHtml = '';
          if (ev.redFlags && ev.redFlags.length > 0) {
            redFlagsHtml = `<div class="mt-2 flex gap-2">${ev.redFlags.map(f => `<span class="px-2 py-0.5 rounded-md bg-heart-100 text-heart-700 text-[10px] font-bold uppercase tracking-wider">${f}</span>`).join('')}</div>`;
          }

          contentHtml = `<p class="text-sm font-bold text-heart-600">🚨 Acute Symptom <span class="text-gray-400 font-normal ml-2">${time}</span></p>
                         <div class="mt-1.5 p-3 bg-white rounded-lg border border-heart-100 shadow-sm">
                            <p class="text-sm font-medium text-navy-900 mb-1">${ev.detail}</p>
                            <p class="text-xs text-gray-500"><strong>Duration:</strong> ${ev.duration || 'N/A'} &nbsp;|&nbsp; <strong>Activity:</strong> ${ev.activity || 'N/A'} &nbsp;|&nbsp; <strong>Severity:</strong> ${ev.severity}/10</p>
                            ${ev.notes ? `<p class="text-xs text-gray-600 mt-2 bg-gray-50 p-2 rounded">${ev.notes}</p>` : ''}
                            ${redFlagsHtml}
                         </div>`;
        }
        
        timelineHtml += `
          <div class="relative pl-6">
            ${iconHtml}
            ${contentHtml}
          </div>
        `;
      });
    }
    
    timelineHtml += '</div></div>';
    trExp.innerHTML = `<td colspan="5" class="p-0">${timelineHtml}</td>`;

    // Toggle expand
    tr.addEventListener('click', () => {
      trExp.classList.toggle('hidden');
      const svg = tr.querySelector('svg');
      if (trExp.classList.contains('hidden')) {
        svg.classList.remove('rotate-90');
      } else {
        svg.classList.add('rotate-90');
      }
    });

    tbody.appendChild(tr);
    tbody.appendChild(trExp);
  }
}

// ── Filter buttons ──
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    render(parseInt(btn.dataset.days, 10));
  });
});

// Boot
fetchAll();
