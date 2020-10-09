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
    const [wallet, signer, croupier, investor] = provider.getWallets()

    let cc: Contract
    beforeEach(async function () {
        cc = await deployContract(wallet, CryptoDice, [], overrides)
        await cc.setSecretSigner(signer.address)
        await cc.setCroupier(croupier.address)
        await cc.setMaxProfit(ether(50))
    })

    const sign = (commitLastBlock: BigNumber) => {

        let rHex: string
        let sHex: string
        let commit = BigNumber.from(0)
        let reveal = BigNumber.from(0)
        while (true) {
            // set `reveal` value to a random 32-bit value 
            const rand = Math.floor(Math.random() * 0xFFFFFFFF)//.toFixed()
            reveal = BigNumber.from(rand)
            const commitDigest = utils.solidityKeccak256(
                ['uint256'],
                [reveal])

            commit = BigNumber.from(commitDigest)

            console.info(`commitLastBlock: ${commitLastBlock}, reveal: ${reveal}, commit: ${commit}`)

            const digest = utils.solidityKeccak256(
                ['uint40', 'uint256'],
                [commitLastBlock, commit])
            console.info(`digest: ${digest}`)

            const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(signer.privateKey.slice(2), 'hex'))
            rHex = utils.hexlify(r)
            sHex = utils.hexlify(s)
            console.info(`v: ${v}, r: ${rHex}, s: ${sHex}`)

            // dice contract only allows v == 27
            if (v == 27) {
                break;
            }

            console.warn(`-------------------- v!=27, skip -------------------`)
        }

        return { r: rHex, s: sHex, commit, reveal }
    }

    it('place bet emit event', async () => {
        const balBefore = await wallet.getBalance()
        console.info(`bal [before]: ${toEther(balBefore)}`)

        // transfer jackpot to contract
        await cc.fallback({ ...overrides, value: ether(1000) })

        const balAfter = await wallet.getBalance()
        console.info(`bal [after]: ${toEther(balAfter)}`)

        const ccBefore = await provider.getBalance(cc.address)
        console.info(`bal [cc]: ${toEther(ccBefore)}`)

        let i = 0;
        while (i++ < 20) {
            console.info(`========= round: ${i} ===========`)
            const betMask = BigNumber.from(1)
            const modulo = BigNumber.from(2)
            const commitLastBlock = BigNumber.from(await provider.getBlockNumber() + 1)
            const { r, s, commit, reveal } = sign(commitLastBlock)

            const balBeforeBet = await investor.getBalance()
            console.info(`investor [before bet]: ${toEther(balBeforeBet)}`)

            const placeBet = cc.connect(investor).placeBet(betMask, modulo, commitLastBlock, commit, r, s, { ...overrides, value: ether(10) })

            const balAfterBet = await investor.getBalance()
            console.info(`investor [after bet]: ${toEther(balAfterBet)}`)

            // const hash = await expect(placeBet).emit(cc, 'Commit')
            //     .withArgs(commit)

            const receipt = await placeBet
            const txHash = receipt.hash
            // get block hash
            const tx = await provider.getTransaction(txHash)
            // console.info(`tx: `, tx)
            const blockHash = tx.blockHash || ''
            console.info(`blockHash: `, blockHash)

            await cc.connect(croupier).settleBet(reveal, Buffer.from(blockHash.slice(2), 'hex'))

            const ccAfter = await provider.getBalance(cc.address)
            console.info(`bal [cc]: ${toEther(ccAfter)}`)
            const balAfterSettle = await investor.getBalance()
            console.info(`bal [after settle]: ${toEther(balAfterSettle)}`)
        }
    })
})
