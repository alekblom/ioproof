const { Router } = require('express');
const {
  findUserByEmail,
  findUserByAlexiuzId,
  insertUser,
  insertSsoUser,
  updateUser,
  verifyPassword,
  generateSessionHash,
  findUserBySession,
} = require('../auth/users');
const { consumeToken } = require('../auth/alexiuz-sso');
const { sendVerificationEmail } = require('../auth/email');
const config = require('../config');

const router = Router();

// POST /auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: { message: 'Email and password are required.', code: 'MISSING_FIELDS' },
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        error: { message: 'Invalid email format.', code: 'INVALID_EMAIL' },
      });
    }

    if (password.length < 12) {
      return res.status(400).json({
        error: { message: 'Password must be at least 12 characters.', code: 'SHORT_PASSWORD' },
      });
    }

    const existing = findUserByEmail(email);
    if (existing) {
      return res.status(409).json({
        error: { message: 'An account with this email already exists.', code: 'EMAIL_EXISTS' },
      });
    }

    const user = await insertUser({ email, password });

    // Send verification email (or auto-activate if no email config)
    if (config.emailApiKey) {
      await sendVerificationEmail(user.email, user.activationHash);
      res.json({ status: 'success', message: 'Check your email for a verification link.' });
    } else {
      // Self-hosted / no email: auto-activate
      updateUser(user.id, { status: 1, activationHash: null });
      res.json({ status: 'success', message: 'Account created and activated.' });
    }
  } catch (err) {
    console.error('[AUTH] Register error:', err.message);
    res.status(500).json({ error: { message: 'Registration failed.', code: 'INTERNAL' } });
  }
});

// POST /auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: { message: 'Email and password are required.', code: 'MISSING_FIELDS' },
      });
    }

    const user = findUserByEmail(email);
    if (!user) {
      return res.status(401).json({
        error: { message: 'Invalid email or password.', code: 'INVALID_CREDENTIALS' },
      });
    }

    const valid = await verifyPassword(user, password);
    if (!valid) {
      return res.status(401).json({
        error: { message: 'Invalid email or password.', code: 'INVALID_CREDENTIALS' },
      });
    }

    if (user.status === 0) {
      return res.status(403).json({
        error: { message: 'Please verify your email first.', code: 'NOT_VERIFIED' },
      });
    }

    if (user.status === 9) {
      return res.status(403).json({
        error: { message: 'Account suspended.', code: 'BANNED' },
      });
    }

    // Create session
    const sessionHash = generateSessionHash();
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;

    updateUser(user.id, {
      sessionHash,
      sessionIp: ip,
      lastLoginAt: new Date().toISOString(),
    });

    res.setHeader('Set-Cookie',
      `ioproof_session=${sessionHash}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 3600}` +
      (config.nodeEnv === 'production' ? '; Secure' : '')
    );

    res.json({ status: 'success' });
  } catch (err) {
    console.error('[AUTH] Login error:', err.message);
    res.status(500).json({ error: { message: 'Login failed.', code: 'INTERNAL' } });
  }
});

// POST /auth/logout
router.post('/logout', (req, res) => {
  // Parse session cookie
  const cookies = {};
  (req.headers.cookie || '').split(';').forEach((pair) => {
    const [key, ...rest] = pair.trim().split('=');
    cookies[key] = rest.join('=');
  });

  const sessionHash = cookies['ioproof_session'];
  if (sessionHash) {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
    const user = findUserBySession(sessionHash, ip);
    if (user) {
      updateUser(user.id, { sessionHash: null, sessionIp: null });
    }
  }

  res.setHeader('Set-Cookie', 'ioproof_session=; Path=/; HttpOnly; Max-Age=0');
  res.json({ status: 'success' });
});

// GET /auth/activate?email=...&hash=...
router.get('/activate', (req, res) => {
  const { email, hash } = req.query;

  if (!email || !hash) {
    return res.status(400).json({
      error: { message: 'Missing email or hash.', code: 'MISSING_FIELDS' },
    });
  }

  const user = findUserByEmail(email);
  if (!user || user.activationHash !== hash) {
    return res.status(400).json({
      error: { message: 'Invalid or expired activation link.', code: 'INVALID_ACTIVATION' },
    });
  }

  if (user.status === 1) {
    return res.json({ status: 'success', message: 'Account already activated.' });
  }

  updateUser(user.id, { status: 1, activationHash: null });
  res.json({ status: 'success', message: 'Account activated. You can now log in.' });
});

// GET /auth/me (requires session cookie)
router.get('/me', (req, res) => {
  const cookies = {};
  (req.headers.cookie || '').split(';').forEach((pair) => {
    const [key, ...rest] = pair.trim().split('=');
    cookies[key] = rest.join('=');
  });

  const sessionHash = cookies['ioproof_session'];
  if (!sessionHash) {
    return res.status(401).json({ error: { message: 'Not authenticated.', code: 'NOT_AUTHENTICATED' } });
  }

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
  const user = findUserBySession(sessionHash, ip);

  if (!user) {
    return res.status(401).json({ error: { message: 'Session expired.', code: 'SESSION_EXPIRED' } });
  }

  res.json({
    id: user.id,
    email: user.email,
    tier: user.tier,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  });
});

// GET /auth/sso/callback?token=...
router.get('/sso/callback', async (req, res) => {
  try {
    const { token } = req.query;
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;

    const ssoUser = await consumeToken(token, clientIp);
    if (!ssoUser) {
      return res.redirect('/login?error=invalid-token');
    }

    // Find or create local user
    let user = findUserByAlexiuzId(ssoUser.alexiuzUserId);

    if (!user) {
      // Try by email
      user = findUserByEmail(ssoUser.email);
      if (user) {
        // Link existing account to alexiuz
        if (!user.alexiuzUserId) {
          updateUser(user.id, { alexiuzUserId: ssoUser.alexiuzUserId });
        }
      } else {
        // Create new SSO user
        user = insertSsoUser({
          email: ssoUser.email,
          alexiuzUserId: ssoUser.alexiuzUserId,
        });
      }
    }

    // Create session
    const sessionHash = generateSessionHash();
    updateUser(user.id, {
      sessionHash,
      sessionIp: clientIp,
      status: 1,
      lastLoginAt: new Date().toISOString(),
    });

    res.setHeader('Set-Cookie',
      `ioproof_session=${sessionHash}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 3600}` +
      (config.nodeEnv === 'production' ? '; Secure' : '')
    );

    res.redirect('/dashboard');
  } catch (err) {
    console.error('[AUTH] SSO callback error:', err.message);
    res.redirect('/login?error=sso-failed');
  }
});

module.exports = router;
