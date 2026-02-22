const { Router } = require('express');
const { findByHash, findBatch } = require('../db');
const { verifyMerkleProof } = require('../attestation/merkle');

const router = Router();

// GET /api/verify/:hash
router.get('/:hash', (req, res) => {
  const hash = req.params.hash;

  if (!/^[a-f0-9]{64}$/.test(hash)) {
    return res.status(400).json({
      error: { message: 'Invalid hash format. Expected 64-character hex string.', code: 'INVALID_HASH' },
    });
  }

  const proof = findByHash(hash);

  if (!proof) {
    return res.status(404).json({
      found: false,
      hash,
    });
  }

  const result = {
    found: true,
    combined_hash: proof.combinedHash,
    request_hash: proof.requestHash,
    response_hash: proof.responseHash,
    timestamp: proof.timestamp,
    provider: proof.provider,
    solana_status: proof.solanaStatus,
    solana_signature: proof.solanaSignature || null,
    solana_slot: proof.solanaSlot || null,
    batch_id: proof.batchId || null,
    merkle_root: proof.merkleRoot || null,
    merkle_proof: proof.merkleProof || null,
    explorer_url: proof.solanaSignature
      ? `https://explorer.solana.com/tx/${proof.solanaSignature}?cluster=devnet`
      : null,
    created_at: proof.created_at,
  };

  // Verify Merkle proof if available
  if (proof.merkleRoot && proof.merkleProof) {
    result.merkle_valid = verifyMerkleProof(proof.combinedHash, proof.merkleProof, proof.merkleRoot);
  }

  res.json(result);
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
      ? `https://explorer.solana.com/tx/${batch.solanaSignature}?cluster=devnet`
      : null,
    created_at: batch.created_at,
  });
});

module.exports = router;
