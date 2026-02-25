require('dotenv').config();
const crypto = require('crypto');

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  baseUrl: process.env.BASE_URL || 'https://ioproof.com',
  requireApiKey: process.env.REQUIRE_API_KEY !== 'false', // default true (hosted), set false for self-hosted
  sessionSecret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  emailApiKey: process.env.EMAIL_API_KEY || null,
  emailFrom: process.env.EMAIL_FROM || 'noreply@ioproof.com',
  solana: {
    rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
    keypairSecret: process.env.SOLANA_KEYPAIR_SECRET || null,
    cluster: process.env.SOLANA_CLUSTER || 'devnet',
  },
  batch: {
    intervalMs: parseInt(process.env.BATCH_INTERVAL_MS, 10) || 3600000,
    minProofs: parseInt(process.env.BATCH_MIN_PROOFS, 10) || 1,
  },
  providerSig: {
    privateKey: process.env.IOPROOF_SIGNING_PRIVATE_KEY || null,
    publicKey: process.env.IOPROOF_SIGNING_PUBLIC_KEY || null,
    keyId: process.env.IOPROOF_SIGNING_KEY_ID || null,
  },
  alexiuzDb: {
    host: process.env.ALEXIUZ_DB_HOST || 'localhost',
    user: process.env.ALEXIUZ_DB_USER || '',
    password: process.env.ALEXIUZ_DB_PASSWORD || '',
    database: process.env.ALEXIUZ_DB_NAME || '',
  },
};
