#!/usr/bin/env node
/**
 * ============================================================
 * create-rich-menu.js
 * ============================================================
 * Create 2 rich menus (employee + owner) via LINE Messaging API
 *
 * Usage:
 *   LINE_ACCESS_TOKEN=xxx node create-rich-menu.js
 *
 * Then upload images for each rich menu manually via LINE OA Manager
 * or extend this script to upload via API
 *
 * Rich menu size: 2500 × 1686 px (full) or 2500 × 843 px (compact)
 */

const https = require('https');

const TOKEN = process.env.LINE_ACCESS_TOKEN;
if (!TOKEN) {
  console.error('Set LINE_ACCESS_TOKEN env variable');
  process.exit(1);
}

const LIFF_BASE = 'https://liff.line.me/';
const LIFF_IDS = {
  register: process.env.LIFF_ID_REGISTER || 'YOUR_LIFF_ID_REGISTER',
  checkin: process.env.LIFF_ID_CHECKIN || 'YOUR_LIFF_ID_CHECKIN',
  leave: process.env.LIFF_ID_LEAVE || 'YOUR_LIFF_ID_LEAVE',
  ot: process.env.LIFF_ID_OT || 'YOUR_LIFF_ID_OT',
  balance: process.env.LIFF_ID_BALANCE || 'YOUR_LIFF_ID_BALANCE',
  hr: process.env.LIFF_ID_HR_TOOLS || 'YOUR_LIFF_ID_HR_TOOLS',
  approval: process.env.LIFF_ID_APPROVAL || 'YOUR_LIFF_ID_APPROVAL',
};

// ============================================================
// Employee rich menu (5 buttons, compact)
// ============================================================
const employeeMenu = {
  size: { width: 2500, height: 843 },
  selected: false,
  name: 'employee-menu',
  chatBarText: 'เมนู',
  areas: [
    {
      bounds: { x: 0, y: 0, width: 500, height: 843 },
      action: { type: 'uri', label: 'ลงทะเบียน', uri: LIFF_BASE + LIFF_IDS.register }
    },
    {
      bounds: { x: 500, y: 0, width: 500, height: 843 },
      action: { type: 'uri', label: 'เช็คอิน', uri: LIFF_BASE + LIFF_IDS.checkin }
    },
    {
      bounds: { x: 1000, y: 0, width: 500, height: 843 },
      action: { type: 'uri', label: 'ส่งใบลา', uri: LIFF_BASE + LIFF_IDS.leave }
    },
    {
      bounds: { x: 1500, y: 0, width: 500, height: 843 },
      action: { type: 'uri', label: 'ขอ OT', uri: LIFF_BASE + LIFF_IDS.ot }
    },
    {
      bounds: { x: 2000, y: 0, width: 500, height: 843 },
      action: { type: 'uri', label: 'ดูยอด', uri: LIFF_BASE + LIFF_IDS.balance }
    }
  ]
};

// ============================================================
// Owner rich menu (4 buttons)
// ============================================================
const ownerMenu = {
  size: { width: 2500, height: 843 },
  selected: false,
  name: 'owner-menu',
  chatBarText: 'HR Menu',
  areas: [
    {
      bounds: { x: 0, y: 0, width: 625, height: 843 },
      action: { type: 'uri', label: 'กล่องอนุมัติ', uri: LIFF_BASE + LIFF_IDS.approval }
    },
    {
      bounds: { x: 625, y: 0, width: 625, height: 843 },
      action: { type: 'uri', label: 'เครื่องมือ HR', uri: LIFF_BASE + LIFF_IDS.hr }
    },
    {
      bounds: { x: 1250, y: 0, width: 625, height: 843 },
      action: { type: 'uri', label: 'ดูยอด', uri: LIFF_BASE + LIFF_IDS.balance }
    },
    {
      bounds: { x: 1875, y: 0, width: 625, height: 843 },
      action: { type: 'uri', label: 'เช็คอิน', uri: LIFF_BASE + LIFF_IDS.checkin }
    }
  ]
};

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'api.line.me',
      path: path,
      method: method,
      headers: {
        'Authorization': 'Bearer ' + TOKEN,
        'Content-Type': 'application/json'
      }
    };
    if (data) options.headers['Content-Length'] = data.length;
    const req = https.request(options, res => {
      let chunks = '';
      res.on('data', d => chunks += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(chunks || '{}') }); }
        catch (e) { resolve({ status: res.statusCode, body: chunks }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function createRichMenu(menu) {
  const res = await request('POST', '/v2/bot/richmenu', menu);
  if (res.status === 200) {
    console.log(`✅ Created "${menu.name}" → ${res.body.richMenuId}`);
    return res.body.richMenuId;
  } else {
    console.error(`❌ Failed to create ${menu.name}:`, res.body);
    return null;
  }
}

async function setDefaultRichMenu(richMenuId) {
  const res = await request('POST', `/v2/bot/user/all/richmenu/${richMenuId}`);
  console.log(res.status === 200 ? '✅ Set as default' : `❌ ${res.body}`);
}

async function main() {
  console.log('Creating Employee rich menu...');
  const employeeId = await createRichMenu(employeeMenu);

  console.log('Creating Owner rich menu...');
  const ownerId = await createRichMenu(ownerMenu);

  if (employeeId) {
    console.log('\n📌 Setting employee menu as default for all users...');
    await setDefaultRichMenu(employeeId);
  }

  console.log('\n📝 Next steps:');
  console.log('1. Upload rich menu images via LINE OA Manager or:');
  console.log(`   curl -X POST -H 'Authorization: Bearer ${TOKEN.substring(0,20)}...' \\`);
  console.log(`        -H 'Content-Type: image/png' \\`);
  console.log(`        -T employee-menu.png \\`);
  console.log(`        https://api-data.line.me/v2/bot/richmenu/${employeeId || 'EMPLOYEE_ID'}/content`);
  console.log('2. For owner, manually link the owner menu to specific users:');
  console.log(`   curl -X POST -H 'Authorization: Bearer ...' \\`);
  console.log(`        https://api.line.me/v2/bot/user/{ownerLineUserId}/richmenu/${ownerId || 'OWNER_ID'}`);
}

main().catch(err => console.error(err));
