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
    const sheet = getSheet(SHEETS.LOGS.name);
    if (!sheet) {
      console.error('Logs sheet not found');
      return;
    }
    const payloadStr = payload ? JSON.stringify(payload).substring(0, 1000) : '';
    sheet.appendRow([
      nowBangkok(),
      level,
      fn || '',
      userId || '',
      message || '',
      payloadStr
    ]);
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
  const sheet = getSheet(SHEETS.LOGS.name);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysToKeep);

  let deleteUpTo = 1;
  for (let i = 1; i < data.length; i++) {
    const ts = new Date(data[i][0]);
    if (ts < cutoff) {
      deleteUpTo = i + 1;
    } else {
      break;
    }
  }

  if (deleteUpTo > 1) {
    sheet.deleteRows(2, deleteUpTo - 1);
    logInfo('cleanupOldLogs', 'deleted ' + (deleteUpTo - 1) + ' rows');
  }
}
