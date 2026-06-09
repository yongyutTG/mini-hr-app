#!/usr/bin/env node
/**
 * ============================================================
 * test-webhook.js
 * ============================================================
 * Send test payload to Apps Script webhook for local development
 *
 * Usage:
 *   APPS_SCRIPT_URL=https://script.google.com/.../exec node test-webhook.js <action>
 *
 * Actions: register | checkin | leave | ot | balance
 */

const https = require('https');

const URL = process.env.APPS_SCRIPT_URL;
if (!URL) {
  console.error('Set APPS_SCRIPT_URL env variable');
  process.exit(1);
}

const TEST_LINE_USER_ID = process.env.TEST_LINE_USER_ID || 'U0000000000000000000000000000test1';

const ACTIONS = {
  register: {
    action: 'register',
    lineUserId: TEST_LINE_USER_ID,
    displayName: 'Test User',
    phone: '0812345678',
    bankName: 'SCB',
    bankAccountNo: '123-4-56789-0',
    bankAccountName: 'Test User',
    // tiny 1x1 transparent png base64
    selfieBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    idCardBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
  },
  checkin: {
    action: 'checkin',
    lineUserId: TEST_LINE_USER_ID,
    lat: 13.7563,
    lng: 100.5018,
    slot: 'IN',
    selfieBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
  },
  leave: {
    action: 'leave',
    lineUserId: TEST_LINE_USER_ID,
    leaveType: 'sick',
    durationType: 'full_day',
    startDate: new Date(Date.now() + 86400000).toISOString().substring(0, 10),
    endDate: new Date(Date.now() + 86400000).toISOString().substring(0, 10),
    reason: 'ทดสอบลา'
  },
  ot: {
    action: 'ot',
    lineUserId: TEST_LINE_USER_ID,
    otDate: new Date().toISOString().substring(0, 10),
    startTime: '18:00',
    endTime: '21:00',
    reason: 'ทดสอบ OT'
  },
  balance: {
    action: 'balance',
    lineUserId: TEST_LINE_USER_ID
  }
};

const action = process.argv[2];
if (!action || !ACTIONS[action]) {
  console.log('Usage: node test-webhook.js <action>');
  console.log('Actions:', Object.keys(ACTIONS).join(', '));
  process.exit(1);
}

const payload = ACTIONS[action];
const body = JSON.stringify(payload);

const url = new URL(URL);
const options = {
  hostname: url.hostname,
  path: url.pathname + url.search,
  method: 'POST',
  headers: {
    'Content-Type': 'text/plain',
    'Content-Length': body.length
  }
};

console.log(`Sending ${action} →`, URL);
console.log('Payload:', JSON.stringify(payload, null, 2).substring(0, 500));

const req = https.request(options, res => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => {
    console.log('\nStatus:', res.statusCode);
    try {
      console.log('Response:', JSON.parse(data));
    } catch (e) {
      console.log('Response (raw):', data.substring(0, 500));
    }
  });
});

req.on('error', err => console.error(err));
req.write(body);
req.end();
