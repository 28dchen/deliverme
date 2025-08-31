require('@nomicfoundation/hardhat-ethers');
require('dotenv').config();

module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337
    },
    sepolia: {
      url: process.env.ETHEREUM_RPC_URL || "https://sepolia.infura.io/v3/your-project-id",
      accounts: process.env.USER_PRIVATE_KEY ? [process.env.USER_PRIVATE_KEY] : []
    }
  },
  paths: {
    sources: "../SmartContract/contracts",
    tests: "../SmartContract/test",
    cache: "../SmartContract/cache",
    artifacts: "../SmartContract/artifacts"
  }
};