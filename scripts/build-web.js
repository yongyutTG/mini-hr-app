const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_DIR = path.join(ROOT, 'liff');
const OUTPUT_DIR = path.join(ROOT, 'public');

const LIFF_IDS = {
  register: '2010398855-a6ShhYmu',
  checkin: '2010398855-RoaIwd3w',
  leave: '2010398855-SAwIvpcU',
  ot: '2010398855-nb8HmeYV',
  balance: '2010398855-G1eIuAdy',
  'hr-tools': '2010398855-I8olkJtv',
  'approval-inbox': '2010398855-LLpLg8UY',
  evidence: '2010398855-s2m3nHEO',
  response: '2010398855-Ux3VyrTh',
  home: '2010398855-7gTYrfCa',
  profile: '2010398855-7gTYrfCa',
};

function liffUrl(page) {
  return `https://liff.line.me/${LIFF_IDS[page]}`;
}

const GOOGLE_FONT_LINKS = `
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;600;700;800&family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,500,1,0&display=swap" rel="stylesheet">
`;

const NAV_CSS = `
  body { font-family: 'Noto Sans Thai', system-ui, sans-serif; }
  .minihr-bottom-nav {
    position: fixed;
    left: 10px;
    right: 10px;
    bottom: 10px;
    z-index: 9999;
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 6px;
    padding: 8px;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.96);
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.16);
    border: 1px solid #F0E0D0;
    backdrop-filter: blur(10px);
  }
  .minihr-bottom-nav a {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    color: #4A2A12;
    text-decoration: none;
    text-align: center;
    font-family: 'Noto Sans Thai', system-ui, sans-serif;
    font-size: 11px;
    font-weight: 700;
    line-height: 1.25;
    padding: 6px 2px;
    border-radius: 10px;
  }
  .minihr-bottom-nav a:active { background: #FFF3E6; }
  .material-symbols-rounded {
    font-family: 'Material Symbols Rounded';
    font-weight: 500;
    font-style: normal;
    font-size: 22px;
    line-height: 1;
    letter-spacing: normal;
    text-transform: none;
    display: inline-block;
    white-space: nowrap;
    word-wrap: normal;
    direction: ltr;
    -webkit-font-feature-settings: 'liga';
    -webkit-font-smoothing: antialiased;
    color: #D4550A;
  }
  .minihr-bottom-nav .minihr-nav-label {
    display: block;
    font-size: 10px;
  }
`;

const NAV_HTML = `
<nav class="minihr-bottom-nav" aria-label="Mini HR navigation">
  <a href="/"><span class="material-symbols-rounded">home</span><span class="minihr-nav-label">หน้าหลัก</span></a>
  <a href="${liffUrl('checkin')}"><span class="material-symbols-rounded">my_location</span><span class="minihr-nav-label">ลงเวลา</span></a>
  <a href="${liffUrl('leave')}"><span class="material-symbols-rounded">event_busy</span><span class="minihr-nav-label">ใบลา</span></a>
  <a href="${liffUrl('ot')}"><span class="material-symbols-rounded">more_time</span><span class="minihr-nav-label">OT</span></a>
  <a href="${liffUrl('balance')}"><span class="material-symbols-rounded">account_balance_wallet</span><span class="minihr-nav-label">ดูยอด</span></a>
</nav>
`;

const AUTHENTICATED_FETCH = `
  const originalFetch = window.fetch.bind(window);
  window.fetch = function(input, init) {
    if (input === APPS_SCRIPT_URL && init && init.body) {
      const payload = JSON.parse(init.body);
      payload.lineAccessToken = liff.getAccessToken();
      init = Object.assign({}, init, {
        headers: Object.assign({}, init.headers || {}, { 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload)
      });
    }
    return originalFetch(input, init).then(async function(response) {
      if (input === APPS_SCRIPT_URL && response.status === 401) {
        const errorBody = await response.clone().json().catch(function() { return {}; });
        if (errorBody.reauth) {
          liff.logout();
          liff.login({ redirectUri: window.location.href.split('#')[0] });
        }
      }
      return response;
    });
  };
`;

fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

for (const fileName of fs.readdirSync(SOURCE_DIR)) {
  if (!fileName.endsWith('.html')) continue;

  const page = path.basename(fileName, '.html');
  let html = fs.readFileSync(path.join(SOURCE_DIR, fileName), 'utf8');

  html = html
    .replace(/<\?=\s*LIFF_ID\s*\?>/g, LIFF_IDS[page] || '')
    .replace(/<\?=\s*SCRIPT_URL\s*\?>/g, '/api/hr')
    .replace(
      /if\s*\(!liff\.isLoggedIn\(\)\)\s*liff\.login\(\);/g,
      "if (!liff.isLoggedIn()) { liff.login({ redirectUri: window.location.href.split('#')[0] }); return; }"
    )
    .replace(/const maxW = 1280;/g, 'const maxW = 960;')
    .replace(/toDataURL\('image\/jpeg', 0\.85\)/g, "toDataURL('image/jpeg', 0.72)");

  if (html.includes("const APPS_SCRIPT_URL = '/api/hr';")) {
    html = html.replace(
      "const APPS_SCRIPT_URL = '/api/hr';",
      "const APPS_SCRIPT_URL = '/api/hr';" + AUTHENTICATED_FETCH
    );
  }

  if (page !== 'home') {
    html = html.replace('</head>', `${GOOGLE_FONT_LINKS}\n</head>`);
  }

  if (page !== 'home' && page !== 'register') {
    html = html
      .replace('</style>', `${NAV_CSS}\n  body { padding-bottom: 92px; }\n</style>`)
      .replace('</body>', `${NAV_HTML}\n</body>`);
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, fileName), html);
}

console.log('Built LIFF frontend:', Object.keys(LIFF_IDS).length, 'apps');
