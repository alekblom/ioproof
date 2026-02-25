/**
 * @ioproof/provider — Cryptographic response signing for AI providers.
 *
 * Install this middleware on your API server to Ed25519-sign every response.
 * IOProof captures the signature and verifies it, making proofs tamper-proof.
 *
 * Zero dependencies — uses only Node.js built-in crypto.
 */

const crypto = require('crypto');

// Ed25519 DER prefixes for key encoding
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');
const ED25519_PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');

/**
 * SHA-256 hash of a buffer or string, returned as hex.
 */
function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Generate a new Ed25519 keypair for signing responses.
 *
 * @returns {{ publicKey: string, privateKey: string, keyId: string }}
 *   publicKey and privateKey are hex-encoded raw keys (32 bytes each).
 *   keyId is a suggested identifier (YYYY-MM format).
 */
function generateKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'der' },
  });

  // Extract raw 32-byte keys from DER encoding
  const pubHex = publicKey.subarray(ED25519_SPKI_PREFIX.length).toString('hex');
  const privHex = privateKey.subarray(ED25519_PKCS8_PREFIX.length).toString('hex');

  const now = new Date();
  const keyId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  return { publicKey: pubHex, privateKey: privHex, keyId };
}

/**
 * Create a signing function from a private key.
 *
 * @param {string} privateKeyHex - 32-byte hex-encoded Ed25519 private key
 * @param {string} keyId - Key identifier (e.g. "2026-02")
 * @returns {function} sign(requestBody, responseBody) -> { signature, timestamp, keyId, headers }
 */
function createSigner(privateKeyHex, keyId) {
  const privateKey = crypto.createPrivateKey({
    key: Buffer.concat([ED25519_PKCS8_PREFIX, Buffer.from(privateKeyHex, 'hex')]),
    format: 'der',
    type: 'pkcs8',
  });

  /**
   * Sign a request/response pair.
   *
   * @param {Buffer|string} requestBody - The raw request body
   * @param {Buffer|string} responseBody - The raw response body
   * @returns {{ signature: string, timestamp: string, keyId: string, headers: object }}
   */
  return function sign(requestBody, responseBody) {
    const reqHash = sha256(Buffer.isBuffer(requestBody) ? requestBody : Buffer.from(String(requestBody), 'utf-8'));
    const resHash = sha256(Buffer.isBuffer(responseBody) ? responseBody : Buffer.from(String(responseBody), 'utf-8'));
    const timestamp = new Date().toISOString();

    const message = `ioproof:v1:${reqHash}|${resHash}|${timestamp}`;
    const signature = crypto.sign(null, Buffer.from(message, 'utf-8'), privateKey).toString('base64');

    return {
      signature,
      timestamp,
      keyId,
      requestHash: reqHash,
      responseHash: resHash,
      headers: {
        'X-IOProof-Sig': signature,
        'X-IOProof-Sig-Ts': timestamp,
        'X-IOProof-Key-Id': keyId,
      },
    };
  };
}

/**
 * Express middleware that signs every response with Ed25519.
 *
 * @param {{ privateKey: string, keyId: string }} options
 * @returns {function} Express middleware
 *
 * @example
 * const { middleware } = require('@ioproof/provider');
 * app.use(middleware({ privateKey: process.env.IOPROOF_PRIVATE_KEY, keyId: '2026-02' }));
 */
function middleware(options) {
  if (!options || !options.privateKey || !options.keyId) {
    throw new Error('@ioproof/provider middleware requires { privateKey, keyId }');
  }

  const sign = createSigner(options.privateKey, options.keyId);

  return function ioproofMiddleware(req, res, next) {
    // Capture request body for hashing
    let requestBody;
    if (req.rawBody) {
      requestBody = req.rawBody;
    } else if (req.body) {
      requestBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    } else {
      requestBody = '';
    }

    // Intercept response to capture body and sign before sending
    const chunks = [];
    const originalWrite = res.write;
    const originalEnd = res.end;

    res.write = function (chunk, encoding, callback) {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding || 'utf-8'));
      }
      return originalWrite.apply(res, arguments);
    };

    res.end = function (chunk, encoding, callback) {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding || 'utf-8'));
      }

      try {
        const responseBody = Buffer.concat(chunks);
        const result = sign(requestBody, responseBody);

        // Set signature headers (only if headers haven't been sent yet)
        if (!res.headersSent) {
          res.setHeader('X-IOProof-Sig', result.signature);
          res.setHeader('X-IOProof-Sig-Ts', result.timestamp);
          res.setHeader('X-IOProof-Key-Id', result.keyId);
        }
      } catch (err) {
        // Never crash the API — log warning and continue
        console.error('[ioproof/provider] Signing error:', err.message);
      }

      return originalEnd.apply(res, arguments);
    };

    next();
  };
}

/**
 * Express route handler for /.well-known/ioproof.json
 * Serves the provider's public key(s) for signature verification.
 *
 * @param {Array<{ kid: string, publicKey: string }>} keys
 * @returns {function} Express route handler
 *
 * @example
 * app.get('/.well-known/ioproof.json', wellKnown([{ kid: '2026-02', publicKey: pubHex }]));
 */
function wellKnown(keys) {
  const body = {
    version: '1.0',
    keys: keys.map(k => ({
      kid: k.kid,
      algorithm: 'ed25519',
      public_key: k.publicKey,
    })),
  };

  return function (req, res) {
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json(body);
  };
}

module.exports = { generateKeyPair, createSigner, middleware, wellKnown };
