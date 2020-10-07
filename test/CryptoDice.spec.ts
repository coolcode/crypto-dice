import chai, { expect } from 'chai'
import { Contract, BigNumber, utils } from 'ethers'
import { solidity, MockProvider, deployContract } from 'ethereum-waffle'
import { ecsign } from 'ethereumjs-util'

import { ether, toEther } from './shared/util'
import CryptoDice from '../build/CryptoDice.json'

chai.use(solidity)

const overrides = {
    gasLimit: 9999999,
    gasPrice: 0
}

describe('Dice Test', () => {
    const provider = new MockProvider({
        ganacheOptions: {
            gasLimit: 9999999
        }
    })
    const [wallet, investor] = provider.getWallets()

    let cc: Contract
    beforeEach(async function () {
        cc = await deployContract(wallet, CryptoDice, [], overrides)
        await cc.setSecretSigner(wallet.address)
        await cc.setCroupier(wallet.address)
        await cc.setMaxProfit(ether(50))
    })

    it('place bet emit event', async () => {
        const balBefore = await wallet.getBalance()
        console.info(`bal [before]: ${balBefore.div(ether(1))}`)

        // transfer 2 ETH to contract
        await cc.fallback({ ...overrides, value: ether(1000) })

        const balAfter = await wallet.getBalance()
        console.info(`bal [after]: ${balAfter.div(ether(1))}`)

        const ccBefore = await provider.getBalance(cc.address)
        console.info(`bal [cc]: ${ccBefore.div(ether(1))}`)

        let i = 0;
        while (i++ < 20) {
            const betMask = BigNumber.from(1)
            const modulo = BigNumber.from(2)
            const commitLastBlock = BigNumber.from(await provider.getBlockNumber() + 1)

            // TODO: how to retrieve `reveal` value?
            const reveal = BigNumber.from(commitLastBlock)
            // uint256 commit = uint256(keccak256(abi.encodePacked(reveal)));
            const commitDigest = utils.solidityKeccak256(
                ['uint256'],
                [reveal])

            const commit = BigNumber.from(commitDigest)

            console.info(`commitLastBlock: ${commitLastBlock}, reveal: ${reveal}, commit: ${commit}`)

            const digest = utils.solidityKeccak256(
                ['uint40', 'uint256'],
                [commitLastBlock, commit])
            console.info(`digest: ${digest}`)

            const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(wallet.privateKey.slice(2), 'hex'))
            console.info(`v: ${v}, r: ${utils.hexlify(r)}, s: ${utils.hexlify(s)}`)

            const balBeforeBet = await investor.getBalance()
            console.info(`investor [before bet]: ${balBeforeBet.div(ether(1))}`)

            // error!!! when v = 28
            const placeBet = cc.connect(investor).placeBet(betMask, modulo, commitLastBlock, commit, utils.hexlify(r), utils.hexlify(s), { ...overrides, value: ether(10) })

            const balAfterBet = await investor.getBalance()
            console.info(`investor [after bet]: ${balAfterBet.div(ether(1))}`)

            // const hash = await expect(placeBet).emit(cc, 'Commit')
            //     .withArgs(commit)

            const receipt = await placeBet
            // receipt.wait()
            // console.info(`receipt: `, receipt)
            const txHash = receipt.hash
            // get block hash
            const tx = await provider.getTransaction(txHash)
            // console.info(`tx: `, tx)
            const blockHash = tx.blockHash || ''
            console.info(`blockHash: `, blockHash)

            await cc.connect(wallet).settleBet(reveal, Buffer.from(blockHash.slice(2), 'hex'))

            const ccAfter = await provider.getBalance(cc.address)
            console.info(`bal [cc]: ${ccAfter.div(ether(1))}`)
            const balAfterSettle = await investor.getBalance()
            console.info(`bal [after settle]: ${balAfterSettle.div(ether(1))}`)
        }
    })
})
