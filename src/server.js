require('dotenv').config();
const express = require('express');
const path = require('path');
const config = require('./config');
const { rawBodyMiddleware } = require('./middleware/rawBody');
const { errorHandler } = require('./middleware/errorHandler');
const proxyRoutes = require('./routes/proxy');
const verifyRoutes = require('./routes/verify');
const healthRoutes = require('./routes/health');
const { startBatchProcessor } = require('./batch-processor');

const app = express();

// Health check
app.use('/health', healthRoutes);

// API routes
app.use('/v1/proxy', rawBodyMiddleware, proxyRoutes);
app.use('/api/verify', verifyRoutes);

// Static files
app.use(express.static(path.join(__dirname, '..', 'public')));

// SPA fallback for verify pages
app.get('/verify/*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});
app.get('/verify', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Error handler
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`IOProof server running on port ${config.port}`);
  startBatchProcessor();
});
