const APPS_SCRIPT_URL =
  process.env.APPS_SCRIPT_URL ||
  'https://script.google.com/macros/s/AKfycbzwXz0zt4fL3Rv4E3lbeOO4AIvUciO_a0GyIeCYe5d4Q97AQb8SMOY5cC2zRAqF3re8/exec';
module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, service: 'mini-hr-api' });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  try {
    const input = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const publicActions = new Set(['checkin_branches']);
    const action = input.action;
    const lineAccessToken = input.lineAccessToken;
    if (!lineAccessToken && !publicActions.has(action)) {
      return res.status(401).json({ ok: false, error: 'missing_line_identity' });
    }

    if (lineAccessToken) {
      const verifyResponse = await fetch('https://api.line.me/v2/profile', {
        headers: { Authorization: `Bearer ${lineAccessToken}` }
      });
      const identity = await verifyResponse.json();
      if (!verifyResponse.ok || !identity.userId) {
        return res.status(401).json({
          ok: false,
          error: 'invalid_line_identity',
          reauth: true,
          message: identity.message || 'LINE identity verification failed'
        });
      }

      input.lineUserId = identity.userId;
    }

    delete input.lineAccessToken;
    const body = JSON.stringify(input);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);

    const upstream = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body,
      redirect: 'follow',
      signal: controller.signal
    });
    clearTimeout(timeout);

    const text = await upstream.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch (error) {
      payload = {
        ok: false,
        error: 'invalid_backend_response',
        message: text.slice(0, 300)
      };
    }

    if (action === 'checkin' || !payload.ok) {
      console.log('[api/hr] upstream response', {
        action,
        httpStatus: upstream.status,
        ok: payload.ok,
        error: payload.error,
        message: payload.message,
        checkinId: payload.checkinId,
        inRange: payload.inRange,
        branchName: payload.branchName
      });
    }

    return res.status(upstream.ok ? 200 : upstream.status).json(payload);
  } catch (error) {
    const timedOut = error && error.name === 'AbortError';
    const invalidJson = error instanceof SyntaxError;
    return res.status(timedOut ? 504 : (invalidJson ? 400 : 502)).json({
      ok: false,
      error: timedOut ? 'backend_timeout' : (invalidJson ? 'invalid_json' : 'backend_unavailable'),
      message: error && error.message ? error.message : String(error)
    });
  }
};

module.exports.config = {
  maxDuration: 60
};
