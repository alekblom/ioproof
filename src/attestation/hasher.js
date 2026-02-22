const crypto = require('crypto');

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function buildCombinedHash(requestHash, responseHash, timestamp) {
  const payload = `${requestHash}|${responseHash}|${timestamp}`;
  return sha256(Buffer.from(payload, 'utf-8'));
}

module.exports = { sha256, buildCombinedHash };
