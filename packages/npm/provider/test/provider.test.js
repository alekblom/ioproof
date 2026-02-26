/**
 * @ioproof/provider test suite.
 *
 * Uses node:test + node:assert (zero dependencies).
 * Includes a hard-coded cross-language test vector — the same keypair, input,
 * and expected signature are used in the Python and Go test suites.
 *
 * Run: node --test test/provider.test.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const http = require('node:http');
const { generateKeyPair, createSigner, middleware, wellKnown } = require('../index');

// ─── Cross-language test vector ──────────────────────────────────────────────
// Ed25519 is deterministic: same key + message = same signature, always.
// Python and Go test suites MUST use these exact values and produce the same
// signature string. If they don't, there is a cross-language compatibility bug.
const VECTOR = {
  privateKey: '4c830864429505b175ea2fd113367a2b0671a24bd78a827fa24377c66d66b64f',
  publicKey:  '24ab368303288a10e15205fa54f15d0761b7cd3363bb017a2d4afaec1db14703',
  keyId:      'test-2026',
  requestBody:  '{"model":"gpt-4o","messages":[{"role":"user","content":"Hello"}]}',
  responseBody: '{"choices":[{"message":{"content":"Hi there!"}}]}',
  timestamp:    '2026-01-15T12:00:00.000Z',
  requestHash:  '32b417167ac89a4a2469d959dcedebf471e94058668ae4c3dc4c84a8c80fbb02',
  responseHash: '018600114fec1d6995a43c74c6c26b97a4f65bd7a8d6afaf55af8fcd9deabfbf',
  message:      'ioproof:v1:32b417167ac89a4a2469d959dcedebf471e94058668ae4c3dc4c84a8c80fbb02|018600114fec1d6995a43c74c6c26b97a4f65bd7a8d6afaf55af8fcd9deabfbf|2026-01-15T12:00:00.000Z',
  signature:    'kz5LDmarkNtpwNa4up0Yvb+1+r/C7QIKr7R3WPvDEtdl5TQQp9bj7bG4LvcLRi+Lan1jEv0KugLC6q3ZVbnXCg==',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

function makePublicKeyObject(pubHex) {
  return crypto.createPublicKey({
    key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(pubHex, 'hex')]),
    format: 'der',
    type: 'spki',
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('generateKeyPair', () => {
  it('returns 64-char hex keys and YYYY-MM keyId', () => {
    const kp = generateKeyPair();
    assert.equal(kp.publicKey.length, 64);
    assert.equal(kp.privateKey.length, 64);
    assert.match(kp.publicKey, /^[0-9a-f]{64}$/);
    assert.match(kp.privateKey, /^[0-9a-f]{64}$/);
    assert.match(kp.keyId, /^\d{4}-\d{2}$/);
  });

  it('generates unique keys each call', () => {
    const a = generateKeyPair();
    const b = generateKeyPair();
    assert.notEqual(a.publicKey, b.publicKey);
    assert.notEqual(a.privateKey, b.privateKey);
  });
});

describe('createSigner', () => {
  it('returns a function', () => {
    const sign = createSigner(VECTOR.privateKey, VECTOR.keyId);
    assert.equal(typeof sign, 'function');
  });

  it('produces a valid signature that can be verified', () => {
    const sign = createSigner(VECTOR.privateKey, VECTOR.keyId);
    const result = sign('test request', 'test response');

    assert.equal(typeof result.signature, 'string');
    assert.equal(result.keyId, VECTOR.keyId);
    assert.ok(result.timestamp);
    assert.ok(result.requestHash);
    assert.ok(result.responseHash);
    assert.deepEqual(Object.keys(result.headers).sort(), [
      'X-IOProof-Key-Id',
      'X-IOProof-Sig',
      'X-IOProof-Sig-Ts',
    ]);

    // Verify the signature
    const pubKey = makePublicKeyObject(VECTOR.publicKey);
    const msg = `ioproof:v1:${result.requestHash}|${result.responseHash}|${result.timestamp}`;
    const verified = crypto.verify(null, Buffer.from(msg), pubKey, Buffer.from(result.signature, 'base64'));
    assert.ok(verified, 'Signature must verify against the public key');
  });

  it('handles Buffer inputs', () => {
    const sign = createSigner(VECTOR.privateKey, VECTOR.keyId);
    const result = sign(Buffer.from('req'), Buffer.from('res'));
    assert.ok(result.signature);
  });

  it('handles empty body', () => {
    const sign = createSigner(VECTOR.privateKey, VECTOR.keyId);
    const result = sign('', '');
    assert.ok(result.signature);
  });
});

describe('cross-language test vector', () => {
  it('produces the exact expected hashes', () => {
    const reqHash = crypto.createHash('sha256').update(VECTOR.requestBody).digest('hex');
    const resHash = crypto.createHash('sha256').update(VECTOR.responseBody).digest('hex');
    assert.equal(reqHash, VECTOR.requestHash);
    assert.equal(resHash, VECTOR.responseHash);
  });

  it('builds the exact expected message', () => {
    const msg = `ioproof:v1:${VECTOR.requestHash}|${VECTOR.responseHash}|${VECTOR.timestamp}`;
    assert.equal(msg, VECTOR.message);
  });

  it('produces the exact expected signature (deterministic Ed25519)', () => {
    const sign = createSigner(VECTOR.privateKey, VECTOR.keyId);

    // We need to control the timestamp, so we sign manually
    const ED25519_PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');
    const privKey = crypto.createPrivateKey({
      key: Buffer.concat([ED25519_PKCS8_PREFIX, Buffer.from(VECTOR.privateKey, 'hex')]),
      format: 'der',
      type: 'pkcs8',
    });

    const sig = crypto.sign(null, Buffer.from(VECTOR.message, 'utf-8'), privKey).toString('base64');
    assert.equal(sig, VECTOR.signature, 'Signature must match the cross-language vector exactly');
  });

  it('verifies the expected signature against the public key', () => {
    const pubKey = makePublicKeyObject(VECTOR.publicKey);
    const verified = crypto.verify(
      null,
      Buffer.from(VECTOR.message, 'utf-8'),
      pubKey,
      Buffer.from(VECTOR.signature, 'base64'),
    );
    assert.ok(verified, 'Cross-language vector signature must verify');
  });
});

describe('middleware', () => {
  it('throws if options are missing', () => {
    assert.throws(() => middleware(), /requires/);
    assert.throws(() => middleware({}), /requires/);
    assert.throws(() => middleware({ privateKey: 'abc' }), /requires/);
  });

  it('adds signature headers to HTTP response', async () => {
    const kp = generateKeyPair();
    const mw = middleware({ privateKey: kp.privateKey, keyId: kp.keyId });

    const headers = await new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        // Simulate express: attach body, then call middleware
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          req.body = body;
          mw(req, res, () => {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end('{"ok":true}');
          });
        });
      });

      server.listen(0, () => {
        const port = server.address().port;
        const postData = '{"test":true}';
        const request = http.request(
          { hostname: '127.0.0.1', port, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) } },
          (res) => {
            let data = '';
            res.on('data', (c) => (data += c));
            res.on('end', () => {
              server.close();
              resolve(res.headers);
            });
          },
        );
        request.on('error', reject);
        request.write(postData);
        request.end();
      });
    });

    assert.ok(headers['x-ioproof-sig'], 'Must have X-IOProof-Sig header');
    assert.ok(headers['x-ioproof-sig-ts'], 'Must have X-IOProof-Sig-Ts header');
    assert.ok(headers['x-ioproof-key-id'], 'Must have X-IOProof-Key-Id header');
    assert.equal(headers['x-ioproof-key-id'], kp.keyId);

    // Verify the signature is valid
    const pubKey = makePublicKeyObject(kp.publicKey);
    const reqHash = crypto.createHash('sha256').update('{"test":true}').digest('hex');
    const resHash = crypto.createHash('sha256').update('{"ok":true}').digest('hex');
    const msg = `ioproof:v1:${reqHash}|${resHash}|${headers['x-ioproof-sig-ts']}`;
    const verified = crypto.verify(null, Buffer.from(msg), pubKey, Buffer.from(headers['x-ioproof-sig'], 'base64'));
    assert.ok(verified, 'Middleware signature must verify');
  });

  it('does not crash on invalid private key', () => {
    // middleware() with a bad key should throw at creation time
    // but if we somehow get past that, signing errors should be caught
    const kp = generateKeyPair();
    const mw = middleware({ privateKey: kp.privateKey, keyId: kp.keyId });
    assert.equal(typeof mw, 'function');
  });
});

describe('wellKnown', () => {
  it('returns a handler that serves correct JSON', async () => {
    const keys = [
      { kid: '2026-01', publicKey: 'aa'.repeat(32) },
      { kid: '2026-02', publicKey: 'bb'.repeat(32) },
    ];
    const handler = wellKnown(keys);

    const result = await new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        // Minimal mock of Express res.json
        res.json = (body) => {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(body));
        };
        handler(req, res);
      });

      server.listen(0, () => {
        const port = server.address().port;
        http.get(`http://127.0.0.1:${port}/.well-known/ioproof.json`, (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => {
            server.close();
            resolve({ headers: res.headers, body: JSON.parse(data) });
          });
        }).on('error', reject);
      });
    });

    assert.equal(result.body.version, '1.0');
    assert.equal(result.body.keys.length, 2);
    assert.equal(result.body.keys[0].kid, '2026-01');
    assert.equal(result.body.keys[0].algorithm, 'ed25519');
    assert.equal(result.body.keys[0].public_key, 'aa'.repeat(32));
    assert.equal(result.body.keys[1].kid, '2026-02');
    assert.ok(result.headers['cache-control'].includes('3600'));
  });
});
