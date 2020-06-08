module.exports = {
  networks: {
    local: {
      host: 'localhost',
      port: 9545,
      gas: 6000000,
      gasPrice: 5e9,
      network_id: '*',
    },
    test: {
      host: 'localhost',
      port: 8545,
      network_id: '*',
    },
    coverage: {
      host: 'localhost',
      network_id: '*',
      port: 8555,
      gas: 0x7270E0,
      gasPrice: 0x01,
    },
  },
  compilers: {
    solc: {
      version: "0.6.2",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        }
      }
    }
  }
}
