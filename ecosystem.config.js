// PM2 Config
module.exports = {
  apps: [
    {
      name: 'liquidation-keeper-mainnet',
      max_memory_restart: '500M',
      script: './build/src/index.js',
      args: 'run',
      time: true
    },
    {
      name: 'liquidation-keeper-testnet',
      max_memory_restart: '500M',
      script: './build/src/index.js',
      args: 'run',
      time: true
    },
  ],
};
