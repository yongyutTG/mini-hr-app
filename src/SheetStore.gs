/**
 * ============================================================
 * Sheet Store — CRUD helpers on Google Sheets
 * ============================================================
 */

/**
 * Get sheet by name (cached)
 */
const _sheetCache = {};
function getSheet(name) {
  if (_sheetCache[name]) return _sheetCache[name];
  const ss = SpreadsheetApp.openById(getProp('SHEET_ID'));
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('sheet_not_found: ' + name);
  _sheetCache[name] = sheet;
  return sheet;
}

function clearSheetCache() {
  for (const k in _sheetCache) delete _sheetCache[k];
}

/**
 * Get all rows as array of objects (with header → field map)
 */
function getAllRows(sheetName) {
  const sheet = getSheet(sheetName);
  const data = sheet.getDataRange().getValues();
  if (data.length === 0) return [];
  const headers = data[0];
  const result = [];
  for (let i = 1; i < data.length; i++) {
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = data[i][j];
    }
    obj._row = i + 1; // 1-indexed sheet row
    result.push(obj);
  }
  return result;
}

/**
 * Find first row matching predicate
 */
function findRow(sheetName, predicate) {
  const rows = getAllRows(sheetName);
  for (let i = 0; i < rows.length; i++) {
    if (predicate(rows[i])) return rows[i];
  }
  return null;
}

/**
 * Filter rows
 */
function filterRows(sheetName, predicate) {
  return getAllRows(sheetName).filter(predicate);
}

/**
 * Insert a row from object (matching headers)
 */
function insertRow(sheetName, obj) {
  const sheet = getSheet(sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = headers.map(function(h) { return obj[h] !== undefined ? obj[h] : ''; });
  sheet.appendRow(row);
  return row;
}

/**
 * Update row by row number (1-indexed)
 */
function updateRowByNumber(sheetName, rowNum, updates) {
  const sheet = getSheet(sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  for (const key in updates) {
    const colIdx = headers.indexOf(key);
    if (colIdx >= 0) {
      sheet.getRange(rowNum, colIdx + 1).setValue(updates[key]);
    }
  }
}

/**
 * Update row by predicate
 */
function updateRow(sheetName, predicate, updates) {
  const found = findRow(sheetName, predicate);
  if (!found) return false;
  updateRowByNumber(sheetName, found._row, updates);
  return true;
}

/**
 * Delete row by predicate
 */
function deleteRow(sheetName, predicate) {
  const found = findRow(sheetName, predicate);
  if (!found) return false;
  const sheet = getSheet(sheetName);
  sheet.deleteRow(found._row);
  return true;
}

// ====================================================================
// Domain-specific helpers
// ====================================================================

function findEmployeeByLineId(lineUserId) {
  return findRow(SHEETS.EMPLOYEES.name, function(r) {
    return r.line_user_id === lineUserId;
  });
}

function findEmployeeById(employeeId) {
  return findRow(SHEETS.EMPLOYEES.name, function(r) {
    return r.employee_id === employeeId;
  });
}

function getActiveEmployees() {
  return filterRows(SHEETS.EMPLOYEES.name, function(r) {
    return r.is_active === true || r.is_active === 'TRUE' || r.is_active === 'true';
  });
}

function insertEmployee(data) {
  return insertRow(SHEETS.EMPLOYEES.name, data);
}

function insertCheckin(data) {
  return insertRow(SHEETS.CHECKINS.name, data);
}

function findCheckin(employeeId, date, slot) {
  return findRow(SHEETS.CHECKINS.name, function(r) {
    return r.employee_id === employeeId
      && formatDate(new Date(r.checkin_date)) === date
      && r.slot === slot;
  });
}

function insertLeave(data) {
  return insertRow(SHEETS.LEAVES.name, data);
}

function findLeaveById(leaveId) {
  return findRow(SHEETS.LEAVES.name, function(r) { return r.leave_id === leaveId; });
}

function insertOT(data) {
  return insertRow(SHEETS.OT.name, data);
}

function findOTById(otId) {
  return findRow(SHEETS.OT.name, function(r) { return r.ot_id === otId; });
}

function insertPayment(data) {
  return insertRow(SHEETS.PAYMENTS.name, data);
}

function getLeaveQuota(employeeId, year) {
  return findRow(SHEETS.LEAVE_QUOTA.name, function(r) {
    return r.employee_id === employeeId && Number(r.year) === year;
  });
}

function initLeaveQuota(employeeId, year) {
  const config = getConfig();
  const existing = getLeaveQuota(employeeId, year);
  if (existing) return existing;

  const quota = {
    employee_id: employeeId,
    year: year,
    sick_quota: config.sick_quota_default,
    sick_used: 0,
    personal_quota: config.personal_quota_default,
    personal_used: 0,
    vacation_quota: config.vacation_quota_default,
    vacation_used: 0,
  };
  insertRow(SHEETS.LEAVE_QUOTA.name, quota);
  return quota;
}

function deductLeaveQuota(leave) {
  const year = new Date(leave.start_date).getFullYear();
  const quota = getLeaveQuota(leave.employee_id, year);
  if (!quota) return;

  const usedField = leave.leave_type + '_used';
  const newUsed = Number(quota[usedField] || 0) + Number(leave.total_days || 0);

  const updates = {};
  updates[usedField] = newUsed;
  updateRowByNumber(SHEETS.LEAVE_QUOTA.name, quota._row, updates);
}
