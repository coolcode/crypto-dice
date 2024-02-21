// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import { Script, console } from "forge-std/Script.sol";
import { CryptoDice } from "src/CryptoDice.sol";

contract CryptoDiceScript is Script {
    function setUp() public { }

    function run() public {
        // deploy
        new CryptoDice();
        vm.broadcast();
    }
}
