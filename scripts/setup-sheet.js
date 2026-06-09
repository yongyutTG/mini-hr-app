#!/usr/bin/env node
/**
 * ============================================================
 * setup-sheet.js
 * ============================================================
 * Bootstrap Google Sheet with 11 sheets + headers via Sheets API
 *
 * Prerequisite:
 *   npm install googleapis google-auth-library
 *   Get credentials.json from Google Cloud Console (OAuth Desktop)
 *
 * Usage:
 *   node setup-sheet.js <SPREADSHEET_ID>
 *
 * Alternative: use Apps Script's initializeAllSheets() function instead
 */

const { google } = require('googleapis');
const { authenticate } = require('@google-cloud/local-auth');
const path = require('path');

const SHEETS_DEFINITION = {
  Employees: ['employee_id', 'line_user_id', 'display_name', 'phone', 'email',
              'department', 'position', 'base_pay_monthly', 'ot_rate_per_hour',
              'bank_name', 'bank_account_no', 'bank_account_name',
              'selfie_url', 'id_card_url',
              'approver_L1_id', 'approver_L2_id', 'approver_L3_id',
              'start_date', 'is_active', 'registered_at'],
  Checkins: ['checkin_id', 'employee_id', 'checkin_date', 'slot',
             'checkin_at', 'lat', 'lng', 'distance_m', 'selfie_url',
             'status', 'approved_by', 'approved_at'],
  Leaves: ['leave_id', 'employee_id', 'leave_type', 'duration_type',
           'start_date', 'end_date', 'total_days', 'total_hours', 'reason',
           'evidence_url', 'status', 'current_approver', 'approval_history',
           'submitted_at'],
  OT: ['ot_id', 'employee_id', 'ot_date', 'start_time', 'end_time',
       'total_hours', 'reason', 'status', 'current_approver',
       'approval_history', 'submitted_at'],
  Payments: ['payment_id', 'employee_id', 'period', 'work_days', 'ot_hours',
             'base_pay', 'ot_pay', 'bonus', 'deduction', 'total_amount',
             'status', 'closed_at', 'paid_at', 'note'],
  LeaveQuota: ['employee_id', 'year', 'sick_quota', 'sick_used',
               'personal_quota', 'personal_used',
               'vacation_quota', 'vacation_used'],
  PayItems: ['item_id', 'employee_id', 'period', 'type', 'amount',
             'reason', 'created_by', 'created_at'],
  Holidays: ['date', 'name', 'type'],
  Config: ['key', 'value'],
  Logs: ['timestamp', 'level', 'function', 'user_id', 'message', 'payload'],
  Approvers: ['employee_id', 'level', 'approver_id', 'is_active']
};

const DEFAULT_CONFIG = [
  ['company_name', 'My Company Co., Ltd.'],
  ['geofence_lat', 13.7563],
  ['geofence_lng', 100.5018],
  ['geofence_radius_m', 150],
  ['work_start', '09:00'],
  ['work_end', '18:00'],
  ['lunch_start', '12:00'],
  ['lunch_end', '13:00'],
  ['ot_rate_multiplier', 1.5],
  ['sick_quota_default', 30],
  ['personal_quota_default', 3],
  ['vacation_quota_default', 15],
  ['late_threshold_min', 15],
  ['ot_request_lead_min', 30]
];

async function main() {
  const spreadsheetId = process.argv[2];
  if (!spreadsheetId) {
    console.error('Usage: node setup-sheet.js <SPREADSHEET_ID>');
    process.exit(1);
  }

  const auth = await authenticate({
    keyfilePath: path.join(__dirname, 'credentials.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  const sheets = google.sheets({ version: 'v4', auth });

  // Get existing sheets
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existingSheets = meta.data.sheets.map(s => s.properties.title);

  // Create missing sheets
  const requests = [];
  Object.keys(SHEETS_DEFINITION).forEach(name => {
    if (!existingSheets.includes(name)) {
      requests.push({ addSheet: { properties: { title: name } } });
    }
  });

  if (requests.length > 0) {
    console.log(`Creating ${requests.length} sheets...`);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests }
    });
  }

  // Write headers + format
  for (const [name, columns] of Object.entries(SHEETS_DEFINITION)) {
    console.log(`Writing headers for ${name}...`);
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${name}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [columns] }
    });
  }

  // Format headers (orange background, white text, bold)
  const meta2 = await sheets.spreadsheets.get({ spreadsheetId });
  const formatRequests = meta2.data.sheets
    .filter(s => SHEETS_DEFINITION[s.properties.title])
    .map(s => ({
      repeatCell: {
        range: {
          sheetId: s.properties.sheetId,
          startRowIndex: 0, endRowIndex: 1
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.83, green: 0.33, blue: 0.04 },
            textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true }
          }
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)'
      }
    }))
    .concat(meta2.data.sheets
      .filter(s => SHEETS_DEFINITION[s.properties.title])
      .map(s => ({
        updateSheetProperties: {
          properties: { sheetId: s.properties.sheetId, gridProperties: { frozenRowCount: 1 } },
          fields: 'gridProperties.frozenRowCount'
        }
      })));

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: formatRequests }
  });

  // Insert default config
  console.log('Inserting default config...');
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Config!A2',
    valueInputOption: 'RAW',
    requestBody: { values: DEFAULT_CONFIG }
  });

  console.log('\n✅ Setup complete!');
  console.log(`Spreadsheet: https://docs.google.com/spreadsheets/d/${spreadsheetId}`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
