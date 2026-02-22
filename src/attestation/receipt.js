function buildReceipt({ requestHash, responseHash, combinedHash, timestamp, solanaResult, batchId, merkleRoot, merkleProof }) {
  const receipt = {
    request_hash: `sha256:${requestHash}`,
    response_hash: `sha256:${responseHash}`,
    combined_hash: `sha256:${combinedHash}`,
    timestamp,
    batch_status: 'pending_batch',
    verify_url: `https://ioproof.com/verify/${combinedHash}`,
  };

  // If already batched (unlikely in real-time, but possible for re-queries)
  if (solanaResult?.signature) {
    receipt.batch_status = 'confirmed';
    receipt.batch_id = batchId;
    receipt.merkle_root = merkleRoot;
    receipt.merkle_proof = merkleProof;
    receipt.solana_signature = solanaResult.signature;
    receipt.solana_slot = solanaResult.slot;
    receipt.explorer_url = `https://explorer.solana.com/tx/${solanaResult.signature}?cluster=devnet`;
  }

  return receipt;
}

module.exports = { buildReceipt };
