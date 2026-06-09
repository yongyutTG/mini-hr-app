/**
 * ============================================================
 * Leave Handler
 * ============================================================
 * Flow 5: ขอลา (sick / personal / vacation / unpaid / emergency)
 */

const LEAVE_TYPES = ['sick', 'personal', 'vacation', 'unpaid', 'emergency'];
const DURATION_TYPES = ['full_day', 'half_day_morning', 'half_day_afternoon', 'hourly'];

function submitLeave(payload) {
  const lineUserId = payload.lineUserId;
  const leaveType = payload.leaveType;
  const durationType = payload.durationType;
  const startDate = payload.startDate;
  const endDate = payload.endDate || payload.startDate;
  const totalHours = payload.totalHours ? Number(payload.totalHours) : null;
  const reason = (payload.reason || '').trim();
  const evidenceBase64 = payload.evidenceBase64;

  // === Validate ===
  if (!lineUserId) return { ok: false, error: 'missing_line_user_id' };
  if (LEAVE_TYPES.indexOf(leaveType) < 0) return { ok: false, error: 'invalid_leave_type' };
  if (DURATION_TYPES.indexOf(durationType) < 0) return { ok: false, error: 'invalid_duration_type' };
  if (!startDate) return { ok: false, error: 'missing_start_date' };
  if (!reason) return { ok: false, error: 'missing_reason' };

  const emp = findEmployeeByLineId(lineUserId);
  if (!emp) return { ok: false, error: 'not_registered' };

  if (!emp.approver_L1_id) {
    return { ok: false, error: 'no_approver_set', message: 'รอ HR กำหนดผู้อนุมัติให้คุณก่อน' };
  }

  // === Calculate total days ===
  let totalDays;
  if (durationType === 'full_day') {
    totalDays = countWorkingDays(startDate, endDate);
  } else if (durationType === 'half_day_morning' || durationType === 'half_day_afternoon') {
    totalDays = 0.5;
  } else if (durationType === 'hourly') {
    if (!totalHours || totalHours <= 0) return { ok: false, error: 'missing_hours' };
    totalDays = totalHours / 8; // assume 8-hour workday
  }

  // === Check quota ===
  if (leaveType !== 'unpaid' && leaveType !== 'emergency') {
    const year = new Date(startDate).getFullYear();
    const quota = getLeaveQuota(emp.employee_id, year);
    if (!quota) {
      initLeaveQuota(emp.employee_id, year);
    } else {
      const remaining = Number(quota[leaveType + '_quota'] || 0)
                      - Number(quota[leaveType + '_used'] || 0);
      if (totalDays > remaining) {
        return {
          ok: false,
          error: 'insufficient_quota',
          message: 'สิทธิ์ลา' + thaiLeaveType(leaveType) + 'เหลือ ' + remaining + ' วัน'
                 + ' แต่คุณขอลา ' + totalDays + ' วัน',
          remaining: remaining,
          requested: totalDays
        };
      }
    }
  }

  // === Lead time rules ===
  // personal leave: 3 days advance, emergency: any time, vacation: 7 days
  const today = new Date(todayBangkok());
  const start = new Date(startDate);
  const daysAhead = Math.floor((start - today) / (1000 * 60 * 60 * 24));

  if (leaveType === 'personal' && daysAhead < 3) {
    return { ok: false, error: 'personal_leave_lead_time', message: 'ลากิจต้องขอล่วงหน้าอย่างน้อย 3 วัน' };
  }
  if (leaveType === 'vacation' && daysAhead < 7) {
    return { ok: false, error: 'vacation_lead_time', message: 'ลาพักร้อนต้องขอล่วงหน้าอย่างน้อย 7 วัน' };
  }

  // === Upload evidence (optional) ===
  let evidenceUrl = '';
  if (evidenceBase64) {
    try {
      evidenceUrl = uploadImage(
        evidenceBase64,
        'leave_' + emp.employee_id + '_' + Date.now() + '.jpg',
        'evidence'
      );
    } catch (err) {
      logWarn('submitLeave:upload', err.message, { lineUserId });
    }
  }

  // === Insert row ===
  const leaveId = nextLeaveId();
  const newLeave = {
    leave_id: leaveId,
    employee_id: emp.employee_id,
    leave_type: leaveType,
    duration_type: durationType,
    start_date: startDate,
    end_date: endDate,
    total_days: totalDays,
    total_hours: totalHours || '',
    reason: reason,
    evidence_url: evidenceUrl,
    status: 'pending_L1',
    current_approver: emp.approver_L1_id,
    approval_history: '[]',
    submitted_at: nowBangkok()
  };

  insertLeave(newLeave);

  // === Notify L1 approver ===
  const approver = findEmployeeById(emp.approver_L1_id);
  if (approver) {
    pushFlex(approver.line_user_id, 'ใบลา: ' + emp.display_name, buildLeaveApprovalCard({
      leave: newLeave,
      employee: emp,
      level: 'L1'
    }));
  }

  // === Confirm to employee ===
  pushMessage(lineUserId, [{
    type: 'text',
    text: '📝 ส่งใบลาเรียบร้อย\n' +
          'รหัส: ' + leaveId + '\n' +
          'ประเภท: ' + thaiLeaveType(leaveType) + '\n' +
          'จำนวน: ' + totalDays + ' วัน\n' +
          'สถานะ: รอ ' + (approver ? approver.display_name : 'ผู้อนุมัติ') + ' อนุมัติ (L1)'
  }]);

  logUserAction('submitLeave', lineUserId, 'success', { leaveId, leaveType, totalDays });
  return { ok: true, leaveId: leaveId, status: 'pending_L1' };
}

function thaiLeaveType(type) {
  const map = {
    sick: 'ป่วย',
    personal: 'กิจ',
    vacation: 'พักร้อน',
    unpaid: 'ไม่รับเงิน',
    emergency: 'ฉุกเฉิน'
  };
  return map[type] || type;
}
