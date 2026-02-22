const fs = require('fs');
const path = require('path');
const { getTierLimit } = require('./tiers');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const USAGE_PATH = path.join(DATA_DIR, 'usage.json');

function loadUsage() {
  if (!fs.existsSync(USAGE_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(USAGE_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

function saveUsage(records) {
  fs.writeFileSync(USAGE_PATH, JSON.stringify(records, null, 2));
}

function currentMonth() {
  return new Date().toISOString().substring(0, 7); // YYYY-MM
}

function getUsageForUser(userId, month) {
  const records = loadUsage();
  return records.find((r) => r.userId === userId && r.month === month) || null;
}

function incrementUsage(userId) {
  const records = loadUsage();
  const month = currentMonth();
  let record = records.find((r) => r.userId === userId && r.month === month);

  if (record) {
    record.proofCount++;
    record.lastProofAt = new Date().toISOString();
  } else {
    record = {
      userId,
      month,
      proofCount: 1,
      lastProofAt: new Date().toISOString(),
    };
    records.push(record);
  }

  saveUsage(records);
  return record;
}

function checkQuota(userId, tier) {
  const month = currentMonth();
  const record = getUsageForUser(userId, month);
  const used = record ? record.proofCount : 0;
  const limit = getTierLimit(tier);

  return {
    allowed: limit === -1 || used < limit,
    used,
    limit,
    tier,
    month,
  };
}

function getUsageHistory(userId, months = 6) {
  const records = loadUsage();
  return records
    .filter((r) => r.userId === userId)
    .sort((a, b) => b.month.localeCompare(a.month))
    .slice(0, months);
}

module.exports = {
  incrementUsage,
  checkQuota,
  getUsageHistory,
  getUsageForUser,
  currentMonth,
};
