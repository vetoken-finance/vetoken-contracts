const veToken = artifacts.require("veToken");
const { constants } = require("@openzeppelin/test-helpers");
const addContract = require("./helper/addContracts");

module.exports = async function (deployer, network, accounts) {
  let pickleVoterProxy = "0x05A7Ebd3b20A2b0742FdFDe8BA79F6D22Ea9C351";

  await deployer.deploy(veToken, constants.ZERO_ADDRESS , pickleVoterProxy);
  let vetoken = await veToken.deployed();
};
