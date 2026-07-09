// ------------------------------------------------------------------
// Insight Engine – pure-JS array math, no external libraries
// ------------------------------------------------------------------

/**
 * Normalise a Date (or date-like value) to a "YYYY-MM-DD" string so we can
 * group records that fall on the same calendar day.
 */
function toDateKey(d) {
  const dt = new Date(d);
  return dt.toISOString().slice(0, 10); // "2026-07-09"
}

/**
 * Compute the arithmetic mean of an array of numbers.
 * Returns 0 when the array is empty.
 */
function avg(arr) {
  if (!arr.length) return 0;
  return arr.reduce((sum, v) => sum + v, 0) / arr.length;
}

// ------------------------------------------------------------------
// 1. getStrongestTrigger
//
// For every trigger type the user has logged we:
//   • collect the calendar dates where severity was HIGH (> threshold)
//   • collect the remaining dates as LOW
//   • compute the average heart-rate on HIGH days vs LOW days
//   • return the trigger whose HIGH-day avg HR minus LOW-day avg HR is
//     the biggest – that is the "strongest trigger".
//
// Thresholds are expressed via severity (1-10 scale stored on TriggerLog).
// A severity >= 7 is considered "high".
// ------------------------------------------------------------------
const SEVERITY_HIGH_THRESHOLD = 7;

function getStrongestTrigger(triggerLogs, heartLogs) {
  if (!triggerLogs.length || !heartLogs.length) {
    return {
      trigger: null,
      bpmDifference: 0,
      message: 'Not enough data yet. Keep logging your triggers and heart rate!'
    };
  }

  // Build a map: dateKey -> average heartRate for that day
  const heartByDate = {};
  for (const h of heartLogs) {
    const key = toDateKey(h.timestamp);
    if (!heartByDate[key]) heartByDate[key] = [];
    heartByDate[key].push(h.heartRate);
  }
  // Collapse each day's readings into a single average
  const avgHrByDate = {};
  for (const [key, readings] of Object.entries(heartByDate)) {
    avgHrByDate[key] = avg(readings);
  }

  // Group trigger logs by triggerType
  const triggerGroups = {};
  for (const t of triggerLogs) {
    if (!triggerGroups[t.triggerType]) triggerGroups[t.triggerType] = [];
    triggerGroups[t.triggerType].push(t);
  }

  let bestTrigger = null;
  let bestDiff = -Infinity;
  let bestHighAvg = 0;
  let bestLowAvg = 0;

  for (const [type, logs] of Object.entries(triggerGroups)) {
    // Dates where this trigger was HIGH
    const highDates = new Set();
    const lowDates = new Set();

    for (const log of logs) {
      const key = toDateKey(log.timestamp);
      if (log.severity >= SEVERITY_HIGH_THRESHOLD) {
        highDates.add(key);
      } else {
        lowDates.add(key);
      }
    }

    // Collect heart-rate averages for high vs low days
    const highHrs = [];
    const lowHrs = [];

    for (const d of highDates) {
      if (avgHrByDate[d] !== undefined) highHrs.push(avgHrByDate[d]);
    }
    for (const d of lowDates) {
      if (avgHrByDate[d] !== undefined) lowHrs.push(avgHrByDate[d]);
    }

    if (!highHrs.length || !lowHrs.length) continue;

    const highAvg = avg(highHrs);
    const lowAvg = avg(lowHrs);
    const diff = highAvg - lowAvg;

    if (diff > bestDiff) {
      bestDiff = diff;
      bestTrigger = type;
      bestHighAvg = highAvg;
      bestLowAvg = lowAvg;
    }
  }

  if (bestTrigger === null) {
    return {
      trigger: null,
      bpmDifference: 0,
      message: 'Not enough overlapping trigger and heart-rate data to identify a pattern yet.'
    };
  }

  const diffRounded = Math.round(bestDiff * 10) / 10;

  return {
    trigger: bestTrigger,
    bpmDifference: diffRounded,
    highDayAvgBpm: Math.round(bestHighAvg * 10) / 10,
    lowDayAvgBpm: Math.round(bestLowAvg * 10) / 10,
    message:
      diffRounded > 0
        ? `Your strongest trigger is "${bestTrigger}". On high-${bestTrigger} days your average heart rate was ${Math.round(bestHighAvg)} BPM compared to ${Math.round(bestLowAvg)} BPM on low days — a difference of ${diffRounded} BPM.`
        : `No trigger showed a significant heart-rate increase. Keep logging for more accurate insights!`
  };
}

// ------------------------------------------------------------------
// 2. getWorstCombination
//
// Counts how many distinct trigger types were active on each calendar
// day.  "High-risk" days are those with MORE than 2 active triggers;
// "low-risk" days have 2 or fewer.  We compare average HR between
// the two groups.
// ------------------------------------------------------------------
function getWorstCombination(triggerLogs, heartLogs) {
  if (!triggerLogs.length || !heartLogs.length) {
    return {
      highRiskAvgBpm: 0,
      lowRiskAvgBpm: 0,
      bpmDifference: 0,
      message: 'Not enough data yet. Keep logging your triggers and heart rate!'
    };
  }

  // Build heart-rate average per day (reuse logic)
  const heartByDate = {};
  for (const h of heartLogs) {
    const key = toDateKey(h.timestamp);
    if (!heartByDate[key]) heartByDate[key] = [];
    heartByDate[key].push(h.heartRate);
  }
  const avgHrByDate = {};
  for (const [key, readings] of Object.entries(heartByDate)) {
    avgHrByDate[key] = avg(readings);
  }

  // Count distinct trigger types per day
  const triggersPerDay = {};
  for (const t of triggerLogs) {
    const key = toDateKey(t.timestamp);
    if (!triggersPerDay[key]) triggersPerDay[key] = new Set();
    triggersPerDay[key].add(t.triggerType);
  }

  const HIGH_RISK_THRESHOLD = 2; // more than 2 triggers = high-risk

  const highRiskHrs = [];
  const lowRiskHrs = [];

  for (const [day, types] of Object.entries(triggersPerDay)) {
    if (avgHrByDate[day] === undefined) continue;

    if (types.size > HIGH_RISK_THRESHOLD) {
      highRiskHrs.push(avgHrByDate[day]);
    } else {
      lowRiskHrs.push(avgHrByDate[day]);
    }
  }

  const highAvg = avg(highRiskHrs);
  const lowAvg = avg(lowRiskHrs);
  const diff = Math.round((highAvg - lowAvg) * 10) / 10;

  if (!highRiskHrs.length || !lowRiskHrs.length) {
    return {
      highRiskAvgBpm: Math.round(highAvg * 10) / 10,
      lowRiskAvgBpm: Math.round(lowAvg * 10) / 10,
      bpmDifference: 0,
      message: 'You need days with both high and low trigger counts alongside heart-rate data to see combination effects.'
    };
  }

  // Identify the most common trigger combo on high-risk days
  const comboCount = {};
  for (const [day, types] of Object.entries(triggersPerDay)) {
    if (types.size > HIGH_RISK_THRESHOLD) {
      const combo = [...types].sort().join(' + ');
      comboCount[combo] = (comboCount[combo] || 0) + 1;
    }
  }
  const worstCombo = Object.entries(comboCount).sort((a, b) => b[1] - a[1])[0];

  return {
    highRiskAvgBpm: Math.round(highAvg * 10) / 10,
    lowRiskAvgBpm: Math.round(lowAvg * 10) / 10,
    bpmDifference: diff,
    worstCombination: worstCombo ? worstCombo[0] : null,
    message:
      diff > 0
        ? `On days with 3+ triggers your average heart rate was ${Math.round(highAvg)} BPM vs ${Math.round(lowAvg)} BPM on calmer days (${diff > 0 ? '+' : ''}${diff} BPM).${worstCombo ? ` The most common high-risk combination is "${worstCombo[0]}" (${worstCombo[1]} day${worstCombo[1] > 1 ? 's' : ''}).` : ''}`
        : 'Combining multiple triggers hasn\'t noticeably raised your heart rate yet. Keep logging!'
  };
}

// ------------------------------------------------------------------
// 3. getSymptomPattern
//
// "Symptoms" live in HeartLog descriptions or DailyLog notes/mood.
// We look at days where the user recorded a poor mood (mood field) in
// DailyLog, then check which trigger types were elevated on those
// same days.  The most frequently co-occurring trigger is the match.
// ------------------------------------------------------------------
const NEGATIVE_MOODS = ['bad', 'terrible', 'awful', 'poor', 'stressed', 'anxious', 'sick', 'tired', 'sad', 'low'];

function getSymptomPattern(dailyLogs, triggerLogs) {
  if (!dailyLogs.length || !triggerLogs.length) {
    return {
      topTrigger: null,
      occurrences: 0,
      message: 'Not enough data yet. Log your daily mood and triggers to uncover patterns!'
    };
  }

  // Find dates where the user logged a negative mood / symptom
  const symptomDates = new Set();
  for (const dl of dailyLogs) {
    const moodLower = (dl.mood || '').toLowerCase();
    const notesLower = (dl.notes || '').toLowerCase();

    const isNegative = NEGATIVE_MOODS.some(
      (m) => moodLower.includes(m) || notesLower.includes(m)
    );

    if (isNegative) {
      symptomDates.add(toDateKey(dl.date));
    }
  }

  if (!symptomDates.size) {
    return {
      topTrigger: null,
      occurrences: 0,
      message: 'No symptom days detected in your logs. That\'s great — or try logging your mood more often!'
    };
  }

  // Count which trigger types appear on those symptom days
  const triggerHits = {};
  for (const t of triggerLogs) {
    const key = toDateKey(t.timestamp);
    if (symptomDates.has(key)) {
      triggerHits[t.triggerType] = (triggerHits[t.triggerType] || 0) + 1;
    }
  }

  const entries = Object.entries(triggerHits);
  if (!entries.length) {
    return {
      topTrigger: null,
      occurrences: 0,
      message: 'No triggers were logged on your symptom days. Try logging triggers on every day for better insights.'
    };
  }

  entries.sort((a, b) => b[1] - a[1]);
  const [topTrigger, count] = entries[0];

  return {
    topTrigger,
    occurrences: count,
    symptomDaysCount: symptomDates.size,
    message: `On ${symptomDates.size} day${symptomDates.size > 1 ? 's' : ''} where you felt unwell, "${topTrigger}" was the most common trigger (present ${count} time${count > 1 ? 's' : ''}). Consider reducing ${topTrigger} and tracking the effect.`
  };
}

module.exports = {
  getStrongestTrigger,
  getWorstCombination,
  getSymptomPattern
};
