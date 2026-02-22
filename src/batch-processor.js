const { buildMerkleTree, getMerkleProof } = require('./attestation/merkle');
const { SolanaAttestor } = require('./attestation/solana');
const { getPendingProofs, updateProofsBatch, insertBatch } = require('./db');
const config = require('./config');
const crypto = require('crypto');

const attestor = new SolanaAttestor(config.solana.rpcUrl, config.solana.keypairSecret);

let batchTimer = null;

function generateBatchId() {
  const ts = Date.now().toString(36);
  const rand = crypto.randomBytes(4).toString('hex');
  return `batch_${ts}_${rand}`;
}

async function processBatch() {
  const pending = getPendingProofs();

  if (pending.length < config.batch.minProofs) {
    return;
  }

  const batchId = generateBatchId();
  // Use blinded hashes as Merkle leaves — raw data never appears on-chain
  const leaves = pending.map((p) => p.blindedHash);
  const { root, layers } = buildMerkleTree(leaves);

  if (!root) return;

  console.log(`[BATCH] Processing batch ${batchId} with ${leaves.length} proofs, Merkle root: ${root}`);

  // Commit Merkle root to Solana
  let solanaResult = null;
  if (attestor.isConfigured()) {
    try {
      solanaResult = await attestor.commitBatch(
        batchId,
        root,
        leaves.length,
        new Date().toISOString()
      );
      console.log(`[BATCH] Solana tx confirmed: ${solanaResult.signature}`);
    } catch (err) {
      console.error(`[BATCH] Solana commit failed: ${err.message}`);
    }
  } else {
    console.warn('[BATCH] No Solana keypair — batch stored locally only');
  }

  // Build individual Merkle proofs for each leaf (keyed by blindedHash)
  const proofMap = {};
  for (let i = 0; i < leaves.length; i++) {
    proofMap[leaves[i]] = getMerkleProof(layers, i);
  }

  // Update all proofs in this batch (match by blindedHash)
  const blindedHashes = pending.map((p) => p.blindedHash);
  updateProofsBatch(blindedHashes, {
    batchId,
    merkleRoot: root,
    proofs: proofMap,
    signature: solanaResult?.signature || null,
    slot: solanaResult?.slot || null,
  });

  // Record the batch
  insertBatch({
    batchId,
    merkleRoot: root,
    proofCount: leaves.length,
    solanaSignature: solanaResult?.signature || null,
    solanaSlot: solanaResult?.slot || null,
    leaves,
  });

  console.log(`[BATCH] Batch ${batchId} complete — ${leaves.length} proofs committed`);
}

function startBatchProcessor() {
  console.log(`[BATCH] Processor started (interval: ${config.batch.intervalMs}ms, min proofs: ${config.batch.minProofs})`);

  // Run once on startup for any pending proofs from previous runs
  setTimeout(() => processBatch().catch((err) => console.error('[BATCH] Error:', err.message)), 5000);

  batchTimer = setInterval(() => {
    processBatch().catch((err) => console.error('[BATCH] Error:', err.message));
  }, config.batch.intervalMs);
}

function stopBatchProcessor() {
  if (batchTimer) {
    clearInterval(batchTimer);
    batchTimer = null;
  }
}

module.exports = { startBatchProcessor, stopBatchProcessor, processBatch };
