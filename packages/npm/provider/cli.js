#!/usr/bin/env node
/**
 * IOProof Provider CLI — setup and test Ed25519 response signing.
 *
 * Usage:
 *   npx @ioproof/provider init   — Generate keys + setup instructions
 *   npx @ioproof/provider test   — Verify signing works locally
 *   npx @ioproof/provider keygen — Generate a new keypair only
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { generateKeyPair, createSigner } = require('./index');

const command = process.argv[2];

if (!command || command === '--help' || command === '-h') {
  console.log(`
  IOProof Provider Signing CLI

  Commands:
    init     Generate keys and get framework-specific setup instructions
    test     Verify signing works with your current keys
    keygen   Generate a new Ed25519 keypair

  Usage:
    npx @ioproof/provider init
    npx @ioproof/provider test
    npx @ioproof/provider keygen
`);
  process.exit(0);
}

if (command === 'init') {
  runInit();
} else if (command === 'test') {
  runTest();
} else if (command === 'keygen') {
  runKeygen();
} else {
  console.error(`Unknown command: ${command}\nRun with --help for usage.`);
  process.exit(1);
}

// ─── Commands ────────────────────────────────────────────────────────────────

function runInit() {
  console.log('\n  IOProof Provider Signing Setup');
  console.log('  ' + '='.repeat(34) + '\n');

  // Generate keypair
  const kp = generateKeyPair();
  console.log('  Generated Ed25519 keypair:\n');
  console.log(`  PUBLIC KEY:   ${kp.publicKey}`);
  console.log(`  PRIVATE KEY:  ${kp.privateKey}`);
  console.log(`  KEY ID:       ${kp.keyId}\n`);

  console.log('  Add to your .env:');
  console.log('  ─────────────────');
  console.log(`  IOPROOF_PRIVATE_KEY=${kp.privateKey}`);
  console.log(`  IOPROOF_PUBLIC_KEY=${kp.publicKey}`);
  console.log(`  IOPROOF_KEY_ID=${kp.keyId}\n`);

  // Detect framework
  const framework = detectFramework();
  printSnippet(framework);

  // Local test
  console.log('  Verifying signature locally...');
  const testResult = localSignTest(kp.privateKey, kp.publicKey, kp.keyId);
  if (testResult) {
    console.log('  \u2713 Signature verified successfully\n');
  } else {
    console.log('  \u2717 Signature verification failed!\n');
    process.exit(1);
  }

  console.log('  Done! Your API responses will now be cryptographically signed.');
  console.log('  Learn more: https://ioproof.com/docs/provider-signing\n');
}

function runTest() {
  const privateKey = process.env.IOPROOF_PRIVATE_KEY;
  const publicKey = process.env.IOPROOF_PUBLIC_KEY;
  const keyId = process.env.IOPROOF_KEY_ID || 'test';

  if (!privateKey || !publicKey) {
    console.error('\n  Missing IOPROOF_PRIVATE_KEY and/or IOPROOF_PUBLIC_KEY env vars.');
    console.error('  Run `npx @ioproof/provider init` to generate them.\n');
    process.exit(1);
  }

  console.log('\n  IOProof Signature Test');
  console.log('  ' + '='.repeat(22) + '\n');

  const result = localSignTest(privateKey, publicKey, keyId);
  if (result) {
    console.log('  \u2713 All checks passed\n');
  } else {
    console.log('  \u2717 Test failed\n');
    process.exit(1);
  }
}

function runKeygen() {
  const kp = generateKeyPair();
  console.log(`\nIOPROOF_PRIVATE_KEY=${kp.privateKey}`);
  console.log(`IOPROOF_PUBLIC_KEY=${kp.publicKey}`);
  console.log(`IOPROOF_KEY_ID=${kp.keyId}\n`);
}

// ─── Framework detection ─────────────────────────────────────────────────────

function detectFramework() {
  const cwd = process.cwd();

  // Check package.json for Node.js frameworks
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf-8'));
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (allDeps.express) return 'express';
    if (allDeps.fastify) return 'fastify';
    if (allDeps.koa) return 'koa';
    if (allDeps.hono) return 'hono';
    if (allDeps.next) return 'nextjs';
    // Generic Node.js
    return 'node';
  } catch {}

  // Check requirements.txt for Python frameworks
  try {
    const reqs = fs.readFileSync(path.join(cwd, 'requirements.txt'), 'utf-8').toLowerCase();
    if (reqs.includes('fastapi')) return 'fastapi';
    if (reqs.includes('flask')) return 'flask';
    if (reqs.includes('django')) return 'django';
    return 'python';
  } catch {}

  // Check pyproject.toml for Python
  try {
    const pyproject = fs.readFileSync(path.join(cwd, 'pyproject.toml'), 'utf-8').toLowerCase();
    if (pyproject.includes('fastapi')) return 'fastapi';
    if (pyproject.includes('flask')) return 'flask';
    return 'python';
  } catch {}

  // Check go.mod for Go
  try {
    fs.readFileSync(path.join(cwd, 'go.mod'), 'utf-8');
    return 'go';
  } catch {}

  return 'generic';
}

function printSnippet(framework) {
  const snippets = {
    express: `
  Framework detected: Express.js

  Add to your server:
  ───────────────────

    const { middleware, wellKnown } = require('@ioproof/provider');

    app.use(middleware({
      privateKey: process.env.IOPROOF_PRIVATE_KEY,
      keyId: process.env.IOPROOF_KEY_ID,
    }));

    app.get('/.well-known/ioproof.json', wellKnown([
      { kid: process.env.IOPROOF_KEY_ID, publicKey: process.env.IOPROOF_PUBLIC_KEY },
    ]));
`,
    fastify: `
  Framework detected: Fastify

  Add to your server:
  ───────────────────

    const { createSigner } = require('@ioproof/provider');
    const sign = createSigner(process.env.IOPROOF_PRIVATE_KEY, process.env.IOPROOF_KEY_ID);

    fastify.addHook('onSend', (request, reply, payload, done) => {
      try {
        const result = sign(request.body || '', payload || '');
        reply.header('X-IOProof-Sig', result.headers['X-IOProof-Sig']);
        reply.header('X-IOProof-Sig-Ts', result.headers['X-IOProof-Sig-Ts']);
        reply.header('X-IOProof-Key-Id', result.headers['X-IOProof-Key-Id']);
      } catch (err) {
        fastify.log.warn('IOProof signing error:', err.message);
      }
      done(null, payload);
    });
`,
    fastapi: `
  Framework detected: FastAPI

  Install: pip install ioproof

  Add to your server:
  ───────────────────

    import os
    from ioproof.middleware_fastapi import IOProofMiddleware, well_known_route

    app.add_middleware(
        IOProofMiddleware,
        private_key=os.environ["IOPROOF_PRIVATE_KEY"],
        key_id=os.environ["IOPROOF_KEY_ID"],
    )

    @app.get("/.well-known/ioproof.json")
    async def ioproof_keys():
        return well_known_route([{
            "kid": os.environ["IOPROOF_KEY_ID"],
            "public_key": os.environ["IOPROOF_PUBLIC_KEY"],
        }])
`,
    flask: `
  Framework detected: Flask

  Install: pip install ioproof

  Add to your server:
  ───────────────────

    import os
    from ioproof.middleware_flask import init_app, well_known_blueprint

    init_app(app,
        private_key=os.environ["IOPROOF_PRIVATE_KEY"],
        key_id=os.environ["IOPROOF_KEY_ID"],
    )

    app.register_blueprint(well_known_blueprint([{
        "kid": os.environ["IOPROOF_KEY_ID"],
        "public_key": os.environ["IOPROOF_PUBLIC_KEY"],
    }]))
`,
    go: `
  Framework detected: Go

  Install: go get github.com/ioproof/go-provider

  Add to your server:
  ───────────────────

    import ioproof "github.com/ioproof/go-provider"

    handler := ioproof.Middleware(
        os.Getenv("IOPROOF_PRIVATE_KEY"),
        os.Getenv("IOPROOF_KEY_ID"),
    )(mux)

    // Serve public key
    wellKnown, _ := ioproof.WellKnownJSON([]ioproof.KeyEntry{
        {KID: os.Getenv("IOPROOF_KEY_ID"), PublicKey: os.Getenv("IOPROOF_PUBLIC_KEY")},
    })
    mux.HandleFunc("/.well-known/ioproof.json", func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("Content-Type", "application/json")
        w.Write(wellKnown)
    })
`,
  };

  // Fallback snippets
  snippets.node = snippets.express;
  snippets.koa = snippets.express;
  snippets.hono = snippets.express;
  snippets.nextjs = snippets.express;
  snippets.python = snippets.fastapi;
  snippets.django = snippets.fastapi;

  snippets.generic = `
  No framework detected. Here's the low-level API:
  ─────────────────────────────────────────────────

    Node.js:  npm install @ioproof/provider
    Python:   pip install ioproof
    Go:       go get github.com/ioproof/go-provider

    See https://ioproof.com/docs/provider-signing for integration guides.
`;

  console.log(snippets[framework] || snippets.generic);
}

// ─── Local sign + verify test ────────────────────────────────────────────────

function localSignTest(privateKeyHex, publicKeyHex, keyId) {
  try {
    const sign = createSigner(privateKeyHex, keyId);
    const testReq = '{"model":"gpt-4o","messages":[{"role":"user","content":"test"}]}';
    const testRes = '{"choices":[{"message":{"content":"Hello!"}}]}';

    const result = sign(testReq, testRes);
    console.log(`  Request hash:  ${result.requestHash}`);
    console.log(`  Response hash: ${result.responseHash}`);
    console.log(`  Signature:     ${result.signature.substring(0, 32)}...`);
    console.log(`  Timestamp:     ${result.timestamp}`);

    // Verify
    const pubKey = crypto.createPublicKey({
      key: Buffer.concat([
        Buffer.from('302a300506032b6570032100', 'hex'),
        Buffer.from(publicKeyHex, 'hex'),
      ]),
      format: 'der',
      type: 'spki',
    });

    const msg = `ioproof:v1:${result.requestHash}|${result.responseHash}|${result.timestamp}`;
    const verified = crypto.verify(null, Buffer.from(msg, 'utf-8'), pubKey, Buffer.from(result.signature, 'base64'));

    return verified;
  } catch (err) {
    console.error(`  Error: ${err.message}`);
    return false;
  }
}
