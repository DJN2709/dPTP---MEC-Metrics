/*
 * dPTP MEC Metrics Server
 * 
 * CHANNEL TRANSITION LOGIC:
 * - Jan 2024 - May 2025: Music (CB0CY1YBH), Audiobooks (C05U48VE6ER) - separate channels
 * - June 2025 onwards: Both Music and Audiobooks tracked in CB0CY1YBH with keyword filtering
 *   - Music messages must contain "Music" keyword
 *   - Audiobooks messages must contain "Audiobooks" keyword
 * 
 * The audiobooks functions now handle both periods automatically using keyword filtering.
 * New music-specific functions are available for June 2025 onwards.
 */
console.log('SERVER.JS STARTED');
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 4000;
require('dotenv').config();
const { WebClient } = require('@slack/web-api');
const path = require('path');
const fs = require('fs');

fs.writeFileSync('debug_test.txt', 'hello from server.js');

app.use(cors());

const slackToken = process.env.SLACK_BOT_TOKEN;
const slackChannel = 'CB0CY1YBH';
const slackClient = new WebClient(slackToken);

// Helper: Extract step timestamps from Slack messages
function extractTimeline(messages) {
  // Define step patterns
  const patterns = [
    { key: 'backfillStart', regex: /MEC Update:/i },
    { key: 'cliqueData', regex: /CliqueDataJoined is available on GCS\. Volatile backfill can be triggered\./i },
    { key: 'completenessCheck', regex: /Completeness Check: calculator dependencies are done\./i },
    { key: 'initialCounter', regex: /Initial Counter Validation Passed\.\.\. and MEC Sheet has been updated\./i },
    { key: 'bigqueryTables', regex: /All BigQuery tables are available\./i },
    { key: 'breakageFile', regex: /Breakage file is ingested successfully\./i },
    { key: 'backfillEnd', regex: /final counter validation npassed\.\.\. and MEC sheet has been updated/i },
  ];

  // Group messages by month (based on MEC Update:)
  const timeline = [];
  let current = null;
  messages.forEach(msg => {
    if (!msg.text) return;
    const ts = new Date(Number(msg.ts) * 1000);
    if (patterns[0].regex.test(msg.text)) {
      if (current) timeline.push(current);
      current = { month: ts.toLocaleString('default', { month: 'long', year: 'numeric' }), steps: { backfillStart: ts } };
    } else if (current) {
      for (let i = 1; i < patterns.length; i++) {
        if (patterns[i].regex.test(msg.text)) {
          current.steps[patterns[i].key] = ts;
        }
      }
    }
  });
  if (current) timeline.push(current);
  return timeline;
}

// High-level MEC duration extraction
function extractHighLevelTimeline(messages) {
  // Reverse to process oldest to newest
  const msgs = [...messages].reverse();
  // Helper to get month/year string
  const getMonthYear = (date) => {
    return date.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  };
  // Generate all months from Jan 2024 to Dec 2025
  // From June 2025 onwards, will filter by "Music" keyword
  const targetMonths = [];
  let d = new Date('2024-01-01T00:00:00Z');
  for (let i = 0; i < 24; i++) { // Full range: Jan 2024 - Dec 2025
    targetMonths.push(getMonthYear(d));
    d.setMonth(d.getMonth() + 1);
  }
  // Find all MEC Update messages
  // MEC Update messages are NOT filtered by keywords (even from June 2025 onwards)
  const mecUpdates = msgs.filter(msg => {
    if (!msg.text || !/MEC Update:/i.test(msg.text)) return false;
    return true; // Always use all MEC Update messages, no keyword filtering
  }).map(msg => ({
    ts: new Date(Number(msg.ts) * 1000),
    text: msg.text
  }));
  
  // Find all 'booked' messages
  // From June 2025 onwards, filter by "Music" keyword
  const bookedMsgs = msgs.filter(msg => {
    if (!msg.text || !/booked/i.test(msg.text)) return false;
    const msgDate = new Date(Number(msg.ts) * 1000);
    const msgMonth = getMonthYear(msgDate);
    
    // For June 2025 onwards, must contain "Music" AND "booked" in same context (not just section headers)
    if (isJune2025OrLater(msgMonth)) {
      // Look for patterns that indicate this is actually a Music booked message
      // Pattern 1: "Music" and "booked" appear close together (within 200 characters)
      // Pattern 2: Message starts with music context (not just has a music section)
      const musicIndex = msg.text.toLowerCase().indexOf('music');
      const bookedIndex = msg.text.toLowerCase().indexOf('booked');
      const hasMusic = musicIndex !== -1;
      const hasBooked = bookedIndex !== -1;
      const closeProximity = hasMusic && hasBooked && Math.abs(musicIndex - bookedIndex) <= 200;
      
      // Additional check: if message has multiple sections (ABP, Lyrics, Music), 
      // only consider it a Music booked message if Music section contains "booked"
      const hasMultipleSections = /(:books-jam:|:microphone:).*:musical_note:/i.test(msg.text);
      
      let isValidMusicBooked = false;
      if (hasMultipleSections) {
        // Extract just the Music section and check if it contains "booked"
        const musicSectionMatch = msg.text.match(/:musical_note:\s*\*Music\*(.*?)(?=:[\w-]+:|$)/is);
        if (musicSectionMatch) {
          const musicSection = musicSectionMatch[1];
          isValidMusicBooked = /booked/i.test(musicSection);
        }
      } else {
        // Single section message - use proximity check
        isValidMusicBooked = closeProximity;
      }
      
      return isValidMusicBooked;
    }
    return true; // Before June 2025, use all booked messages
  }).map(msg => ({
    ts: new Date(Number(msg.ts) * 1000),
    text: msg.text
  }));
  
  const results = [];
  for (let i = 0; i < targetMonths.length; i++) {
    const month = targetMonths[i];
    // Find the first 'booked' message in this month
    const booked = bookedMsgs.find(m => getMonthYear(m.ts) === month);
    if (!booked) continue;
    
    // Find the last MEC Update from the previous month
    const prevMonthDate = new Date(booked.ts);
    prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
    const prevMonth = getMonthYear(prevMonthDate);
    const mecUpdate = [...mecUpdates].reverse().find(m => getMonthYear(m.ts) === prevMonth && m.ts < booked.ts);
    if (!mecUpdate) continue;
    
    // Use total minutes (including weekends)
    const durationMinutes = Math.round((booked.ts - mecUpdate.ts) / 60000);
    results.push({
      month,
      start: mecUpdate.ts,
      end: booked.ts,
      durationMinutes
    });
  }
  
  // Hardcode October 2024 if missing
  if (!results.find(r => r.month === 'October 2024')) {
    // October 2024: duration 94.1h = 5646 minutes
    // Use realistic start/end: Sep 30 13:29 UTC to Oct 4 11:36 UTC (from step data)
    const start = new Date(Date.UTC(2024, 8, 30, 13, 29)); // Sep 30 13:29 UTC
    const end = new Date(Date.UTC(2024, 9, 4, 11, 36));   // Oct 4 11:36 UTC
    results.push({
      month: 'October 2024',
      start: start.toISOString(),
      end: end.toISOString(),
      durationMinutes: 5646
    });
    // Sort results chronologically by month/year
    const monthOrder = [
      'January','February','March','April','May','June','July','August','September','October','November','December'
    ];
    results.sort((a, b) => {
      const [am, ay] = a.month.split(' ');
      const [bm, by] = b.month.split(' ');
      const ad = new Date(Number(ay), monthOrder.indexOf(am));
      const bd = new Date(Number(by), monthOrder.indexOf(bm));
      return ad - bd;
    });
  }
  return results;
}

// Helper: Extract step timestamps for Backfill, WD1, WD2, WD3, Booked
function extractStepsTimeline(messages) {
  // Reverse to process oldest to newest
  const msgs = [...messages].reverse();
  // Helper to get month/year string
  const getMonthYear = (date) => {
    return date.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  };
  // Generate all months from Jan 2024 to Dec 2025
  // From June 2025 onwards, will filter by "Music" keyword
  const targetMonths = [];
  let d = new Date('2024-01-01T00:00:00Z');
  for (let i = 0; i < 24; i++) { // Full range: Jan 2024 - Dec 2025
    targetMonths.push(getMonthYear(d));
    d.setMonth(d.getMonth() + 1);
  }
  // Find all relevant messages
  // MEC Update messages are NOT filtered by keywords (even from June 2025 onwards)
  const mecUpdates = msgs.filter(msg => {
    if (!msg.text || !/MEC Update:/i.test(msg.text)) return false;
    return true; // Always use all MEC Update messages, no keyword filtering
  }).map(msg => ({
    ts: new Date(Number(msg.ts) * 1000),
    text: msg.text
  }));
  
  const wd1Msgs = msgs.filter(msg => {
    if (!msg.text || !/WD-?1/i.test(msg.text)) return false;
    const msgDate = new Date(Number(msg.ts) * 1000);
    const msgMonth = getMonthYear(msgDate);
    // For June 2025 onwards, must contain "Music"
    if (isJune2025OrLater(msgMonth)) {
      return /music/i.test(msg.text);
    }
    return true; // Before June 2025, use all WD1 messages
  }).map(msg => ({
    ts: new Date(Number(msg.ts) * 1000),
    text: msg.text
  }));
  
  const wd2Msgs = msgs.filter(msg => {
    if (!msg.text || !/WD-?2/i.test(msg.text)) return false;
    const msgDate = new Date(Number(msg.ts) * 1000);
    const msgMonth = getMonthYear(msgDate);
    // For June 2025 onwards, must contain "Music"
    if (isJune2025OrLater(msgMonth)) {
      return /music/i.test(msg.text);
    }
    return true; // Before June 2025, use all WD2 messages
  }).map(msg => ({
    ts: new Date(Number(msg.ts) * 1000),
    text: msg.text
  }));
  
  const wd3Msgs = msgs.filter(msg => {
    if (!msg.text || !/WD-?3/i.test(msg.text)) return false;
    const msgDate = new Date(Number(msg.ts) * 1000);
    const msgMonth = getMonthYear(msgDate);
    // For June 2025 onwards, must contain "Music"
    if (isJune2025OrLater(msgMonth)) {
      return /music/i.test(msg.text);
    }
    return true; // Before June 2025, use all WD3 messages
  }).map(msg => ({
    ts: new Date(Number(msg.ts) * 1000),
    text: msg.text
  }));
  
  const bookedMsgs = msgs.filter(msg => {
    if (!msg.text || !/booked/i.test(msg.text)) return false;
    const msgDate = new Date(Number(msg.ts) * 1000);
    const msgMonth = getMonthYear(msgDate);
    // For June 2025 onwards, must contain "Music"
    if (isJune2025OrLater(msgMonth)) {
      return /music/i.test(msg.text);
    }
    return true; // Before June 2025, use all booked messages
  }).map(msg => ({
    ts: new Date(Number(msg.ts) * 1000),
    text: msg.text
  }));
  const results = [];
  for (let i = 0; i < targetMonths.length; i++) {
    const month = targetMonths[i];
    // Find the first 'booked' message in this month
    const [targetMonthName, targetYear] = month.split(' ');
    const targetMonthIndex = new Date(Date.parse(targetMonthName +" 1, 2000")).getMonth();
    const targetYearNum = parseInt(targetYear, 10);

    let booked = bookedMsgs.find(m => {
      const ts = m.ts;
      return ts.getUTCFullYear() === targetYearNum && ts.getUTCMonth() === targetMonthIndex;
    });
    
    // No fallback for June 2025+ - only show months with proper music booked messages
    
    if (!booked) continue;
    // Find MEC Update message for backfill start
    // For June 2025 onwards: look for MEC Update in the current month
    // Before June 2025: look for MEC Update from the previous month (original logic)
    let backfillStart;
    if (isJune2025OrLater(month)) {
      // June 2025 onwards: find the first MEC Update in the current month
      backfillStart = mecUpdates.find(m => getMonthYear(m.ts) === month && m.ts < booked.ts);
    } else {
      // Before June 2025: original logic - look in previous month
      const prevMonthDate = new Date(booked.ts);
      prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
      const prevMonth = getMonthYear(prevMonthDate);
      backfillStart = [...mecUpdates].reverse().find(m => getMonthYear(m.ts) === prevMonth && m.ts < booked.ts);
    }
    if (!backfillStart) continue;
    // For June 2025+: use simplified timeline (test data doesn't have proper WD messages)
    if (isJune2025OrLater(month)) {
      // Simplified timeline: just backfill -> booked
      results.push({
        month,
        backfill: {
          start: backfillStart.ts,
          end: booked.ts
        },
        wd1: null,
        wd2: null,
        wd3: null,
        booked: {
          ts: booked.ts
        }
      });
      continue;
    }
    
    // Original logic for pre-June 2025: all steps must be present
    let wd1 = wd1Msgs.find(m => getMonthYear(m.ts) === month && m.ts > backfillStart.ts);
    let wd2 = wd2Msgs.find(m => getMonthYear(m.ts) === month && m.ts > (wd1?.ts || backfillStart.ts));
    let wd3 = wd3Msgs.find(m => getMonthYear(m.ts) === month && m.ts > (wd2?.ts || wd1?.ts || backfillStart.ts));
    
    if (!wd1 || !wd2 || !wd3) continue;
    
    results.push({
      month,
      backfill: {
        start: backfillStart.ts,
        end: wd1.ts
      },
      wd1: {
        start: wd1.ts,
        end: wd2.ts
      },
      wd2: {
        start: wd2.ts,
        end: wd3.ts
      },
      wd3: {
        start: wd3.ts,
        end: booked.ts
      },
      booked: {
        ts: booked.ts
      }
    });
  }
  // Hardcode October 2024 if missing
  if (!results.find(r => r.month === 'October 2024')) {
    // User provided times (CET):
    // Backfill: start Sep 30 15:29, end Oct 1 17:23
    // WD1: start Oct 1 17:23, end Oct 2 23:36
    // WD2: start Oct 2 23:36, end Oct 3 17:42
    // WD3: start Oct 3 17:42, end Oct 4 13:36
    // Convert CET to UTC (CET = UTC+2 for these dates)
    const backfillStart = new Date(Date.UTC(2024, 8, 30, 13, 29)); // Sep 30 13:29 UTC
    const backfillEnd = new Date(Date.UTC(2024, 9, 1, 15, 23));   // Oct 1 15:23 UTC
    const wd1Start = backfillEnd;
    const wd1End = new Date(Date.UTC(2024, 9, 2, 21, 36));         // Oct 2 21:36 UTC
    const wd2Start = wd1End;
    const wd2End = new Date(Date.UTC(2024, 9, 3, 15, 42));         // Oct 3 15:42 UTC
    const wd3Start = wd2End;
    const wd3End = new Date(Date.UTC(2024, 9, 4, 11, 36));         // Oct 4 11:36 UTC
    results.push({
      month: 'October 2024',
      backfill: {
        start: backfillStart.toISOString(),
        end: backfillEnd.toISOString(),
      },
      wd1: {
        start: wd1Start.toISOString(),
        end: wd1End.toISOString(),
      },
      wd2: {
        start: wd2Start.toISOString(),
        end: wd2End.toISOString(),
      },
      wd3: {
        start: wd3Start.toISOString(),
        end: wd3End.toISOString(),
      },
      booked: {
        ts: wd3End.toISOString(),
      }
    });
  }
  return results;
}

// Helper function to determine if a month is June 2025 or later
function isJune2025OrLater(monthYear) {
  const [month, year] = monthYear.split(' ');
  const monthIndex = ['January','February','March','April','May','June','July','August','September','October','November','December'].indexOf(month);
  const yearNum = parseInt(year, 10);
  return yearNum > 2025 || (yearNum === 2025 && monthIndex >= 5); // June is index 5
}

// Helper function to get the appropriate channel for audiobooks based on date
function getAudiobooksChannel(targetDate = null) {
  // If no target date provided, check if we're currently in June 2025 or later
  if (!targetDate) {
    const now = new Date();
    const currentMonth = now.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    return isJune2025OrLater(currentMonth) ? 'CB0CY1YBH' : 'C05U48VE6ER';
  }
  
  // If target date provided, use it to determine channel
  const targetMonth = targetDate.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return isJune2025OrLater(targetMonth) ? 'CB0CY1YBH' : 'C05U48VE6ER';
}

// Audiobooks MEC high-level duration extraction
function extractAudiobooksHighLevelTimeline(messages) {
  const fs = require('fs');
  const debugLines = [];
  debugLines.push('extractAudiobooksHighLevelTimeline CALLED, messages: ' + messages.length);
  // Reverse to process oldest to newest
  const msgs = [...messages].reverse();
  // Helper to get month/year string (force UTC)
  const getMonthYear = (date) => {
    return date.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  };
  // Generate all months from Jan 2024 to Dec 2025
  // From June 2025 onwards, will use music channel with "Audiobooks" keyword filtering
  const targetMonths = [];
  let d = new Date('2024-01-01T00:00:00Z');
  for (let i = 0; i < 24; i++) { // Full range: Jan 2024 - Dec 2025
    targetMonths.push(getMonthYear(d));
    d.setMonth(d.getMonth() + 1);
  }
  // Find all ABP MEC UPDATE messages first, then fall back to MEC Update messages
  // ABP MEC UPDATE messages are NOT filtered by keywords (even from June 2025 onwards)
  const abpMecUpdates = msgs.filter(msg => {
    if (!msg.text || !/ABP MEC UPDATE/i.test(msg.text)) return false;
    return true; // Always use all ABP MEC UPDATE messages, no keyword filtering
  }).map(msg => ({
    ts: new Date(Number(msg.ts) * 1000),
    text: msg.text
  }));
  
  // Find all MEC Update messages as fallback
  // MEC Update messages are NOT filtered by keywords (even from June 2025 onwards)
  const mecUpdates = msgs.filter(msg => {
    if (!msg.text || !/MEC Update:/i.test(msg.text)) return false;
    return true; // Always use all MEC Update messages, no keyword filtering
  }).map(msg => ({
    ts: new Date(Number(msg.ts) * 1000),
    text: msg.text
  }));
  
  // Find all 'booked' messages and sort by timestamp ascending
  // From June 2025 onwards, filter by "Audiobooks" keyword with section-based validation
  const bookedMsgs = msgs
    .filter(msg => {
      if (!msg.text || !/booked/i.test(msg.text)) return false;
      const msgDate = new Date(Number(msg.ts) * 1000);
      const msgMonth = getMonthYear(msgDate);
      // For June 2025 onwards, must contain "Audiobooks" in proper context
      if (isJune2025OrLater(msgMonth)) {
        const audiobooksIndex = msg.text.toLowerCase().indexOf('audiobooks');
        const abpIndex = msg.text.toLowerCase().indexOf('abp');
        const bookedIndex = msg.text.toLowerCase().indexOf('booked');
        const hasAudiobooks = audiobooksIndex !== -1 || abpIndex !== -1;
        const hasBooked = bookedIndex !== -1;
        
        if (!hasAudiobooks) return false;
        
        // Check for multi-section messages (ABP, Lyrics, Music)
        const hasMultipleSections = /(:microphone:|:musical_note:).*:books-jam:/i.test(msg.text);
        
        let isValidAudiobooksBooked = false;
        if (hasMultipleSections) {
          // Extract just the ABP section and check if it contains current month being booked
          const abpSectionMatch = msg.text.match(/:books-jam:\s*\*ABP\*(.*?)(?=:[\w-]+:|$)/is);
          if (abpSectionMatch) {
            const abpSection = abpSectionMatch[1];
            // Check if the ABP section contains "booked" and is about current month
            // For June 2025, allow any ABP booked message (since it's the first month)
            // For July 2025+, be more strict about month matching
            const hasBooked = /booked/i.test(abpSection);
            if (msgMonth === 'June 2025') {
              // June 2025: allow any ABP booked message (first month of new system)
              isValidAudiobooksBooked = hasBooked;
            } else {
              // July 2025+: must mention current month
              const currentMonthYear = msgMonth.replace(' ', ' '); // e.g., "July 2025"
              const hasCurrentMonthBooked = new RegExp(`${currentMonthYear}.*ABP.*booked|ABP.*${currentMonthYear}.*booked|${currentMonthYear}.*audiobooks.*booked|audiobooks.*${currentMonthYear}.*booked`, 'i').test(abpSection);
              isValidAudiobooksBooked = hasCurrentMonthBooked;
            }
          }
        } else {
          // Single section message or simple proximity check - also check for current month
          if (msgMonth === 'June 2025') {
            // June 2025: allow any ABP booked message (first month of new system)
            isValidAudiobooksBooked = hasAudiobooks && hasBooked;
          } else {
            // July 2025+: must mention current month
            const currentMonthYear = msgMonth.replace(' ', ' ');
            const hasCurrentMonthBooked = new RegExp(`${currentMonthYear}.*ABP.*booked|ABP.*${currentMonthYear}.*booked|${currentMonthYear}.*audiobooks.*booked|audiobooks.*${currentMonthYear}.*booked`, 'i').test(msg.text);
            isValidAudiobooksBooked = hasCurrentMonthBooked;
          }
        }
        
        return isValidAudiobooksBooked;
      }
      return true; // Before June 2025, use all booked messages
    })
    .map(msg => ({
      ts: new Date(Number(msg.ts) * 1000),
      text: msg.text
    }))
    .sort((a, b) => a.ts - b.ts);
  debugLines.push('Total bookedMsgs: ' + bookedMsgs.length);
  bookedMsgs.forEach(m => debugLines.push('Booked: ' + m.ts.toISOString() + ' | UTC Year: ' + m.ts.getUTCFullYear() + ' UTC Month: ' + (m.ts.getUTCMonth()+1) + ' | ' + getMonthYear(m.ts) + ' | ' + m.text));
  debugLines.push('Total abpMecUpdates: ' + abpMecUpdates.length);
  abpMecUpdates.forEach(m => debugLines.push('ABP MEC Update: ' + m.ts.toISOString() + ' ' + getMonthYear(m.ts) + ' | ' + m.text));
  debugLines.push('Total mecUpdates: ' + mecUpdates.length);
  mecUpdates.forEach(m => debugLines.push('MEC Update: ' + m.ts.toISOString() + ' ' + getMonthYear(m.ts) + ' | ' + m.text));
  const results = [];
  for (let i = 0; i < targetMonths.length; i++) {
    const month = targetMonths[i];
    // Parse month and year for UTC comparison
    const [targetMonthName, targetYear] = month.split(' ');
    const targetMonthIndex = new Date(Date.parse(targetMonthName + ' 1, 2000')).getMonth();
    const targetYearNum = parseInt(targetYear, 10);
    // Filter all booked messages for this month (UTC)
    const bookedCandidates = bookedMsgs.filter(m => {
      const ts = m.ts;
      debugLines.push(`Checking booked candidate: ${ts.toISOString()} | UTC Year: ${ts.getUTCFullYear()} UTC Month: ${ts.getUTCMonth()+1} (target: ${targetYearNum}-${targetMonthIndex+1})`);
      if (ts.getUTCFullYear() !== targetYearNum || ts.getUTCMonth() !== targetMonthIndex) {
        debugLines.push(`SKIP: ${ts.toISOString()} is not in target month/year.`);
        return false;
      }
      return true;
    });
    const booked = bookedCandidates.length > 0 ? bookedCandidates[0] : undefined;
    if (!booked) continue;
    // Find MEC Update message - first try ABP MEC UPDATE, then fall back to MEC Update
    // For June 2025 onwards: look for MEC Update in the current month
    // Before June 2025: look for MEC Update from the previous month (original logic)
    let mecUpdate;
    if (isJune2025OrLater(month)) {
      // June 2025 onwards: find the first ABP MEC UPDATE in the current month before the booked message
      mecUpdate = abpMecUpdates.find(m => getMonthYear(m.ts) === month && m.ts < booked.ts);
      if (!mecUpdate) {
        // Fall back to regular MEC Update if no ABP MEC UPDATE found
        mecUpdate = mecUpdates.find(m => getMonthYear(m.ts) === month && m.ts < booked.ts);
      }
    } else {
      // Before June 2025: find the last ABP MEC UPDATE from the previous month (original logic)
      const prevMonthDate = new Date(Date.UTC(targetYearNum, targetMonthIndex, 1));
      prevMonthDate.setUTCMonth(prevMonthDate.getUTCMonth() - 1);
      const prevMonth = getMonthYear(prevMonthDate);
      mecUpdate = [...abpMecUpdates].reverse().find(m => getMonthYear(m.ts) === prevMonth && m.ts < booked.ts);
      if (!mecUpdate) {
        // Fall back to regular MEC Update if no ABP MEC UPDATE found
        mecUpdate = [...mecUpdates].reverse().find(m => getMonthYear(m.ts) === prevMonth && m.ts < booked.ts);
      }
    }
    if (!mecUpdate) continue;
    // Use total minutes (including weekends)
    const durationMinutes = Math.round((booked.ts - mecUpdate.ts) / 60000);
    results.push({
      month,
      start: mecUpdate.ts,
      end: booked.ts,
      durationMinutes
    });
  }
  fs.writeFileSync('debug_booked.txt', debugLines.join('\n'));
  return results;
}

// Extract Audiobooks MEC steps timeline (Backfill, WD1, WD2 only)
function extractAudiobooksStepsTimeline(messages) {
  // Use the EXACT same logic as extractAudiobooksHighLevelTimeline to get MEC start/end times
  // Then build subtasks within those exact time boundaries
  
  // Reverse to process oldest to newest
  const msgs = [...messages].reverse();
  // Helper to get month/year string (force UTC)
  const getMonthYear = (date) => {
    return date.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  };
  
  // Generate all months from Jan 2024 to Dec 2025
  const targetMonths = [];
  let d = new Date('2024-01-01T00:00:00Z');
  for (let i = 0; i < 24; i++) { // Full range: Jan 2024 - Dec 2025
    targetMonths.push(getMonthYear(d));
    d.setMonth(d.getMonth() + 1);
  }
  
  // Find all ABP MEC UPDATE messages first, then fall back to MEC Update messages
  // ABP MEC UPDATE messages are NOT filtered by keywords (even from June 2025 onwards)
  const abpMecUpdates = msgs.filter(msg => {
    if (!msg.text || !/ABP MEC UPDATE/i.test(msg.text)) return false;
    return true; // Always use all ABP MEC UPDATE messages, no keyword filtering
  }).map(msg => ({
    ts: new Date(Number(msg.ts) * 1000),
    text: msg.text
  }));
  
  // Find all MEC Update messages as fallback (no keyword filtering)
  const mecUpdates = msgs.filter(msg => {
    if (!msg.text || !/MEC Update:/i.test(msg.text)) return false;
    return true; // Always use all MEC Update messages, no keyword filtering
  }).map(msg => ({
    ts: new Date(Number(msg.ts) * 1000),
    text: msg.text
  }));
  
  // Find all 'booked' messages and sort by timestamp ascending
  // From June 2025 onwards, filter by "Audiobooks" keyword with section-based validation
  const bookedMsgs = msgs
    .filter(msg => {
      if (!msg.text || !/booked/i.test(msg.text)) return false;
      const msgDate = new Date(Number(msg.ts) * 1000);
      const msgMonth = getMonthYear(msgDate);
      // For June 2025 onwards, must contain "Audiobooks" in proper context
      if (isJune2025OrLater(msgMonth)) {
        const audiobooksIndex = msg.text.toLowerCase().indexOf('audiobooks');
        const abpIndex = msg.text.toLowerCase().indexOf('abp');
        const bookedIndex = msg.text.toLowerCase().indexOf('booked');
        const hasAudiobooks = audiobooksIndex !== -1 || abpIndex !== -1;
        const hasBooked = bookedIndex !== -1;
        
        if (!hasAudiobooks) return false;
        
        // Check for multi-section messages (ABP, Lyrics, Music)
        const hasMultipleSections = /(:microphone:|:musical_note:).*:books-jam:/i.test(msg.text);
        
        let isValidAudiobooksBooked = false;
        if (hasMultipleSections) {
          // Extract just the ABP section and check if it contains current month being booked
          const abpSectionMatch = msg.text.match(/:books-jam:\s*\*ABP\*(.*?)(?=:[\w-]+:|$)/is);
          if (abpSectionMatch) {
            const abpSection = abpSectionMatch[1];
            // Check if the ABP section contains "booked" and is about current month
            // For June 2025, allow any ABP booked message (since it's the first month)
            // For July 2025+, be more strict about month matching
            const hasBooked = /booked/i.test(abpSection);
            if (msgMonth === 'June 2025') {
              // June 2025: allow any ABP booked message (first month of new system)
              isValidAudiobooksBooked = hasBooked;
            } else {
              // July 2025+: must mention current month
              const currentMonthYear = msgMonth.replace(' ', ' '); // e.g., "July 2025"
              const hasCurrentMonthBooked = new RegExp(`${currentMonthYear}.*ABP.*booked|ABP.*${currentMonthYear}.*booked|${currentMonthYear}.*audiobooks.*booked|audiobooks.*${currentMonthYear}.*booked`, 'i').test(abpSection);
              isValidAudiobooksBooked = hasCurrentMonthBooked;
            }
          }
        } else {
          // Single section message or simple proximity check - also check for current month
          if (msgMonth === 'June 2025') {
            // June 2025: allow any ABP booked message (first month of new system)
            isValidAudiobooksBooked = hasAudiobooks && hasBooked;
          } else {
            // July 2025+: must mention current month
            const currentMonthYear = msgMonth.replace(' ', ' ');
            const hasCurrentMonthBooked = new RegExp(`${currentMonthYear}.*ABP.*booked|ABP.*${currentMonthYear}.*booked|${currentMonthYear}.*audiobooks.*booked|audiobooks.*${currentMonthYear}.*booked`, 'i').test(msg.text);
            isValidAudiobooksBooked = hasCurrentMonthBooked;
          }
        }
        
        return isValidAudiobooksBooked;
      }
      return true; // Before June 2025, use all booked messages
    })
    .map(msg => ({
      ts: new Date(Number(msg.ts) * 1000),
      text: msg.text
    }))
    .sort((a, b) => a.ts - b.ts);
  
  // Find WD1 and WD2 messages with keyword filtering for June 2025+
  const wd1Msgs = msgs
    .filter(msg => {
      if (!msg.text || !/WD1/i.test(msg.text)) return false;
      const msgDate = new Date(Number(msg.ts) * 1000);
      const msgMonth = getMonthYear(msgDate);
      // For June 2025 onwards, must contain "Audiobooks", "ABP", or "ABP:"
      if (isJune2025OrLater(msgMonth)) {
        return /audiobooks\s*:?|ABP\s*:?/i.test(msg.text);
      }
      return true; // Before June 2025, use all WD1 messages
    })
    .map(msg => ({
      ts: new Date(Number(msg.ts) * 1000),
      text: msg.text
    }));
    
  const wd2Msgs = msgs
    .filter(msg => {
      if (!msg.text || !/WD2/i.test(msg.text)) return false;
      const msgDate = new Date(Number(msg.ts) * 1000);
      const msgMonth = getMonthYear(msgDate);
      // For June 2025 onwards, must contain "Audiobooks", "ABP", or "ABP:"
      if (isJune2025OrLater(msgMonth)) {
        return /audiobooks\s*:?|ABP\s*:?/i.test(msg.text);
      }
      return true; // Before June 2025, use all WD2 messages
    })
    .map(msg => ({
      ts: new Date(Number(msg.ts) * 1000),
      text: msg.text
    }));

  const results = [];
  for (let i = 0; i < targetMonths.length; i++) {
    const month = targetMonths[i];
    // Parse month and year for UTC comparison
    const [targetMonthName, targetYear] = month.split(' ');
    const targetMonthIndex = new Date(Date.parse(targetMonthName + ' 1, 2000')).getMonth();
    const targetYearNum = parseInt(targetYear, 10);
    
    // Filter all booked messages for this month (UTC) - EXACT same logic as high-level
    const bookedCandidates = bookedMsgs.filter(m => {
      const ts = m.ts;
      if (ts.getUTCFullYear() !== targetYearNum || ts.getUTCMonth() !== targetMonthIndex) {
        return false;
      }
      return true;
    });
    const booked = bookedCandidates.length > 0 ? bookedCandidates[0] : undefined;
    if (!booked) continue;
    
    // Find MEC Update message - EXACT same logic as high-level (ABP MEC UPDATE first, then fallback)
    let mecUpdate;
    if (isJune2025OrLater(month)) {
      // June 2025 onwards: find the first ABP MEC UPDATE in the current month before the booked message
      mecUpdate = abpMecUpdates.find(m => getMonthYear(m.ts) === month && m.ts < booked.ts);
      if (!mecUpdate) {
        // Fall back to regular MEC Update if no ABP MEC UPDATE found
        mecUpdate = mecUpdates.find(m => getMonthYear(m.ts) === month && m.ts < booked.ts);
      }
    } else {
      // Before June 2025: find the last ABP MEC UPDATE from the previous month (original logic)
      const prevMonthDate = new Date(Date.UTC(targetYearNum, targetMonthIndex, 1));
      prevMonthDate.setUTCMonth(prevMonthDate.getUTCMonth() - 1);
      const prevMonth = getMonthYear(prevMonthDate);
      mecUpdate = [...abpMecUpdates].reverse().find(m => getMonthYear(m.ts) === prevMonth && m.ts < booked.ts);
      if (!mecUpdate) {
        // Fall back to regular MEC Update if no ABP MEC UPDATE found
        mecUpdate = [...mecUpdates].reverse().find(m => getMonthYear(m.ts) === prevMonth && m.ts < booked.ts);
      }
    }
    if (!mecUpdate) continue;
    
    // Use EXACT same start and end times as high-level function
    const totalStart = mecUpdate.ts;
    const totalEnd = booked.ts;
    // Find WD1 and WD2 messages for this specific month
    const monthWD1 = wd1Msgs.find(m => {
      const ts = m.ts;
      return ts.getUTCFullYear() === targetYearNum && 
             ts.getUTCMonth() === targetMonthIndex && 
             ts >= totalStart && ts <= totalEnd;
    });
    
    const monthWD2 = wd2Msgs.find(m => {
      const ts = m.ts;
      return ts.getUTCFullYear() === targetYearNum && 
             ts.getUTCMonth() === targetMonthIndex && 
             ts >= totalStart && ts <= totalEnd;
    });
    
    // Build subtasks in chronological order
    const subtasks = [];
    
    // Backfill: from MEC Update to first WD message (or booked if no WD messages)
    let backfillEnd = totalEnd;
    if (monthWD1 && monthWD1.ts > totalStart) {
      backfillEnd = monthWD1.ts;
    } else if (monthWD2 && monthWD2.ts > totalStart) {
      backfillEnd = monthWD2.ts;
    }
    
    subtasks.push({
      type: 'backfill',
      start: totalStart.toISOString(),
      end: backfillEnd.toISOString()
    });
    
    // WD1 (if exists)
    if (monthWD1) {
      let wd1End = totalEnd;
      if (monthWD2 && monthWD2.ts > monthWD1.ts) {
        wd1End = monthWD2.ts;
      }
      
      subtasks.push({
        type: 'WD1',
        start: monthWD1.ts.toISOString(),
        end: wd1End.toISOString()
      });
    }
    
    // WD2 (if exists)
    if (monthWD2) {
      subtasks.push({
        type: 'WD2',
        start: monthWD2.ts.toISOString(),
        end: totalEnd.toISOString()
      });
    }
    
    // Booked: always use the booked message we already found
    subtasks.push({
      type: 'booked',
      start: booked.ts.toISOString(),
      end: totalEnd.toISOString()
    });
    
    // Sort subtasks by start time and fill gaps with 'remaining'
    subtasks.sort((a, b) => new Date(a.start) - new Date(b.start));
    
    const finalSubtasks = [];
    let currentTime = totalStart;
    
    for (let j = 0; j < subtasks.length; j++) {
      const subtask = subtasks[j];
      const subtaskStart = new Date(subtask.start);
      
      // Fill gap before this subtask if needed
      if (currentTime < subtaskStart) {
        finalSubtasks.push({
          type: 'remaining',
          start: currentTime.toISOString(),
          end: subtask.start
        });
      }
      
      // Add the subtask
      finalSubtasks.push(subtask);
      currentTime = new Date(subtask.end);
    }
    
    // Fill final gap if needed
    if (currentTime < totalEnd) {
      finalSubtasks.push({
        type: 'remaining',
        start: currentTime.toISOString(),
        end: totalEnd.toISOString()
      });
    }
    
    results.push({
      month,
      total: {
        start: totalStart.toISOString(),
        end: totalEnd.toISOString()
      },
      subtasks: finalSubtasks
    });
  }
  
  return results;
}

// Music MEC high-level duration extraction (for June 2025 onwards)
function extractMusicHighLevelTimeline(messages) {
  const fs = require('fs');
  const debugLines = [];
  debugLines.push('extractMusicHighLevelTimeline CALLED, messages: ' + messages.length);
  // Reverse to process oldest to newest
  const msgs = [...messages].reverse();
  // Helper to get month/year string (force UTC)
  const getMonthYear = (date) => {
    return date.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  };
  // Generate months from June 2025 onwards only
  const targetMonths = [];
  let d = new Date('2025-06-01T00:00:00Z');
  for (let i = 0; i < 7; i++) { // June 2025 - Dec 2025
    targetMonths.push(getMonthYear(d));
    d.setMonth(d.getMonth() + 1);
  }
  
  // Find all MEC Update messages (no keyword filtering for MEC Update)
  const mecUpdates = msgs.filter(msg => {
    if (!msg.text || !/MEC Update:/i.test(msg.text)) return false;
    const msgDate = new Date(Number(msg.ts) * 1000);
    const msgMonth = getMonthYear(msgDate);
    // Only for June 2025 onwards (but no keyword filtering for MEC Update)
    return isJune2025OrLater(msgMonth);
  }).map(msg => ({
    ts: new Date(Number(msg.ts) * 1000),
    text: msg.text
  }));
  
  // Find all 'booked' messages that contain "Music"
  const bookedMsgs = msgs
    .filter(msg => {
      if (!msg.text || !/booked/i.test(msg.text)) return false;
      const msgDate = new Date(Number(msg.ts) * 1000);
      const msgMonth = getMonthYear(msgDate);
      // Only for June 2025 onwards, must contain "Music"
      if (isJune2025OrLater(msgMonth)) {
        return /music\s*:?/i.test(msg.text);
      }
      return false; // Before June 2025, don't include any music messages
    })
    .map(msg => ({
      ts: new Date(Number(msg.ts) * 1000),
      text: msg.text
    }))
    .sort((a, b) => a.ts - b.ts);
    
  const results = [];
  for (let i = 0; i < targetMonths.length; i++) {
    const month = targetMonths[i];
    // Parse month and year for UTC comparison
    const [targetMonthName, targetYear] = month.split(' ');
    const targetMonthIndex = new Date(Date.parse(targetMonthName + ' 1, 2000')).getMonth();
    const targetYearNum = parseInt(targetYear, 10);
    
    // Filter all booked messages for this month (UTC)
    const bookedCandidates = bookedMsgs.filter(m => {
      const ts = m.ts;
      return ts.getUTCFullYear() === targetYearNum && ts.getUTCMonth() === targetMonthIndex;
    });
    const booked = bookedCandidates.length > 0 ? bookedCandidates[0] : undefined;
    if (!booked) continue;
    
    // Find the last MEC Update from the previous month
    const prevMonthDate = new Date(Date.UTC(targetYearNum, targetMonthIndex, 1));
    prevMonthDate.setUTCMonth(prevMonthDate.getUTCMonth() - 1);
    const prevMonth = getMonthYear(prevMonthDate);
    const mecUpdate = [...mecUpdates].reverse().find(m => getMonthYear(m.ts) === prevMonth && m.ts < booked.ts);
    if (!mecUpdate) continue;
    
    // Use total minutes (including weekends)
    const durationMinutes = Math.round((booked.ts - mecUpdate.ts) / 60000);
    results.push({
      month,
      start: mecUpdate.ts,
      end: booked.ts,
      durationMinutes
    });
  }
  
  return results;
}

// Music MEC steps timeline extraction (for June 2025 onwards)
function extractMusicStepsTimeline(messages) {
  // Sort messages oldest to newest
  const msgs = [...messages].sort((a, b) => Number(a.ts) - Number(b.ts));
  // Helper to get month/year string (force UTC)
  const getMonthYear = (date) => date.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  
  // Filter messages by type and keyword for June 2025 onwards only
  // MEC UPDATE messages: no keyword filtering
  // WD1, WD2, WD3, booked messages: filter by "Music" keyword
  const filteredMsgs = msgs.filter(msg => {
    if (!msg.text) return false;
    const ts = new Date(Number(msg.ts) * 1000);
    const month = getMonthYear(ts);
    // Only for June 2025 onwards
    if (!isJune2025OrLater(month)) return false;
    
    // MEC UPDATE messages: always include (no keyword filtering)
    if (/MEC\s*UPDATE/i.test(msg.text) || /MEC\s*is\s*coming/i.test(msg.text)) {
      return true;
    }
    
    // WD1, WD2, WD3, booked messages: must contain "Music" or "Music:"
    if (/WD1/i.test(msg.text) || /WD2/i.test(msg.text) || /WD3/i.test(msg.text) || /is booked/i.test(msg.text)) {
      return /music\s*:?/i.test(msg.text);
    }
    
    return false; // Other messages not needed
  });
  
  // Group filtered messages by month
  const byMonth = {};
  filteredMsgs.forEach(msg => {
    const ts = new Date(Number(msg.ts) * 1000);
    const month = getMonthYear(ts);
    if (!byMonth[month]) byMonth[month] = [];
    byMonth[month].push({ ...msg, ts });
  });
  
  // Generate months from June 2025 onwards only
  const months = [];
  let d = new Date(Date.UTC(2025, 5, 1)); // June 2025
  for (let i = 0; i < 7; i++) { // June 2025 - Dec 2025
    months.push(getMonthYear(d));
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  
  const results = [];
  for (let i = 0; i < months.length; i++) {
    const month = months[i];
    const prevMonth = months[i - 1] || null;
    const prevMsgs = prevMonth ? (byMonth[prevMonth] || []) : [];
    const currMsgs = byMonth[month] || [];
    
    // High-level total duration: start and end of the month
    const year = 2025;
    const monthIdx = 5 + i; // Starting from June (index 5)
    const totalStart = new Date(Date.UTC(year, monthIdx, 1));
    const totalEnd = new Date(Date.UTC(year, monthIdx + 1, 0, 23, 59, 59, 999));
    
    // Subtasks: only include if available
    const subtasks = [];
    
    // Backfill: last MEC Update or MEC is coming in prev month
    let backfillStartMsg = [...prevMsgs].reverse().find(m => /MEC\s*UPDATE/i.test(m.text));
    if (!backfillStartMsg) backfillStartMsg = [...prevMsgs].reverse().find(m => /MEC\s*is\s*coming/i.test(m.text));
    if (backfillStartMsg) {
      let backfillEndMsg = currMsgs.find(m => /WD1/i.test(m.text) || /WD2/i.test(m.text) || /WD3/i.test(m.text) || /is booked/i.test(m.text));
      let backfillEnd = backfillEndMsg ? backfillEndMsg.ts : totalEnd;
      subtasks.push({
        type: 'backfill',
        start: backfillStartMsg.ts.toISOString(),
        end: backfillEnd.toISOString()
      });
    }
    
    // WD1
    let wd1Msg = currMsgs.find(m => /WD1/i.test(m.text));
    if (wd1Msg) {
      let wd1EndMsg = currMsgs.find(m => /WD2/i.test(m.text) && m.ts > wd1Msg.ts);
      if (!wd1EndMsg) wd1EndMsg = currMsgs.find(m => /WD3/i.test(m.text) && m.ts > wd1Msg.ts);
      if (!wd1EndMsg) wd1EndMsg = currMsgs.find(m => /is booked/i.test(m.text) && m.ts > wd1Msg.ts);
      let wd1End = wd1EndMsg ? wd1EndMsg.ts : totalEnd;
      subtasks.push({
        type: 'WD1',
        start: wd1Msg.ts.toISOString(),
        end: wd1End.toISOString()
      });
    }
    
    // WD2
    let wd2Msg = currMsgs.find(m => /WD2/i.test(m.text));
    if (wd2Msg) {
      let wd2EndMsg = currMsgs.find(m => /WD3/i.test(m.text) && m.ts > wd2Msg.ts);
      if (!wd2EndMsg) wd2EndMsg = currMsgs.find(m => /is booked/i.test(m.text) && m.ts > wd2Msg.ts);
      let wd2End = wd2EndMsg ? wd2EndMsg.ts : totalEnd;
      subtasks.push({
        type: 'WD2',
        start: wd2Msg.ts.toISOString(),
        end: wd2End.toISOString()
      });
    }
    
    // WD3
    let wd3Msg = currMsgs.find(m => /WD3/i.test(m.text));
    if (wd3Msg) {
      let wd3EndMsg = currMsgs.find(m => /is booked/i.test(m.text) && m.ts > wd3Msg.ts);
      let wd3End = wd3EndMsg ? wd3EndMsg.ts : totalEnd;
      subtasks.push({
        type: 'WD3',
        start: wd3Msg.ts.toISOString(),
        end: wd3End.toISOString()
      });
    }
    
    // Booked
    let bookedMsg = currMsgs.find(m => /is booked/i.test(m.text));
    if (bookedMsg) {
      subtasks.push({
        type: 'booked',
        start: bookedMsg.ts.toISOString(),
        end: totalEnd.toISOString()
      });
    }
    
    // Add 'Remaining Tasks' if there is a gap after the last subtask
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
  
  return results;
}

// S4C Podcast MEC high-level duration extraction
async function extractS4CPodcastHighLevelTimeline() {
  const result = await slackClient.conversations.history({ channel: 'C05N1FVJ6TD', limit: 1000 });
  const messages = result.messages;
  console.log(`[S4C] Pulled ${messages.length} messages from Slack`);
  const getMonthYear = (date) => date.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  // Generate all months from Jan 2024 to Dec 2025 (extended for podcast MEC)
  // Podcast MEC channel C05N1FVJ6TD didn't change, so we can continue with same logic
  const targetMonths = [];
  let d = new Date('2024-01-01T00:00:00Z');
  for (let i = 0; i < 24; i++) { // Extended to 24 months (Jan 2024 - Dec 2025)
    targetMonths.push(getMonthYear(d));
    d.setMonth(d.getMonth() + 1);
  }
  const results = [];
  for (let i = 0; i < targetMonths.length; i++) {
    const month = targetMonths[i];
    const starters = messages.filter(msg => {
      if (!msg.text) return false;
      const text = msg.text.toLowerCase();
      return text.includes('starting') && text.includes('mec');
    });
    const starter = starters.find(msg => getMonthYear(new Date(Number(msg.ts) * 1000)) === month);
    if (!starter) {
      console.log(`[S4C] No starter found for month: ${month}`);
      continue;
    }
    const thread_ts = starter.ts;
    // Fetch all replies in the thread
    let threadMsgs = [];
    try {
      const repliesResult = await slackClient.conversations.replies({ channel: 'C05N1FVJ6TD', ts: thread_ts });
      threadMsgs = repliesResult.messages || [];
    } catch (e) {
      console.log(`[S4C] Error fetching replies for thread_ts ${thread_ts}:`, e.message);
      threadMsgs = [starter]; // fallback to just the starter
    }
    // Only consider messages in the same month
    const threadMsgsInMonth = threadMsgs.filter(msg => getMonthYear(new Date(Number(msg.ts) * 1000)) === month);
    if (threadMsgsInMonth.length === 0) {
      console.log(`[S4C] No thread messages found for month: ${month} (thread_ts: ${thread_ts})`);
      continue;
    }
    // Start: first message, End: last message in thread in this month
    const start = new Date(Number(starter.ts) * 1000);
    const end = new Date(Math.max(...threadMsgsInMonth.map(msg => Number(msg.ts) * 1000)));
    const durationMinutes = Math.round((end - start) / 60000);
    results.push({
      month,
      start: start.toISOString(),
      end: end.toISOString(),
      durationMinutes
    });
  }
  // Remove duplicate months, keep only the entry with the latest end date
  const uniqueResults = Object.values(results.reduce((acc, curr) => {
    if (!acc[curr.month] || new Date(curr.end) > new Date(acc[curr.month].end)) {
      acc[curr.month] = curr;
    }
    return acc;
  }, {}));

  // For August 2024, use a hardcoded end date
  const augustIdx = uniqueResults.findIndex(r => r.month === 'August 2024');
  if (augustIdx !== -1) {
    const start = uniqueResults[augustIdx].start;
    const end = '2024-08-06T15:40:00.000Z'; // August 6, 5:40pm UTC+2
    uniqueResults[augustIdx].end = end;
    uniqueResults[augustIdx].durationMinutes = Math.round((new Date(end) - new Date(start)) / 60000);
  }

  // For January 2025, use hardcoded start and end dates
  const jan2025Idx = uniqueResults.findIndex(r => r.month === 'January 2025');
  if (jan2025Idx !== -1) {
    const start = '2025-01-06T18:34:00.000Z'; // January 6, 7:34pm UTC+1
    const end = '2025-01-07T18:24:00.000Z';   // January 7, 7:24pm UTC+1
    uniqueResults[jan2025Idx].start = start;
    uniqueResults[jan2025Idx].end = end;
    uniqueResults[jan2025Idx].durationMinutes = Math.round((new Date(end) - new Date(start)) / 60000);
  }

  // For April 2025, use hardcoded start and end dates
  const apr2025Idx = uniqueResults.findIndex(r => r.month === 'April 2025');
  if (apr2025Idx !== -1) {
    const start = '2025-04-03T18:27:00.000Z'; // April 3, 7:27pm UTC+1
    const end = '2025-04-04T13:21:00.000Z';   // April 4, 3:21pm UTC+2
    uniqueResults[apr2025Idx].start = start;
    uniqueResults[apr2025Idx].end = end;
    uniqueResults[apr2025Idx].durationMinutes = Math.round((new Date(end) - new Date(start)) / 60000);
  }

  // For October 2024, use hardcoded start and end dates
  const oct2024Idx = uniqueResults.findIndex(r => r.month === 'October 2024');
  const start = '2024-10-03T16:39:00.000Z';
  const end = '2024-10-09T14:30:00.000Z';
  if (oct2024Idx !== -1) {
    uniqueResults[oct2024Idx].start = start;
    uniqueResults[oct2024Idx].end = end;
    uniqueResults[oct2024Idx].durationMinutes = Math.round((new Date(end) - new Date(start)) / 60000);
  } else {
    uniqueResults.push({
      month: 'October 2024',
      start,
      end,
      durationMinutes: Math.round((new Date(end) - new Date(start)) / 60000)
    });
  }

  return uniqueResults;
}

// Music MEC high-level timeline extraction (for June 2025 onwards)  
function extractMusicHighLevelTimeline(messages) {
  const fs = require('fs');
  const debugLines = [];
  debugLines.push('extractMusicHighLevelTimeline CALLED, messages: ' + messages.length);
  // Reverse to process oldest to newest
  const msgs = [...messages].reverse();
  // Helper to get month/year string (force UTC)
  const getMonthYear = (date) => {
    return date.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  };
  // Generate months from June 2025 onwards only
  const targetMonths = [];
  let d = new Date('2025-06-01T00:00:00Z');
  for (let i = 0; i < 7; i++) { // June 2025 - Dec 2025
    targetMonths.push(getMonthYear(d));
    d.setMonth(d.getMonth() + 1);
  }
  
  // Find all MEC Update messages (no keyword filtering for MEC Update)
  const mecUpdates = msgs.filter(msg => {
    if (!msg.text || !/MEC Update:/i.test(msg.text)) return false;
    const msgDate = new Date(Number(msg.ts) * 1000);
    const msgMonth = getMonthYear(msgDate);
    // Only for June 2025 onwards (but no keyword filtering for MEC Update)
    return isJune2025OrLater(msgMonth);
  }).map(msg => ({
    ts: new Date(Number(msg.ts) * 1000),
    text: msg.text
  }));
  
  // Find all messages that contain "booked" and "music" and extract target month from text
  const bookedMsgs = msgs
    .filter(msg => {
      if (!msg.text || !/booked/i.test(msg.text) || !/music\s*:?/i.test(msg.text)) return false;
      const msgDate = new Date(Number(msg.ts) * 1000);
      const msgMonth = getMonthYear(msgDate);
      // Only process messages from June 2025 onwards (when new channel started)
      return isJune2025OrLater(msgMonth);
    })
    .map(msg => {
      const msgDate = new Date(Number(msg.ts) * 1000);
      const msgMonth = getMonthYear(msgDate);
      
      // Extract target month from message text (e.g., "May 2025 Music MEC booked")
      const monthPattern = /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})[^]*?booked/i;
      const match = msg.text.match(monthPattern);
      const targetMonth = match ? `${match[1]} ${match[2]}` : null;
      
      debugLines.push(`MSG in ${msgMonth}: "${msg.text.substring(0, 100)}..."`);
      debugLines.push(`Extracted target month: ${targetMonth}`);
      
      return {
        ts: msgDate,
        text: msg.text,
        targetMonth: targetMonth,
        msgMonth: msgMonth
      };
    })
    .filter(msg => msg.targetMonth && isJune2025OrLater(msg.targetMonth)) // Only target months from June 2025+
    .sort((a, b) => a.ts - b.ts);
    
  const results = [];
  // Process each booked message with extracted target month
  for (const booked of bookedMsgs) {
    const targetMonth = booked.targetMonth;
    if (!targetMonth) continue;
    
    // Parse target month to find the previous month for MEC Update
    const [targetMonthName, targetYear] = targetMonth.split(' ');
    const targetMonthIndex = new Date(Date.parse(targetMonthName + ' 1, 2000')).getMonth();
    const targetYearNum = parseInt(targetYear, 10);
    
    // Find the previous month for MEC Update
    const prevMonthDate = new Date(Date.UTC(targetYearNum, targetMonthIndex, 1));
    prevMonthDate.setUTCMonth(prevMonthDate.getUTCMonth() - 1);
    const prevMonth = getMonthYear(prevMonthDate);
    
    debugLines.push(`Processing: Target month ${targetMonth}, looking for MEC Update in ${prevMonth}`);
    debugLines.push(`Available MEC Updates: ${mecUpdates.length}`);
    debugLines.push(`MEC Updates months: ${mecUpdates.map(m => getMonthYear(m.ts)).join(', ')}`);
    
    // Find the last MEC Update from the previous month
    const mecUpdate = [...mecUpdates].reverse().find(m => getMonthYear(m.ts) === prevMonth && m.ts < booked.ts);
    if (!mecUpdate) {
      debugLines.push(`No MEC Update found in ${prevMonth} for ${targetMonth} music`);
      continue;
    }
    debugLines.push(`Found MEC Update in ${prevMonth}: "${mecUpdate.text.substring(0, 50)}..."`);
    
    // Use total minutes (including weekends)
    const durationMinutes = Math.round((booked.ts - mecUpdate.ts) / 60000);
    debugLines.push(`Duration: ${durationMinutes} minutes (${(durationMinutes/60).toFixed(1)}h)`);
    results.push({
      month: targetMonth,
      start: mecUpdate.ts,
      end: booked.ts,
      durationMinutes
    });
  }
  
  // Write debug info
  fs.writeFileSync('debug_music.txt', debugLines.join('\n'));
  
  return results;
}

// Lyrics MEC high-level timeline extraction (for June 2025 onwards)
function extractLyricsHighLevelTimeline(messages) {
  const fs = require('fs');
  const debugLines = [];
  debugLines.push('extractLyricsHighLevelTimeline CALLED, messages: ' + messages.length);
  
  // Helper to get month/year string (force UTC)
  const getMonthYear = (date) => {
    return date.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  };
  
  // Debug: show count of messages by month
  debugLines.push('Counting messages by month...');
  const monthCounts = {};
  let june2025Count = 0;
  messages.forEach(msg => {
    try {
      const msgDate = new Date(Number(msg.ts) * 1000);
      const msgMonth = getMonthYear(msgDate);
      monthCounts[msgMonth] = (monthCounts[msgMonth] || 0) + 1;
      if (msgMonth === 'June 2025') {
        june2025Count++;
      }
    } catch (e) {
      debugLines.push(`Error processing message: ${e.message}`);
    }
  });
  debugLines.push(`June 2025 messages: ${june2025Count}`);
  debugLines.push(`Total unique months: ${Object.keys(monthCounts).length}`);
  
  // Reverse to process oldest to newest
  const msgs = [...messages].reverse();
  // Generate months from June 2025 onwards only
  const targetMonths = [];
  let d = new Date('2025-06-01T00:00:00Z');
  for (let i = 0; i < 7; i++) { // June 2025 - Dec 2025
    targetMonths.push(getMonthYear(d));
    d.setMonth(d.getMonth() + 1);
  }
  
  // Find all MEC Update messages (no keyword filtering for MEC Update)
  const mecUpdates = msgs.filter(msg => {
    if (!msg.text || !/MEC Update:/i.test(msg.text)) return false;
    const msgDate = new Date(Number(msg.ts) * 1000);
    const msgMonth = getMonthYear(msgDate);
    debugLines.push(`Found MEC Update in ${msgMonth}: "${msg.text.substring(0, 100)}..."`);
    // Only for June 2025 onwards (but no keyword filtering for MEC Update)
    return isJune2025OrLater(msgMonth);
  }).map(msg => ({
    ts: new Date(Number(msg.ts) * 1000),
    text: msg.text
  }));
  
  debugLines.push(`Total MEC Updates found: ${mecUpdates.length}`);
  
  // Find all messages that contain both "lyrics" and "booked" where "booked" comes after "lyrics"
  const bookedMsgs = msgs
    .filter(msg => {
      if (!msg.text) return false;
      const msgDate = new Date(Number(msg.ts) * 1000);
      const msgMonth = getMonthYear(msgDate);
      // Only process messages from June 2025 onwards (when new channel started)
      if (!isJune2025OrLater(msgMonth)) return false;
      
      // Check if both "lyrics" and "booked" are present and "booked" comes after "lyrics"
          // Use regex to find "lyrics" with optional punctuation (like "Lyrics:")
    // Handle both "lyrics" and "Lyrics" (case variations) with optional colon
    const lyricsMatch = msg.text.match(/lyrics\s*:?/i);
    const lyricsIndex = lyricsMatch ? msg.text.toLowerCase().indexOf(lyricsMatch[0].toLowerCase()) : -1;
      const bookedIndex = msg.text.toLowerCase().indexOf('booked');
      
             // Debug: show ALL messages in June 2025
       if (msgMonth === "June 2025") {
         debugLines.push(`ALL JUNE 2025 MSG: "${msg.text.substring(0, 100)}..."`);
         if (msg.text.toLowerCase().includes('wd3')) {
           debugLines.push(`  -> Contains WD3!`);
         }
         if (msg.text.toLowerCase().includes('lyrics')) {
           debugLines.push(`  -> Contains lyrics!`);
         }
       }
       
       // Debug: show all messages that contain lyrics (case variations)
       const hasLyrics = /lyrics/i.test(msg.text);
       const hasBooked = /booked/i.test(msg.text);
       if (hasLyrics) {
         debugLines.push(`MSG with LYRICS in ${msgMonth}: "${msg.text.substring(0, 500)}..."`);
         debugLines.push(`Lyrics index: ${lyricsIndex}, Booked index: ${bookedIndex}, hasBooked: ${hasBooked}`);
       }
      
      const hasLyricsAndBooked = lyricsIndex !== -1 && bookedIndex !== -1 && bookedIndex > lyricsIndex;
      if (hasLyricsAndBooked) {
        debugLines.push(`FOUND lyrics->booked message in ${msgMonth}: "${msg.text.substring(0, 150)}..."`);
      }
      return hasLyricsAndBooked;
    })
    .map(msg => {
      const msgDate = new Date(Number(msg.ts) * 1000);
      const msgMonth = getMonthYear(msgDate);
      
      // Recalculate lyrics and booked indices for this specific message
      const lyricsMatch = msg.text.match(/lyrics\s*:?/i);
      const lyricsIndex = lyricsMatch ? msg.text.toLowerCase().indexOf(lyricsMatch[0].toLowerCase()) : -1;
      const bookedIndex = msg.text.toLowerCase().indexOf('booked');
      
      // Extract target month from message text (e.g., "May 2025 lyrics booked" or "re-runs back to may 2024 booked")
      // Look for month/year pattern anywhere in the message, then verify it's in the lyrics section
      const monthPattern = /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/gi;
      const matches = [...msg.text.matchAll(monthPattern)];
      
      // For lyrics, use the message timestamp month as the target month
      // (since the message indicates completion of lyrics work in that month)
      let targetMonth = null;
      if (lyricsIndex !== -1 && bookedIndex !== -1) {
        targetMonth = msgMonth; // Use the month when the message was sent
        debugLines.push(`FULL MSG in ${msgMonth}: "${msg.text}"`);
        debugLines.push(`Extracted target month: ${targetMonth}`);
      }
      
      return {
        ts: msgDate,
        text: msg.text,
        targetMonth: targetMonth,
        msgMonth: msgMonth
      };
    })
    .filter(msg => msg.targetMonth && isJune2025OrLater(msg.targetMonth)) // Only target months from June 2025+
    .sort((a, b) => a.ts - b.ts);
    
  const results = [];
  // Process each booked message with extracted target month
  for (const booked of bookedMsgs) {
    const targetMonth = booked.targetMonth;
    if (!targetMonth) continue;
    
    debugLines.push(`\nProcessing: Target month ${targetMonth}`);
    
    // Parse target month to find the previous month for MEC Update
    const [targetMonthName, targetYear] = targetMonth.split(' ');
    const targetMonthIndex = new Date(Date.parse(targetMonthName + ' 1, 2000')).getMonth();
    const targetYearNum = parseInt(targetYear, 10);
    
    // Find MEC Update: first check current month (1st-7th), then previous month
    let mecUpdate = null;
    
    // Check if there's a MEC Update in target month between 1st-7th
    const currentMonthMecUpdates = mecUpdates.filter(m => {
      const mecMonth = getMonthYear(m.ts);
      if (mecMonth !== targetMonth) return false;
      // Check if it's between 1st-7th of the month
      const dayOfMonth = m.ts.getUTCDate();
      return dayOfMonth >= 1 && dayOfMonth <= 7 && m.ts < booked.ts;
    });
    
    if (currentMonthMecUpdates.length > 0) {
      mecUpdate = currentMonthMecUpdates[0]; // Use first MEC Update in target month (1st-7th)
      debugLines.push(`Found MEC Update in target month ${targetMonth} (day ${mecUpdate.ts.getUTCDate()}): "${mecUpdate.text.substring(0, 50)}..."`);
    } else {
      // Fall back to last MEC Update from previous month
      const prevMonthDate = new Date(Date.UTC(targetYearNum, targetMonthIndex, 1));
      prevMonthDate.setUTCMonth(prevMonthDate.getUTCMonth() - 1);
      const prevMonth = getMonthYear(prevMonthDate);
      
      debugLines.push(`Looking for MEC Update in previous month ${prevMonth}`);
      debugLines.push(`Available MEC Updates: ${mecUpdates.length}`);
      debugLines.push(`MEC Updates months: ${mecUpdates.map(m => getMonthYear(m.ts)).join(', ')}`);
      
      mecUpdate = [...mecUpdates].reverse().find(m => getMonthYear(m.ts) === prevMonth && m.ts < booked.ts);
      if (mecUpdate) {
        debugLines.push(`Found MEC Update in previous month ${prevMonth}: "${mecUpdate.text.substring(0, 50)}..."`);
      } else {
        debugLines.push(`No MEC Update found in ${prevMonth} for ${targetMonth} lyrics`);
      }
    }
    
    if (!mecUpdate) {
      debugLines.push(`No suitable MEC Update found for ${targetMonth} lyrics`);
      continue;
    }
    
    // Use total minutes (including weekends)
    const durationMinutes = Math.round((booked.ts - mecUpdate.ts) / 60000);
    debugLines.push(`Duration: ${durationMinutes} minutes (${(durationMinutes/60).toFixed(1)}h)`);
    results.push({
      month: targetMonth,
      start: mecUpdate.ts,
      end: booked.ts,
      durationMinutes
    });
  }
  
  // Write debug info
  fs.writeFileSync('debug_lyrics.txt', debugLines.join('\n'));
  
  return results;
}

// Lyrics MEC steps timeline extraction (for June 2025 onwards)
function extractLyricsStepsTimeline(messages) {
  // Sort messages oldest to newest
  const msgs = [...messages].sort((a, b) => Number(a.ts) - Number(b.ts));
  // Helper to get month/year string (force UTC)
  const getMonthYear = (date) => date.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  
  // Filter messages by type and keyword for June 2025 onwards only
  // MEC UPDATE messages: no keyword filtering
  // WD1, WD2, WD3, booked messages: filter by "Lyrics" keyword
  const filteredMsgs = msgs.filter(msg => {
    if (!msg.text) return false;
    const ts = new Date(Number(msg.ts) * 1000);
    const month = getMonthYear(ts);
    // Only for June 2025 onwards
    if (!isJune2025OrLater(month)) return false;
    
    // MEC UPDATE messages: always include (no keyword filtering)
    if (/MEC\s*UPDATE/i.test(msg.text) || /MEC\s*is\s*coming/i.test(msg.text)) {
      return true;
    }
    
    // WD1, WD2, WD3, booked messages: must contain "Lyrics" (except WD3 EOD update)
    if (/WD1/i.test(msg.text) || /WD2/i.test(msg.text) || /is booked/i.test(msg.text)) {
      return /lyrics\s*:?/i.test(msg.text);
    }
    
    // Special case for WD3: either contains "lyrics" OR starts with "WD3 EOD update"
    if (/WD3/i.test(msg.text)) {
      return /lyrics\s*:?/i.test(msg.text) || /^WD3\s+EOD\s+update/i.test(msg.text.trim());
    }
    
    return false; // Other messages not needed
  });
  
  // Group filtered messages by month
  const byMonth = {};
  filteredMsgs.forEach(msg => {
    const ts = new Date(Number(msg.ts) * 1000);
    const month = getMonthYear(ts);
    if (!byMonth[month]) byMonth[month] = [];
    byMonth[month].push({ ...msg, ts });
  });
  
  // Generate months from June 2025 onwards only
  const months = [];
  let d = new Date(Date.UTC(2025, 5, 1)); // June 2025
  for (let i = 0; i < 7; i++) { // June 2025 - Dec 2025
    months.push(getMonthYear(d));
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  
  const results = [];
  for (let i = 0; i < months.length; i++) {
    const month = months[i];
    const currMsgs = byMonth[month] || [];
    
    // Find booked message for this month (contains "lyrics" and "booked")
    const bookedMsg = currMsgs.find(m => /lyrics\s*:?/i.test(m.text) && /booked/i.test(m.text));
    if (!bookedMsg) continue; // Skip months without booked message
    
    // Parse target month for finding MEC Update
    const [targetMonthName, targetYear] = month.split(' ');
    const targetMonthIndex = new Date(Date.parse(targetMonthName + ' 1, 2000')).getMonth();
    const targetYearNum = parseInt(targetYear, 10);
    
    // Find MEC Update: first check current month (1st-7th), then previous month
    let mecUpdateMsg = null;
    
    // Check if there's a MEC Update in current month between 1st-7th
    const currentMonthMecUpdates = currMsgs.filter(m => {
      if (!/MEC\s*UPDATE/i.test(m.text)) return false;
      const dayOfMonth = m.ts.getUTCDate();
      return dayOfMonth >= 1 && dayOfMonth <= 7 && m.ts < bookedMsg.ts;
    });
    
    if (currentMonthMecUpdates.length > 0) {
      mecUpdateMsg = currentMonthMecUpdates[0]; // Use first MEC Update in current month (1st-7th)
    } else {
      // Fall back to last MEC Update from previous month
      const prevMonthDate = new Date(Date.UTC(targetYearNum, targetMonthIndex, 1));
      prevMonthDate.setUTCMonth(prevMonthDate.getUTCMonth() - 1);
      const prevMonth = getMonthYear(prevMonthDate);
      const prevMsgs = byMonth[prevMonth] || [];
      
      mecUpdateMsg = [...prevMsgs].reverse().find(m => /MEC\s*UPDATE/i.test(m.text) && m.ts < bookedMsg.ts);
    }
    
    if (!mecUpdateMsg) continue; // Skip if no MEC Update found
    
    // Find WD messages for this month (must contain "lyrics")
    const wd1Msg = currMsgs.find(m => /WD1/i.test(m.text) && /lyrics\s*:?/i.test(m.text));
    const wd2Msg = currMsgs.find(m => /WD2/i.test(m.text) && /lyrics\s*:?/i.test(m.text));
    
    // WD3 detection: either contains "lyrics" OR starts with "WD3 EOD update" (Kevin Shea's format)
    const wd3Msg = currMsgs.find(m => {
      if (!/WD3/i.test(m.text)) return false;
      // Check if it contains "lyrics" OR starts with "WD3 EOD update"
      return /lyrics\s*:?/i.test(m.text) || /^WD3\s+EOD\s+update/i.test(m.text.trim());
    });
    
    // Build subtasks based on available messages
    const subtasks = [];
    
    // Backfill: from MEC Update to WD1 (or to booked if no WD1)
    let backfillEnd = wd1Msg ? wd1Msg.ts : bookedMsg.ts;
    subtasks.push({
      type: 'backfill',
      start: mecUpdateMsg.ts.toISOString(),
      end: backfillEnd.toISOString()
    });
    
    // WD1: from WD1 to WD2 (or to booked if no WD2)
    if (wd1Msg) {
      let wd1End = wd2Msg ? wd2Msg.ts : bookedMsg.ts;
      subtasks.push({
        type: 'WD1',
        start: wd1Msg.ts.toISOString(),
        end: wd1End.toISOString()
      });
    }
    
    // WD2: from WD2 to WD3 (or to booked if no WD3)
    if (wd2Msg) {
      let wd2End = wd3Msg ? wd3Msg.ts : bookedMsg.ts;
      subtasks.push({
        type: 'WD2',
        start: wd2Msg.ts.toISOString(),
        end: wd2End.toISOString()
      });
    }
    
    // WD3: from WD3 to booked
    if (wd3Msg) {
      subtasks.push({
        type: 'WD3',
        start: wd3Msg.ts.toISOString(),
        end: bookedMsg.ts.toISOString()
      });
    }
    
    // Only add results if we have some subtasks
    if (subtasks.length > 0) {
      results.push({
        month,
        total: {
          start: mecUpdateMsg.ts.toISOString(),
          end: bookedMsg.ts.toISOString()
        },
        subtasks
      });
    }
  }
  
  return results;
}

app.get('/messages', (req, res) => {
  const data = require('./mec-monarchs.json');
  res.json(data);
});

app.get('/api/mec-timeline', async (req, res) => {
  try {
    const result = await slackClient.conversations.history({ channel: slackChannel, limit: 1000 });
    const timeline = extractTimeline(result.messages);
    res.json(timeline);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/mec-highlevel', async (req, res) => {
  try {
    const result = await slackClient.conversations.history({ channel: slackChannel, limit: 1000 });
    const timeline = extractHighLevelTimeline(result.messages);
    // Hardcode October 2024 if missing
    const oct2024Start = '2024-09-29T13:15:00+02:00';
    const oct2024End = '2024-10-03T01:06:00+02:00';

    // High-level duration
    if (!timeline.find(d => d.month === 'October 2024')) {
      timeline.push({
        month: 'October 2024',
        start: oct2024Start,
        end: oct2024End,
        durationMinutes: (new Date(oct2024End) - new Date(oct2024Start)) / 60000
      });
    }
    res.json(timeline);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/mec-steps-timeline', async (req, res) => {
  try {
    const result = await slackClient.conversations.history({ channel: slackChannel, limit: 1000 });
    const timeline = extractStepsTimeline(result.messages);
    // Hardcode October 2024 if missing
    const oct2024Start = '2024-09-29T13:15:00+02:00';
    const oct2024End = '2024-10-03T01:06:00+02:00';

    // Steps timeline
    if (!timeline.find(d => d.month === 'October 2024')) {
      timeline.push({
        month: 'October 2024',
        total: { start: oct2024Start, end: oct2024End },
        subtasks: [
          { type: 'remaining', start: oct2024Start, end: oct2024End }
        ]
      });
    }
    res.json(timeline);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/audiobooks-mec-highlevel', async (req, res) => {
  console.log('Audiobooks MEC highlevel route HIT');
  fs.writeFileSync('debug_route.txt', 'route called');
  try {
    // Get messages from both channels to handle the transition
    const oldChannelResult = await slackClient.conversations.history({ channel: 'C05U48VE6ER', limit: 1000 });
    const newChannelResult = await slackClient.conversations.history({ channel: 'CB0CY1YBH', limit: 1000 });
    
    // Combine messages from both channels
    const combinedMessages = [...oldChannelResult.messages, ...newChannelResult.messages];
    
    const timeline = extractAudiobooksHighLevelTimeline(combinedMessages);
    // Hardcode October 2024 if missing
    const oct2024Start = '2024-09-29T13:15:00+02:00';
    const oct2024End = '2024-10-03T01:06:00+02:00';
    if (!timeline.find(d => d.month === 'October 2024')) {
      timeline.push({
        month: 'October 2024',
        start: oct2024Start,
        end: oct2024End,
        durationMinutes: (new Date(oct2024End) - new Date(oct2024Start)) / 60000
      });
    }
    res.json(timeline);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
  console.log('Audiobooks MEC highlevel route registered');
});

app.get('/api/audiobooks-mec-steps-timeline', async (req, res) => {
  try {
    // Get messages from both channels to handle the transition
    const oldChannelResult = await slackClient.conversations.history({ channel: 'C05U48VE6ER', limit: 1000 });
    const newChannelResult = await slackClient.conversations.history({ channel: 'CB0CY1YBH', limit: 1000 });
    
    // Combine messages from both channels
    const combinedMessages = [...oldChannelResult.messages, ...newChannelResult.messages];
    
    const timeline = extractAudiobooksStepsTimeline(combinedMessages);
    // Hardcode October 2024 if missing
    const oct2024Start = '2024-09-29T13:15:00+02:00';
    const oct2024End = '2024-10-03T01:06:00+02:00';
    if (!timeline.find(d => d.month === 'October 2024')) {
      timeline.push({
        month: 'October 2024',
        total: { start: oct2024Start, end: oct2024End },
        subtasks: [
          { type: 'remaining', start: oct2024Start, end: oct2024End }
        ]
      });
    }
    res.json(timeline);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/music-mec-highlevel', async (req, res) => {
  try {
    // Get messages from both old and new channels to handle the transition
    // Old channel: CB0CY1YBH (same as current) - MEC Updates should be in this channel
    // New channel: CB0CY1YBH (June 2025+) for everything including music-filtered messages
    const result = await slackClient.conversations.history({ channel: 'CB0CY1YBH', limit: 1000 });
    
    const timeline = extractMusicHighLevelTimeline(result.messages);
    res.json(timeline);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/music-mec-steps-timeline', async (req, res) => {
  try {
    // Get messages from the music channel (CB0CY1YBH) for June 2025 onwards
    const result = await slackClient.conversations.history({ channel: 'CB0CY1YBH', limit: 1000 });
    const timeline = extractMusicStepsTimeline(result.messages);
    res.json(timeline);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/lyrics-mec-highlevel', async (req, res) => {
  try {
    // Get messages from the lyrics channel - same as current MEC channel
    const result = await slackClient.conversations.history({ channel: 'CB0CY1YBH', limit: 1000 });
    const timeline = extractLyricsHighLevelTimeline(result.messages);
    res.json(timeline);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/lyrics-mec-steps-timeline', async (req, res) => {
  try {
    // Get messages from the lyrics channel - same as current MEC channel
    const result = await slackClient.conversations.history({ channel: 'CB0CY1YBH', limit: 1000 });
    const timeline = extractLyricsStepsTimeline(result.messages);
    res.json(timeline);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/s4c-podcast-mec-highlevel', async (req, res) => {
  try {
    const timeline = await extractS4CPodcastHighLevelTimeline();
    res.json(timeline);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve static files from the React app build
app.use(express.static(path.join(__dirname, 'build')));

// Catch-all: send back React's index.html for any non-API route
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`API server running at http://localhost:${PORT}`);
});