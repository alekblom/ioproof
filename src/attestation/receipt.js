const config = require('../config');

function buildReceipt({ requestHash, responseHash, combinedHash, blindedHash, secret, timestamp, solanaResult, batchId, merkleRoot, merkleProof }) {
  const receipt = {
    request_hash: `sha256:${requestHash}`,
    response_hash: `sha256:${responseHash}`,
    combined_hash: `sha256:${combinedHash}`,
    blinded_hash: `sha256:${blindedHash}`,
    secret,
    timestamp,
    batch_status: 'pending_batch',
    verify_url: `${config.baseUrl}/verify/${combinedHash}?secret=${secret}`,
    privacy_note: 'Only the blinded_hash appears on-chain. Keep your secret to verify ownership.',
  };

  // If already batched (unlikely in real-time, but possible for re-queries)
  if (solanaResult?.signature) {
    receipt.batch_status = 'confirmed';
    receipt.batch_id = batchId;
    receipt.merkle_root = merkleRoot;
    receipt.merkle_proof = merkleProof;
    receipt.solana_signature = solanaResult.signature;
    receipt.solana_slot = solanaResult.slot;
    receipt.explorer_url = `https://explorer.solana.com/tx/${solanaResult.signature}?cluster=${config.solana.cluster}`;
  }

  return receipt;
}

module.exports = { buildReceipt };
