module.exports = {
  name: 'openai',
  baseUrl: 'https://api.openai.com',

  buildHeaders(apiKey) {
    return {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };
  },

  buildUrl(path) {
    return `https://api.openai.com${path}`;
  },
};
