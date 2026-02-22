const { Router } = require('express');
const { SolanaAttestor } = require('../attestation/solana');
const { getProviderNames } = require('../providers');
const config = require('../config');
const router = Router();

const attestor = new SolanaAttestor(config.solana.rpcUrl, config.solana.keypairSecret);

router.get('/', async (req, res) => {
  const health = {
    status: 'ok',
    service: 'ioproof',
    providers: getProviderNames(),
    batch_interval_ms: config.batch.intervalMs,
    solana_configured: attestor.isConfigured(),
  };

  if (attestor.isConfigured()) {
    try {
      health.solana_balance = await attestor.getBalance();
      health.solana_pubkey = attestor.getPublicKey();
    } catch {
      health.solana_balance = 'unavailable';
    }
  }

  res.json(health);
});

module.exports = router;
