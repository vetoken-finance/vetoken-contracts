const veToken = artifacts.require("veToken");
const { constants } = require("@openzeppelin/test-helpers");
const addContract = require("./helper/addContracts");

module.exports = async function (deployer, network, accounts) {
  let convexVoterProxy = "0x989AEb4d175e16225E39E87d0D97A3360524AD80";

  await deployer.deploy(veToken, convexVoterProxy, constants.ZERO_ADDRESS);
  let vetoken = await veToken.deployed();
};
