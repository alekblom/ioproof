const { Router } = require('express');
const { sha256, buildCombinedHash, generateSecret, blindHash } = require('../attestation/hasher');
const { buildReceipt } = require('../attestation/receipt');
const { verifyProviderSignature } = require('../attestation/provider-signature');
const { insertProof, storePayload } = require('../db');
const { apiKeyAuth } = require('../middleware/apiKeyAuth');
const { incrementUsage } = require('../auth/usage');

const router = Router();

/**
 * POST /v1/attest
 *
 * Post-hoc attestation: accepts pre-collected request/response pairs
 * for services that use streaming or need to submit proofs after the fact.
 *
 * Body: {
 *   request_body:  string (the JSON/text sent to the provider),
 *   response_body: string (the accumulated response),
 *   provider:      string (openai|anthropic|gemini|xai|replicate|...),
 *   endpoint:      string (optional, e.g. /v1/chat/completions),
 *   metadata:      object (optional, e.g. { service: "darobodo", type: "coach_chat" })
 * }
 */
router.post('/', apiKeyAuth, async (req, res, next) => {
  try {
    const { request_body, response_body, provider, endpoint, metadata, provider_headers } = req.body;

    if (!request_body || !response_body) {
      return res.status(400).json({
        error: { message: 'request_body and response_body are required.', code: 'MISSING_FIELDS' },
      });
    }

    if (!provider) {
      return res.status(400).json({
        error: { message: 'provider is required.', code: 'MISSING_PROVIDER' },
      });
    }

    // 1. Hash request and response (accept both string and object)
    const requestStr = typeof request_body === 'string' ? request_body : JSON.stringify(request_body);
    const responseStr = typeof response_body === 'string' ? response_body : JSON.stringify(response_body);
    const requestBuffer = Buffer.from(requestStr, 'utf-8');
    const responseBuffer = Buffer.from(responseStr, 'utf-8');
    const requestHash = sha256(requestBuffer);
    const responseHash = sha256(responseBuffer);
    const timestamp = new Date().toISOString();

    // 2. Build combined hash
    const combinedHash = buildCombinedHash(requestHash, responseHash, timestamp);

    // 3. Generate dual secrets
    const secret = generateSecret();
    const userSecret = generateSecret();
    const blindedHash = blindHash(combinedHash, secret);

    // 4. Extract provider info and verify signature from headers
    let providerRequestId = null;
    let providerTimestamp = null;
    let providerSignature = null;
    if (provider_headers && typeof provider_headers === 'object') {
      const h = {};
      for (const [k, v] of Object.entries(provider_headers)) {
        h[k.toLowerCase()] = v;
      }
      providerRequestId = h['x-request-id'] || h['request-id'] || h['x-ds-trace-id'] || null;
      providerTimestamp = h['date'] || null;

      const sig = h['x-ioproof-sig'];
      const sigTs = h['x-ioproof-sig-ts'];
      const keyId = h['x-ioproof-key-id'];
      if (sig && sigTs && keyId) {
        providerSignature = await verifyProviderSignature(requestHash, responseHash, sig, sigTs, keyId, provider);
      }
    }

    // 6. Store proof
    insertProof({
      combinedHash,
      blindedHash,
      secret,
      userSecret,
      requestHash,
      responseHash,
      timestamp,
      provider,
      targetUrl: endpoint || null,
      responseStatus: 200,
      userId: req.iopUser?.id || null,
      solanaSignature: null,
      solanaSlot: null,
      solanaStatus: 'pending_batch',
      batchId: null,
      merkleRoot: null,
      merkleProof: null,
      metadata: metadata || null,
      providerHeaders: provider_headers || null,
      providerRequestId,
      providerTimestamp,
      providerSignature,
    });

    // 6. Store raw payloads
    storePayload(combinedHash, {
      request: requestStr,
      response: responseStr,
    });

    // 7. Track usage
    if (req.iopUser) {
      incrementUsage(req.iopUser.id);
    }

    // 9. Build and return receipt
    const verification = buildReceipt({
      requestHash,
      responseHash,
      combinedHash,
      blindedHash,
      secret,
      userSecret,
      timestamp,
      providerRequestId,
      providerTimestamp,
      providerSignature,
    });

    res.json({ verification });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
