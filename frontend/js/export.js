const API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000/api' : '/api';
const token = localStorage.getItem('token');
if (!token) window.location.href = 'index.html';

function authHeaders() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

document.getElementById('report-date').textContent = `Generated: ${new Date().toLocaleDateString()}`;

// Helper
function formatDateTime(d) {
  const date = new Date(d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

let allSymptoms = [];
let allTriggers = [];

document.getElementById('export-timeframe').addEventListener('change', (e) => {
  renderTable(e.target.value);
});

async function loadExportData() {
  try {
    const [sympRes, trigRes] = await Promise.all([
      fetch(`${API}/symptom`, { headers: authHeaders() }),
      fetch(`${API}/trigger`, { headers: authHeaders() })
    ]);

    if (!sympRes.ok) throw new Error('Fetch failed');

    allSymptoms = await sympRes.json();
    allTriggers = await trigRes.json();

    // Sort symptoms oldest to newest for chronological reading
    allSymptoms.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Initial render (default to Last 7 Days if you prefer, or the select's default)
    renderTable(document.getElementById('export-timeframe').value);

    // Auto-open print dialog after a tiny delay for paint
    setTimeout(() => {
      window.print();
    }, 500);

  } catch (err) {
    console.error(err);
    document.getElementById('export-container').innerHTML = '<p class="text-red-500">Failed to load export data.</p>';
  }
}

function renderTable(daysFilter) {
  const tbody = document.getElementById('export-tbody');
  tbody.innerHTML = '';
  
  let filteredSymptoms = allSymptoms;
  let filteredTriggers = allTriggers;

  if (daysFilter !== 'all') {
    const days = parseInt(daysFilter, 10);
    
    let maxTime = 0;
    allSymptoms.forEach(s => { const t = new Date(s.timestamp).getTime(); if(t > maxTime) maxTime = t; });
    allTriggers.forEach(t => { const t = new Date(t.timestamp).getTime(); if(t > maxTime) maxTime = t; });
    if (maxTime === 0) maxTime = Date.now();
    
    const maxDateObj = new Date(maxTime);
    const tzOffset = maxDateObj.getTimezoneOffset() * 60000;
    const mostRecentStr = new Date(maxTime - tzOffset).toISOString().slice(0, 10);
    
    const cutoff = new Date(mostRecentStr + 'T00:00:00');
    cutoff.setDate(cutoff.getDate() - (days - 1));
    
    filteredSymptoms = allSymptoms.filter(s => new Date(s.timestamp) >= cutoff);
    filteredTriggers = allTriggers.filter(t => new Date(t.timestamp) >= cutoff);
  }

  if (filteredSymptoms.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="p-5 text-center text-gray-500">No symptoms recorded in this timeframe.</td></tr>`;
    document.getElementById('summary-content').innerHTML = 'No acute events logged in this timeframe.';
    return;
  }

  let correlatedCount = 0;

  filteredSymptoms.forEach(s => {
    const sTime = new Date(s.timestamp);
    
    // Find prior intake within 24 hours
    const prior24h = allTriggers.filter(t => { // Use allTriggers for context even if trigger was slightly before cutoff
      const tTime = new Date(t.timestamp);
      const diffHours = (sTime - tTime) / (1000 * 60 * 60);
      return diffHours >= 0 && diffHours <= 24;
    });

    // Sort prior intakes by closest to symptom
    prior24h.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    let intakeHtml = '<span class="text-gray-400">—</span>';
    if (prior24h.length > 0) {
      correlatedCount++;
      // Just show the most recent one to prevent clutter
      const closest = prior24h[0];
      const diffHours = ((sTime - new Date(closest.timestamp)) / (1000 * 60 * 60)).toFixed(1);
      intakeHtml = `
        <div class="font-medium text-blue-800">${closest.triggerType === 'caffeine' ? '☕' : '🍺'} ${closest.description || (closest.triggerType + ' (Sev ' + closest.severity + ')')}</div>
        <div class="text-xs text-blue-600 mt-1">at ${new Date(closest.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} <strong>(${diffHours}h prior)</strong></div>
      `;
    }

    // Red flags
    const isRed = s.redFlags && s.redFlags.length > 0;
    let redFlagsHtml = '';
    if (isRed) {
      redFlagsHtml = s.redFlags.map(f => `<span class="bg-red-100 text-red-700 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider block w-fit mb-1">${f}</span>`).join('');
    }

    const tr = document.createElement('tr');
    if (isRed) tr.classList.add('bg-red-50/30');

    tr.innerHTML = `
      <td class="p-3 align-top font-medium text-gray-800 border-r border-gray-100">${formatDateTime(s.timestamp)}</td>
      <td class="p-3 align-top border-r border-gray-100">
        <div class="font-semibold text-gray-900">${s.symptomTypes.join(', ') || 'Unspecified'}</div>
        <div class="text-xs text-gray-500 mt-1">Severity: ${s.severity}/10</div>
      </td>
      <td class="p-3 align-top border-r border-gray-100 text-gray-600">
        <div><span class="font-semibold">Dur:</span> ${s.duration || '?'}</div>
        <div class="mt-1"><span class="font-semibold">Act:</span> ${s.activity || '?'}</div>
      </td>
      <td class="p-3 align-top border-r border-blue-50 bg-blue-50/10">
        ${intakeHtml}
      </td>
      <td class="p-3 align-top">
        ${redFlagsHtml}
        ${s.notes ? `<div class="text-xs text-gray-600 italic mt-1">"${s.notes}"</div>` : ''}
        ${!isRed && !s.notes ? '<span class="text-gray-400">—</span>' : ''}
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Generate Summary
  const correlationRate = Math.round((correlatedCount / filteredSymptoms.length) * 100);
  document.getElementById('summary-content').innerHTML = `
    <p>Total acute symptoms logged: <strong>${filteredSymptoms.length}</strong></p>
    <p>Symptoms correlated with a substance intake within 24 hours: <strong>${correlationRate}%</strong></p>
  `;
}

loadExportData();
