const crypto = require('crypto');

// Lightweight double-submit CSRF protection tied to the session.
// A token is generated per session and must be echoed back in the
// X-CSRF-Token header for any state-changing request.

function ensureToken(req) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  return req.session.csrfToken;
}

function csrfTokenRoute(req, res) {
  res.json({ csrfToken: ensureToken(req) });
}

function csrfProtect(req, res, next) {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    ensureToken(req);
    return next();
  }
  // Login doesn't require CSRF (no session yet); everything else does.
  if (req.path === '/api/auth/login') return next();

  const headerToken = req.headers['x-csrf-token'];
  const sessionToken = req.session.csrfToken;
  if (!sessionToken || !headerToken || headerToken !== sessionToken) {
    return res.status(403).json({ error: 'Invalid or missing security token. Please refresh the page and try again.' });
  }
  next();
}

module.exports = { csrfProtect, csrfTokenRoute, ensureToken };
