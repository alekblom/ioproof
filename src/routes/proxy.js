const { Router } = require('express');
const { getProvider } = require('../providers');
const { sha256, buildCombinedHash, generateSecret, blindHash } = require('../attestation/hasher');
const { buildReceipt } = require('../attestation/receipt');
const { insertProof, storePayload } = require('../db');
const { apiKeyAuth } = require('../middleware/apiKeyAuth');
const { incrementUsage } = require('../auth/usage');

const router = Router();

// POST /v1/proxy/:provider/* — API key auth (skipped if REQUIRE_API_KEY=false)
router.post('/:provider/*', apiKeyAuth, async (req, res, next) => {
  try {
    const providerName = req.params.provider;
    const provider = getProvider(providerName);

    if (!provider) {
      return res.status(400).json({
        error: { message: `Unknown provider: ${providerName}`, code: 'INVALID_PROVIDER' },
      });
    }

    const apiKey = req.headers['x-provider-key'];
    if (!apiKey) {
      return res.status(401).json({
        error: { message: 'Missing X-Provider-Key header', code: 'MISSING_API_KEY' },
      });
    }

    if (!req.rawBody || req.rawBody.length === 0) {
      return res.status(400).json({
        error: { message: 'Empty request body', code: 'EMPTY_BODY' },
      });
    }

    // 1. Hash raw request payload
    const requestHash = sha256(req.rawBody);
    const timestamp = new Date().toISOString();

    // 2. Build target URL
    const wildcardPath = req.params[0];
    const targetUrl = provider.buildUrl(`/${wildcardPath}`);
    const headers = provider.buildHeaders(apiKey);

    // 3. Forward request to LLM provider
    let providerRes;
    try {
      providerRes = await fetch(targetUrl, {
        method: 'POST',
        headers,
        body: req.rawBody,
      });
    } catch (err) {
      return res.status(502).json({
        error: { message: `Provider request failed: ${err.message}`, code: 'PROVIDER_ERROR' },
      });
    }

    // 4. Read raw response body
    const responseBuffer = Buffer.from(await providerRes.arrayBuffer());
    const responseHash = sha256(responseBuffer);

    // 5. Build combined hash
    const combinedHash = buildCombinedHash(requestHash, responseHash, timestamp);

    // 6. Generate blinding secret — only the caller receives this
    const secret = generateSecret();
    const blindedHash = blindHash(combinedHash, secret);

    // 7. Store proof + full payloads for audit trail
    insertProof({
      combinedHash,
      blindedHash,
      secret,
      requestHash,
      responseHash,
      timestamp,
      provider: providerName,
      targetUrl,
      responseStatus: providerRes.status,
      userId: req.iopUser?.id || null,
      solanaSignature: null,
      solanaSlot: null,
      solanaStatus: 'pending_batch',
      batchId: null,
      merkleRoot: null,
      merkleProof: null,
    });

    // Store raw payloads as separate files (can be large)
    storePayload(combinedHash, {
      request: req.rawBody.toString('utf-8'),
      response: responseBuffer.toString('utf-8'),
    });

    // Track usage
    if (req.iopUser) {
      incrementUsage(req.iopUser.id);
    }

    // 8. Build receipt (shows pending_batch status, includes secret for verification)
    const verification = buildReceipt({
      requestHash,
      responseHash,
      combinedHash,
      blindedHash,
      secret,
      timestamp,
    });

    // 9. Parse provider response and return envelope
    let providerResponse;
    try {
      providerResponse = JSON.parse(responseBuffer.toString('utf-8'));
    } catch {
      providerResponse = responseBuffer.toString('utf-8');
    }

    res.status(providerRes.status).json({
      provider_response: providerResponse,
      verification,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
