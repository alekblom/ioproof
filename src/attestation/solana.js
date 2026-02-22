const {
  Connection,
  Keypair,
  Transaction,
  TransactionInstruction,
  PublicKey,
  sendAndConfirmTransaction,
} = require('@solana/web3.js');

const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

class SolanaAttestor {
  constructor(rpcUrl, keypairSecret) {
    this.connection = new Connection(rpcUrl, 'confirmed');
    if (keypairSecret) {
      this.keypair = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(keypairSecret))
      );
    } else {
      this.keypair = null;
    }
  }

  isConfigured() {
    return this.keypair !== null;
  }

  getPublicKey() {
    return this.keypair?.publicKey?.toBase58() || null;
  }

  /**
   * Commit a Merkle root to Solana as a single memo transaction.
   * Format: ioproof|batch|{batchId}|{merkleRoot}|{proofCount}|{timestamp}
   */
  async commitBatch(batchId, merkleRoot, proofCount, timestamp) {
    if (!this.keypair) {
      console.warn('[SOLANA] No keypair configured, skipping on-chain commitment');
      return null;
    }

    const memo = `ioproof|batch|${batchId}|${merkleRoot}|${proofCount}|${timestamp}`;

    const instruction = new TransactionInstruction({
      keys: [{
        pubkey: this.keypair.publicKey,
        isSigner: true,
        isWritable: true,
      }],
      data: Buffer.from(memo, 'utf-8'),
      programId: MEMO_PROGRAM_ID,
    });

    const transaction = new Transaction().add(instruction);

    const signature = await sendAndConfirmTransaction(
      this.connection,
      transaction,
      [this.keypair],
    );

    let slot = null;
    let blockTime = null;
    try {
      const txInfo = await this.connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });
      slot = txInfo?.slot || null;
      blockTime = txInfo?.blockTime || null;
    } catch (err) {
      console.warn('[SOLANA] Could not fetch tx details:', err.message);
    }

    return { signature, slot, blockTime };
  }

  async getBalance() {
    if (!this.keypair) return 0;
    return this.connection.getBalance(this.keypair.publicKey);
  }
}

module.exports = { SolanaAttestor };
