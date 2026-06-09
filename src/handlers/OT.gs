/**
 * ============================================================
 * OT Handler
 * ============================================================
 * Flow 6: ขอ OT
 */

function submitOT(payload) {
  const lineUserId = payload.lineUserId;
  const otDate = payload.otDate;
  const startTime = payload.startTime; // "18:00"
  const endTime = payload.endTime;     // "21:00"
  const reason = (payload.reason || '').trim();

  // === Validate ===
  if (!lineUserId) return { ok: false, error: 'missing_line_user_id' };
  if (!otDate) return { ok: false, error: 'missing_date' };
  if (!startTime || !endTime) return { ok: false, error: 'missing_time' };
  if (!reason) return { ok: false, error: 'missing_reason' };

  const emp = findEmployeeByLineId(lineUserId);
  if (!emp) return { ok: false, error: 'not_registered' };

  if (!emp.approver_L1_id) {
    return { ok: false, error: 'no_approver_set' };
  }

  // === Calculate hours ===
  const startMin = parseHHMM(startTime);
  const endMin = parseHHMM(endTime);
  if (endMin <= startMin) {
    return { ok: false, error: 'invalid_time_range', message: 'เวลาสิ้นสุดต้องหลังเวลาเริ่ม' };
  }
  const totalHours = (endMin - startMin) / 60;

  // === Lead time check ===
  // OT request must be at least N min before work_end if same day
  const config = getConfig();
  const today = todayBangkok();
  if (otDate === today) {
    const workEnd = parseHHMM(config.work_end);
    const nowMin = minutesNow();
    const leadRequired = config.ot_request_lead_min || 30;
    if (nowMin > workEnd - leadRequired) {
      return {
        ok: false,
        error: 'ot_lead_time',
        message: 'การขอ OT ต้องส่งก่อนเลิกงานอย่างน้อย ' + leadRequired + ' นาที'
      };
    }
  }

  // === Insert row ===
  const otId = nextOTId();
  const newOT = {
    ot_id: otId,
    employee_id: emp.employee_id,
    ot_date: otDate,
    start_time: startTime,
    end_time: endTime,
    total_hours: totalHours,
    reason: reason,
    status: 'pending_L1',
    current_approver: emp.approver_L1_id,
    approval_history: '[]',
    submitted_at: nowBangkok()
  };

  insertOT(newOT);

  // === Notify L1 ===
  const approver = findEmployeeById(emp.approver_L1_id);
  if (approver) {
    pushFlex(approver.line_user_id, 'ขอ OT: ' + emp.display_name, buildOTApprovalCard({
      ot: newOT,
      employee: emp,
      level: 'L1'
    }));
  }

  pushMessage(lineUserId, [{
    type: 'text',
    text: '⏱️ ส่งคำขอ OT เรียบร้อย\n' +
          'รหัส: ' + otId + '\n' +
          'วัน: ' + otDate + ' เวลา ' + startTime + '-' + endTime + '\n' +
          'รวม: ' + totalHours + ' ชั่วโมง\n' +
          'สถานะ: รอ ' + (approver ? approver.display_name : 'ผู้อนุมัติ') + ' อนุมัติ'
  }]);

  logUserAction('submitOT', lineUserId, 'success', { otId, totalHours });
  return { ok: true, otId: otId };
}
