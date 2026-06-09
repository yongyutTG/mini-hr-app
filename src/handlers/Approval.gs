/**
 * ============================================================
 * Approval Handler — Multi-level state machine
 * ============================================================
 * Flow 7: L1 → L2 → L3
 * Actions: approve / approve_conditional / reject / need_info
 *
 * State transitions:
 *   pending_L1 -[approve]→ pending_L2 (if L2 exists) | approved
 *   pending_L2 -[approve]→ pending_L3 (if L3 exists) | approved
 *   pending_L3 -[approve]→ approved
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
  if (record.current_approver !== approver.employee_id) {
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
    return doApprove(record, type, level, approver, replyToken);
  } else if (action === 'reject') {
    return doReject(record, type, level, approver, replyToken);
  } else if (action === 'need_info') {
    return doNeedInfo(record, type, level, approver, replyToken);
  }

  return { ok: false, error: 'unknown_action' };
}

function doApprove(record, type, level, approver, replyToken) {
  // Append to history
  const history = parseHistory(record.approval_history);
  history.push({
    level: level,
    by: approver.employee_id,
    by_name: approver.display_name,
    action: 'approve',
    at: nowBangkok()
  });

  // Find employee
  const employee = findEmployeeById(record.employee_id);

  // Determine next level
  const config = getConfig();
  const nextLevel = getNextLevel(level, employee, config);

  const sheetName = (type === 'leave') ? SHEETS.LEAVES.name : SHEETS.OT.name;
  const idField = (type === 'leave') ? 'leave_id' : 'ot_id';

  if (nextLevel) {
    // Forward to next level
    const nextApprover = findEmployeeById(employee['approver_' + nextLevel + '_id']);
    if (!nextApprover) {
      logWarn('doApprove', 'next_approver_missing', { recordId: record[idField], nextLevel });
      // Fallback: final approve
      finalizeApproval(record, type, employee, history, sheetName, idField);
    } else {
      updateRowByNumber(sheetName, record._row, {
        status: 'pending_' + nextLevel,
        current_approver: nextApprover.employee_id,
        approval_history: JSON.stringify(history)
      });

      // Notify next approver
      if (type === 'leave') {
        pushFlex(nextApprover.line_user_id, 'ใบลา: ' + employee.display_name, buildLeaveApprovalCard({
          leave: record,
          employee: employee,
          level: nextLevel
        }));
      } else {
        pushFlex(nextApprover.line_user_id, 'ขอ OT: ' + employee.display_name, buildOTApprovalCard({
          ot: record,
          employee: employee,
          level: nextLevel
        }));
      }

      if (replyToken) replyMessage(replyToken, [{
        type: 'text',
        text: '✅ อนุมัติแล้ว (ขั้น ' + level + ')\nส่งต่อ ' + nextApprover.display_name + ' (' + nextLevel + ')'
      }]);
    }
  } else {
    // Final approval
    finalizeApproval(record, type, employee, history, sheetName, idField);
    if (replyToken) replyMessage(replyToken, [{
      type: 'text',
      text: '✅ อนุมัติเรียบร้อย\n' + record[idField] + ' (' + level + ' = final)'
    }]);
  }

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

function doReject(record, type, level, approver, replyToken) {
  const history = parseHistory(record.approval_history);
  history.push({
    level: level,
    by: approver.employee_id,
    by_name: approver.display_name,
    action: 'reject',
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

function doNeedInfo(record, type, level, approver, replyToken) {
  const history = parseHistory(record.approval_history);
  history.push({
    level: level,
    by: approver.employee_id,
    by_name: approver.display_name,
    action: 'need_info',
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

function getNextLevel(currentLevel, employee, config) {
  if (currentLevel === 'L1') {
    if (config.enable_approval_L2 && employee.approver_L2_id) return 'L2';
    if (config.enable_approval_L3 && employee.approver_L3_id) return 'L3';
    return null;
  }
  if (currentLevel === 'L2') {
    if (config.enable_approval_L3 && employee.approver_L3_id) return 'L3';
    return null;
  }
  return null;
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

  // Find all leaves + OTs where current_approver = me
  const pendingLeaves = filterRows(SHEETS.LEAVES.name, function(r) {
    return r.current_approver === approver.employee_id
      && String(r.status).indexOf('pending_') === 0;
  });

  const pendingOT = filterRows(SHEETS.OT.name, function(r) {
    return r.current_approver === approver.employee_id
      && String(r.status).indexOf('pending_') === 0;
  });

  return {
    ok: true,
    leaves: pendingLeaves,
    ot: pendingOT,
    count: pendingLeaves.length + pendingOT.length
  };
}

/**
 * Process approval from LIFF (instead of postback)
 */
function processApproval(payload) {
  return processApprovalPostback({
    action: payload.action,
    id: payload.id,
    level: payload.level,
    type: payload.type,
    userId: payload.lineUserId,
    replyToken: null
  });
}
