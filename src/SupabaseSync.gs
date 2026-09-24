/**
 * Optional Supabase parallel sync.
 *
 * Google Sheets remains the source of truth while SUPABASE_SYNC_ENABLED is not "true".
 * When enabled, handlers can call these helpers after the Sheet write succeeds.
 */

function isSupabaseSyncEnabled_() {
  return String(getPropOptional('SUPABASE_SYNC_ENABLED', 'false')).toLowerCase() === 'true';
}

function getSupabaseConfig_() {
  return {
    url: normalizeSupabaseUrl_(getPropOptional('SUPABASE_URL', '')),
    serviceKey: getPropOptional('SUPABASE_SERVICE_ROLE_KEY', '')
  };
}

function normalizeSupabaseUrl_(rawUrl) {
  var url = String(rawUrl || '').trim();
  if (!url) return '';

  // Allow pasting either the real API URL or any dashboard project URL.
  // Dashboard examples:
  // https://supabase.com/dashboard/project/olwkhorvaxcvuxeqtcpd
  // https://supabase.com/dashboard/project/olwkhorvaxcvuxeqtcpd/settings/api-keys
  var dashboardMatch = url.match(/supabase\.com\/dashboard\/project\/([a-z0-9]+)/i);
  if (dashboardMatch && dashboardMatch[1]) {
    return 'https://' + dashboardMatch[1] + '.supabase.co';
  }

  // Allow entering only the project ref for convenience.
  if (/^[a-z0-9]{20}$/.test(url)) {
    return 'https://' + url + '.supabase.co';
  }

  // If the user pasted a REST endpoint, reduce it back to the project base URL.
  var restMatch = url.match(/^(https:\/\/[^\/]+\.supabase\.co)(?:\/rest\/v1.*)?$/i);
  if (restMatch && restMatch[1]) {
    return restMatch[1].replace(/\/+$/, '');
  }

  return url.replace(/\/+$/, '');
}

function testSupabaseConnection() {
  var config = getSupabaseConfig_();
  var result = {
    normalizedUrl: config.url,
    hasServiceKey: Boolean(config.serviceKey),
    testEndpoint: config.url ? config.url + '/rest/v1/employees?select=employee_code&limit=1' : ''
  };

  if (!config.url || !config.serviceKey) {
    logWarn('Supabase connection test skipped', result);
    return result;
  }

  var response = UrlFetchApp.fetch(result.testEndpoint, {
    method: 'get',
    muteHttpExceptions: true,
    headers: {
      apikey: config.serviceKey,
      Authorization: 'Bearer ' + config.serviceKey
    }
  });
  result.status = response.getResponseCode();
  result.body = response.getContentText();
  logInfo('Supabase connection test', result);
  return result;
}

function supabaseInsert_(tableName, payload) {
  if (!isSupabaseSyncEnabled_()) {
    return { skipped: true, reason: 'SUPABASE_SYNC_ENABLED is not true' };
  }

  var config = getSupabaseConfig_();
  if (!config.url || !config.serviceKey) {
    logWarn('Supabase sync skipped: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY', {
      tableName: tableName,
      hasUrl: Boolean(config.url),
      hasServiceKey: Boolean(config.serviceKey)
    });
    return { skipped: true, reason: 'missing_supabase_config' };
  }

  var endpoint = config.url + '/rest/v1/' + encodeURIComponent(tableName);
  var options = {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    headers: {
      apikey: config.serviceKey,
      Authorization: 'Bearer ' + config.serviceKey,
      Prefer: 'resolution=merge-duplicates,return=representation'
    },
    payload: JSON.stringify(payload)
  };

  try {
    var response = UrlFetchApp.fetch(endpoint, options);
    var status = response.getResponseCode();
    var body = response.getContentText();
    if (status < 200 || status >= 300) {
      logError('Supabase sync failed', {
        tableName: tableName,
        status: status,
        body: body,
        payload: payload
      });
      return { ok: false, status: status, body: body };
    }
    return { ok: true, status: status, body: body };
  } catch (err) {
    logError('Supabase sync exception', {
      tableName: tableName,
      message: err && err.message ? err.message : String(err),
      payload: payload
    });
    return { ok: false, error: err && err.message ? err.message : String(err) };
  }
}

function supabaseUpsert_(tableName, payload, conflictColumns) {
  if (!isSupabaseSyncEnabled_()) {
    return { skipped: true, reason: 'SUPABASE_SYNC_ENABLED is not true' };
  }

  var config = getSupabaseConfig_();
  if (!config.url || !config.serviceKey) {
    logWarn('Supabase upsert skipped: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY', {
      tableName: tableName,
      hasUrl: Boolean(config.url),
      hasServiceKey: Boolean(config.serviceKey)
    });
    return { skipped: true, reason: 'missing_supabase_config' };
  }

  var endpoint = config.url + '/rest/v1/' + encodeURIComponent(tableName);
  if (conflictColumns) {
    endpoint += '?on_conflict=' + encodeURIComponent(conflictColumns);
  }

  var options = {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    headers: {
      apikey: config.serviceKey,
      Authorization: 'Bearer ' + config.serviceKey,
      Prefer: 'resolution=merge-duplicates,return=representation'
    },
    payload: JSON.stringify(payload)
  };

  try {
    var response = UrlFetchApp.fetch(endpoint, options);
    var status = response.getResponseCode();
    var body = response.getContentText();
    if (status < 200 || status >= 300) {
      logError('Supabase upsert failed', {
        tableName: tableName,
        status: status,
        body: body,
        payload: payload
      });
      return { ok: false, status: status, body: body };
    }
    return { ok: true, status: status, body: body };
  } catch (err) {
    logError('Supabase upsert exception', {
      tableName: tableName,
      message: err && err.message ? err.message : String(err),
      payload: payload
    });
    return { ok: false, error: err && err.message ? err.message : String(err) };
  }
}

function syncEmployeeToSupabase_(employee) {
  if (!employee) return { skipped: true, reason: 'empty_employee' };
  return supabaseUpsert_('employees', {
    employee_code: employee.employee_id || employee.employeeCode || employee.code || '',
    line_user_id: employee.line_user_id || employee.lineUserId || '',
    display_name: employee.display_name || employee.displayName || employee.name || '',
    full_name: employee.full_name || employee.fullName || employee.name || '',
    department: employee.department || '',
    position: employee.position || '',
    phone: employee.phone || '',
    email: employee.email || '',
    bank_account: employee.bank_account || employee.bankAccount || '',
    roles: employee.roles || '',
    status: employee.status || 'active',
    raw_data: employee,
    updated_at: new Date().toISOString()
  }, 'employee_code');
}

function syncLeaveRequestToSupabase_(leaveRequest) {
  if (!leaveRequest) return { skipped: true, reason: 'empty_leave_request' };
  return supabaseUpsert_('leave_requests', {
    request_id: leaveRequest.request_id || leaveRequest.id || '',
    employee_code: leaveRequest.employee_id || leaveRequest.employeeCode || leaveRequest.employee_code || '',
    leave_type: leaveRequest.leave_type || leaveRequest.leaveType || '',
    start_date: leaveRequest.start_date || leaveRequest.startDate || null,
    end_date: leaveRequest.end_date || leaveRequest.endDate || null,
    start_time: leaveRequest.start_time || leaveRequest.startTime || null,
    end_time: leaveRequest.end_time || leaveRequest.endTime || null,
    duration_type: leaveRequest.duration_type || leaveRequest.durationType || '',
    hours: Number(leaveRequest.hours || 0),
    reason: leaveRequest.reason || '',
    status: leaveRequest.status || 'pending',
    approver_l1_id: leaveRequest.approver_l1_id || leaveRequest.approverL1Id || '',
    approver_l2_id: leaveRequest.approver_l2_id || leaveRequest.approverL2Id || '',
    approver_l3_id: leaveRequest.approver_l3_id || leaveRequest.approverL3Id || '',
    evidence_url: leaveRequest.evidence_url || leaveRequest.evidenceUrl || '',
    raw_data: leaveRequest,
    updated_at: new Date().toISOString()
  }, 'request_id');
}

function syncOtRequestToSupabase_(otRequest) {
  if (!otRequest) return { skipped: true, reason: 'empty_ot_request' };
  return supabaseUpsert_('ot_requests', {
    request_id: otRequest.request_id || otRequest.id || '',
    employee_code: otRequest.employee_id || otRequest.employeeCode || otRequest.employee_code || '',
    ot_date: otRequest.ot_date || otRequest.otDate || otRequest.date || null,
    start_time: otRequest.start_time || otRequest.startTime || null,
    end_time: otRequest.end_time || otRequest.endTime || null,
    hours: Number(otRequest.hours || 0),
    reason: otRequest.reason || '',
    status: otRequest.status || 'pending',
    approver_l1_id: otRequest.approver_l1_id || otRequest.approverL1Id || '',
    approver_l2_id: otRequest.approver_l2_id || otRequest.approverL2Id || '',
    approver_l3_id: otRequest.approver_l3_id || otRequest.approverL3Id || '',
    raw_data: otRequest,
    updated_at: new Date().toISOString()
  }, 'request_id');
}

function syncCheckinToSupabase_(checkin) {
  if (!checkin) return { skipped: true, reason: 'empty_checkin' };
  return supabaseUpsert_('attendance_logs', {
    checkin_id: checkin.checkin_id || checkin.id || '',
    employee_code: checkin.employee_id || checkin.employeeCode || checkin.employee_code || '',
    line_user_id: checkin.line_user_id || checkin.lineUserId || '',
    event_type: checkin.event_type || checkin.type || 'checkin',
    event_at: checkin.event_at || checkin.timestamp || new Date().toISOString(),
    branch_name: checkin.branch_name || checkin.branchName || '',
    latitude: Number(checkin.latitude || checkin.lat || 0),
    longitude: Number(checkin.longitude || checkin.lng || 0),
    distance_meters: Number(checkin.distance_meters || checkin.distanceMeters || 0),
    photo_url: checkin.photo_url || checkin.photoUrl || '',
    status: checkin.status || '',
    raw_data: checkin,
    updated_at: new Date().toISOString()
  }, 'checkin_id');
}

/**
 * Batch sync from Google Sheets to Supabase.
 *
 * This is the safest first hook for parallel migration because it reads the
 * current Google Sheets source of truth and upserts Supabase without changing
 * the live request/approval flow.
 *
 * Run manually from Apps Script, or create a time trigger for this function.
 */
function syncSupabaseFromSheets() {
  if (!isSupabaseSyncEnabled_()) {
    return { skipped: true, reason: 'SUPABASE_SYNC_ENABLED is not true' };
  }

  var result = {
    employees: syncSheetRowsToSupabase_({
      table: 'employees',
      sheetProperty: 'SUPABASE_EMPLOYEES_SHEET',
      defaultSheetNames: ['employees', 'Employees', 'พนักงาน', 'Employees_Master'],
      mapper: mapEmployeeSheetRow_
    }),
    leave_requests: syncSheetRowsToSupabase_({
      table: 'leave_requests',
      sheetProperty: 'SUPABASE_LEAVE_REQUESTS_SHEET',
      defaultSheetNames: ['leave_requests', 'LeaveRequests', 'Leaves', 'Leave', 'ใบลา', 'ลางาน'],
      mapper: mapLeaveSheetRow_
    }),
    ot_requests: syncSheetRowsToSupabase_({
      table: 'ot_requests',
      sheetProperty: 'SUPABASE_OT_REQUESTS_SHEET',
      defaultSheetNames: ['ot_requests', 'OTRequests', 'OT', 'โอที'],
      mapper: mapOtSheetRow_
    }),
    attendance_logs: syncSheetRowsToSupabase_({
      table: 'attendance_logs',
      sheetProperty: 'SUPABASE_ATTENDANCE_LOGS_SHEET',
      defaultSheetNames: ['attendance_logs', 'Attendance', 'Checkins', 'Checkin', 'ลงเวลา'],
      mapper: mapAttendanceSheetRow_
    })
  };

  logInfo('Supabase batch sync completed', result);
  return result;
}

function createSupabaseSyncTrigger() {
  ScriptApp.newTrigger('syncSupabaseFromSheets')
    .timeBased()
    .everyMinutes(15)
    .create();
}

function syncSheetRowsToSupabase_(options) {
  var sheet = findSupabaseSyncSheet_(options.sheetProperty, options.defaultSheetNames);
  if (!sheet) {
    return { skipped: true, reason: 'sheet_not_found', candidates: options.defaultSheetNames };
  }

  var values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return { skipped: true, reason: 'empty_sheet', sheetName: sheet.getName() };
  }

  var headerRowIndex = findHeaderRowIndex_(values);
  if (headerRowIndex < 0 || headerRowIndex >= values.length - 1) {
    return { skipped: true, reason: 'header_not_found', sheetName: sheet.getName() };
  }

  var headers = values[headerRowIndex].map(normalizeHeader_);
  var synced = 0;
  var skipped = 0;
  var failed = 0;

  for (var i = headerRowIndex + 1; i < values.length; i++) {
    var row = rowToObject_(headers, values[i]);
    if (isBlankRow_(row)) {
      skipped++;
      continue;
    }

    var payload = options.mapper(row, i + 1, sheet.getName());
    if (!payload) {
      skipped++;
      continue;
    }

    var syncResult;
    if (options.table === 'employees') {
      syncResult = syncEmployeeToSupabase_(payload);
    } else if (options.table === 'leave_requests') {
      syncResult = syncLeaveRequestToSupabase_(payload);
    } else if (options.table === 'ot_requests') {
      syncResult = syncOtRequestToSupabase_(payload);
    } else if (options.table === 'attendance_logs') {
      syncResult = syncCheckinToSupabase_(payload);
    }

    if (syncResult && syncResult.ok) {
      synced++;
    } else {
      failed++;
    }
  }

  return {
    sheetName: sheet.getName(),
    headerRow: headerRowIndex + 1,
    synced: synced,
    skipped: skipped,
    failed: failed
  };
}

function findSupabaseSyncSheet_(propertyName, fallbackNames) {
  var spreadsheet = SpreadsheetApp.openById(getProp('SHEET_ID'));
  var configuredName = getPropOptional(propertyName, '');
  if (configuredName) {
    var configuredSheet = spreadsheet.getSheetByName(configuredName);
    if (configuredSheet) return configuredSheet;
  }

  for (var i = 0; i < fallbackNames.length; i++) {
    var sheet = spreadsheet.getSheetByName(fallbackNames[i]);
    if (sheet) return sheet;
  }

  return null;
}

function findHeaderRowIndex_(values) {
  var bestIndex = -1;
  var bestScore = 0;
  for (var i = 0; i < Math.min(values.length, 10); i++) {
    var row = values[i].map(normalizeHeader_);
    var score = 0;
    for (var j = 0; j < row.length; j++) {
      if (row[j]) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }
  return bestScore >= 2 ? bestIndex : -1;
}

function rowToObject_(headers, values) {
  var obj = {};
  for (var i = 0; i < headers.length; i++) {
    if (headers[i]) obj[headers[i]] = values[i];
  }
  return obj;
}

function isBlankRow_(row) {
  var keys = Object.keys(row);
  for (var i = 0; i < keys.length; i++) {
    var value = row[keys[i]];
    if (value !== '' && value !== null && typeof value !== 'undefined') return false;
  }
  return true;
}

function normalizeHeader_(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[()]/g, '');
}

function getRowValue_(row, aliases) {
  for (var i = 0; i < aliases.length; i++) {
    var key = normalizeHeader_(aliases[i]);
    if (Object.prototype.hasOwnProperty.call(row, key)) return row[key];
  }
  return '';
}

function formatDateValue_(value) {
  if (!value) return null;
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(value);
}

function formatDateTimeValue_(value) {
  if (!value) return null;
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return value.toISOString();
  }
  return String(value);
}

function formatTimeValue_(value) {
  if (!value) return null;
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'HH:mm:ss');
  }

  var text = String(value).trim();
  if (!text) return null;

  // Handles strings produced by Apps Script for spreadsheet time cells.
  var dateMatch = text.match(/\b(\d{1,2}):(\d{2})(?::(\d{2}))?\b/);
  if (dateMatch) {
    return ('0' + dateMatch[1]).slice(-2) + ':' + dateMatch[2] + ':' + (dateMatch[3] || '00');
  }

  var hmMatch = text.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (hmMatch) {
    return ('0' + hmMatch[1]).slice(-2) + ':' + hmMatch[2] + ':' + (hmMatch[3] || '00');
  }

  return null;
}
function mapEmployeeSheetRow_(row, rowNumber, sheetName) {
  var employeeCode = getRowValue_(row, [
    'employee_id', 'employee_code', 'emp_id', 'รหัสพนักงาน', 'เลขพนักงาน'
  ]);
  if (!employeeCode) return null;
  return {
    employee_id: String(employeeCode),
    line_user_id: String(getRowValue_(row, ['line_user_id', 'lineUserId', 'LINE User ID']) || ''),
    display_name: String(getRowValue_(row, ['display_name', 'line_display_name', 'ชื่อไลน์']) || ''),
    full_name: String(getRowValue_(row, ['full_name', 'name', 'ชื่อ', 'ชื่อ-สกุล', 'ชื่อ_สกุล']) || ''),
    department: String(getRowValue_(row, ['department', 'แผนก']) || ''),
    position: String(getRowValue_(row, ['position', 'ตำแหน่ง']) || ''),
    phone: String(getRowValue_(row, ['phone', 'tel', 'เบอร์โทร', 'เบอร์โทรศัพท์']) || ''),
    email: String(getRowValue_(row, ['email', 'อีเมล']) || ''),
    bank_account: String(getRowValue_(row, ['bank_account', 'บัญชีธนาคาร']) || ''),
    roles: String(getRowValue_(row, ['roles', 'role', 'สิทธิ์']) || 'employee'),
    status: String(getRowValue_(row, ['status', 'สถานะ']) || 'active'),
    sheet_name: sheetName,
    sheet_row: rowNumber
  };
}

function mapLeaveSheetRow_(row, rowNumber, sheetName) {
  var requestId = getRowValue_(row, ['request_id', 'leave_id', 'id', 'เลขที่คำขอ']);
  var employeeCode = getRowValue_(row, [
    'employee_id', 'employee_code', 'emp_id', 'รหัสพนักงาน', 'เลขพนักงาน'
  ]);
  if (!requestId && !employeeCode) return null;
  return {
    request_id: String(requestId || 'leave-' + sheetName + '-' + rowNumber),
    employee_id: String(employeeCode || ''),
    leave_type: String(getRowValue_(row, ['leave_type', 'type', 'ประเภทการลา']) || ''),
    start_date: formatDateValue_(getRowValue_(row, ['start_date', 'date_from', 'วันที่เริ่ม', 'วันที่ลา'])),
    end_date: formatDateValue_(getRowValue_(row, ['end_date', 'date_to', 'วันที่สิ้นสุด'])),
    start_time: formatTimeValue_(getRowValue_(row, ['start_time', 'เวลาเริ่ม'])),
    end_time: formatTimeValue_(getRowValue_(row, ['end_time', 'เวลาสิ้นสุด'])),
    duration_type: String(getRowValue_(row, ['duration_type', 'ระยะเวลา']) || ''),
    hours: Number(getRowValue_(row, ['hours', 'ชั่วโมง']) || 0),
    reason: String(getRowValue_(row, ['reason', 'เหตุผล']) || ''),
    status: String(getRowValue_(row, ['status', 'สถานะ']) || 'pending'),
    approver_l1_id: String(getRowValue_(row, ['approver_l1_id', 'ผู้อนุมัติ_l1']) || ''),
    approver_l2_id: String(getRowValue_(row, ['approver_l2_id', 'ผู้อนุมัติ_l2']) || ''),
    approver_l3_id: String(getRowValue_(row, ['approver_l3_id', 'ผู้อนุมัติ_l3']) || ''),
    evidence_url: String(getRowValue_(row, ['evidence_url', 'หลักฐาน', 'ไฟล์แนบ']) || ''),
    sheet_name: sheetName,
    sheet_row: rowNumber
  };
}

function mapOtSheetRow_(row, rowNumber, sheetName) {
  var requestId = getRowValue_(row, ['request_id', 'ot_id', 'id', 'เลขที่คำขอ']);
  var employeeCode = getRowValue_(row, [
    'employee_id', 'employee_code', 'emp_id', 'รหัสพนักงาน', 'เลขพนักงาน'
  ]);
  if (!requestId && !employeeCode) return null;
  return {
    request_id: String(requestId || 'ot-' + sheetName + '-' + rowNumber),
    employee_id: String(employeeCode || ''),
    ot_date: formatDateValue_(getRowValue_(row, ['ot_date', 'date', 'วันที่ทำโอที'])),
    start_time: formatTimeValue_(getRowValue_(row, ['start_time', 'เวลาเริ่ม'])),
    end_time: formatTimeValue_(getRowValue_(row, ['end_time', 'เวลาสิ้นสุด'])),
    hours: Number(getRowValue_(row, ['hours', 'รวม', 'ชั่วโมง']) || 0),
    reason: String(getRowValue_(row, ['reason', 'เหตุผล']) || ''),
    status: String(getRowValue_(row, ['status', 'สถานะ']) || 'pending'),
    approver_l1_id: String(getRowValue_(row, ['approver_l1_id', 'ผู้อนุมัติ_l1']) || ''),
    approver_l2_id: String(getRowValue_(row, ['approver_l2_id', 'ผู้อนุมัติ_l2']) || ''),
    approver_l3_id: String(getRowValue_(row, ['approver_l3_id', 'ผู้อนุมัติ_l3']) || ''),
    sheet_name: sheetName,
    sheet_row: rowNumber
  };
}

function mapAttendanceSheetRow_(row, rowNumber, sheetName) {
  var checkinId = getRowValue_(row, ['checkin_id', 'attendance_id', 'id', 'เลขที่รายการ']);
  var employeeCode = getRowValue_(row, [
    'employee_id', 'employee_code', 'emp_id', 'รหัสพนักงาน', 'เลขพนักงาน'
  ]);
  if (!checkinId && !employeeCode) return null;
  return {
    checkin_id: String(checkinId || 'att-' + sheetName + '-' + rowNumber),
    employee_id: String(employeeCode || ''),
    line_user_id: String(getRowValue_(row, ['line_user_id', 'lineUserId']) || ''),
    event_type: String(getRowValue_(row, ['event_type', 'type', 'ประเภท']) || 'checkin'),
    event_at: formatDateTimeValue_(getRowValue_(row, ['event_at', 'timestamp', 'วันที่เวลา', 'เวลา'])),
    branch_name: String(getRowValue_(row, ['branch_name', 'branch', 'สาขา']) || ''),
    latitude: Number(getRowValue_(row, ['latitude', 'lat']) || 0),
    longitude: Number(getRowValue_(row, ['longitude', 'lng', 'lon']) || 0),
    distance_meters: Number(getRowValue_(row, ['distance_meters', 'distance', 'ระยะห่าง']) || 0),
    photo_url: String(getRowValue_(row, ['photo_url', 'image_url', 'รูปภาพ']) || ''),
    status: String(getRowValue_(row, ['status', 'สถานะ']) || ''),
    sheet_name: sheetName,
    sheet_row: rowNumber
  };
}



/**
 * Sync every known Google Sheet into Supabase app_rows.
 * Run this before setting DATA_BACKEND=supabase.
 */
function syncSupabaseAppRowsFromSheets() {
  var spreadsheet = SpreadsheetApp.openById(getProp('SHEET_ID'));
  var result = {};
  Object.keys(SHEETS).forEach(function(key) {
    var def = SHEETS[key];
    var sheet = spreadsheet.getSheetByName(def.name);
    if (!sheet) {
      result[def.name] = { skipped: true, reason: 'sheet_not_found' };
      return;
    }

    var values = sheet.getDataRange().getValues();
    if (values.length < 2) {
      result[def.name] = { synced: 0, skipped: true, reason: 'empty_sheet' };
      return;
    }

    var headers = values[0];
    var synced = 0;
    for (var i = 1; i < values.length; i++) {
      var rowData = {};
      var isBlank = true;
      for (var j = 0; j < headers.length; j++) {
        if (!headers[j]) continue;
        var value = normalizeAppRowValue_(values[i][j]);
        rowData[headers[j]] = value;
        if (value !== '' && value !== null && typeof value !== 'undefined') isBlank = false;
      }
      if (isBlank) continue;

      var rowNum = i + 1;
      var payload = {
        sheet_name: def.name,
        row_num: rowNum,
        row_key: supabaseRowKey_(def.name, rowData, rowNum),
        data: rowData,
        updated_at: new Date().toISOString()
      };
      supabaseUpsert_('app_rows', payload, 'sheet_name,row_key');
      synced++;
    }
    result[def.name] = { synced: synced };
  });
  logInfo('syncSupabaseAppRowsFromSheets', 'completed', result);
  return result;
}

function normalizeAppRowValue_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return value.toISOString();
  }
  if (value === undefined) return null;
  return value;
}

function testSupabasePrimaryRead() {
  var previous = getPropOptional('DATA_BACKEND', 'sheets');
  var rows = supabaseGetAppRows_(SHEETS.EMPLOYEES.name);
  return {
    currentBackend: previous,
    employeesInSupabaseAppRows: rows.length,
    firstEmployee: rows.length ? rows[0].employee_id || '' : ''
  };
}
