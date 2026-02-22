module.exports = {
  name: 'xai',
  baseUrl: 'https://api.x.ai',

  buildHeaders(apiKey) {
    return {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };
  },

  buildUrl(path) {
    return `https://api.x.ai${path}`;
  },
};
