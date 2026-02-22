const config = require('../config');
const { hashApiKey, findKeyByHash, updateKeyLastUsed } = require('../auth/apikeys');
const { findUserById } = require('../auth/users');
const { checkQuota } = require('../auth/usage');

function apiKeyAuth(req, res, next) {
  // Self-hosted mode: skip auth entirely
  if (!config.requireApiKey) {
    req.iopUser = null;
    req.iopKeyId = null;
    return next();
  }

  // Extract API key from header
  let rawKey = req.headers['x-ioproof-key'];
  if (!rawKey) {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer iop_live_')) {
      rawKey = authHeader.substring(7); // strip "Bearer "
    }
  }

  if (!rawKey) {
    return res.status(401).json({
      error: {
        message: 'Missing API key. Provide X-IOProof-Key header or Authorization: Bearer iop_live_...',
        code: 'MISSING_API_KEY',
      },
    });
  }

  if (!rawKey.startsWith('iop_live_')) {
    return res.status(401).json({
      error: { message: 'Invalid API key format.', code: 'INVALID_API_KEY' },
    });
  }

  // Hash and look up
  const keyHash = hashApiKey(rawKey);
  const keyRecord = findKeyByHash(keyHash);

  if (!keyRecord) {
    return res.status(401).json({
      error: { message: 'Invalid API key.', code: 'INVALID_API_KEY' },
    });
  }

  // Load user
  const user = findUserById(keyRecord.userId);
  if (!user || user.status !== 1) {
    return res.status(401).json({
      error: { message: 'Account inactive or not found.', code: 'ACCOUNT_INACTIVE' },
    });
  }

  // Check quota
  const quota = checkQuota(user.id, user.tier);
  if (!quota.allowed) {
    return res.status(429).json({
      error: {
        message: `Monthly quota exceeded. Used ${quota.used}/${quota.limit} proofs this month.`,
        code: 'QUOTA_EXCEEDED',
        used: quota.used,
        limit: quota.limit,
        tier: quota.tier,
      },
    });
  }

  // Attach to request
  req.iopUser = user;
  req.iopKeyId = keyRecord.id;

  // Update last used (async, non-blocking)
  updateKeyLastUsed(keyRecord.id);

  next();
}

module.exports = { apiKeyAuth };
