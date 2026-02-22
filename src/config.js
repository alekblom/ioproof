require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  solana: {
    rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
    keypairSecret: process.env.SOLANA_KEYPAIR_SECRET || null,
  },
  batch: {
    intervalMs: parseInt(process.env.BATCH_INTERVAL_MS, 10) || 3600000, // 1 hour default
    minProofs: parseInt(process.env.BATCH_MIN_PROOFS, 10) || 1,         // minimum proofs to trigger batch
  },
};
