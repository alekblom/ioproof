const { Router } = require('express');
const bcrypt = require('bcrypt');
const { generateApiKey, getKeysForUser, insertApiKey, revokeApiKey } = require('../auth/apikeys');
const { checkQuota, getUsageHistory, currentMonth } = require('../auth/usage');
const { updateUser, findUserByEmail, verifyPassword } = require('../auth/users');
const { getTierName } = require('../auth/tiers');
const { getRecentProofsForUser, getAllProofsForUser } = require('../db');

const router = Router();

// GET /api/dashboard/stats
router.get('/stats', (req, res) => {
  const user = req.user;
  const quota = checkQuota(user.id, user.tier);
  const keys = getKeysForUser(user.id);
  const activeKeys = keys.filter((k) => !k.revoked);
  const recentProofs = getRecentProofsForUser(user.id, 10);

  res.json({
    user: {
      email: user.email,
      tier: user.tier,
      tierName: getTierName(user.tier),
      createdAt: user.createdAt,
    },
    usage: {
      used: quota.used,
      limit: quota.limit,
      month: quota.month,
      percentUsed: quota.limit > 0 ? Math.round((quota.used / quota.limit) * 100) : 0,
    },
    keys: {
      total: keys.length,
      active: activeKeys.length,
    },
    recentProofs,
  });
});

// GET /api/dashboard/keys
router.get('/keys', (req, res) => {
  const keys = getKeysForUser(req.user.id).map((k) => ({
    id: k.id,
    name: k.name,
    prefix: k.prefix,
    createdAt: k.createdAt,
    lastUsedAt: k.lastUsedAt,
    revoked: k.revoked,
  }));

  res.json({ keys });
});

// POST /api/dashboard/keys
router.post('/keys', (req, res) => {
  const { name } = req.body;

  // Limit to 5 active keys per user
  const existing = getKeysForUser(req.user.id).filter((k) => !k.revoked);
  if (existing.length >= 5) {
    return res.status(400).json({
      error: { message: 'Maximum 5 active API keys.', code: 'KEY_LIMIT' },
    });
  }

  const { fullKey, keyHash, prefix } = generateApiKey();

  const key = insertApiKey({
    userId: req.user.id,
    name: name || 'Default',
    keyHash,
    prefix,
  });

  res.json({
    key: {
      id: key.id,
      name: key.name,
      fullKey,
      prefix: key.prefix,
    },
    warning: 'This is the only time the full key will be shown. Store it securely.',
  });
});

// DELETE /api/dashboard/keys/:id
router.delete('/keys/:id', (req, res) => {
  const result = revokeApiKey(req.params.id, req.user.id);
  if (!result) {
    return res.status(404).json({
      error: { message: 'Key not found.', code: 'NOT_FOUND' },
    });
  }
  res.json({ status: 'revoked' });
});

// GET /api/dashboard/usage
router.get('/usage', (req, res) => {
  const quota = checkQuota(req.user.id, req.user.tier);
  const history = getUsageHistory(req.user.id, 6);

  res.json({
    current: {
      month: quota.month,
      used: quota.used,
      limit: quota.limit,
    },
    history,
  });
});

// GET /api/dashboard/proofs?page=1
router.get('/proofs', (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const result = getAllProofsForUser(req.user.id, page, 20);
  res.json(result);
});

// PUT /api/dashboard/account
router.put('/account', async (req, res) => {
  try {
    const { email, currentPassword, newPassword } = req.body;

    // Change email
    if (email && email !== req.user.email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({
          error: { message: 'Invalid email format.', code: 'INVALID_EMAIL' },
        });
      }
      const existing = findUserByEmail(email);
      if (existing) {
        return res.status(409).json({
          error: { message: 'Email already in use.', code: 'EMAIL_EXISTS' },
        });
      }
      updateUser(req.user.id, { email: email.toLowerCase() });
    }

    // Change password
    if (currentPassword && newPassword) {
      if (newPassword.length < 12) {
        return res.status(400).json({
          error: { message: 'New password must be at least 12 characters.', code: 'SHORT_PASSWORD' },
        });
      }
      const valid = await verifyPassword(req.user, currentPassword);
      if (!valid) {
        return res.status(401).json({
          error: { message: 'Current password is incorrect.', code: 'WRONG_PASSWORD' },
        });
      }
      const passwordHash = await bcrypt.hash(newPassword, 10);
      updateUser(req.user.id, { passwordHash });
    }

    res.json({ status: 'updated' });
  } catch (err) {
    console.error('[DASHBOARD] Account update error:', err.message);
    res.status(500).json({ error: { message: 'Update failed.', code: 'INTERNAL' } });
  }
});

module.exports = router;
