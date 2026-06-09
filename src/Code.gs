/**
 * ============================================================
 * Mini HR App — Entry Point
 * ============================================================
 * Apps Script Web App entry (doPost / doGet)
 *
 * URL pattern after deploy:
 *   https://script.google.com/macros/s/{deployId}/exec
 *
 * Handles:
 *   - POST from LIFF frontend → action handlers
 *   - POST from LINE webhook → handleLineWebhook
 *   - GET → serve HTML page
 *
 * Author: Mini HR App scaffolding (skeleton)
 * License: MIT-style
 */

/**
 * Main POST handler — entry for ALL backend calls
 * @param {GoogleAppsScript.Events.DoPost} e
 */
function doPost(e) {
  let body = {};
  try {
    body = JSON.parse(e.postData.contents || '{}');
  } catch (parseErr) {
    return jsonOutput({ ok: false, error: 'invalid_json' });
  }

  try {
    // === Case 1: LINE Webhook event ===
    if (body.events && Array.isArray(body.events)) {
      // Verify LINE signature
      const signature = e.parameter ? e.parameter['x-line-signature'] : null;
      // NOTE: LINE sends signature in HEADER, but Apps Script doesn't expose headers in doPost
      // Workaround: skip verification (UNSAFE) OR use API Gateway/Cloudflare in front
      // For production, set up Cloudflare Worker to proxy + verify
      // if (!verifyLineSignature(e.postData.contents, signature)) {
      //   logError('doPost', 'invalid_signature', { signature });
      //   return jsonOutput({ ok: false, error: 'invalid_signature' });
      // }

      return handleLineWebhook(body.events);
    }

    // === Case 2: LIFF action call ===
    const action = body.action;
    if (!action) {
      return jsonOutput({ ok: false, error: 'missing_action' });
    }

    return routeAction(action, body);

  } catch (err) {
    logError('doPost', err.message, { body, stack: err.stack });
    return jsonOutput({ ok: false, error: 'internal_error', message: err.message });
  }
}

/**
 * GET handler — serve LIFF HTML pages
 * URL: ?page=register|checkin|leave|ot|balance|hr-tools|approval-inbox|evidence|response
 */
function doGet(e) {
  const page = (e.parameter && e.parameter.page) || 'home';
  const allowedPages = [
    'register', 'checkin', 'leave', 'ot', 'balance',
    'hr-tools', 'approval-inbox', 'evidence', 'response', 'home'
  ];

  if (!allowedPages.includes(page)) {
    return HtmlService.createHtmlOutput('Page not found').setTitle('404');
  }

  // Load template
  try {
    const template = HtmlService.createTemplateFromFile('liff/' + page);
    // Inject Apps Script URL into template
    template.SCRIPT_URL = ScriptApp.getService().getUrl();
    template.LIFF_ID = getLiffIdForPage(page);
    return template.evaluate()
      .setTitle('Mini HR App — ' + page)
      .setSandboxMode(HtmlService.SandboxMode.IFRAME)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0');
  } catch (err) {
    logError('doGet', err.message, { page });
    return HtmlService.createHtmlOutput('Error loading page: ' + err.message);
  }
}

function getLiffIdForPage(page) {
  const props = PropertiesService.getScriptProperties();
  const map = {
    'register': 'LIFF_ID_REGISTER',
    'checkin': 'LIFF_ID_CHECKIN',
    'leave': 'LIFF_ID_LEAVE',
    'ot': 'LIFF_ID_OT',
    'balance': 'LIFF_ID_BALANCE',
    'hr-tools': 'LIFF_ID_HR_TOOLS',
    'approval-inbox': 'LIFF_ID_APPROVAL',
    'evidence': 'LIFF_ID_EVIDENCE',
    'response': 'LIFF_ID_RESPONSE',
  };
  return map[page] ? props.getProperty(map[page]) : '';
}

/**
 * Wrap response in JSON ContentService
 */
function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Manual run from editor — initialize all sheets
 * Run this ONCE after first setup
 */
function setupSheets() {
  return initializeAllSheets();
}

/**
 * Manual run from editor — test config
 */
function testConfig() {
  const config = getConfig();
  Logger.log(JSON.stringify(config, null, 2));
  return config;
}
