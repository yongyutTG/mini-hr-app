/**
 * ============================================================
 * Router — dispatch action to correct handler
 * ============================================================
 */

const ACTION_HANDLERS = {
  // Employee actions
  'register':       function(p) { return register(p); },
  'checkin_branches': function(p) { return getCheckinBranchOptions(); },
  'checkin':        function(p) { return checkin(p); },
  'leave':          function(p) { return submitLeave(p); },
  'cancel_leave':   function(p) { return cancelLeave(p); },
  'ot':             function(p) { return submitOT(p); },
  'balance':        function(p) { return getBalance(p); },
  'leave_history':  function(p) { return getEmployeeLeaveHistory(p); },
  'employee_profile': function(p) { return getEmployeeProfile(p); },
  'employee_profile_update': function(p) { return updateEmployeeProfile(p); },
  'user_context':   function(p) { return getUserContext(p); },
  'evidence':       function(p) { return submitEvidence(p); },

  // Approver actions
  'approval_list':  function(p) { return getApprovalInbox(p); },
  'approve_item':   function(p) { return processApproval(p); },

  // HR / Owner actions
  'hr_employees':   function(p) { return hrGetEmployees(p); },
  'hr_add_emp':     function(p) { return hrAddEmployee(p); },
  'hr_update_emp':  function(p) { return hrUpdateEmployee(p); },
  'hr_pay_items':   function(p) { return hrGetPayItems(p); },
  'hr_add_payitem': function(p) { return hrAddPayItem(p); },
  'hr_holidays':    function(p) { return hrGetHolidays(p); },
  'hr_add_holiday': function(p) { return hrAddHoliday(p); },
  'hr_leave_quotas': function(p) { return hrGetLeaveQuotas(p); },
  'hr_set_quota':   function(p) { return hrSetLeaveQuota(p); },
  'hr_report':      function(p) { return hrGetReport(p); },

  // Payment
  'close_period':   function(p) { return closePeriod(p); },
  'mark_paid':      function(p) { return markPaid(p); },
};

function routeAction(action, payload) {
  const handler = ACTION_HANDLERS[action];
  if (!handler) {
    logError('routeAction', 'unknown_action', { action });
    return jsonOutput({ ok: false, error: 'unknown_action', action: action });
  }

  try {
    const result = handler(payload);
    return jsonOutput(result);
  } catch (err) {
    logError('routeAction:' + action, err.message, { payload, stack: err.stack });
    return jsonOutput({ ok: false, error: 'handler_error', message: err.message });
  }
}

/**
 * Handle LINE webhook events (message, postback, follow, etc.)
 */
function handleLineWebhook(events) {
  for (const event of events) {
    try {
      processWebhookEvent(event);
    } catch (err) {
      logError('handleLineWebhook', err.message, { event });
    }
  }
  return jsonOutput({ ok: true });
}

function processWebhookEvent(event) {
  const type = event.type;
  const sourceUserId = event.source && event.source.userId;
  const replyToken = event.replyToken;

  logInfo('webhook', type, { userId: sourceUserId });

  if (type === 'follow') {
    // เพิ่งเพิ่มเพื่อน
    handleFollowEvent(sourceUserId, replyToken);
  } else if (type === 'postback') {
    // กดปุ่มใน Flex Card
    handlePostback(event.postback.data, sourceUserId, replyToken);
  } else if (type === 'message' && event.message.type === 'text') {
    // ข้อความ text
    handleTextMessage(event.message.text, sourceUserId, replyToken);
  }
  // ignore other event types
}

function handleFollowEvent(userId, replyToken) {
  replyMessage(replyToken, [{
    type: 'text',
    text: 'ยินดีต้อนรับสู่ Mini HR App!\n\nกดเมนูด้านล่างเพื่อเริ่มลงทะเบียน หรือใช้งานระบบ'
  }]);
}

function handlePostback(data, userId, replyToken) {
  // data รูปแบบ: "action=approve&id=LV-...&level=L1&type=leave"
  const params = parsePostbackData(data);

  if (params.action === 'approve' || params.action === 'reject' || params.action === 'need_info') {
    return processApprovalPostback({
      action: params.action,
      id: params.id,
      level: params.level,
      type: params.type,
      userId: userId,
      replyToken: replyToken
    });
  }

  replyMessage(replyToken, [{ type: 'text', text: 'คำสั่งไม่ถูกต้อง' }]);
}

function handleTextMessage(text, userId, replyToken) {
  // simple command examples
  const normalized = text.trim().toLowerCase();
  if (normalized === 'help' || normalized === 'menu' || normalized === 'เมนู') {
    replyMessage(replyToken, [{
      type: 'text',
      text: 'กดที่ Rich Menu ด้านล่างเพื่อใช้งานครับ'
    }]);
  }
  // ignore other text
}

function parsePostbackData(data) {
  const result = {};
  data.split('&').forEach(function(pair) {
    const idx = pair.indexOf('=');
    if (idx > 0) {
      result[pair.substring(0, idx)] = decodeURIComponent(pair.substring(idx + 1));
    }
  });
  return result;
}
