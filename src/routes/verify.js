const crypto = require('crypto');
const { Router } = require('express');
const { findByHash, findBatch, loadPayload } = require('../db');
const { verifyMerkleProof } = require('../attestation/merkle');
const { blindHash } = require('../attestation/hasher');
const config = require('../config');

/**
 * Constant-time comparison of two hex strings.
 */
function safeEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

const router = Router();

// GET /api/verify/:hash?secret=...
// With secret: full proof details (proves you own this interaction)
// Without secret: confirms existence only (no request/response details leaked)
router.get('/:hash', (req, res) => {
  const hash = req.params.hash;
  const secret = req.query.secret || null;

  if (!/^[a-f0-9]{64}$/.test(hash)) {
    return res.status(400).json({
      error: { message: 'Invalid hash format. Expected 64-character hex string.', code: 'INVALID_HASH' },
    });
  }

  if (secret && !/^[a-f0-9]{64}$/.test(secret)) {
    return res.status(400).json({
      error: { message: 'Invalid secret format. Expected 64-character hex string.', code: 'INVALID_SECRET' },
    });
  }

  const proof = findByHash(hash);

  if (!proof) {
    return res.status(404).json({
      found: false,
      hash,
    });
  }

  // Verify the secret: check owner secret (via blinding) or user secret (direct match)
  let secretValid = false;
  let accessType = null;
  if (secret) {
    // Owner secret: SHA-256(combined_hash | secret) should equal blindedHash
    const expectedBlinded = blindHash(proof.combinedHash, secret);
    if (expectedBlinded === proof.blindedHash) {
      secretValid = true;
      accessType = 'owner';
    }
    // User secret: alternative access for end-user (e.g. chat user in a dispute)
    if (!secretValid && proof.userSecret && safeEqual(secret, proof.userSecret)) {
      secretValid = true;
      accessType = 'user';
    }
  }

  // Base result — always safe to show (blinded hash is what's on-chain)
  const result = {
    found: true,
    blinded_hash: proof.blindedHash,
    solana_status: proof.solanaStatus,
    batch_id: proof.batchId || null,
    merkle_root: proof.merkleRoot || null,
    explorer_url: proof.solanaSignature
      ? `https://explorer.solana.com/tx/${proof.solanaSignature}?cluster=${config.solana.cluster}`
      : null,
    created_at: proof.created_at,
  };

  // Verify Merkle proof against blinded hash (this is always verifiable)
  if (proof.merkleRoot && proof.merkleProof) {
    result.merkle_valid = verifyMerkleProof(proof.blindedHash, proof.merkleProof, proof.merkleRoot);
    result.merkle_proof = proof.merkleProof;
  }

  if (secret) {
    result.secret_valid = secretValid;
    if (accessType) {
      result.access_type = accessType;
    }
  }

  // Only reveal full details if correct secret is provided
  if (secretValid) {
    result.combined_hash = proof.combinedHash;
    result.request_hash = proof.requestHash;
    result.response_hash = proof.responseHash;
    result.timestamp = proof.timestamp;
    result.provider = proof.provider;
    result.target_url = proof.targetUrl || null;
    result.response_status = proof.responseStatus || null;
    result.solana_signature = proof.solanaSignature || null;
    result.solana_slot = proof.solanaSlot || null;

    // Load full request/response payloads
    const payload = loadPayload(proof.combinedHash);
    if (payload) {
      result.request_body = payload.request;
      result.response_body = payload.response;
    }
  }

  res.json(result);
});

// GET /api/verify/export/:hash?secret=...
// Returns a self-contained proof bundle for independent verification.
// With this bundle, you can verify against Solana without needing IOProof.
router.get('/export/:hash', (req, res) => {
  const hash = req.params.hash;
  const secret = req.query.secret;

  if (!/^[a-f0-9]{64}$/.test(hash) || !secret || !/^[a-f0-9]{64}$/.test(secret)) {
    return res.status(400).json({
      error: { message: 'Both hash and secret (64-char hex) are required.', code: 'MISSING_PARAMS' },
    });
  }

  const proof = findByHash(hash);
  if (!proof) {
    return res.status(404).json({ error: { message: 'Proof not found.', code: 'NOT_FOUND' } });
  }

  // Accept either owner secret (via blinding) or user secret (direct match)
  const expectedBlinded = blindHash(proof.combinedHash, secret);
  const isOwner = expectedBlinded === proof.blindedHash;
  const isUser = !isOwner && proof.userSecret && safeEqual(secret, proof.userSecret);
  if (!isOwner && !isUser) {
    return res.status(403).json({ error: { message: 'Invalid secret.', code: 'INVALID_SECRET' } });
  }

  if (proof.solanaStatus !== 'confirmed') {
    return res.status(202).json({
      error: { message: 'Proof not yet batched. Try again after the next batch cycle.', code: 'PENDING' },
      solana_status: proof.solanaStatus,
    });
  }

  // Load payloads
  const payload = loadPayload(proof.combinedHash);

  // Build self-contained bundle
  const bundle = {
    version: 1,
    exported_at: new Date().toISOString(),
    proof: {
      request_hash: proof.requestHash,
      response_hash: proof.responseHash,
      combined_hash: proof.combinedHash,
      blinded_hash: proof.blindedHash,
      secret,
      timestamp: proof.timestamp,
      provider: proof.provider,
      target_url: proof.targetUrl || null,
      response_status: proof.responseStatus || null,
    },
    merkle: {
      root: proof.merkleRoot,
      proof: proof.merkleProof,
    },
    solana: {
      signature: proof.solanaSignature,
      slot: proof.solanaSlot,
      cluster: config.solana.cluster,
      explorer_url: `https://explorer.solana.com/tx/${proof.solanaSignature}?cluster=${config.solana.cluster}`,
      memo_format: 'ioproof|batch|{batchId}|{merkleRoot}|{proofCount}|{timestamp}',
    },
    batch: {
      id: proof.batchId,
    },
    payloads: payload || null,
    verification_steps: [
      '1. Re-hash: SHA-256(request_body) should equal proof.request_hash',
      '2. Re-hash: SHA-256(response_body) should equal proof.response_hash',
      '3. Combined: SHA-256(request_hash + "|" + response_hash + "|" + timestamp) should equal proof.combined_hash',
      '4. Blinding: SHA-256(combined_hash + "|" + secret) should equal proof.blinded_hash',
      '5. Merkle: walk merkle.proof from blinded_hash to merkle.root',
      '6. On-chain: fetch solana.signature, extract memo, confirm merkle_root matches',
    ],
  };

  // Set filename for download
  res.setHeader('Content-Disposition', `attachment; filename="ioproof-${hash.substring(0, 12)}.json"`);
  res.json(bundle);
});

// GET /api/verify/batch/:batchId
router.get('/batch/:batchId', (req, res) => {
  const batch = findBatch(req.params.batchId);

  if (!batch) {
    return res.status(404).json({ found: false, batch_id: req.params.batchId });
  }

  res.json({
    found: true,
    batch_id: batch.batchId,
    merkle_root: batch.merkleRoot,
    proof_count: batch.proofCount,
    solana_signature: batch.solanaSignature,
    solana_slot: batch.solanaSlot,
    explorer_url: batch.solanaSignature
      ? `https://explorer.solana.com/tx/${batch.solanaSignature}?cluster=${config.solana.cluster}`
      : null,
    created_at: batch.created_at,
  });
});

module.exports = router;
