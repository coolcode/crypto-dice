import { Contract } from 'ethers'
import { BigNumber, } from 'ethers'

export const MINIMUM_LIQUIDITY = BigNumber.from(10).pow(3)

export function ether(n: number): BigNumber {
    return BigNumber.from(n).mul(BigNumber.from(10).pow(18))
}

export function toEther(n: number): BigNumber {
    return BigNumber.from(n).div(BigNumber.from(10).pow(18))
}
