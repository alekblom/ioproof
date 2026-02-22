const providers = {
  openai: require('./openai'),
  anthropic: require('./anthropic'),
  xai: require('./xai'),
  gemini: require('./gemini'),
};

function getProvider(name) {
  return providers[name] || null;
}

module.exports = { getProvider, providers };
