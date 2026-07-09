const API = 'https://healthlog-backend-l0u0.onrender.com/api';
const token = localStorage.getItem('token');

// ── Guard ──
if (!token) window.location.href = 'index.html';

function authHeaders() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

// ── Date Helpers ──
function getLocalYMD(dateObj = new Date()) {
  const tzOffset = dateObj.getTimezoneOffset() * 60000;
  return new Date(dateObj.getTime() - tzOffset).toISOString().slice(0, 10);
}

// ── Global Date Picker ──
const globalDatePicker = document.getElementById('global-log-date');
if (globalDatePicker) {
  globalDatePicker.value = getLocalYMD();
  globalDatePicker.addEventListener('change', () => {
    loadDailyLog();
    loadEventManager();
  });
}

function setTimePickersToNow() {
  const now = new Date();
  const timeString = now.toTimeString().slice(0, 5); // HH:MM
  if (document.getElementById('caffeine-time')) document.getElementById('caffeine-time').value = timeString;
  if (document.getElementById('alcohol-time')) document.getElementById('alcohol-time').value = timeString;
  if (document.getElementById('heart-time')) document.getElementById('heart-time').value = timeString;
  if (document.getElementById('symptom-time')) document.getElementById('symptom-time').value = timeString;
}
setTimePickersToNow();

// Convert "HH:MM" from time picker to a full JS Date object using the Global Date Picker date
function getTimestampFromTime(timeString) {
  if (!timeString) return new Date();
  const [hours, minutes] = timeString.split(':');
  
  const selectedDateStr = globalDatePicker ? globalDatePicker.value : getLocalYMD();
  // Parse as local date to prevent timezone shift by adding T00:00:00
  const d = new Date(selectedDateStr + 'T00:00:00');
  d.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
  return d;
}

document.getElementById('symptom-now-btn')?.addEventListener('click', () => {
  const now = new Date();
  document.getElementById('symptom-time').value = now.toTimeString().slice(0, 5);
  if (globalDatePicker) {
    globalDatePicker.value = getLocalYMD(now);
    loadDailyLog();
    loadEventManager();
  }
});

// ── Logout ──
function logout() {
  localStorage.removeItem('token');
  window.location.href = 'index.html';
}

// ═══════════════════════════════════════════════
// Toast notifications
// ═══════════════════════════════════════════════
function toast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const colors = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    error:   'bg-heart-50 text-heart-700 border-heart-200',
    info:    'bg-blue-50 text-blue-700 border-blue-200'
  };
  const div = document.createElement('div');
  div.className = `toast px-5 py-3 rounded-xl text-sm font-semibold border shadow-lg ${colors[type] || colors.info}`;
  div.textContent = message;
  container.appendChild(div);
  setTimeout(() => { div.style.opacity = '0'; div.style.transition = 'opacity .3s'; setTimeout(() => div.remove(), 300); }, 3000);
}

// ═══════════════════════════════════════════════
// ═══════════════════════════════════════════════
// Preload Selected Date's Data
// ═══════════════════════════════════════════════
async function loadDailyLog() {
  // Reset Form
  document.querySelectorAll('.mood-btn').forEach(b => {
    b.classList.remove('!border-navy-400', '!text-navy-700', '!bg-navy-50');
  });
  selectedMood = '';
  document.getElementById('morning-notes').value = '';
  document.getElementById('sleep-slider').value = 7.5;
  document.getElementById('sleep-val').textContent = '7.5h';

  try {
    const selectedDateStr = globalDatePicker ? globalDatePicker.value : getLocalYMD();
    const res = await fetch(`${API}/daily`, { headers: authHeaders() });
    if (!res.ok) return;
    const logs = await res.json();
    
    const targetLog = logs.find(l => getLocalYMD(new Date(l.date)) === selectedDateStr);

    if (targetLog) {
      if (targetLog.mood) {
        document.querySelectorAll('.mood-btn').forEach(b => {
          if (b.dataset.mood === targetLog.mood) b.click();
        });
      }
      
      if (targetLog.notes) {
        const sleepMatch = targetLog.notes.match(/Sleep:\s*([\d.]+)h/i);
        if (sleepMatch) {
          const sleepVal = sleepMatch[1];
          document.getElementById('sleep-slider').value = sleepVal;
          document.getElementById('sleep-val').textContent = sleepVal + 'h';
        }
        const rawNotes = targetLog.notes.replace(/Sleep:\s*[\d.]+h\.?\s*/i, '').trim();
        document.getElementById('morning-notes').value = rawNotes;
      }
    }
  } catch (err) {
    console.error('Failed to load daily log data:', err);
  }
}
loadDailyLog();

// ═══════════════════════════════════════════════
// Mood selector
// ═══════════════════════════════════════════════
let selectedMood = '';
document.querySelectorAll('.mood-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mood-btn').forEach(b => {
      b.classList.remove('!border-navy-400', '!text-navy-700', '!bg-navy-50');
    });
    btn.classList.add('!border-navy-400', '!text-navy-700', '!bg-navy-50');
    selectedMood = btn.dataset.mood;
  });
});

// ═══════════════════════════════════════════════
// Caffeine Custom Drinks & UI Logic
// ═══════════════════════════════════════════════
const caffeineDrink = document.getElementById('caffeine-drink');
const caffeineMg = document.getElementById('caffeine-mg');
const caffeineQty = document.getElementById('caffeine-qty');
const caffeineSeverity = document.getElementById('caffeine-severity');
const caffeineDesc = document.getElementById('caffeine-desc');
const customDrinksGroup = document.getElementById('custom-drinks-group');
const saveCustomWrapper = document.getElementById('caffeine-save-wrapper');
const saveCustomCheck = document.getElementById('caffeine-save-custom');

let customDrinks = JSON.parse(localStorage.getItem('customDrinks') || '[]');
function renderCustomDrinks() {
  customDrinksGroup.innerHTML = '';
  if (customDrinks.length === 0) return;
  customDrinks.forEach(drink => {
    const opt = document.createElement('option');
    opt.value = drink.name;
    opt.dataset.mg = drink.mg;
    opt.textContent = `⭐ ${drink.name} — ${drink.mg} mg`;
    customDrinksGroup.appendChild(opt);
  });
}
renderCustomDrinks();

function updateCaffeineSeverity() {
  const mg = parseInt(caffeineMg.value, 10) || 0;
  const qty = parseInt(caffeineQty.value, 10) || 1;
  const totalMg = mg * qty;
  const sev = Math.min(10, Math.max(1, Math.round(totalMg / 40)));
  caffeineSeverity.value = sev;
}

caffeineDrink.addEventListener('change', () => {
  const opt = caffeineDrink.options[caffeineDrink.selectedIndex];
  if (caffeineDrink.value === 'Custom') {
    caffeineMg.value = '';
    caffeineDesc.value = '';
    caffeineDesc.focus();
    saveCustomWrapper.classList.remove('hidden');
  } else {
    const mg = opt.dataset.mg;
    if (mg) caffeineMg.value = mg;
    saveCustomWrapper.classList.add('hidden');
    saveCustomCheck.checked = false;
  }
  updateCaffeineSeverity();
});

caffeineMg.addEventListener('input', () => {
  updateCaffeineSeverity();
  if (caffeineDrink.value && caffeineDrink.value !== 'Custom' && caffeineDrink.value !== '') {
    saveCustomWrapper.classList.remove('hidden');
  }
});
caffeineQty.addEventListener('input', updateCaffeineSeverity);

// ═══════════════════════════════════════════════
// 1. Morning Check-in → POST /api/daily
// ═══════════════════════════════════════════════
document.getElementById('submit-morning').addEventListener('click', async () => {
  const sleep = document.getElementById('sleep-slider').value;
  const notes = document.getElementById('morning-notes').value.trim();
  const mood  = selectedMood || 'neutral';
  const targetDate = globalDatePicker ? globalDatePicker.value : getLocalYMD(); 

  try {
    const res = await fetch(`${API}/daily`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ date: targetDate, mood, notes: `Sleep: ${sleep}h. ${notes}`.trim() })
    });
    if (!res.ok) throw new Error();
    toast('Morning check-in saved!');
  } catch { toast('Failed to save check-in.', 'error'); }
});

// ═══════════════════════════════════════════════
// 2. Caffeine → POST /api/trigger
// ═══════════════════════════════════════════════
document.getElementById('submit-caffeine').addEventListener('click', async () => {
  const severity = parseInt(caffeineSeverity.value, 10);
  const mg = parseInt(caffeineMg.value, 10);
  let description = caffeineDesc.value.trim();
  const drinkValue = caffeineDrink.value;
  const qty = parseInt(caffeineQty.value, 10) || 1;
  const timeStr = document.getElementById('caffeine-time').value;
  
  if (!severity || severity < 1 || severity > 10) return toast('Severity must be 1–10.', 'error');
  if (drinkValue === 'Custom' && !description) return toast('Please enter a description for your custom drink.', 'error');

  const drinkName = description || drinkValue;
  if (saveCustomCheck.checked && mg > 0 && drinkName) {
    if (!customDrinks.some(d => d.name.toLowerCase() === drinkName.toLowerCase())) {
      customDrinks.push({ name: drinkName, mg });
      localStorage.setItem('customDrinks', JSON.stringify(customDrinks));
      renderCustomDrinks();
    }
  }

  const finalDesc = `${qty > 1 ? qty + 'x ' : ''}${drinkName}${mg ? ' (' + (mg * qty) + 'mg)' : ''}`;
  const timestamp = getTimestampFromTime(timeStr);

  try {
    const res = await fetch(`${API}/trigger`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ triggerType: 'caffeine', severity, description: finalDesc, timestamp: timestamp.toISOString() })
    });
    if (!res.ok) throw new Error();
    toast('Caffeine logged!');
    loadEventManager();
    
    caffeineDrink.value = '';
    caffeineMg.value = '';
    caffeineQty.value = '1';
    caffeineDesc.value = '';
    caffeineSeverity.value = '1';
    saveCustomWrapper.classList.add('hidden');
    saveCustomCheck.checked = false;
  } catch (err) {
    toast('Error connecting to server', 'error');
  }
});

// ═══════════════════════════════════════════════
// Event Manager
// ═══════════════════════════════════════════════
async function loadEventManager() {
  const container = document.getElementById('event-manager-list');
  if (!container) return;
  container.innerHTML = '<p class="text-sm text-gray-500">Loading events...</p>';

  try {
    const selectedDateStr = globalDatePicker ? globalDatePicker.value : getLocalYMD();
    
    const [trigRes, heartRes, sympRes] = await Promise.all([
      fetch(`${API}/trigger`, { headers: authHeaders() }),
      fetch(`${API}/heart`, { headers: authHeaders() }),
      fetch(`${API}/symptom`, { headers: authHeaders() })
    ]);

    const triggers = await trigRes.json();
    const hearts = await heartRes.json();
    const symptoms = await sympRes.json();

    let events = [];

    triggers.forEach(t => {
      if (getLocalYMD(new Date(t.timestamp)) === selectedDateStr) {
        events.push({ type: 'trigger', data: t, time: new Date(t.timestamp) });
      }
    });
    hearts.forEach(h => {
      if (getLocalYMD(new Date(h.timestamp)) === selectedDateStr) {
        events.push({ type: 'heart', data: h, time: new Date(h.timestamp) });
      }
    });
    symptoms.forEach(s => {
      if (getLocalYMD(new Date(s.timestamp)) === selectedDateStr) {
        events.push({ type: 'symptom', data: s, time: new Date(s.timestamp) });
      }
    });

    events.sort((a, b) => a.time - b.time);

    if (events.length === 0) {
      container.innerHTML = '<p class="text-sm text-gray-500 p-2">No discrete events logged for this date.</p>';
      return;
    }

    container.innerHTML = '';
    events.forEach(evt => {
      const div = document.createElement('div');
      div.className = 'flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg shadow-sm';
      
      let icon = '', title = '', detail = '';
      if (evt.type === 'trigger') {
        icon = evt.data.triggerType === 'caffeine' ? '☕' : '🍺';
        title = evt.data.triggerType === 'caffeine' ? 'Caffeine' : 'Alcohol';
        detail = `${evt.data.description || 'Unknown'} (Severity: ${evt.data.severity})`;
      } else if (evt.type === 'heart') {
        icon = '❤️';
        title = 'Heart Rate & BP';
        detail = `${evt.data.heartRate} BPM, ${evt.data.bloodPressureSys || '-'}/${evt.data.bloodPressureDia || '-'}`;
      } else if (evt.type === 'symptom') {
        icon = '🤒';
        title = 'Symptom';
        detail = evt.data.symptomTypes.join(', ');
      }

      div.innerHTML = `
        <div class="flex items-center gap-3">
          <div class="text-xl">${icon}</div>
          <div>
            <div class="font-semibold text-sm text-navy-900">${title} <span class="text-gray-400 font-normal ml-2">${evt.time.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span></div>
            <div class="text-xs text-gray-600 mt-0.5">${detail}</div>
          </div>
        </div>
        <button onclick="deleteEvent('${evt.type}', '${evt.data._id}')" class="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition" title="Delete Event">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </button>
      `;
      container.appendChild(div);
    });

  } catch (err) {
    console.error('Failed to load events:', err);
    container.innerHTML = '<p class="text-sm text-red-500">Failed to load events.</p>';
  }
}

// Attach delete to window so inline onclick works
window.deleteEvent = async function(type, id) {
  if (!confirm('Are you sure you want to delete this event?')) return;
  try {
    const res = await fetch(`${API}/${type}/${id}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    if (res.ok) {
      toast('Event deleted successfully');
      loadEventManager();
    } else {
      toast('Failed to delete event', 'error');
    }
  } catch (err) {
    console.error(err);
    toast('Error connecting to server', 'error');
  }
};

loadEventManager();

// ═══════════════════════════════════════════════
// 3. Alcohol → POST /api/trigger
// ═══════════════════════════════════════════════
document.getElementById('submit-alcohol').addEventListener('click', async () => {
  const severity    = parseInt(document.getElementById('alcohol-severity').value, 10);
  const description = document.getElementById('alcohol-desc').value.trim();
  const timeStr     = document.getElementById('alcohol-time').value;

  if (!severity || severity < 1 || severity > 10) return toast('Severity must be 1–10.', 'error');

  const timestamp = getTimestampFromTime(timeStr);

  try {
    const res = await fetch(`${API}/trigger`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ triggerType: 'alcohol', severity, description, timestamp: timestamp.toISOString() })
    });
    if (!res.ok) throw new Error();
    toast('Alcohol logged!');
    loadEventManager();
    document.getElementById('alcohol-desc').value = '';
    document.getElementById('alcohol-severity').value = '1';
  } catch { toast('Failed to log alcohol.', 'error'); }
});

// ═══════════════════════════════════════════════
// 4. Heart Rate → POST /api/heart
// ═══════════════════════════════════════════════
document.getElementById('submit-heart').addEventListener('click', async () => {
  const heartRate       = parseInt(document.getElementById('heart-bpm').value, 10);
  const bloodPressureSys = parseInt(document.getElementById('heart-sys').value, 10) || undefined;
  const bloodPressureDia = parseInt(document.getElementById('heart-dia').value, 10) || undefined;
  const timeStr         = document.getElementById('heart-time').value;

  if (!heartRate || heartRate < 30 || heartRate > 250) return toast('Enter a valid heart rate (30–250 BPM).', 'error');

  const timestamp = getTimestampFromTime(timeStr);

  try {
    const res = await fetch(`${API}/heart`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ heartRate, bloodPressureSys, bloodPressureDia, timestamp: timestamp.toISOString() })
    });
    if (!res.ok) throw new Error();
    toast('Heart data logged!');
    loadEventManager();
    document.getElementById('heart-bpm').value = '';
    document.getElementById('heart-sys').value = '';
    document.getElementById('heart-dia').value = '';
  } catch { toast('Failed to log heart data.', 'error'); }
});

// ═══════════════════════════════════════════════
// 5. Symptom Logger → POST /api/symptom
// ═══════════════════════════════════════════════
const selectedSymptoms = new Set();
document.querySelectorAll('.symp-chip').forEach(btn => {
  btn.addEventListener('click', () => {
    const val = btn.dataset.val;
    if (selectedSymptoms.has(val)) {
      selectedSymptoms.delete(val);
      btn.classList.remove('bg-heart-50', 'border-heart-400', 'text-heart-700');
      btn.classList.add('bg-white', 'text-gray-500');
    } else {
      selectedSymptoms.add(val);
      btn.classList.add('bg-heart-50', 'border-heart-400', 'text-heart-700');
      btn.classList.remove('bg-white', 'text-gray-500');
    }
  });
});

document.getElementById('submit-symptom').addEventListener('click', async () => {
  const timeStr = document.getElementById('symptom-time').value;
  const severity = parseInt(document.getElementById('symptom-severity').value, 10);
  const duration = document.getElementById('symptom-duration').value;
  const activity = document.getElementById('symptom-activity').value;
  const notes = document.getElementById('symptom-notes').value.trim();
  
  const redFlags = [];
  document.querySelectorAll('.symptom-redflag:checked').forEach(el => redFlags.push(el.value));
  
  const symptomTypes = Array.from(selectedSymptoms);
  if (symptomTypes.length === 0 && !notes) {
    return toast('Please select at least one symptom or provide notes.', 'error');
  }

  const timestamp = getTimestampFromTime(timeStr);

  try {
    const res = await fetch(`${API}/symptom`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ 
        timestamp: timestamp.toISOString(),
        symptomTypes,
        duration,
        activity,
        severity,
        redFlags,
        notes 
      })
    });
    if (!res.ok) throw new Error();
    toast('Symptom accurately logged!');
    loadEventManager();
    
    // reset
    document.getElementById('symptom-severity').value = 5;
    document.getElementById('symptom-duration').selectedIndex = 0;
    document.getElementById('symptom-activity').selectedIndex = 0;
    document.getElementById('symptom-notes').value = '';
    document.querySelectorAll('.symptom-redflag').forEach(el => el.checked = false);
    selectedSymptoms.clear();
    document.querySelectorAll('.symp-chip').forEach(btn => {
      btn.classList.remove('bg-heart-50', 'border-heart-400', 'text-heart-700');
      btn.classList.add('bg-white', 'text-gray-500');
    });
  } catch { toast('Failed to log symptom.', 'error'); }
});
