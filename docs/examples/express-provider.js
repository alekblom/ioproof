/**
 * Example: Express API server with IOProof response signing.
 *
 * Run:
 *   npm install express @ioproof/provider
 *   node express-provider.js
 *
 * Test:
 *   curl -X POST http://localhost:3000/v1/chat/completions \
 *     -H "Content-Type: application/json" \
 *     -d '{"model":"gpt-4o","messages":[{"role":"user","content":"Hello"}]}' -v
 */

const express = require('express');
const { generateKeyPair, middleware, wellKnown } = require('@ioproof/provider');

// Generate keys for demo (in production, use env vars)
const keys = generateKeyPair();
console.log(`Public key:  ${keys.publicKey}`);
console.log(`Private key: ${keys.privateKey}`);
console.log(`Key ID:      ${keys.keyId}\n`);

const app = express();
app.use(express.json());

// IOProof signing middleware — signs every response
app.use(middleware({ privateKey: keys.privateKey, keyId: keys.keyId }));

// Public key endpoint — IOProof fetches this to verify signatures
app.get('/.well-known/ioproof.json', wellKnown([
  { kid: keys.keyId, publicKey: keys.publicKey },
]));

// Example API endpoint
app.post('/v1/chat/completions', (req, res) => {
  res.json({
    id: 'chatcmpl-demo',
    choices: [{ message: { role: 'assistant', content: 'Hello from the signed API!' } }],
  });
});

app.listen(3000, () => console.log('Listening on http://localhost:3000'));
