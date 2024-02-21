// SPDX-License-Identifier: GPLv3
pragma solidity ^0.8.0;

import { Test, console, Vm } from "forge-std/Test.sol";
import { ECDSA } from "src/libs/ECDSA.sol";
import { CryptoDice } from "src/CryptoDice.sol";

contract CounterTest is Test {
    //using ECDSA for bytes32;

    CryptoDice dice;
    Vm.Wallet secretSigner = vm.createWallet("secret signer");
    Vm.Wallet croupier = vm.createWallet("croupier");
    address user = address(0xA11CE);

    function setUp() public {
        vm.label(user, "Alice");
        vm.deal(user, 100 ether);

        // init dice
        dice = new CryptoDice();
        dice.setSecretSigner(secretSigner.addr);
        dice.setCroupier(croupier.addr);
        dice.setMaxProfit(10 ether);

        // set dice vault
        payable(dice).transfer(1000 ether);

        // set block timestamp to something reasonable
        vm.warp(1700952587);
        vm.roll(10000);
    }

    function test_Bet() public {
        console.log("block number: %d", block.number);
        uint40 commitLastBlock = uint40(block.number + 1);
        vm.prank(secretSigner.addr);
        (uint256 secret, uint256 secretHash, bytes32 r, bytes32 s) = sign(commitLastBlock);

        uint256 betMask = 1;
        uint256 modulo = 2;
        uint256 betAmount = 1 ether;

        // commit 
        vm.prank(user);
        dice.placeBet{ value: betAmount }(betMask, modulo, commitLastBlock, secretHash, r, s);

        assertEq(user.balance, 99 ether, "user should bet 1 ether");
        assertEq(address(dice).balance, 1001 ether, "dice contract should receive 1 ether");

        vm.roll(block.number + 2);

        bytes32 blockHash = blockhash(commitLastBlock);// keccak256(abi.encodePacked(commitLastBlock));
        // console.log("block hash: %s", uint256(blockHash));

        // reveal
        vm.prank(croupier.addr);
        dice.settleBet(secret, blockHash);
    }

    function sign(uint40 commitLastBlock) private returns (uint256 secret, uint256 secretHash, bytes32 r, bytes32 s) {
        uint16 i = 0;
        uint8 v;
        while (i++ < 256) {
            secret = i;
            secretHash = uint256(keccak256(abi.encodePacked(secret)));
            bytes32 digest = keccak256(abi.encodePacked(commitLastBlock, secretHash));
            (v, r, s) = vm.sign(secretSigner.privateKey, digest);
            if (v == 27) {
                break;
            }
            address signer = ecrecover(digest, v, r, s);
            assertEq(signer, secretSigner.addr, "wrong signer");
            // bytes memory signature = abi.encodePacked(r, s, v);
            // console.log("signature:", string(signature));
        }
    }
}
