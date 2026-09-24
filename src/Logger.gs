/**
 * ============================================================
 * Logger — writes to Logs sheet
 * ============================================================
 */

function logInfo(fn, message, payload) {
  writeLog('info', fn, '', message, payload);
}

function logWarn(fn, message, payload) {
  writeLog('warn', fn, '', message, payload);
}

function logError(fn, message, payload) {
  writeLog('error', fn, '', message, payload);
  // Also write to Stackdriver
  console.error('[' + fn + ']', message, payload);
}

function logUserAction(fn, userId, message, payload) {
  writeLog('info', fn, userId, message, payload);
}

function writeLog(level, fn, userId, message, payload) {
  try {
    const payloadStr = payload ? JSON.stringify(payload).substring(0, 1000) : '';
    insertRow(SHEETS.LOGS.name, {
      timestamp: nowBangkok(),
      level: level,
      function: fn || '',
      user_id: userId || '',
      message: message || '',
      payload: payloadStr
    });
  } catch (err) {
    // last resort
    console.error('Failed to write log', err.message);
  }
}

/**
 * Clear old logs (run manually or via trigger)
 */
function cleanupOldLogs(daysToKeep) {
  daysToKeep = daysToKeep || 30;
  const rows = getAllRows(SHEETS.LOGS.name);
  if (rows.length === 0) return;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysToKeep);

  rows.forEach(function(row) {
    const ts = new Date(row.timestamp);
    if (row._row && ts < cutoff) {
      deleteRow(SHEETS.LOGS.name, function(r) { return r._row === row._row; });
    }
  });

  logInfo('cleanupOldLogs', 'completed');
}


