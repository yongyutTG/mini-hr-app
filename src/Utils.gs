/**
 * ============================================================
 * Utils — Common helpers (time, IDs, distance, etc.)
 * ============================================================
 */

const TZ = 'Asia/Bangkok';

/**
 * Current datetime in Bangkok timezone, ISO 8601 with offset
 */
function nowBangkok() {
  return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

function todayBangkok() {
  return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd");
}

function timeBangkok() {
  return Utilities.formatDate(new Date(), TZ, "HH:mm:ss");
}

function formatDate(d) {
  return Utilities.formatDate(d, TZ, "yyyy-MM-dd");
}

function formatDateTime(d) {
  return Utilities.formatDate(d, TZ, "yyyy-MM-dd HH:mm:ss");
}

function formatThaiDate(d) {
  // วันที่ภาษาไทย พ.ศ.
  if (!(d instanceof Date)) d = new Date(d);
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
                  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const day = d.getDate();
  const month = months[d.getMonth()];
  const year = d.getFullYear() + 543;
  return day + ' ' + month + ' ' + year;
}

/**
 * Haversine distance — meters
 */
function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371e3; // Earth radius in meters
  const toRad = function(deg) { return deg * Math.PI / 180; };
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lng2 - lng1);
  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * ID generators — atomic via Sheet last row
 */
function nextEmployeeId() {
  const sheet = getSheet(SHEETS.EMPLOYEES.name);
  const lastRow = sheet.getLastRow();
  // count actual rows excluding header
  const count = lastRow > 1 ? lastRow - 1 : 0;
  return 'EMP-' + padLeft(count + 1, 4);
}

function nextCheckinId(dateStr) {
  // dateStr = "2026-05-12"
  const dateCompact = dateStr.replace(/-/g, '');
  const sheet = getSheet(SHEETS.CHECKINS.name);
  const data = sheet.getDataRange().getValues();
  let count = 0;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] && String(data[i][0]).indexOf('CHK-' + dateCompact) === 0) {
      count++;
    }
  }
  return 'CHK-' + dateCompact + '-' + padLeft(count + 1, 4);
}

function nextLeaveId() {
  const today = todayBangkok().replace(/-/g, '');
  const sheet = getSheet(SHEETS.LEAVES.name);
  const data = sheet.getDataRange().getValues();
  let count = 0;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] && String(data[i][0]).indexOf('LV-' + today) === 0) {
      count++;
    }
  }
  return 'LV-' + today + '-' + padLeft(count + 1, 4);
}

function nextOTId() {
  const today = todayBangkok().replace(/-/g, '');
  const sheet = getSheet(SHEETS.OT.name);
  const data = sheet.getDataRange().getValues();
  let count = 0;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] && String(data[i][0]).indexOf('OT-' + today) === 0) {
      count++;
    }
  }
  return 'OT-' + today + '-' + padLeft(count + 1, 4);
}

function nextPaymentId(period) {
  // period = "2026-05"
  const compact = period.replace(/-/g, '');
  const sheet = getSheet(SHEETS.PAYMENTS.name);
  const data = sheet.getDataRange().getValues();
  let count = 0;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] && String(data[i][0]).indexOf('PAY-' + compact) === 0) {
      count++;
    }
  }
  return 'PAY-' + compact + '-' + padLeft(count + 1, 4);
}

function padLeft(num, len) {
  let s = String(num);
  while (s.length < len) s = '0' + s;
  return s;
}

/**
 * Time helpers
 */
function parseHHMM(str) {
  // "09:30" → minutes since midnight
  const parts = str.split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

function minutesNow() {
  const now = new Date();
  const bkk = Utilities.formatDate(now, TZ, "HH:mm");
  return parseHHMM(bkk);
}

function diffMinutes(t1, t2) {
  // t1, t2 = "HH:mm"
  return parseHHMM(t2) - parseHHMM(t1);
}

/**
 * String helpers
 */
function safe(value, defaultValue) {
  return value === null || value === undefined ? (defaultValue || '') : value;
}

function isEmpty(value) {
  return value === null || value === undefined || value === '';
}

/**
 * Check if today is a holiday
 */
function isHoliday(dateStr) {
  // dateStr = "2026-05-12"
  const sheet = getSheet(SHEETS.HOLIDAYS.name);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const rowDate = data[i][0];
    if (rowDate && formatDate(new Date(rowDate)) === dateStr) {
      return { isHoliday: true, name: data[i][1], type: data[i][2] };
    }
  }
  return { isHoliday: false };
}

/**
 * Check if today is a working day (weekday + not holiday)
 */
function isWorkingDay(dateStr) {
  const date = new Date(dateStr);
  const dow = date.getDay(); // 0=Sun, 6=Sat
  if (dow === 0 || dow === 6) return false;
  return !isHoliday(dateStr).isHoliday;
}

/**
 * Count working days between dates (inclusive)
 */
function countWorkingDays(startDate, endDate) {
  let count = 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (isWorkingDay(formatDate(d))) count++;
  }
  return count;
}
