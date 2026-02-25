const crypto = require('crypto');
const { sha256 } = require('./hasher');
const { getProvider } = require('../providers');

// In-memory cache for provider public keys: "provider:keyId" -> { publicKey, expiresAt }
const keyCache = new Map();
const CACHE_TTL_MS = 3600000; // 1 hour

/**
 * Build the canonical message that gets signed.
 * Format: ioproof:v1:{requestHash}|{responseHash}|{timestamp}
 */
function buildSignatureMessage(requestHash, responseHash, timestamp) {
  return `ioproof:v1:${requestHash}|${responseHash}|${timestamp}`;
}

/**
 * Fetch a provider's public key from their .well-known/ioproof.json endpoint.
 * Caches results in memory for 1 hour.
 *
 * @param {string} providerName - Provider name (e.g. "openai")
 * @param {string} keyId - Key identifier to match
 * @returns {Buffer|null} - Public key as DER buffer, or null if not found
 */
async function fetchProviderPublicKey(providerName, keyId) {
  const cacheKey = `${providerName}:${keyId}`;
  const cached = keyCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.publicKey;
  }

  const provider = getProvider(providerName);
  if (!provider || !provider.baseUrl) {
    return null;
  }

  try {
    const url = `${provider.baseUrl}/.well-known/ioproof.json`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = await res.json();
    if (!data.keys || !Array.isArray(data.keys)) return null;

    const keyEntry = data.keys.find(k => k.kid === keyId);
    if (!keyEntry || !keyEntry.public_key) return null;

    // Convert hex public key to a KeyObject
    const publicKey = crypto.createPublicKey({
      key: Buffer.concat([
        // Ed25519 DER prefix (12 bytes) + 32 bytes raw key
        Buffer.from('302a300506032b6570032100', 'hex'),
        Buffer.from(keyEntry.public_key, 'hex'),
      ]),
      format: 'der',
      type: 'spki',
    });

    keyCache.set(cacheKey, { publicKey, expiresAt: Date.now() + CACHE_TTL_MS });
    return publicKey;
  } catch (err) {
    // Network error, timeout, parse error — silently return null
    return null;
  }
}

/**
 * Verify a provider's Ed25519 signature on an IOProof attestation.
 *
 * @param {string} requestHash - SHA-256 hex hash of request body
 * @param {string} responseHash - SHA-256 hex hash of response body
 * @param {string} signature - Base64-encoded Ed25519 signature
 * @param {string} signatureTimestamp - ISO timestamp the provider used when signing
 * @param {string} keyId - Key identifier from X-IOProof-Key-Id header
 * @param {string} providerName - Provider name (e.g. "openai")
 * @returns {object|null} - { verified, keyId, signatureTimestamp } or null if no key found
 */
async function verifyProviderSignature(requestHash, responseHash, signature, signatureTimestamp, keyId, providerName) {
  try {
    const publicKey = await fetchProviderPublicKey(providerName, keyId);
    if (!publicKey) {
      return null; // No key available — can't verify, not necessarily invalid
    }

    const message = buildSignatureMessage(requestHash, responseHash, signatureTimestamp);
    const messageBuffer = Buffer.from(message, 'utf-8');
    const signatureBuffer = Buffer.from(signature, 'base64');

    const verified = crypto.verify(null, messageBuffer, publicKey, signatureBuffer);

    return {
      verified,
      keyId,
      signatureTimestamp,
    };
  } catch (err) {
    return {
      verified: false,
      keyId,
      signatureTimestamp,
      error: err.message,
    };
  }
}

/**
 * Register a provider's public key directly (for testing or manual config).
 * Bypasses the .well-known fetch.
 */
function registerProviderKey(providerName, keyId, publicKeyHex) {
  const cacheKey = `${providerName}:${keyId}`;
  const publicKey = crypto.createPublicKey({
    key: Buffer.concat([
      Buffer.from('302a300506032b6570032100', 'hex'),
      Buffer.from(publicKeyHex, 'hex'),
    ]),
    format: 'der',
    type: 'spki',
  });
  keyCache.set(cacheKey, { publicKey, expiresAt: Date.now() + CACHE_TTL_MS });
}

module.exports = {
  verifyProviderSignature,
  fetchProviderPublicKey,
  registerProviderKey,
  buildSignatureMessage,
};
