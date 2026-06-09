/**
 * ============================================================
 * Register Handler
 * ============================================================
 * Flow 1: ลงทะเบียนพนักงานใหม่
 */

function register(payload) {
  const lineUserId = payload.lineUserId;
  const displayName = payload.displayName;
  const phone = payload.phone;
  const email = payload.email || '';
  const department = payload.department || '';
  const position = payload.position || '';
  const basePayMonthly = Number(payload.basePayMonthly || 15000);
  const otRatePerHour = Number(payload.otRatePerHour || 80);
  const bankName = payload.bankName;
  const bankAccountNo = payload.bankAccountNo;
  const bankAccountName = payload.bankAccountName;
  const selfieBase64 = payload.selfieBase64;
  const idCardBase64 = payload.idCardBase64;

  // === Validate ===
  if (!lineUserId) return { ok: false, error: 'missing_line_user_id' };
  if (!displayName) return { ok: false, error: 'missing_display_name' };
  if (!phone) return { ok: false, error: 'missing_phone' };
  if (!bankAccountNo) return { ok: false, error: 'missing_bank' };
  if (!selfieBase64) return { ok: false, error: 'missing_selfie' };
  if (!idCardBase64) return { ok: false, error: 'missing_id_card' };

  // === Check duplicate ===
  const existing = findEmployeeByLineId(lineUserId);
  if (existing) {
    logUserAction('register', lineUserId, 'already_registered');
    return { ok: false, error: 'already_registered', employeeId: existing.employee_id };
  }

  // === Upload images ===
  let selfieUrl, idCardUrl;
  try {
    selfieUrl = uploadImage(
      selfieBase64,
      'selfie_' + lineUserId + '_' + Date.now() + '.jpg',
      'selfies'
    );
    idCardUrl = uploadImage(
      idCardBase64,
      'id_' + lineUserId + '_' + Date.now() + '.jpg',
      'id-cards'
    );
  } catch (err) {
    logError('register:upload', err.message, { lineUserId });
    return { ok: false, error: 'upload_failed', message: err.message };
  }

  // === Insert row ===
  const employeeId = nextEmployeeId();
  const newEmp = {
    employee_id: employeeId,
    line_user_id: lineUserId,
    display_name: displayName,
    phone: phone,
    email: email,
    department: department,
    position: position,
    base_pay_monthly: basePayMonthly,
    ot_rate_per_hour: otRatePerHour,
    bank_name: bankName,
    bank_account_no: bankAccountNo,
    bank_account_name: bankAccountName,
    selfie_url: selfieUrl,
    id_card_url: idCardUrl,
    approver_L1_id: '',  // ต้อง assign ทีหลังโดย HR
    approver_L2_id: '',
    approver_L3_id: '',
    start_date: todayBangkok(),
    is_active: true,
    registered_at: nowBangkok()
  };

  try {
    insertEmployee(newEmp);
  } catch (err) {
    logError('register:insert', err.message, { lineUserId });
    return { ok: false, error: 'insert_failed', message: err.message };
  }

  // === Init leave quota ===
  try {
    initLeaveQuota(employeeId, new Date().getFullYear());
  } catch (err) {
    logWarn('register:quota', err.message, { employeeId });
    // continue — quota สามารถสร้างเองทีหลังได้
  }

  // === Welcome message ===
  pushMessage(lineUserId, [{
    type: 'text',
    text: '✅ ลงทะเบียนเรียบร้อย ' + displayName + '!\n' +
          'รหัสพนักงาน: ' + employeeId + '\n\n' +
          '⚠️ รอ HR/เจ้าของระบบกำหนดผู้อนุมัติให้คุณก่อน จึงจะเริ่มลงเวลา/ขอลาได้'
  }]);

  // === Notify owner ===
  pushMessage(getProp('OWNER_LINE_USER_ID'), [{
    type: 'text',
    text: '🆕 พนักงานใหม่ลงทะเบียน\n' +
          'ID: ' + employeeId + '\n' +
          'ชื่อ: ' + displayName + '\n' +
          'เบอร์: ' + phone + '\n\n' +
          'กรุณาเข้า "เครื่องมือ HR" เพื่อกำหนดผู้อนุมัติ'
  }]);

  logUserAction('register', lineUserId, 'success', { employeeId });
  return { ok: true, employeeId: employeeId, selfieUrl: selfieUrl };
}
