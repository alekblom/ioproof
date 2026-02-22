const path = require('path');
const fs = require('fs');

const configPath = path.join(__dirname, 'providers.json');
const registry = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

const providers = {};

for (const [name, cfg] of Object.entries(registry)) {
  providers[name] = {
    name,
    baseUrl: cfg.baseUrl,

    buildHeaders(apiKey) {
      const headers = { 'Content-Type': 'application/json' };

      if (cfg.authType === 'bearer') {
        headers['Authorization'] = `Bearer ${apiKey}`;
      } else if (cfg.authType === 'header') {
        headers[cfg.authHeader] = apiKey;
      }

      if (cfg.extraHeaders) {
        Object.assign(headers, cfg.extraHeaders);
      }

      return headers;
    },

    buildUrl(urlPath) {
      return `${cfg.baseUrl}${urlPath}`;
    },
  };
}

function getProvider(name) {
  return providers[name] || null;
}

function getProviderNames() {
  return Object.keys(providers);
}

module.exports = { getProvider, getProviderNames, providers };
