const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const PAYLOADS_DIR = path.join(DATA_DIR, 'payloads');
const DB_PATH = path.join(DATA_DIR, 'proofs.json');
const BATCHES_PATH = path.join(DATA_DIR, 'batches.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(PAYLOADS_DIR)) {
  fs.mkdirSync(PAYLOADS_DIR, { recursive: true });
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

function updateProofsBatch(blindedHashes, batchData) {
  const proofs = loadProofs();
  const hashSet = new Set(blindedHashes);
  for (const proof of proofs) {
    if (hashSet.has(proof.blindedHash)) {
      proof.solanaStatus = 'confirmed';
      proof.batchId = batchData.batchId;
      proof.merkleRoot = batchData.merkleRoot;
      proof.merkleProof = batchData.proofs[proof.blindedHash] || null;
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

function getRecentProofsForUser(userId, limit = 10) {
  const proofs = loadProofs();
  return proofs
    .filter((p) => p.userId === userId)
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    .slice(0, limit)
    .map((p) => ({
      combinedHash: p.combinedHash,
      provider: p.provider,
      responseStatus: p.responseStatus,
      solanaStatus: p.solanaStatus,
      createdAt: p.created_at,
    }));
}

function getAllProofsForUser(userId, page = 1, perPage = 20) {
  const proofs = loadProofs();
  const userProofs = proofs
    .filter((p) => p.userId === userId)
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  const total = userProofs.length;
  const start = (page - 1) * perPage;
  const items = userProofs.slice(start, start + perPage).map((p) => ({
    combinedHash: p.combinedHash,
    blindedHash: p.blindedHash,
    secret: p.secret || null,
    userSecret: p.userSecret || null,
    provider: p.provider,
    targetUrl: p.targetUrl,
    responseStatus: p.responseStatus,
    solanaStatus: p.solanaStatus,
    batchId: p.batchId || null,
    solanaSignature: p.solanaSignature || null,
    createdAt: p.created_at,
  }));
  return { items, total, page, perPage, pages: Math.ceil(total / perPage) };
}

// --- Payloads (stored as individual files to keep proof index lean) ---

function storePayload(combinedHash, { request, response }) {
  const filePath = path.join(PAYLOADS_DIR, `${combinedHash}.json`);
  fs.writeFileSync(filePath, JSON.stringify({ request, response }));
}

function loadPayload(combinedHash) {
  const filePath = path.join(PAYLOADS_DIR, `${combinedHash}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

module.exports = {
  insertProof,
  findByHash,
  getPendingProofs,
  updateProofsBatch,
  insertBatch,
  findBatch,
  storePayload,
  loadPayload,
  getRecentProofsForUser,
  getAllProofsForUser,
};
