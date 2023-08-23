require("@nomiclabs/hardhat-waffle")
require("@nomiclabs/hardhat-etherscan")
require("hardhat-deploy")
require("solidity-coverage")
require("hardhat-gas-reporter")
require("hardhat-contract-sizer")
require("dotenv").config()
/** @type import('hardhat/config').HardhatUserConfig */

const ALCHEMY_API_KEY=process.env.ALCHEMY_API_KEY
const SEPOLIA_PRIVATE_KEY=process.env.SEPOLIA_PRIVATE_KEY
const COINMARKET_API_KEY=process.env.COINMARKET_API_KEY
const ETHERSCAN_API_KEY=process.env.ETHERSCAN_API_KEY

module.exports = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      chainId: 31337,
      blockConfirmations: 1
    },
    sepolia: {
      chainid: 11155111,
      url: `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
      blockConfirmations: 1,
      accounts: [SEPOLIA_PRIVATE_KEY],
    },
  },
  solidity: {
    compilers: [{ version: "0.8.18"}, { version: "0.8.4"}],
  
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
    player: {
      default: 1,
    },
  },
  mocha: {
    timeout: 200000,
  },
}
