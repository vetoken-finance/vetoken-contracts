const VetokenBond = artifacts.require("VetokenBond");
const Treasury = artifacts.require("Treasury");
const veToken = artifacts.require("veToken");
const { constants } = require("@openzeppelin/test-helpers");

module.exports = async function (deployer, network, accounts) {
  const vetokenTreasury = "0x9e3B5c81336f17B3e484f6805815f21782290EEF";
  let pickleVoterProxy = "0x05A7Ebd3b20A2b0742FdFDe8BA79F6D22Ea9C351";

  await deployer.deploy(veToken, constants.ZERO_ADDRESS, pickleVoterProxy);
  let vetoken = await veToken.deployed();

  await deployer.deploy(
    Treasury,
    vetoken.address,
    constants.ZERO_ADDRESS,
    constants.ZERO_ADDRESS,
    constants.ZERO_ADDRESS,
    constants.ZERO_ADDRESS,
    0,
    0,
    0,
    0
  );

  let treasury = await Treasury.deployed();

  await deployer.deploy(
    VetokenBond,
    vetoken.address,
    vetoken.address,
    treasury.address,
    constants.ZERO_ADDRESS,
    vetokenTreasury,
    vetokenTreasury
  );
};
