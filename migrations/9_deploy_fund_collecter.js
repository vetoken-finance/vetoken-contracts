const veToken = artifacts.require("veToken");
const veTokenPresale = artifacts.require("veTokenPresale");
const { constants } = require("@openzeppelin/test-helpers");
const BigNumber = require("bignumber.js");

function toBN(number) {
  return new BigNumber(number);
}

module.exports = async function (deployer, network, accounts) {
  let pickleVoterProxy = "0x05A7Ebd3b20A2b0742FdFDe8BA79F6D22Ea9C351";
  const vetokenTreasury = "0x9e3B5c81336f17B3e484f6805815f21782290EEF";
  // vetoken
  await deployer.deploy(veToken, constants.ZERO_ADDRESS, pickleVoterProxy);
  let vetoken = await veToken.deployed();

  // 1 month after product publish
  let startBlock = toBN((await web3.eth.getBlockNumber()).toString()).plus(192000);
  
  await deployer.deploy(veTokenPresale, startBlock, vetokenTreasury, vetoken.address);
  let vetokenPresale = await veTokenPresale.deployed();
};
