require('dotenv').config();
const express = require('express');
const path = require('path');
const config = require('./config');
const { rawBodyMiddleware } = require('./middleware/rawBody');
const { errorHandler } = require('./middleware/errorHandler');
const { sessionAuth } = require('./middleware/sessionAuth');
const proxyRoutes = require('./routes/proxy');
const verifyRoutes = require('./routes/verify');
const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');
const dashboardApiRoutes = require('./routes/dashboard-api');
const { startBatchProcessor } = require('./batch-processor');

const app = express();

// Health check
app.use('/health', healthRoutes);

// Auth routes (JSON body parsing)
app.use('/auth', express.json(), authRoutes);

// Dashboard API (JSON body parsing + session auth)
app.use('/api/dashboard', express.json(), sessionAuth, dashboardApiRoutes);

// Proxy routes (raw body capture, NOT express.json)
app.use('/v1/proxy', rawBodyMiddleware, proxyRoutes);

// Verify API
app.use('/api/verify', verifyRoutes);

// Static files
app.use(express.static(path.join(__dirname, '..', 'public')));

// SPA fallbacks
const publicDir = path.join(__dirname, '..', 'public');
app.get('/verify/*', (req, res) => res.sendFile(path.join(publicDir, 'index.html')));
app.get('/verify', (req, res) => res.sendFile(path.join(publicDir, 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(publicDir, 'login.html')));
app.get('/register', (req, res) => res.sendFile(path.join(publicDir, 'register.html')));
app.get('/activate', (req, res) => res.sendFile(path.join(publicDir, 'activate.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(publicDir, 'dashboard', 'index.html')));
app.get('/dashboard/keys', (req, res) => res.sendFile(path.join(publicDir, 'dashboard', 'keys.html')));
app.get('/dashboard/usage', (req, res) => res.sendFile(path.join(publicDir, 'dashboard', 'usage.html')));
app.get('/dashboard/account', (req, res) => res.sendFile(path.join(publicDir, 'dashboard', 'account.html')));
app.get('/dashboard/proofs', (req, res) => res.sendFile(path.join(publicDir, 'dashboard', 'proofs.html')));
app.get('/standalone-verifier', (req, res) => res.sendFile(path.join(publicDir, 'standalone-verifier.html')));

// Error handler
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`IOProof server running on port ${config.port} (API key required: ${config.requireApiKey})`);
  startBatchProcessor();
});
