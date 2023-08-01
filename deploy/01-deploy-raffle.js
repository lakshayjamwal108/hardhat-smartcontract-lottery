const { network, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")
const { EventLog } = require("ethers")

const VRF_SUB_FUND_AMOUNT = ethers.parseEther("30")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const {deployer} = await getNamedAccounts()
    const chainId = network.config.chainId
    let vrfCoordinatorV2Address, subscriptionId, vrfCoordinatorV2Mock

    if(developmentChains.includes(network.name)){
        vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
        vrfCoordinatorV2Address = await vrfCoordinatorV2Mock.getAddress()
        console.log("VrfCoordinatorV2Mock address : ",vrfCoordinatorV2Address)
        const transactionResponse = await vrfCoordinatorV2Mock.createSubscription()
        const transactionReceipt = await transactionResponse.wait(1)
        console.log(transactionReceipt)
        subscriptionId = transactionReceipt.events[0].args.subId
        //subscriptionId = await vrfCoordinatorV2Mock.getSubId()
        console.log("Sub Id : ",subscriptionId)

        await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, VRF_SUB_FUND_AMOUNT)
    } else {
        vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"]
        subscriptionId = networkConfig[chainId]["subscriptionId"]
    }
    
    const waitBlockConfirmations = developmentChains.includes(network.name)
        ? 1
        : VERIFICATION_BLOCK_CONFIRMATIONS

    log("----------------------------------------------------")

    const gasLane = await networkConfig[chainId]["gasLane"]
    const entranceFee = await networkConfig[chainId]["entranceFee"]
    const callbackGasLimit = await networkConfig[chainId]["callbackGasLimit"]
    const interval = await networkConfig[chainId]["interval"]

    const arguments = [vrfCoordinatorV2Address, entranceFee, gasLane, subscriptionId, callbackGasLimit, interval]
    const raffle = await deploy("Raffle", {
        from: deployer,
        args: arguments,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    })

    if(!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY){
        log("verifying...")
        await verify(raffle.getAddress(), args)
    }

    log("----------------------------------------------")
}

module.exports.tags = ["all","raffle"]