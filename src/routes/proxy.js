const { Router } = require('express');
const { getProvider } = require('../providers');
const { sha256, buildCombinedHash } = require('../attestation/hasher');
const { buildReceipt } = require('../attestation/receipt');
const { insertProof } = require('../db');

const router = Router();

// POST /v1/proxy/:provider/*
router.post('/:provider/*', async (req, res, next) => {
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

    // 6. Store proof locally — marked as pending_batch (Merkle batch processor handles Solana)
    insertProof({
      combinedHash,
      requestHash,
      responseHash,
      timestamp,
      provider: providerName,
      solanaSignature: null,
      solanaSlot: null,
      solanaStatus: 'pending_batch',
      batchId: null,
      merkleRoot: null,
      merkleProof: null,
    });

    // 7. Build receipt (shows pending_batch status)
    const verification = buildReceipt({
      requestHash,
      responseHash,
      combinedHash,
      timestamp,
    });

    // 8. Parse provider response and return envelope
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
