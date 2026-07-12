/**
 * ============================================================
 * Balance Handler — Flow 8
 * ============================================================
 */

function getBalance(payload) {
  const lineUserId = payload.lineUserId;
  const emp = findEmployeeByLineId(lineUserId);
  if (!emp) return { ok: false, error: 'not_registered' };

  const period = payload.period || currentPeriod();
  const year = parseInt(period.split('-')[0], 10);

  // === Work days this period ===
  const workDays = countApprovedWorkDays(emp.employee_id, period);

  // === OT hours this period ===
  const otHours = sumApprovedOT(emp.employee_id, period);

  // === Pay calculation (estimate) ===
  const dailyRate = Number(emp.base_pay_monthly || 0) / 22; // 22 working days/month
  const config = getConfig();
  const otRate = Number(emp.ot_rate_per_hour || 0);
  const basePay = workDays * dailyRate;
  const otPay = otHours * otRate * config.ot_rate_multiplier;

  // === Bonus/deduction ===
  const bonus = sumPayItems(emp.employee_id, period, 'bonus');
  const deduction = sumPayItems(emp.employee_id, period, 'deduction');

  const estimateTotal = basePay + otPay + bonus - deduction;

  // === Leave quota remaining ===
  const quota = getLeaveQuota(emp.employee_id, year) || {};
  const leaveBalance = {
    sick: {
      quota: Number(quota.sick_quota || 0),
      used: Number(quota.sick_used || 0),
      remaining: Number(quota.sick_quota || 0) - Number(quota.sick_used || 0)
    },
    personal: {
      quota: Number(quota.personal_quota || 0),
      used: Number(quota.personal_used || 0),
      remaining: Number(quota.personal_quota || 0) - Number(quota.personal_used || 0)
    },
    vacation: {
      quota: Number(quota.vacation_quota || 0),
      used: Number(quota.vacation_used || 0),
      remaining: Number(quota.vacation_quota || 0) - Number(quota.vacation_used || 0)
    }
  };

  // === Last paid period ===
  const lastPayment = findLastPayment(emp.employee_id);
  const leaveHistory = getEmployeeLeaveHistoryRows(emp.employee_id, 20, period);

  // === Pending counts ===
  const pendingLeaves = filterRows(SHEETS.LEAVES.name, function(r) {
    return r.employee_id === emp.employee_id
      && String(r.status).indexOf('pending') === 0;
  }).length;

  const pendingOT = filterRows(SHEETS.OT.name, function(r) {
    return r.employee_id === emp.employee_id
      && String(r.status).indexOf('pending') === 0;
  }).length;

  return {
    ok: true,
    employee: {
      id: emp.employee_id,
      name: emp.display_name,
      department: emp.department,
      position: emp.position
    },
    period: period,
    workDays: workDays,
    otHours: otHours,
    basePay: Math.round(basePay),
    otPay: Math.round(otPay),
    bonus: bonus,
    deduction: deduction,
    estimateTotal: Math.round(estimateTotal),
    leaveBalance: leaveBalance,
    leaveHistory: leaveHistory,
    pending: { leaves: pendingLeaves, ot: pendingOT },
    lastPayment: lastPayment ? {
      period: lastPayment.period,
      total: lastPayment.total_amount,
      status: lastPayment.status
    } : null
  };
}

function getEmployeeLeaveHistory(payload) {
  const lineUserId = payload.lineUserId;
  const emp = findEmployeeByLineId(lineUserId);
  if (!emp) return { ok: false, error: 'not_registered' };

  return {
    ok: true,
    employee: {
      id: emp.employee_id,
      name: emp.display_name
    },
    period: payload.period || '',
    leaves: getEmployeeLeaveHistoryRows(emp.employee_id, Number(payload.limit || 50), payload.period || '')
  };
}

function getEmployeeLeaveHistoryRows(employeeId, limit, period) {
  limit = Math.max(1, Math.min(Number(limit || 20), 100));
  const normalizedPeriod = normalizePeriodString(period);

  const rows = filterRows(SHEETS.LEAVES.name, function(r) {
    return r.employee_id === employeeId
      && (!normalizedPeriod || leaveRowMatchesPeriod(r, normalizedPeriod));
  });

  rows.sort(function(a, b) {
    return String(b.submitted_at || b.start_date || '').localeCompare(String(a.submitted_at || a.start_date || ''));
  });

  return rows.slice(0, limit).map(function(r) {
    return {
      leave_id: r.leave_id,
      leave_type: r.leave_type,
      duration_type: r.duration_type,
      start_date: sheetDateString(r.start_date),
      end_date: sheetDateString(r.end_date),
      start_time: r.start_time || '',
      end_time: r.end_time || '',
      total_days: Number(r.total_days || 0),
      total_hours: r.total_hours || '',
      reason: r.reason || '',
      status: r.status || '',
      can_cancel: String(r.status).indexOf('pending') === 0,
      submitted_at: sheetDateTimeString(r.submitted_at)
    };
  });
}

function normalizePeriodString(period) {
  if (!period) return '';
  const raw = String(period).trim();
  const match = raw.match(/^(\d{4})-(\d{1,2})/);
  if (!match) return '';
  return match[1] + '-' + ('0' + match[2]).slice(-2);
}

function leaveRowMatchesPeriod(row, period) {
  const monthStart = period + '-01';
  const monthEnd = periodMonthEndString(period);
  const start = sheetDateString(row.start_date);
  const end = sheetDateString(row.end_date) || start;
  if (!start) return false;
  return start <= monthEnd && end >= monthStart;
}

function periodMonthEndString(period) {
  const parts = period.split('-');
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  return formatDate(new Date(year, month, 0));
}

function getEmployeeProfile(payload) {
  const lineUserId = payload.lineUserId;
  if (!lineUserId) return { ok: false, error: 'missing_line_user_id' };

  const emp = findEmployeeByLineId(lineUserId);
  if (!emp) return { ok: false, error: 'not_registered' };

  const approver = emp.approver_L1_id ? findEmployeeById(emp.approver_L1_id) : null;
  const context = getUserContext(payload);
  const config = getConfig();

  return {
    ok: true,
    employee: {
      id: emp.employee_id,
      name: emp.display_name,
      phone: emp.phone || '',
      email: emp.email || '',
      department: emp.department || '',
      position: emp.position || '',
      bankName: emp.bank_name || '',
      bankAccountNo: emp.bank_account_no || '',
      bankAccountName: emp.bank_account_name || '',
      role: normalizeRole(emp.role),
      startDate: sheetDateString(emp.start_date),
      isActive: emp.is_active === true || emp.is_active === 'TRUE' || emp.is_active === 'true',
      registeredAt: sheetDateTimeString(emp.registered_at)
    },
    line: {
      linked: Boolean(emp.line_user_id),
      userIdTail: emp.line_user_id ? String(emp.line_user_id).slice(-6) : ''
    },
    approver: approver ? {
      id: approver.employee_id,
      name: approver.display_name,
      department: approver.department || '',
      position: approver.position || ''
    } : {
      id: emp.approver_L1_id || '',
      name: ''
    },
    roles: context.roles || [],
    permissions: Object.assign({}, context.permissions || {}, {
      canEditProfile: true,
      canEditBank: config.allow_employee_bank_edit !== false
    })
  };
}

function updateEmployeeProfile(payload) {
  const lineUserId = payload.lineUserId;
  if (!lineUserId) return { ok: false, error: 'missing_line_user_id' };

  const emp = findEmployeeByLineId(lineUserId);
  if (!emp) return { ok: false, error: 'not_registered' };

  const config = getConfig();
  const bankEditAllowed = config.allow_employee_bank_edit !== false;
  const hasBankUpdates = payload.bankName !== undefined
    || payload.bankAccountNo !== undefined
    || payload.bankAccountName !== undefined;
  if (!bankEditAllowed && hasBankUpdates) {
    return { ok: false, error: 'bank_edit_disabled', message: 'บริษัทไม่ได้เปิดให้พนักงานแก้ไขบัญชีธนาคารเอง' };
  }

  const updates = {};
  if (payload.phone !== undefined) updates.phone = cleanProfileText(payload.phone, 30);
  if (payload.email !== undefined) updates.email = cleanProfileText(payload.email, 120);
  if (payload.bankName !== undefined) updates.bank_name = cleanProfileText(payload.bankName, 80);
  if (payload.bankAccountNo !== undefined) updates.bank_account_no = cleanProfileText(payload.bankAccountNo, 60);
  if (payload.bankAccountName !== undefined) updates.bank_account_name = cleanProfileText(payload.bankAccountName, 120);

  if (updates.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updates.email)) {
    return { ok: false, error: 'invalid_email', message: 'รูปแบบอีเมลไม่ถูกต้อง' };
  }
  if (updates.phone && !/^[0-9+\-\s()]{8,30}$/.test(updates.phone)) {
    return { ok: false, error: 'invalid_phone', message: 'รูปแบบเบอร์โทรไม่ถูกต้อง' };
  }

  const ok = updateRow(SHEETS.EMPLOYEES.name, function(r) {
    return r.employee_id === emp.employee_id && r.line_user_id === lineUserId;
  }, updates);
  if (!ok) return { ok: false, error: 'employee_not_found' };

  logUserAction('employee_profile_update', lineUserId, 'success', {
    employeeId: emp.employee_id,
    fields: Object.keys(updates)
  });

  return { ok: true, employee: Object.assign({}, emp, updates) };
}

function cleanProfileText(value, maxLength) {
  value = String(value === null || value === undefined ? '' : value).trim();
  if (value.length > maxLength) value = value.substring(0, maxLength);
  return value;
}

function sheetDateString(value) {
  if (!value) return '';
  if (value instanceof Date) return formatDate(value);
  return String(value).substring(0, 10);
}

function sheetDateTimeString(value) {
  if (!value) return '';
  if (value instanceof Date) return formatDateTime(value);
  return String(value).replace('T', ' ').substring(0, 19);
}

function getUserContext(payload) {
  const lineUserId = payload.lineUserId;
  if (!lineUserId) return { ok: false, error: 'missing_line_user_id' };

  const emp = findEmployeeByLineId(lineUserId);
  const owner = isOwner(lineUserId);
  const hrAdmin = isHrAdmin(lineUserId);
  const employeeId = emp ? emp.employee_id : '';
  const assignedApprover = emp ? isAssignedApprover(employeeId) : false;
  const pendingApprovals = emp ? countPendingApprovalsFor(employeeId) : 0;
  const approver = assignedApprover || pendingApprovals > 0;
  const baseRole = normalizeRole(emp && emp.role);

  const roles = [];
  if (emp) roles.push('employee');
  if (baseRole && baseRole !== 'employee' && roles.indexOf(baseRole) < 0) roles.push(baseRole);
  if (approver && roles.indexOf('approver') < 0) roles.push('approver');
  if (owner && roles.indexOf('owner') < 0) roles.push('owner');

  return {
    ok: true,
    registered: Boolean(emp),
    employee: emp ? {
      id: emp.employee_id,
      name: emp.display_name,
      department: emp.department,
      position: emp.position
    } : null,
    roles: roles,
    permissions: {
      employee: Boolean(emp),
      approver: approver,
      admin: hrAdmin
    },
    pendingApprovals: pendingApprovals
  };
}

function isAssignedApprover(employeeId) {
  if (!employeeId) return false;
  return getAllRows(SHEETS.EMPLOYEES.name).some(function(r) {
    return r.approver_L1_id === employeeId;
  });
}

function normalizeRole(role) {
  role = String(role || 'employee').trim().toLowerCase();
  if (['employee', 'approver', 'hr', 'admin'].indexOf(role) < 0) return 'employee';
  return role;
}

function isHrAdmin(lineUserId) {
  const emp = findEmployeeByLineId(lineUserId);
  const role = normalizeRole(emp && emp.role);
  return role === 'hr' || role === 'admin';
}

function countPendingApprovalsFor(employeeId) {
  if (!employeeId) return 0;
  const pendingLeaves = filterRows(SHEETS.LEAVES.name, function(r) {
    return r.current_approver === employeeId
      && String(r.status).indexOf('pending_') === 0;
  }).length;
  const pendingOT = filterRows(SHEETS.OT.name, function(r) {
    return r.current_approver === employeeId
      && String(r.status).indexOf('pending_') === 0;
  }).length;
  return pendingLeaves + pendingOT;
}

function currentPeriod() {
  const now = new Date();
  const year = now.getFullYear();
  const month = ('0' + (now.getMonth() + 1)).slice(-2);
  return year + '-' + month;
}

function countApprovedWorkDays(employeeId, period) {
  // Count distinct dates with at least one approved IN checkin
  const checkins = filterRows(SHEETS.CHECKINS.name, function(r) {
    if (r.employee_id !== employeeId) return false;
    if (r.status !== 'approved') return false;
    if (r.slot !== 'IN') return false;
    const dateStr = formatDate(new Date(r.checkin_date));
    return dateStr.indexOf(period) === 0;
  });
  // Distinct dates
  const dates = {};
  checkins.forEach(function(c) {
    dates[formatDate(new Date(c.checkin_date))] = true;
  });
  return Object.keys(dates).length;
}

function sumApprovedOT(employeeId, period) {
  const otRows = filterRows(SHEETS.OT.name, function(r) {
    return r.employee_id === employeeId
      && r.status === 'approved'
      && formatDate(new Date(r.ot_date)).indexOf(period) === 0;
  });
  return otRows.reduce(function(s, r) { return s + Number(r.total_hours || 0); }, 0);
}

function sumPayItems(employeeId, period, type) {
  const items = filterRows(SHEETS.PAY_ITEMS.name, function(r) {
    return (r.employee_id === employeeId || r.employee_id === '' || r.employee_id === '*')
      && r.period === period
      && r.type === type;
  });
  return items.reduce(function(s, r) { return s + Number(r.amount || 0); }, 0);
}

function findLastPayment(employeeId) {
  const payments = filterRows(SHEETS.PAYMENTS.name, function(r) {
    return r.employee_id === employeeId;
  });
  if (payments.length === 0) return null;
  // Sort by period desc
  payments.sort(function(a, b) { return String(b.period).localeCompare(String(a.period)); });
  return payments[0];
}


/**
 * ============================================================
 * Evidence Handler — attach evidence after "need_info"
 * ============================================================
 */
function submitEvidence(payload) {
  const lineUserId = payload.lineUserId;
  const recordId = payload.id;
  const type = payload.type; // leave / ot
  const evidenceBase64 = payload.evidenceBase64;
  const note = (payload.note || '').trim();

  if (!recordId) return { ok: false, error: 'missing_id' };
  if (!evidenceBase64) return { ok: false, error: 'missing_evidence' };

  const emp = findEmployeeByLineId(lineUserId);
  if (!emp) return { ok: false, error: 'not_registered' };

  const record = (type === 'leave') ? findLeaveById(recordId) : findOTById(recordId);
  if (!record) return { ok: false, error: 'record_not_found' };
  if (record.employee_id !== emp.employee_id) return { ok: false, error: 'not_your_record' };
  if (record.status !== 'need_info') return { ok: false, error: 'wrong_status' };

  // Upload
  let evidenceUrl;
  try {
    evidenceUrl = uploadImage(
      evidenceBase64,
      'evidence_' + recordId + '_' + Date.now() + '.jpg',
      'evidence'
    );
  } catch (err) {
    return { ok: false, error: 'upload_failed' };
  }

  // Append to history
  const history = parseHistory(record.approval_history);
  const lastNeedInfo = history.slice().reverse().find(function(h) { return h.action === 'need_info'; });
  const level = lastNeedInfo ? lastNeedInfo.level : 'L1';

  history.push({
    level: 'employee',
    by: emp.employee_id,
    action: 'submit_evidence',
    note: note,
    evidence_url: evidenceUrl,
    at: nowBangkok()
  });

  // Reset back to pending at the level that asked
  const sheetName = (type === 'leave') ? SHEETS.LEAVES.name : SHEETS.OT.name;
  const idField = (type === 'leave') ? 'leave_id' : 'ot_id';
  updateRowByNumber(sheetName, record._row, {
    status: 'pending_' + level,
    evidence_url: evidenceUrl,
    approval_history: JSON.stringify(history)
  });

  // Notify approver
  const approver = findEmployeeById(record.current_approver);
  if (approver) {
    pushMessage(approver.line_user_id, [{
      type: 'text',
      text: '📎 ' + emp.display_name + ' ส่งหลักฐานเพิ่มสำหรับ ' + recordId + ' แล้ว\n\n' +
            'หมายเหตุ: ' + (note || '-') + '\n' +
            'ดูหลักฐาน: ' + evidenceUrl
    }]);
  }

  return { ok: true, evidenceUrl: evidenceUrl };
}


/**
 * ============================================================
 * HR Tools Handler — Owner only
 * ============================================================
 */
function hrGetEmployees(payload) {
  if (!isHrAdmin(payload.lineUserId)) return { ok: false, error: 'forbidden' };
  const employees = getAllRows(SHEETS.EMPLOYEES.name);
  return { ok: true, employees: employees };
}

function hrAddEmployee(payload) {
  if (!isHrAdmin(payload.lineUserId)) return { ok: false, error: 'forbidden' };
  const newEmp = payload.employee || {};
  newEmp.line_user_id = String(newEmp.line_user_id || '').trim();
  newEmp.display_name = String(newEmp.display_name || '').trim();
  newEmp.phone = String(newEmp.phone || '').trim();

  if (!newEmp.line_user_id) return { ok: false, error: 'missing_line_user_id' };
  if (!newEmp.display_name) return { ok: false, error: 'missing_display_name' };
  if (findEmployeeByLineId(newEmp.line_user_id)) {
    return { ok: false, error: 'line_user_id_exists' };
  }

  newEmp.employee_id = newEmp.employee_id || nextEmployeeId();
  if (findEmployeeById(newEmp.employee_id)) return { ok: false, error: 'employee_id_exists' };

  newEmp.base_pay_monthly = Math.max(0, Number(newEmp.base_pay_monthly || 0));
  newEmp.ot_rate_per_hour = Math.max(0, Number(newEmp.ot_rate_per_hour || 0));
  newEmp.role = normalizeRole(newEmp.role);
  newEmp.start_date = newEmp.start_date || todayBangkok();
  newEmp.registered_at = nowBangkok();
  newEmp.is_active = true;
  insertEmployee(newEmp);
  initLeaveQuota(newEmp.employee_id, Number(payload.year || new Date().getFullYear()));
  return { ok: true, employeeId: newEmp.employee_id };
}

function hrUpdateEmployee(payload) {
  if (!isHrAdmin(payload.lineUserId)) return { ok: false, error: 'forbidden' };
  const employeeId = payload.employeeId;
  const existingEmployee = employeeId ? findEmployeeById(employeeId) : null;
  if (!employeeId || !existingEmployee) return { ok: false, error: 'employee_not_found' };

  const allowed = [
    'line_user_id', 'display_name', 'phone', 'email', 'department', 'position',
    'base_pay_monthly', 'ot_rate_per_hour', 'bank_name',
    'bank_account_no', 'bank_account_name', 'approver_L1_id',
    'role', 'start_date', 'is_active'
  ];
  const updates = {};
  const requested = payload.updates || {};
  allowed.forEach(function(key) {
    if (requested[key] !== undefined) updates[key] = requested[key];
  });
  if (updates.display_name !== undefined && !String(updates.display_name).trim()) {
    return { ok: false, error: 'missing_display_name' };
  }
  if (updates.line_user_id !== undefined) {
    updates.line_user_id = String(updates.line_user_id || '').trim();
    if (!updates.line_user_id) return { ok: false, error: 'missing_line_user_id' };
    const lineOwner = findEmployeeByLineId(updates.line_user_id);
    if (lineOwner && lineOwner.employee_id !== employeeId) {
      return { ok: false, error: 'line_user_id_exists', message: 'LINE User ID นี้ถูกผูกกับพนักงานคนอื่นแล้ว' };
    }
  }
  ['base_pay_monthly', 'ot_rate_per_hour'].forEach(function(key) {
    if (updates[key] !== undefined) updates[key] = Math.max(0, Number(updates[key] || 0));
  });
  if (updates.role !== undefined) updates.role = normalizeRole(updates.role);

  const ok = updateRow(SHEETS.EMPLOYEES.name, function(r) {
    return r.employee_id === employeeId;
  }, updates);
  return { ok: ok };
}

function hrGetPayItems(payload) {
  if (!isHrAdmin(payload.lineUserId)) return { ok: false, error: 'forbidden' };
  const period = payload.period || currentPeriod();
  const items = filterRows(SHEETS.PAY_ITEMS.name, function(r) {
    return r.period === period;
  });
  return { ok: true, items: items };
}

function hrAddPayItem(payload) {
  if (!isHrAdmin(payload.lineUserId)) return { ok: false, error: 'forbidden' };
  const item = payload.item || {};
  if (!/^\d{4}-\d{2}$/.test(String(item.period || ''))) return { ok: false, error: 'invalid_period' };
  if (['bonus', 'deduction'].indexOf(item.type) < 0) return { ok: false, error: 'invalid_type' };
  item.amount = Number(item.amount);
  if (!isFinite(item.amount) || item.amount <= 0) return { ok: false, error: 'invalid_amount' };
  if (item.employee_id && item.employee_id !== '*' && !findEmployeeById(item.employee_id)) {
    return { ok: false, error: 'employee_not_found' };
  }
  item.item_id = 'PI-' + Date.now();
  item.created_by = payload.lineUserId;
  item.created_at = nowBangkok();
  insertRow(SHEETS.PAY_ITEMS.name, item);
  return { ok: true };
}

function hrGetHolidays(payload) {
  if (!isHrAdmin(payload.lineUserId)) return { ok: false, error: 'forbidden' };
  const holidays = getAllRows(SHEETS.HOLIDAYS.name).map(function(h) {
    return {
      date: h.date ? formatDate(new Date(h.date)) : '',
      name: h.name,
      type: h.type
    };
  });
  holidays.sort(function(a, b) { return String(a.date).localeCompare(String(b.date)); });
  return { ok: true, holidays: holidays };
}

function hrAddHoliday(payload) {
  if (!isHrAdmin(payload.lineUserId)) return { ok: false, error: 'forbidden' };
  const holiday = payload.holiday || {};
  const date = String(holiday.date || '');
  const name = String(holiday.name || '').trim();
  const type = String(holiday.type || 'company').trim();

  const parsedDate = new Date(date + 'T00:00:00+07:00');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)
      || isNaN(parsedDate.getTime())
      || formatDate(parsedDate) !== date) {
    return { ok: false, error: 'invalid_date' };
  }
  if (!name) return { ok: false, error: 'missing_name' };
  const existing = findRow(SHEETS.HOLIDAYS.name, function(r) {
    return formatDate(new Date(r.date)) === date;
  });
  if (existing) return { ok: false, error: 'holiday_exists' };

  insertRow(SHEETS.HOLIDAYS.name, { date: date, name: name, type: type });
  return { ok: true };
}

function hrGetLeaveQuotas(payload) {
  if (!isHrAdmin(payload.lineUserId)) return { ok: false, error: 'forbidden' };
  const year = Number(payload.year || new Date().getFullYear());
  if (!Number.isInteger(year) || year < 2000 || year > 2200) {
    return { ok: false, error: 'invalid_year' };
  }

  const quotas = getActiveEmployees().map(function(emp) {
    const quota = getLeaveQuota(emp.employee_id, year) || initLeaveQuota(emp.employee_id, year);
    return {
      employee_id: emp.employee_id,
      name: emp.display_name,
      sick_quota: Number(quota.sick_quota || 0),
      sick_used: Number(quota.sick_used || 0),
      personal_quota: Number(quota.personal_quota || 0),
      personal_used: Number(quota.personal_used || 0),
      vacation_quota: Number(quota.vacation_quota || 0),
      vacation_used: Number(quota.vacation_used || 0)
    };
  });
  return { ok: true, year: year, quotas: quotas };
}

function hrSetLeaveQuota(payload) {
  if (!isHrAdmin(payload.lineUserId)) return { ok: false, error: 'forbidden' };
  const employeeId = payload.employeeId;
  const year = Number(payload.year);
  if (!findEmployeeById(employeeId)) return { ok: false, error: 'employee_not_found' };
  if (!Number.isInteger(year) || year < 2000 || year > 2200) return { ok: false, error: 'invalid_year' };

  const requested = payload.updates || {};
  const updates = {};
  ['sick_quota', 'personal_quota', 'vacation_quota'].forEach(function(key) {
    if (requested[key] !== undefined) {
      const value = Number(requested[key]);
      if (isFinite(value) && value >= 0) updates[key] = value;
    }
  });
  if (Object.keys(updates).length === 0) return { ok: false, error: 'missing_updates' };

  if (!getLeaveQuota(employeeId, year)) initLeaveQuota(employeeId, year);
  const ok = updateRow(SHEETS.LEAVE_QUOTA.name, function(r) {
    return r.employee_id === employeeId && Number(r.year) === Number(year);
  }, updates);
  return { ok: ok };
}

function hrGetReport(payload) {
  if (!isHrAdmin(payload.lineUserId)) return { ok: false, error: 'forbidden' };
  const period = payload.period || currentPeriod();
  const employees = getActiveEmployees();
  const report = employees.map(function(emp) {
    return {
      employee_id: emp.employee_id,
      name: emp.display_name,
      department: emp.department,
      work_days: countApprovedWorkDays(emp.employee_id, period),
      ot_hours: sumApprovedOT(emp.employee_id, period),
      bonus: sumPayItems(emp.employee_id, period, 'bonus'),
      deduction: sumPayItems(emp.employee_id, period, 'deduction')
    };
  });
  return { ok: true, period: period, report: report };
}

function isOwner(lineUserId) {
  return lineUserId === getProp('OWNER_LINE_USER_ID');
}


/**
 * ============================================================
 * Payment Handler — Flow 10: ปิดงวด + จ่ายเงิน
 * ============================================================
 */
function closePeriod(payload) {
  if (!isHrAdmin(payload.lineUserId)) return { ok: false, error: 'forbidden' };
  const period = payload.period || currentPeriod();

  // Check pending
  const pendingLeaves = filterRows(SHEETS.LEAVES.name, function(r) {
    return String(r.status).indexOf('pending') === 0
      && formatDate(new Date(r.start_date)).indexOf(period) === 0;
  });
  const pendingOT = filterRows(SHEETS.OT.name, function(r) {
    return String(r.status).indexOf('pending') === 0
      && formatDate(new Date(r.ot_date)).indexOf(period) === 0;
  });

  if ((pendingLeaves.length > 0 || pendingOT.length > 0) && !payload.force) {
    return {
      ok: false,
      error: 'has_pending',
      message: 'มีคำขอที่ยังค้างอนุมัติ: ' + pendingLeaves.length + ' ลา + ' + pendingOT.length + ' OT',
      pendingLeaves: pendingLeaves.length,
      pendingOT: pendingOT.length
    };
  }

  // Process each employee
  const employees = getActiveEmployees();
  const config = getConfig();
  const results = [];

  employees.forEach(function(emp) {
    const workDays = countApprovedWorkDays(emp.employee_id, period);
    const otHours = sumApprovedOT(emp.employee_id, period);
    const dailyRate = Number(emp.base_pay_monthly || 0) / 22;
    const otRate = Number(emp.ot_rate_per_hour || 0);
    const basePay = workDays * dailyRate;
    const otPay = otHours * otRate * config.ot_rate_multiplier;
    const bonus = sumPayItems(emp.employee_id, period, 'bonus');
    const deduction = sumPayItems(emp.employee_id, period, 'deduction');
    const total = Math.round(basePay + otPay + bonus - deduction);

    // Check if already closed
    const existing = findRow(SHEETS.PAYMENTS.name, function(r) {
      return r.employee_id === emp.employee_id && r.period === period;
    });

    if (existing) {
      results.push({ employee: emp.display_name, skipped: true, reason: 'already_closed' });
      return;
    }

    const paymentId = nextPaymentId(period);
    insertPayment({
      payment_id: paymentId,
      employee_id: emp.employee_id,
      period: period,
      work_days: workDays,
      ot_hours: otHours,
      base_pay: Math.round(basePay),
      ot_pay: Math.round(otPay),
      bonus: bonus,
      deduction: deduction,
      total_amount: total,
      status: 'รอจ่าย',
      closed_at: nowBangkok(),
      paid_at: '',
      note: ''
    });

    results.push({
      employee: emp.display_name,
      total: total,
      paymentId: paymentId
    });
  });

  // Send summary
  const summaryLines = results.map(function(r) {
    if (r.skipped) return '  - ' + r.employee + ' (' + r.reason + ')';
    return '  ' + r.employee + ': ' + (r.total || 0).toLocaleString() + ' บาท';
  });
  const totalSum = results.reduce(function(s, r) { return s + (r.total || 0); }, 0);

  pushMessage(getProp('OWNER_LINE_USER_ID'), [{
    type: 'text',
    text: '💰 ปิดงวด ' + period + ' เรียบร้อย\n\n' +
          summaryLines.join('\n') + '\n\n' +
          '─────────────────\n' +
          'รวมทั้งสิ้น: ' + totalSum.toLocaleString() + ' บาท\n\n' +
          'หลังโอนเงินแล้ว กดเปลี่ยนสถานะ "จ่ายแล้ว" ใน Sheet Payments'
  }]);

  return { ok: true, period: period, count: results.length, totalSum: totalSum };
}

function markPaid(payload) {
  if (!isHrAdmin(payload.lineUserId)) return { ok: false, error: 'forbidden' };
  const paymentId = payload.paymentId;

  const ok = updateRow(SHEETS.PAYMENTS.name, function(r) {
    return r.payment_id === paymentId;
  }, {
    status: 'จ่ายแล้ว',
    paid_at: nowBangkok()
  });

  if (ok) {
    // Notify employee
    const payment = findRow(SHEETS.PAYMENTS.name, function(r) {
      return r.payment_id === paymentId;
    });
    const emp = findEmployeeById(payment.employee_id);
    if (emp) {
      pushMessage(emp.line_user_id, [{
        type: 'text',
        text: '💵 เงินเดือนงวด ' + payment.period + ' โอนเข้าบัญชีคุณแล้ว\n' +
              'จำนวน: ' + Number(payment.total_amount).toLocaleString() + ' บาท'
      }]);
    }
  }

  return { ok: ok };
}

