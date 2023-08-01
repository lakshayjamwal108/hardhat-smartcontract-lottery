const { assert, expect } = require("chai")
const { network, getNamedAccounts } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")
const { toUtf8Bytes } = require("ethers")

!developmentChains.includes(network.name) ? describe.skip : describe("Raffle", async () => {
    let raffle, vrfCoordinatorV2Mock, raffleEntranceFee, deployer, interval
    const chainId = network.config.chainId

    beforeEach(async ()=> {
       // const { deployer } = await getNamedAccounts()
        deployer = (await getNamedAccounts()).deployer
        await deployments.fixture(["all"])
        raffle = await ethers.getContract("Raffle", deployer)
        vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
        raffleEntranceFee = await raffle.getEntranceFee()
        interval = await raffle.getInterval()
    })

    describe("constructor", () => {
        it("initializes the raffle correctly", async function() {
            const raffleState = await raffle.getRaffleState()
            assert.equal(raffleState.toString(), "0")
            assert.equal(interval.toString(), networkConfig[chainId]["interval"])
        })
    })

    describe("enterRaffle", () => {
        it("reverts when you don't pay enough", async () => {
            await expect(raffle.enterRaffle()).to.be.revertedWith("Raffle__NotEnoughETHEntered")
        })
        it("records players when they enter", async function (){
            await raffle.enterRaffle({ value: raffleEntranceFee })
            const playerFromContract = await raffle.getPlayer(0)
            assert.equal(playerFromContract, deployer)
        })
        it("emits event on enter", async function() {
            await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.emit(raffle, "RaffleEnter"
            )
        })
        it("doesn't allow entrance when raffle is calculating", async function() {
            const checkData = toUtf8Bytes("")

            await raffle.enterRaffle({ value: raffleEntranceFee })
            await network.provider.send("evm_increaseTime", [Number(interval) + 1 ])
            await network.provider.send("evm_mine", [])
        //  await network.provider.request({method: "evm_mine", params: []})
            await raffle.performUpkeep(checkData)
            //await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.be.revertedWith("Raffle__NotOpen")
        })
    })
    describe("checkUpkeep", () => {
        it("returns false if people haven't sent any ETH", async () =>{
            const checkData = toUtf8Bytes("")
            await network.provider.send("evm_increaseTime", [Number(interval) + 1 ])
            await network.provider.send("evm_mine", [])
            const { upkeepNeeded } = await raffle.checkUpkeep.staticCall(checkData)
            console.log("checkdata passed")
            assert(!upkeepNeeded)
        })
        it("returns false if raffle isn't open", async () => {
            await raffle.enterRaffle({ value: raffleEntranceFee })
            const checkData = toUtf8Bytes("")
            await network.provider.send("evm_increaseTime", [Number(interval) + 1])
            await network.provider.send("evm_mine", [])
            await raffle.performUpkeep(checkData)
            const raffleState = await raffle.getRaffleState()
            const { upkeepNeeded } = await raffle.checkUpkeep.staticCall(checkData)
            assert.equal(raffleState.toString(), "1")
            assert.equal(upkeepNeeded, false)
        })
        it("returns false if enough time hasn't passed", async () => {
            await raffle.enterRaffle({ value: raffleEntranceFee })
            const checkData = toUtf8Bytes("")
            await network.provider.send("evm_increaseTime", [Number(interval) - 1 ])
            await network.provider.send("evm_mine", [])
            const { upkeepNeeded } = await raffle.checkUpkeep.staticCall(checkData)
            console.log("checkdata passed")
            assert(!upkeepNeeded)
        })
        it("returns true if enough time has passed, has player, eth, and is open", async () => {
            await raffle.enterRaffle({ value: raffleEntranceFee })
            const checkData = toUtf8Bytes("")
            await network.provider.send("evm_increaseTime", [Number(interval) + 1 ])
            await network.provider.send("evm_mine", [])
            const { upkeepNeeded } = await raffle.checkUpkeep.staticCall(checkData)
            console.log("checkdata passed")
            assert(upkeepNeeded)
        })
    })

    describe("performUpkeep", ()=> {
        it("it can only run if checkUpkeep is true", async ()=> {
            await raffle.enterRaffle({value: raffleEntranceFee})
            await network.provider.send("evm_increaseTime",[Number(interval) + 1])
            await network.provider.send("evm_mine", [])
            const tx = await raffle.performUpkeep("0x")
            assert(tx)
        })
        it("reverts when checkUpkeep is false", async () => {
            await expect(raffle.performUpkeep("0x").to.be.revertedWith("Raffle__UpkeepNotNeeded"))
        })
        it("updates the rafle state, emits an event, and calls thevrf coordinator", async () => {
            await raffle.enterRaffle({value: raffleEntranceFee})
            await network.provider.send("evm_increaseTime",[Number(interval) + 1])
            await network.provider.send("evm_mine", [])
            const txResponse = await raffle.performUpkeep("0x")
            const txReceipt = await txResponse.wait(1)
            const requestId = txReceipt.events[1].args.requestId
            assert(Number(requestId) > 0)
            assert(raffleState.toString() == "1")
        })
    })
    describe("fulfillRandomWords", () => {
        beforeEach( async () => {
            await raffle.enterRaffle({value: raffleEntranceFee})
            await network.provider.send("evm_increaseTime",[Number(interval) + 1])
            await network.provider.send("evm_mine", [])
        })
        it("can only be called after performUpkeep", async ()=> {
            await expect(vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.getAddress())).to.be.revertedWith("nonexistent request")
            await expect(vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.getAddress())).to.be.revertedWith("nonexistent request")
        })
        it("picks a winner, resets the lottery, and sends money", async () => {
            const additionalEntrants = 3
            const startingAccountIndex = 1
            const accounts = await ethers.getSigners()
            for(let i = startingAccountIndex;
                i< startingAccountIndex + additionalEntrants;
                i++
                ){
                    const accountConnectedRaffle = raffle.connect(accounts[i])
                    await accountConnectedRaffle.enterRaffle({value: raffleEntranceFee})
            }
            const startingTimeStamp = await raffle.getLatestTimeStamp()
            await new Promise(async (resolve, reject) => {
                raffle.once("winnerPicked", async () => {
                    console.log("Found the event!")
                    try {
                        console.log(recentWinner)
                        console.log(accounts[2].getAddress())
                        console.log(accounts[0].getAddress())
                        console.log(accounts[1].getAddress())
                        console.log(accounts[3].getAddress())
                        const recentWinner = await raffle.getRecentWinner()
                        const raffleState = await raffle.getRaffleState()
                        const endingTimeStamp = await raffle.getLatestTimeStamp()
                        const numPlayers = await raffle.getNumberOfPlayers()
                        const winnerEndingBalance = await accounts[1].getbalance()
                        assert.equal(numPlayers.toString(), "0")
                        assert.equal(raffleState.toString, "0")
                        assert(endingTimeStamp > startingTimeStamp)

                        assert.equal(winnerEndingBalance.toString(),
                            (
                            winnerStartingBalance +
                            raffleEntranceFee * additionalEntrants +
                            raffleEntranceFee
                            ).toString()
                        )
                    }catch (e) {
                        reject(e)
                    }
                    resolve()
                })
                const tx = await raffle.performUpkeep("0x")
                const txReceipt = await tx.wait(1)
                const winnerStartingBalance = await accounts[1].getbalance()
                await vrfCoordinatorV2Mock.fulfillRandomWords(
                    txReceipt.events[1].args.requestId,
                    raffle.getAddress()
                )
            })
            
        })
    })
})
