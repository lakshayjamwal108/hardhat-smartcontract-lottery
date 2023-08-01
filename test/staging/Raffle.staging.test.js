const { assert, expect } = require("chai")
const { network, getNamedAccounts } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")
const { toUtf8Bytes } = require("ethers")

developmentChains.includes(network.name) ? describe.skip : describe("Raffle", async () => {
    let raffle, raffleEntranceFee, deployer, interval

    beforeEach(async ()=> {
       // const { deployer } = await getNamedAccounts()
        deployer = (await getNamedAccounts()).deployer
        await deployments.fixture(["all"])
        raffle = await ethers.getContract("Raffle", deployer)
        raffleEntranceFee = await raffle.getEntranceFee()
    })

    describe("fulfillRandomWords", () => {
        it("works with live Chainlink Keepers and Chainlink VRF, we get a random winner", async () => {
            const startingTimeStamp = await raffle.getLatestTimeStamp()
            const accounts = await ethers.getSigners()
            await new Promise(async (reslove, reject) => {
                raffle.once("WinnerPicked", async () => {
                    console.log("WinnerPicked event fired!")
                    try {
                        const recentWinner = await raffle.getRecentWinner()
                        const raffleState = await raffle.getRaffleState()
                        const winnerEndingBalance = await accounts[0].getBalance()
                        const endingTimeStamp = await raffle.getLatestTimeStamp()

                         await expect(raffle.getPlayer(0)).to.be.reverted
                        assert.equal(recentWinner.toString(), accounts[0].getAddress())
                        assert.equal(raffleState, 0)
                        assert.equal(winnerEndingBalance.toString(), (winnerStartingBalance + raffleEntranceFee).toString())
                        assert(endingTimeStamp > startingTimeStamp)
                        resolve()
                    } catch(error) {
                        console.log(error)
                        reject(e)
                    }
                })
                await raffle.enterRaffle({ value: raffleEntranceFee })
                const winnerStartingBalance = await accounts[0].getBalance()

            })
        })
    })
})