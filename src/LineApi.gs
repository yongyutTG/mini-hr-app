/**
 * ============================================================
 * LINE Messaging API wrapper
 * ============================================================
 */

const LINE_API_BASE = 'https://api.line.me';

/**
 * Push message to a user
 * @param {string} to - LINE user ID
 * @param {Array} messages - array of message objects
 */
function pushMessage(to, messages) {
  const token = getProp('LINE_CHANNEL_ACCESS_TOKEN');
  const url = LINE_API_BASE + '/v2/bot/message/push';

  const payload = {
    to: to,
    messages: messages
  };

  return retryRequest(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Authorization': 'Bearer ' + token },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
}

/**
 * Reply to a webhook event using replyToken
 */
function replyMessage(replyToken, messages) {
  const token = getProp('LINE_CHANNEL_ACCESS_TOKEN');
  const url = LINE_API_BASE + '/v2/bot/message/reply';

  const payload = {
    replyToken: replyToken,
    messages: messages
  };

  return retryRequest(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Authorization': 'Bearer ' + token },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
}

/**
 * Push a Flex Message
 */
function pushFlex(to, altText, flexContents) {
  return pushMessage(to, [{
    type: 'flex',
    altText: altText || 'แจ้งเตือน',
    contents: flexContents
  }]);
}

/**
 * Push flex card to owner (HR/admin)
 */
function pushFlexToOwner(altText, flexContents) {
  const ownerId = getProp('OWNER_LINE_USER_ID');
  return pushFlex(ownerId, altText, flexContents);
}

/**
 * Get LINE user profile
 */
function getLineProfile(userId) {
  const token = getProp('LINE_CHANNEL_ACCESS_TOKEN');
  const url = LINE_API_BASE + '/v2/bot/profile/' + userId;

  try {
    const res = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: { 'Authorization': 'Bearer ' + token },
      muteHttpExceptions: true
    });
    if (res.getResponseCode() === 200) {
      return JSON.parse(res.getContentText());
    }
    logWarn('getLineProfile', 'non-200', { userId, code: res.getResponseCode() });
    return null;
  } catch (err) {
    logError('getLineProfile', err.message, { userId });
    return null;
  }
}

/**
 * Verify LINE webhook signature (HMAC-SHA256)
 * NOTE: Apps Script doPost does not expose request headers!
 * For production, use Cloudflare Workers as proxy that adds signature in query string.
 */
function verifyLineSignature(body, signature) {
  if (!signature) return false;
  const secret = getProp('LINE_CHANNEL_SECRET');
  const hash = Utilities.computeHmacSha256Signature(body, secret);
  const expected = Utilities.base64Encode(hash);
  return signature === expected;
}

/**
 * Retry with exponential backoff
 */
function retryRequest(url, options, maxRetries) {
  maxRetries = maxRetries || 3;
  let lastError = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = UrlFetchApp.fetch(url, options);
      const code = res.getResponseCode();

      if (code >= 200 && code < 300) {
        return { ok: true, status: code, body: res.getContentText() };
      }

      // Server error → retry
      if (code >= 500) {
        lastError = 'http_' + code;
        Utilities.sleep(Math.pow(2, attempt) * 1000);
        continue;
      }

      // Client error → don't retry
      logWarn('retryRequest', 'client_error', { url, code, body: res.getContentText() });
      return { ok: false, status: code, body: res.getContentText() };

    } catch (err) {
      lastError = err.message;
      logWarn('retryRequest', 'fetch_error', { url, attempt, error: err.message });
      if (attempt < maxRetries - 1) {
        Utilities.sleep(Math.pow(2, attempt) * 1000);
      }
    }
  }

  logError('retryRequest', 'max_retries_exceeded', { url, lastError });
  return { ok: false, error: lastError };
}

/**
 * Set Rich Menu for a specific user
 */
function linkRichMenuToUser(userId, richMenuId) {
  const token = getProp('LINE_CHANNEL_ACCESS_TOKEN');
  const url = LINE_API_BASE + '/v2/bot/user/' + userId + '/richmenu/' + richMenuId;

  return retryRequest(url, {
    method: 'post',
    headers: { 'Authorization': 'Bearer ' + token },
    muteHttpExceptions: true
  });
}

/**
 * Unlink rich menu (back to default)
 */
function unlinkRichMenu(userId) {
  const token = getProp('LINE_CHANNEL_ACCESS_TOKEN');
  const url = LINE_API_BASE + '/v2/bot/user/' + userId + '/richmenu';

  return retryRequest(url, {
    method: 'delete',
    headers: { 'Authorization': 'Bearer ' + token },
    muteHttpExceptions: true
  });
}
