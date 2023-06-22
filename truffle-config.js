require('dotenv').config()  // Store environment-specific variable from '.env' to process.env

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
    live: {
      url: "https://mainnet.infura.io/v3/" + process.env.INFURA_KEY, // Infura
      port: 80,
      network_id: 1, 
    },
    ropsten: {
      url: "https://ropsten.infura.io/v3/" + process.env.INFURA_KEY, // Infura
      port: 80,
      network_id: 3, 
    },
    rinkeby: {
      url: "https://rinkeby.infura.io/v3/" + process.env.INFURA_KEY, // Infura
      port: 80,
      network_id: 4, 
    },
    goerli: {
      url: "https://goerli.infura.io/v3/" + process.env.INFURA_KEY, // Infura
      port: 80,
      network_id: 5, 
    },
    kovan: {
      url: "https://kovan.infura.io/v3/" + process.env.INFURA_KEY, // Infura
      port: 80,
      network_id: 42, 
    },
    sepolia: {
      url: "https://sepolia.infura.io/v3/" + process.env.INFURA_KEY, // Infura
      port: 80,
      network_id: 11155111,
    },
    
  },
  compilers: {
    solc: {
      version: "0.6.2",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200,
        }
      }
    }
  },
  api_keys: {
    etherscan: process.env.ETHERSCAN_KEY
  },
  plugins: ['truffle-plugin-verify']
}
