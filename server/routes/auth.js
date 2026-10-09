const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const db = require('../db/database');
const { logAudit, publicUser } = require('../utils/helpers');
const { ensureToken } = require('../middleware/csrf');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' }
});

router.post('/login',
  loginLimiter,
  body('email').isEmail().normalizeEmail(),
  body('password').isString().isLength({ min: 1, max: 200 }),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Please provide a valid email and password.' });
    }
    const { email, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    // Constant-shape response to avoid user enumeration / leaking internals
    const genericFail = () => {
      logAudit({ userLabel: email, action: 'Login failed', entityType: 'user', result: 'failure' });
      return res.status(401).json({ error: 'Invalid email or password.' });
    };

    if (!user || user.status !== 'active') return genericFail();

    const ok = bcrypt.compareSync(password, user.password_hash);
    if (!ok) return genericFail();

    req.session.regenerate((err) => {
      if (err) {
        return res.status(500).json({ error: 'Could not start session. Please try again.' });
      }
      req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role };
      const csrfToken = ensureToken(req);
      logAudit({ userId: user.id, userLabel: user.email, action: 'Login', entityType: 'user', entityId: user.id });
      res.json({ user: publicUser(user), csrfToken });
    });
  }
);

router.post('/logout', (req, res) => {
  const user = req.session.user;
  if (user) {
    logAudit({ userId: user.id, userLabel: user.email, action: 'Logout', entityType: 'user', entityId: user.id });
  }
  req.session.destroy(() => {
    res.clearCookie('acm.sid');
    res.json({ message: 'Logged out successfully.' });
  });
});

router.get('/me', (req, res) => {
  if (!req.session || !req.session.user) return res.status(401).json({ error: 'Not authenticated.' });
  res.json({ user: req.session.user });
});

module.exports = router;
