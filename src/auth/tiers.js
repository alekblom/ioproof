const TIERS = {
  free: { monthlyLimit: 100, name: 'Free' },
  // pro: { monthlyLimit: 10000, name: 'Pro' },
  // enterprise: { monthlyLimit: -1, name: 'Enterprise' },  // -1 = unlimited
};

function getTierLimit(tierName) {
  const tier = TIERS[tierName];
  return tier ? tier.monthlyLimit : 0;
}

function getTierName(tierName) {
  const tier = TIERS[tierName];
  return tier ? tier.name : 'Unknown';
}

module.exports = { TIERS, getTierLimit, getTierName };
