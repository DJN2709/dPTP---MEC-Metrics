/*
 * MEC Steps Analysis Script
 * 
 * DATE RANGE LOCK: Logic is locked to operate from Jan 2024 to May 2025 (17 months).
 * TODO: Adjust date determination logic from June 2025 onwards.
 */
const fs = require('fs');
const path = require('path');

// CONFIG
const DEBUG_FILE = path.join(__dirname, 'debug_booked.txt');
const START_MONTH = 0; // 0 = January
const START_YEAR = 2024;
const NUM_MONTHS = 17; // Jan 2024 - May 2025 (locked until May 2025)

function getMonthYear(date) {
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function getAllMonths(startYear, startMonth, count) {
  const months = [];
  let d = new Date(Date.UTC(startYear, startMonth, 1));
  for (let i = 0; i < count; i++) {
    months.push(getMonthYear(d));
    d.setMonth(d.getMonth() + 1);
  }
  return months;
}

// Parse debug_booked.txt for relevant messages
const lines = fs.readFileSync(DEBUG_FILE, 'utf-8').split('\n');
const messages = [];
const mecUpdateRegex = /MEC\s*UPDATE/i;
const mecIsComingRegex = /MEC\s*is\s*coming/i;
const wd1Regex = /WD1/i;
const wd2Regex = /WD2/i;
const bookedRegex = /is booked/i;

for (const line of lines) {
  // Try to extract timestamp and text
  const match = line.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z).*\|\s*(.*)/);
  if (match) {
    messages.push({
      ts: new Date(match[1]),
      text: match[2]
    });
  }
}

// Group messages by month
const byMonth = {};
for (const msg of messages) {
  const month = getMonthYear(msg.ts);
  if (!byMonth[month]) byMonth[month] = [];
  byMonth[month].push(msg);
}

const months = getAllMonths(START_YEAR, START_MONTH, NUM_MONTHS);
const results = [];
const seenMonths = new Set();

for (let i = 1; i < months.length; i++) {
  const month = months[i];
  if (seenMonths.has(month)) continue;
  seenMonths.add(month);

  const prevMonth = months[i - 1];
  const prevMsgs = byMonth[prevMonth] || [];
  const currMsgs = byMonth[month] || [];

  // High-level total duration: start and end of the month
  const totalStart = new Date(Date.UTC(START_YEAR, START_MONTH + i, 1));
  const totalEnd = new Date(Date.UTC(START_YEAR, START_MONTH + i + 1, 0, 23, 59, 59, 999));

  // Subtasks: only include if available
  const subtasks = [];

  // Backfill: last MEC Update or MEC is coming in prev month
  let backfillStartMsg = [...prevMsgs].reverse().find(m => mecUpdateRegex.test(m.text));
  if (!backfillStartMsg) backfillStartMsg = [...prevMsgs].reverse().find(m => mecIsComingRegex.test(m.text));
  if (backfillStartMsg) {
    let backfillEndMsg = currMsgs.find(m => wd1Regex.test(m.text) || wd2Regex.test(m.text) || bookedRegex.test(m.text));
    let backfillEnd = backfillEndMsg ? backfillEndMsg.ts : totalEnd;
    subtasks.push({
      type: 'backfill',
      start: backfillStartMsg.ts.toISOString(),
      end: backfillEnd.toISOString()
    });
  }

  // WD1
  let wd1Msg = currMsgs.find(m => wd1Regex.test(m.text));
  if (wd1Msg) {
    let wd1EndMsg = currMsgs.find(m => wd2Regex.test(m.text) && m.ts > wd1Msg.ts);
    if (!wd1EndMsg) wd1EndMsg = currMsgs.find(m => bookedRegex.test(m.text) && m.ts > wd1Msg.ts);
    let wd1End = wd1EndMsg ? wd1EndMsg.ts : totalEnd;
    subtasks.push({
      type: 'WD1',
      start: wd1Msg.ts.toISOString(),
      end: wd1End.toISOString()
    });
  }

  // WD2
  let wd2Msg = currMsgs.find(m => wd2Regex.test(m.text));
  if (wd2Msg) {
    let wd2EndMsg = currMsgs.find(m => bookedRegex.test(m.text) && m.ts > wd2Msg.ts);
    let wd2End = wd2EndMsg ? wd2EndMsg.ts : totalEnd;
    subtasks.push({
      type: 'WD2',
      start: wd2Msg.ts.toISOString(),
      end: wd2End.toISOString()
    });
  }

  // Booked
  let bookedMsg = currMsgs.find(m => bookedRegex.test(m.text));
  if (bookedMsg) {
    subtasks.push({
      type: 'booked',
      start: bookedMsg.ts.toISOString(),
      end: totalEnd.toISOString()
    });
  }

  // Add 'Remaining Tasks' if there is a gap after the last subtask
  let lastEnd = totalStart;
  if (subtasks.length > 0) {
    // Sort subtasks by start time
    subtasks.sort((a, b) => new Date(a.start) - new Date(b.start));
    // Fill any gap before the first subtask
    if (new Date(subtasks[0].start) > totalStart) {
      subtasks.unshift({
        type: 'remaining',
        start: totalStart.toISOString(),
        end: subtasks[0].start
      });
    }
    // Fill gaps between subtasks
    for (let j = 0; j < subtasks.length - 1; j++) {
      if (new Date(subtasks[j].end) < new Date(subtasks[j + 1].start)) {
        subtasks.splice(j + 1, 0, {
          type: 'remaining',
          start: subtasks[j].end,
          end: subtasks[j + 1].start
        });
        j++;
      }
    }
    // Fill any gap after the last subtask
    if (new Date(subtasks[subtasks.length - 1].end) < totalEnd) {
      subtasks.push({
        type: 'remaining',
        start: subtasks[subtasks.length - 1].end,
        end: totalEnd.toISOString()
      });
    }
  } else {
    // If no subtasks, the whole duration is 'remaining'
    subtasks.push({
      type: 'remaining',
      start: totalStart.toISOString(),
      end: totalEnd.toISOString()
    });
  }

  results.push({
    month,
    total: {
      start: totalStart.toISOString(),
      end: totalEnd.toISOString()
    },
    subtasks
  });
}

console.log(JSON.stringify(results, null, 2));

// After generating the output arrays
const oct2024Start = '2024-09-29T13:15:00+02:00';
const oct2024End = '2024-10-03T01:06:00+02:00';

// High-level duration
if (!results.find(d => d.month === 'October 2024')) {
  results.push({
    month: 'October 2024',
    total: {
      start: oct2024Start,
      end: oct2024End
    },
    subtasks: [
      { type: 'remaining', start: oct2024Start, end: oct2024End }
    ]
  });
}
// Steps timeline
if (!results.find(d => d.month === 'October 2024')) {
  results.push({
    month: 'October 2024',
    total: {
      start: oct2024Start,
      end: oct2024End
    },
    subtasks: [
      { type: 'remaining', start: oct2024Start, end: oct2024End }
    ]
  });
} 