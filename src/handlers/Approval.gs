/**
 * ============================================================
 * Approval Handler — Multi-level state machine
 * ============================================================
 * Flow 7: L1 only
 * Actions: approve / approve_conditional / reject / need_info
 *
 * State transitions:
 *   pending_L1 -[approve]→ approved
 *   pending_*  -[reject]→ rejected
 *   pending_*  -[need_info]→ need_info (waiting employee response)
 */

function processApprovalPostback(payload) {
  const action = payload.action;       // approve / reject / need_info
  const recordId = payload.id;          // LV-... or OT-...
  const level = payload.level;          // L1 / L2 / L3
  const type = payload.type || (recordId.indexOf('LV-') === 0 ? 'leave' : 'ot');
  const userId = payload.userId;
  const replyToken = payload.replyToken;

  // === Verify approver ===
  const approver = findEmployeeByLineId(userId);
  if (!approver) {
    if (replyToken) replyMessage(replyToken, [{ type: 'text', text: 'ไม่พบข้อมูลผู้อนุมัติในระบบ' }]);
    return { ok: false, error: 'approver_not_found' };
  }

  // === Get record ===
  const record = (type === 'leave') ? findLeaveById(recordId) : findOTById(recordId);
  if (!record) {
    if (replyToken) replyMessage(replyToken, [{ type: 'text', text: 'ไม่พบรหัส ' + recordId }]);
    return { ok: false, error: 'record_not_found' };
  }

  // === Verify current approver ===
  const approvalAdmin = isHrAdmin(userId);
  if (record.current_approver !== approver.employee_id && !approvalAdmin) {
    if (replyToken) replyMessage(replyToken, [{
      type: 'text',
      text: '❌ คุณไม่ใช่ผู้อนุมัติของคำขอนี้ในขั้นนี้'
    }]);
    return { ok: false, error: 'not_current_approver' };
  }

  // === Verify status ===
  const expectedStatus = 'pending_' + level;
  if (record.status !== expectedStatus) {
    if (replyToken) replyMessage(replyToken, [{
      type: 'text',
      text: '⚠️ คำขอนี้สถานะเปลี่ยนไปแล้ว (' + record.status + ')'
    }]);
    return { ok: false, error: 'wrong_status', currentStatus: record.status };
  }

  // === Process action ===
  if (action === 'approve') {
    return doApprove(record, type, level, approver, replyToken, approvalAdmin);
  } else if (action === 'reject') {
    return doReject(record, type, level, approver, replyToken, approvalAdmin);
  } else if (action === 'need_info') {
    return doNeedInfo(record, type, level, approver, replyToken, approvalAdmin);
  }

  return { ok: false, error: 'unknown_action' };
}

function doApprove(record, type, level, approver, replyToken, approvalAdmin) {
  // Append to history
  const history = parseHistory(record.approval_history);
  history.push({
    level: level,
    by: approver.employee_id,
    by_name: approver.display_name,
    action: 'approve',
    override: Boolean(approvalAdmin && record.current_approver !== approver.employee_id),
    at: nowBangkok()
  });

  // Find employee
  const employee = findEmployeeById(record.employee_id);

  const sheetName = (type === 'leave') ? SHEETS.LEAVES.name : SHEETS.OT.name;
  const idField = (type === 'leave') ? 'leave_id' : 'ot_id';

  finalizeApproval(record, type, employee, history, sheetName, idField);
  if (replyToken) replyMessage(replyToken, [{
    type: 'text',
    text: '✅ อนุมัติเรียบร้อย\n' + record[idField]
  }]);

  logUserAction('doApprove', approver.line_user_id, 'success', {
    recordId: record[idField], level, type
  });
  return { ok: true };
}

function finalizeApproval(record, type, employee, history, sheetName, idField) {
  updateRowByNumber(sheetName, record._row, {
    status: 'approved',
    current_approver: '',
    approval_history: JSON.stringify(history)
  });

  // If leave: deduct quota
  if (type === 'leave' && record.leave_type !== 'unpaid' && record.leave_type !== 'emergency') {
    try {
      deductLeaveQuota(record);
    } catch (err) {
      logError('finalizeApproval:deductQuota', err.message);
    }
  }

  // Notify employee
  const typeLabel = type === 'leave' ? 'ใบลา' : 'OT';
  pushMessage(employee.line_user_id, [{
    type: 'text',
    text: '🎉 คำขอ' + typeLabel + ' ' + record[idField] + ' ได้รับอนุมัติแล้ว!'
  }]);
}

function doReject(record, type, level, approver, replyToken, approvalAdmin) {
  const history = parseHistory(record.approval_history);
  history.push({
    level: level,
    by: approver.employee_id,
    by_name: approver.display_name,
    action: 'reject',
    override: Boolean(approvalAdmin && record.current_approver !== approver.employee_id),
    at: nowBangkok()
  });

  const sheetName = (type === 'leave') ? SHEETS.LEAVES.name : SHEETS.OT.name;
  const idField = (type === 'leave') ? 'leave_id' : 'ot_id';

  updateRowByNumber(sheetName, record._row, {
    status: 'rejected',
    current_approver: '',
    approval_history: JSON.stringify(history)
  });

  const employee = findEmployeeById(record.employee_id);
  const typeLabel = type === 'leave' ? 'ใบลา' : 'OT';
  pushMessage(employee.line_user_id, [{
    type: 'text',
    text: '❌ คำขอ' + typeLabel + ' ' + record[idField] + ' ถูกปฏิเสธในขั้น ' + level
  }]);

  if (replyToken) replyMessage(replyToken, [{ type: 'text', text: 'บันทึกการปฏิเสธแล้ว' }]);

  logUserAction('doReject', approver.line_user_id, 'success', { recordId: record[idField] });
  return { ok: true };
}

function doNeedInfo(record, type, level, approver, replyToken, approvalAdmin) {
  const history = parseHistory(record.approval_history);
  history.push({
    level: level,
    by: approver.employee_id,
    by_name: approver.display_name,
    action: 'need_info',
    override: Boolean(approvalAdmin && record.current_approver !== approver.employee_id),
    at: nowBangkok()
  });

  const sheetName = (type === 'leave') ? SHEETS.LEAVES.name : SHEETS.OT.name;
  const idField = (type === 'leave') ? 'leave_id' : 'ot_id';

  updateRowByNumber(sheetName, record._row, {
    status: 'need_info',
    approval_history: JSON.stringify(history)
  });

  // Send LIFF link to employee
  const evidenceLiff = getProp('LIFF_ID_EVIDENCE');
  const liffUrl = 'https://liff.line.me/' + evidenceLiff + '?id=' + record[idField] + '&type=' + type;

  const employee = findEmployeeById(record.employee_id);
  pushMessage(employee.line_user_id, [{
    type: 'text',
    text: 'ℹ️ ผู้อนุมัติขอข้อมูลเพิ่มเติมสำหรับคำขอ ' + record[idField] +
          '\n\nกรุณาคลิกลิงก์เพื่อแนบหลักฐาน:\n' + liffUrl
  }]);

  if (replyToken) replyMessage(replyToken, [{
    type: 'text',
    text: 'ส่งคำขอข้อมูลเพิ่มถึงพนักงานแล้ว'
  }]);

  logUserAction('doNeedInfo', approver.line_user_id, 'success', { recordId: record[idField] });
  return { ok: true };
}

function parseHistory(historyStr) {
  if (!historyStr) return [];
  try {
    return JSON.parse(historyStr);
  } catch (err) {
    return [];
  }
}

/**
 * Get approval inbox for current user
 */
function getApprovalInbox(payload) {
  const lineUserId = payload.lineUserId;
  const approver = findEmployeeByLineId(lineUserId);
  if (!approver) return { ok: false, error: 'not_registered' };

  const approvalAdmin = isHrAdmin(lineUserId);

  const pendingLeaves = filterRows(SHEETS.LEAVES.name, function(r) {
    return String(r.status).indexOf('pending_') === 0
      && (approvalAdmin || r.current_approver === approver.employee_id);
  });

  const pendingOT = filterRows(SHEETS.OT.name, function(r) {
    return String(r.status).indexOf('pending_') === 0
      && (approvalAdmin || r.current_approver === approver.employee_id);
  });

  return {
    ok: true,
    leaves: pendingLeaves,
    ot: pendingOT,
    count: pendingLeaves.length + pendingOT.length,
    approvalAdmin: approvalAdmin
  };
}

/**
 * Process approval from LIFF (instead of postback)
 */
function processApproval(payload) {
  return processApprovalPostback({
    action: payload.actionType,
    id: payload.id,
    level: payload.level,
    type: payload.type,
    userId: payload.lineUserId,
    replyToken: null
  });
}
