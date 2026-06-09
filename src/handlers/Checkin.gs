/**
 * ============================================================
 * Checkin Handler
 * ============================================================
 * Flow 2-3: ลงเวลา 4 slot/day
 *   IN = เข้างาน
 *   LUNCH_OUT = ออกพักเที่ยง
 *   LUNCH_IN = กลับจากพักเที่ยง
 *   OUT = เลิกงาน
 */

const SLOTS = ['IN', 'LUNCH_OUT', 'LUNCH_IN', 'OUT'];

function checkin(payload) {
  const lineUserId = payload.lineUserId;
  const lat = Number(payload.lat);
  const lng = Number(payload.lng);
  const selfieBase64 = payload.selfieBase64;
  const slot = payload.slot || autoDetectSlot();

  // === Validate ===
  if (!lineUserId) return { ok: false, error: 'missing_line_user_id' };
  if (isNaN(lat) || isNaN(lng)) return { ok: false, error: 'missing_gps' };
  if (!selfieBase64) return { ok: false, error: 'missing_selfie' };
  if (SLOTS.indexOf(slot) < 0) return { ok: false, error: 'invalid_slot' };

  // === Find employee ===
  const emp = findEmployeeByLineId(lineUserId);
  if (!emp) return { ok: false, error: 'not_registered' };

  const isActive = emp.is_active === true || emp.is_active === 'TRUE' || emp.is_active === 'true';
  if (!isActive) return { ok: false, error: 'inactive_employee' };

  // === GPS check ===
  const config = getConfig();
  const distance = haversineMeters(lat, lng, config.geofence_lat, config.geofence_lng);
  const inRange = distance <= config.geofence_radius_m;

  // === Slot timing validation ===
  const slotErr = validateSlotTiming(slot, config);
  if (slotErr) {
    return { ok: false, error: slotErr };
  }

  // === Dedupe ===
  const today = todayBangkok();
  const existing = findCheckin(emp.employee_id, today, slot);
  if (existing) {
    return {
      ok: true,
      duplicated: true,
      checkinId: existing.checkin_id,
      message: 'คุณเช็คอินช่วงนี้ของวันนี้แล้ว'
    };
  }

  // === Upload selfie ===
  let selfieUrl;
  try {
    selfieUrl = uploadImage(
      selfieBase64,
      'chk_' + emp.employee_id + '_' + today + '_' + slot + '.jpg',
      'daily-photos'
    );
  } catch (err) {
    logError('checkin:upload', err.message, { lineUserId, slot });
    return { ok: false, error: 'upload_failed' };
  }

  // === Insert row ===
  const checkinId = nextCheckinId(today);
  const status = inRange ? 'approved' : 'out_of_range';

  const newRow = {
    checkin_id: checkinId,
    employee_id: emp.employee_id,
    checkin_date: today,
    slot: slot,
    checkin_at: nowBangkok(),
    lat: lat,
    lng: lng,
    distance_m: Math.round(distance),
    selfie_url: selfieUrl,
    status: status,
    approved_by: inRange ? 'system' : '',
    approved_at: inRange ? nowBangkok() : ''
  };

  try {
    insertCheckin(newRow);
  } catch (err) {
    logError('checkin:insert', err.message, { lineUserId });
    return { ok: false, error: 'insert_failed' };
  }

  // === Notify owner if out of range ===
  if (!inRange) {
    pushFlexToOwner(
      'นอกรัศมี: ' + emp.display_name,
      buildCheckinNotifyCard({
        employee: emp,
        slot: slot,
        distance: Math.round(distance),
        selfieUrl: selfieUrl,
        time: nowBangkok(),
        outOfRange: true
      })
    );
  }

  logUserAction('checkin', lineUserId, 'success', { slot, inRange, distance });
  return {
    ok: true,
    checkinId: checkinId,
    inRange: inRange,
    distance: Math.round(distance),
    radiusLimit: config.geofence_radius_m,
    selfieUrl: selfieUrl
  };
}

/**
 * Auto-detect slot based on current time
 */
function autoDetectSlot() {
  const config = getConfig();
  const now = minutesNow();
  const workStart = parseHHMM(config.work_start);
  const lunchStart = parseHHMM(config.lunch_start);
  const lunchEnd = parseHHMM(config.lunch_end);
  const workEnd = parseHHMM(config.work_end);

  if (now < lunchStart) return 'IN';
  if (now < lunchEnd) return 'LUNCH_OUT';
  if (now < workEnd) return 'LUNCH_IN';
  return 'OUT';
}

/**
 * Validate slot timing
 * TODO: refine per company policy
 */
function validateSlotTiming(slot, config) {
  // Allow flexible — just warn if outside normal window
  // Return null = OK, string = error
  return null;
}

/**
 * Get today's checkins for an employee
 */
function getTodayCheckins(employeeId) {
  const today = todayBangkok();
  return filterRows(SHEETS.CHECKINS.name, function(r) {
    return r.employee_id === employeeId
      && formatDate(new Date(r.checkin_date)) === today;
  });
}

/**
 * Has any approved checkin today?
 */
function hasCheckedInToday(employeeId) {
  const checkins = getTodayCheckins(employeeId);
  return checkins.some(function(c) { return c.status === 'approved'; });
}

/**
 * Has checked out for the day?
 */
function hasCheckedOut(employeeId) {
  const checkins = getTodayCheckins(employeeId);
  return checkins.some(function(c) {
    return c.slot === 'OUT' && c.status === 'approved';
  });
}
