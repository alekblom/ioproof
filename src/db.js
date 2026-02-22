const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'proofs.json');
const BATCHES_PATH = path.join(DATA_DIR, 'batches.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// --- Proofs ---

function loadProofs() {
  if (!fs.existsSync(DB_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

function saveProofs(proofs) {
  fs.writeFileSync(DB_PATH, JSON.stringify(proofs, null, 2));
}

function insertProof(proof) {
  const proofs = loadProofs();
  proofs.push({
    ...proof,
    created_at: new Date().toISOString(),
  });
  saveProofs(proofs);
}

function findByHash(hash) {
  const proofs = loadProofs();
  return proofs.find(
    (p) => p.combinedHash === hash || p.requestHash === hash || p.responseHash === hash
  ) || null;
}

function getPendingProofs() {
  const proofs = loadProofs();
  return proofs.filter((p) => p.solanaStatus === 'pending_batch');
}

function updateProofsBatch(combinedHashes, batchData) {
  const proofs = loadProofs();
  const hashSet = new Set(combinedHashes);
  for (const proof of proofs) {
    if (hashSet.has(proof.combinedHash)) {
      proof.solanaStatus = 'confirmed';
      proof.batchId = batchData.batchId;
      proof.merkleRoot = batchData.merkleRoot;
      proof.merkleProof = batchData.proofs[proof.combinedHash] || null;
      proof.solanaSignature = batchData.signature;
      proof.solanaSlot = batchData.slot;
    }
  }
  saveProofs(proofs);
}

// --- Batches ---

function loadBatches() {
  if (!fs.existsSync(BATCHES_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(BATCHES_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

function saveBatches(batches) {
  fs.writeFileSync(BATCHES_PATH, JSON.stringify(batches, null, 2));
}

function insertBatch(batch) {
  const batches = loadBatches();
  batches.push({
    ...batch,
    created_at: new Date().toISOString(),
  });
  saveBatches(batches);
}

function findBatch(batchId) {
  const batches = loadBatches();
  return batches.find((b) => b.batchId === batchId) || null;
}

module.exports = {
  insertProof,
  findByHash,
  getPendingProofs,
  updateProofsBatch,
  insertBatch,
  findBatch,
};
