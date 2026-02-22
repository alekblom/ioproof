const crypto = require('crypto');

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function buildCombinedHash(requestHash, responseHash, timestamp) {
  const payload = `${requestHash}|${responseHash}|${timestamp}`;
  return sha256(Buffer.from(payload, 'utf-8'));
}

/**
 * Generate a cryptographic secret for blinding a proof.
 * Returns a 32-byte hex string (256 bits of entropy).
 */
function generateSecret() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create a blinded hash: SHA-256(combinedHash | secret).
 * Only someone with the secret can link back to the original combined hash.
 * This is the value used as the Merkle leaf — nothing on-chain reveals the original data.
 */
function blindHash(combinedHash, secret) {
  return sha256(Buffer.from(`${combinedHash}|${secret}`, 'utf-8'));
}

module.exports = { sha256, buildCombinedHash, generateSecret, blindHash };
