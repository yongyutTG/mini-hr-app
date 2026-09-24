/**
 * ============================================================
 * Config — Script Properties + Config Sheet
 * ============================================================
 */

/**
 * Required script properties
 */
const REQUIRED_PROPS = [
  'LINE_CHANNEL_ACCESS_TOKEN',
  'LINE_CHANNEL_SECRET',
  'SHEET_ID',
  'DRIVE_FOLDER_ID',
  'OWNER_LINE_USER_ID',
  'LIFF_ID_REGISTER',
  'LIFF_ID_CHECKIN',
  'LIFF_ID_LEAVE',
  'LIFF_ID_OT',
  'LIFF_ID_BALANCE',
  'LIFF_ID_HR_TOOLS',
  'LIFF_ID_APPROVAL',
  'LIFF_ID_EVIDENCE',
  'LIFF_ID_RESPONSE',
];

/**
 * Default Config sheet values (เติมตอน setup)
 */
const DEFAULT_CONFIG = {
  company_name: 'My Company Co., Ltd.',
  geofence_lat: 13.7563,
  geofence_lng: 100.5018,
  geofence_radius_m: 150,
  branch_1_name: 'สาขากิ่งแก้ว',
  branch_1_lat: 13.690919359380588,
  branch_1_lng: 100.7296330533856,
  branch_1_radius_m: 50,
  branch_2_name: 'สาขาดอนเมือง',
  branch_2_lat: 13.934976,
  branch_2_lng: 100.611001,
  branch_2_radius_m: 50,
  branch_3_name: 'สาขาลาดพร้าว',
  branch_3_lat: 13.805039,
  branch_3_lng: 100.562180,
  branch_3_radius_m: 50,
  work_start: '09:00',
  work_end: '18:00',
  lunch_start: '12:00',
  lunch_end: '13:00',
  ot_rate_multiplier: 1.5,
  sick_quota_default: 30,
  personal_quota_default: 3,
  vacation_quota_default: 15,
  late_threshold_min: 15,
  ot_request_lead_min: 30,
  enable_approval_L2: false,
  enable_approval_L3: false,
  allow_employee_bank_edit: true,
};

/**
 * Read Script Property
 */
function getProp(key) {
  const v = PropertiesService.getScriptProperties().getProperty(key);
  if (!v) throw new Error('missing_property: ' + key);
  return v;
}

function getPropOptional(key, defaultValue) {
  const v = PropertiesService.getScriptProperties().getProperty(key);
  return v || defaultValue;
}

/**
 * Get full config (merge Script Properties + Config sheet)
 */
function getConfig() {
  const props = PropertiesService.getScriptProperties();

  // Read Config sheet
  const sheetConfig = readConfigSheet();

  // Merge
  const config = Object.assign({}, DEFAULT_CONFIG, sheetConfig);

  // Add LIFF IDs and tokens from Script Properties
  config.LINE_CHANNEL_ACCESS_TOKEN = props.getProperty('LINE_CHANNEL_ACCESS_TOKEN');
  config.LINE_CHANNEL_SECRET = props.getProperty('LINE_CHANNEL_SECRET');
  config.OWNER_LINE_USER_ID = props.getProperty('OWNER_LINE_USER_ID');
  config.DRIVE_FOLDER_ID = props.getProperty('DRIVE_FOLDER_ID');

  return config;
}

/**
 * Read Config sheet (key-value pairs)
 */
function readConfigSheet() {
  if (typeof isSupabasePrimary_ === 'function' && isSupabasePrimary_()) {
    const rows = getAllRows(SHEETS.CONFIG.name);
    const config = {};
    rows.forEach(function(row) {
      if (row.key) config[row.key] = parseConfigValue_(row.value);
    });
    return config;
  }

  const ss = SpreadsheetApp.openById(getProp('SHEET_ID'));
  const sheet = ss.getSheetByName('Config');
  if (!sheet) return {};

  const data = sheet.getDataRange().getValues();
  const config = {};

  // Assume header row [key, value]
  for (let i = 1; i < data.length; i++) {
    const key = data[i][0];
    const value = data[i][1];
    if (key) config[key] = parseConfigValue_(value);
  }
  return config;
}

function parseConfigValue_(value) {
  if (typeof value === 'string') {
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (!isNaN(parseFloat(value)) && isFinite(value)) return parseFloat(value);
  }
  return value;
}

/**
 * Validate all required props are set
 */
function validateConfig() {
  const missing = [];
  REQUIRED_PROPS.forEach(function(key) {
    const v = PropertiesService.getScriptProperties().getProperty(key);
    if (!v) missing.push(key);
  });

  if (missing.length > 0) {
    throw new Error('Missing Script Properties: ' + missing.join(', '));
  }

  return { ok: true, props: REQUIRED_PROPS.length };
}

/**
 * Sheet column constants — Single source of truth
 */
const SHEETS = {
  EMPLOYEES: {
    name: 'Employees',
    columns: [
      'employee_id', 'line_user_id', 'display_name', 'phone', 'email',
      'department', 'position', 'base_pay_monthly', 'ot_rate_per_hour',
      'bank_name', 'bank_account_no', 'bank_account_name',
      'selfie_url', 'id_card_url',
      'approver_L1_id', 'approver_L2_id', 'approver_L3_id',
      'role', 'start_date', 'is_active', 'registered_at'
    ]
  },
  CHECKINS: {
    name: 'Checkins',
    columns: [
      'checkin_id', 'employee_id', 'checkin_date', 'slot',
      'checkin_at', 'lat', 'lng', 'distance_m', 'selfie_url',
      'status', 'approved_by', 'approved_at', 'branch_name'
    ]
  },
  LEAVES: {
    name: 'Leaves',
    columns: [
      'leave_id', 'employee_id', 'leave_type', 'duration_type',
      'start_date', 'end_date', 'start_time', 'end_time',
      'total_days', 'total_hours', 'reason',
      'evidence_url', 'status', 'current_approver', 'approval_history',
      'submitted_at'
    ]
  },
  OT: {
    name: 'OT',
    columns: [
      'ot_id', 'employee_id', 'ot_date', 'start_time', 'end_time',
      'total_hours', 'reason', 'status', 'current_approver',
      'approval_history', 'submitted_at'
    ]
  },
  PAYMENTS: {
    name: 'Payments',
    columns: [
      'payment_id', 'employee_id', 'period', 'work_days', 'ot_hours',
      'base_pay', 'ot_pay', 'bonus', 'deduction', 'total_amount',
      'status', 'closed_at', 'paid_at', 'note'
    ]
  },
  LEAVE_QUOTA: {
    name: 'LeaveQuota',
    columns: [
      'employee_id', 'year',
      'sick_quota', 'sick_used',
      'personal_quota', 'personal_used',
      'vacation_quota', 'vacation_used'
    ]
  },
  PAY_ITEMS: {
    name: 'PayItems',
    columns: [
      'item_id', 'employee_id', 'period', 'type', 'amount',
      'reason', 'created_by', 'created_at'
    ]
  },
  HOLIDAYS: {
    name: 'Holidays',
    columns: ['date', 'name', 'type']
  },
  CONFIG: {
    name: 'Config',
    columns: ['key', 'value']
  },
  LOGS: {
    name: 'Logs',
    columns: ['timestamp', 'level', 'function', 'user_id', 'message', 'payload']
  },
  APPROVERS: {
    name: 'Approvers',
    columns: ['employee_id', 'level', 'approver_id', 'is_active']
  },
};

/**
 * Initialize ALL sheets — run once after setup
 */
function initializeAllSheets() {
  const ss = SpreadsheetApp.openById(getProp('SHEET_ID'));
  const results = [];

  Object.keys(SHEETS).forEach(function(key) {
    const def = SHEETS[key];
    let sheet = ss.getSheetByName(def.name);
    if (!sheet) {
      sheet = ss.insertSheet(def.name);
      results.push({ sheet: def.name, created: true });
    } else {
      results.push({ sheet: def.name, created: false });
    }

    // Set headers if empty
    const range = sheet.getRange(1, 1, 1, def.columns.length);
    const current = range.getValues()[0];
    const isEmpty = current.every(function(c) { return !c; });
    if (isEmpty) {
      range.setValues([def.columns]);
      range.setFontWeight('bold');
      range.setBackground('#D4550A');
      range.setFontColor('#FFFFFF');
      sheet.setFrozenRows(1);
    }
  });

  // Initialize Config sheet with defaults
  initializeConfigSheet();

  // Delete default "Sheet1" if exists
  const sheet1 = ss.getSheetByName('Sheet1');
  if (sheet1 && ss.getSheets().length > 1) {
    ss.deleteSheet(sheet1);
  }

  return { ok: true, sheets: results };
}

function migrateEmployeeRoleColumn() {
  const ss = SpreadsheetApp.openById(getProp('SHEET_ID'));
  const sheet = ss.getSheetByName(SHEETS.EMPLOYEES.name);
  if (!sheet) return { ok: false, error: 'employees_sheet_missing' };

  const header = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  if (header.indexOf('role') >= 0) return { ok: true, added: false };

  const insertAfter = header.indexOf('approver_L3_id') + 1;
  const insertColumn = insertAfter > 0 ? insertAfter + 1 : sheet.getLastColumn() + 1;
  sheet.insertColumnBefore(insertColumn);
  sheet.getRange(1, insertColumn).setValue('role');
  sheet.getRange(1, insertColumn).setFontWeight('bold').setBackground('#D4550A').setFontColor('#FFFFFF');

  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, insertColumn, lastRow - 1, 1).setValue('employee');
  }

  return { ok: true, added: true, column: insertColumn };
}

function migrateLeaveTimeColumns() {
  const ss = SpreadsheetApp.openById(getProp('SHEET_ID'));
  const sheet = ss.getSheetByName(SHEETS.LEAVES.name);
  if (!sheet) return { ok: false, error: 'leaves_sheet_missing' };

  const headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  const added = [];

  function addColumnAfter(name, afterName) {
    const latestHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
    if (latestHeaders.indexOf(name) >= 0) return;
    const afterIndex = latestHeaders.indexOf(afterName);
    const insertColumn = afterIndex >= 0 ? afterIndex + 2 : sheet.getLastColumn() + 1;
    sheet.insertColumnBefore(insertColumn);
    sheet.getRange(1, insertColumn).setValue(name);
    sheet.getRange(1, insertColumn).setFontWeight('bold').setBackground('#D4550A').setFontColor('#FFFFFF');
    added.push(name);
  }

  addColumnAfter('start_time', 'end_date');
  addColumnAfter('end_time', 'start_time');

  return { ok: true, added: added };
}

function migrateCheckinBranchColumn() {
  const ss = SpreadsheetApp.openById(getProp('SHEET_ID'));
  const sheet = ss.getSheetByName(SHEETS.CHECKINS.name);
  if (!sheet) return { ok: false, error: 'checkins_sheet_missing' };

  const headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  if (headers.indexOf('branch_name') >= 0) return { ok: true, added: false };

  const afterIndex = headers.indexOf('approved_at');
  const insertColumn = afterIndex >= 0 ? afterIndex + 2 : sheet.getLastColumn() + 1;
  sheet.insertColumnBefore(insertColumn);
  sheet.getRange(1, insertColumn).setValue('branch_name');
  sheet.getRange(1, insertColumn).setFontWeight('bold').setBackground('#D4550A').setFontColor('#FFFFFF');

  return { ok: true, added: true, column: insertColumn };
}

function initializeConfigSheet() {
  const ss = SpreadsheetApp.openById(getProp('SHEET_ID'));
  const sheet = ss.getSheetByName('Config');
  if (!sheet) return;

  const existing = readConfigSheet();
  const rowsToAdd = [];

  Object.keys(DEFAULT_CONFIG).forEach(function(key) {
    if (!(key in existing)) {
      rowsToAdd.push([key, DEFAULT_CONFIG[key]]);
    }
  });

  if (rowsToAdd.length > 0) {
    const startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, rowsToAdd.length, 2).setValues(rowsToAdd);
  }
}

function setCompanyGeofenceKingKaew() {
  const values = {
    company_name: 'สำนักงานสุวรรณภูมิ - กิ่งแก้ว',
    geofence_lat: 13.690919359380588,
    geofence_lng: 100.7296330533856,
    geofence_radius_m: 50
  };

  updateConfigValues(values);
  return Object.assign({ ok: true }, values);
}

function setCompanyBranches() {
  const values = {
    branch_1_name: 'สาขากิ่งแก้ว',
    branch_1_lat: 13.690919359380588,
    branch_1_lng: 100.7296330533856,
    branch_1_radius_m: 50,
    branch_2_name: 'สาขาดอนเมือง',
    branch_2_lat: 13.934976,
    branch_2_lng: 100.611001,
    branch_2_radius_m: 50,
    branch_3_name: 'สาขาลาดพร้าว',
    branch_3_lat: 13.805039,
    branch_3_lng: 100.562180,
    branch_3_radius_m: 50
  };

  updateConfigValues(values);
  return Object.assign({ ok: true }, values);
}

function updateConfigValues(values) {
  const ss = SpreadsheetApp.openById(getProp('SHEET_ID'));
  const sheet = ss.getSheetByName('Config') || ss.insertSheet('Config');
  const lastRow = sheet.getLastRow();

  if (lastRow === 0) {
    sheet.getRange(1, 1, 1, 2).setValues([['key', 'value']]);
  }

  const data = sheet.getDataRange().getValues();
  const rowByKey = {};
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) rowByKey[data[i][0]] = i + 1;
  }

  Object.keys(values).forEach(function(key) {
    if (rowByKey[key]) {
      sheet.getRange(rowByKey[key], 2).setValue(values[key]);
    } else {
      sheet.appendRow([key, values[key]]);
    }
  });
}

