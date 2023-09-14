// PM2 Config
module.exports = {
  apps: [
    {
      name: 'liquidation-keeper-mainnet',
      script: './build/src/index.js',
      args: 'run',
    },
    {
      name: 'liquidation-keeper-testnet',
      script: './build/src/index.js',
      args: 'run',
    },
  ],
};
