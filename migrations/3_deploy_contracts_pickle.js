const { ether, balance, constants, time } = require("@openzeppelin/test-helpers");
const { addContract } = require("./helper/addContracts");

const veToken = artifacts.require("veToken");
const PcikleVoterProxy = artifacts.require("PickleVoterProxy");
const RewardFactory = artifacts.require("PickleRewardFactory");
const vtPickleToken = artifacts.require("vtDillToken");
const PickleDepositor = artifacts.require("PickleDepositor");
const BaseRewardPool = artifacts.require("PickleBaseRewardPool");
const Booster = artifacts.require("PickleBooster");
const TokenFactory = artifacts.require("PickleTokenFactory");
const vetokenRewardPool = artifacts.require("PickleVtRewardPool");
const PoolManager = artifacts.require("PicklePoolManager");
const ForceSend = artifacts.require("ForceSend");
const SmartWalletWhitelist = artifacts.require("SmartWalletWhitelist");
const dillABI = require("./helper/DILL.json");
const IExchange = artifacts.require("IExchange");
const IERC20 = artifacts.require("IERC20");

module.exports = async function (deployer, network, accounts) {
  let pickle = await IERC20.at("0x429881672B9AE42b8EbA0E26cD9C73711b891Ca5");

  let voterProxyAddress = "0x05A7Ebd3b20A2b0742FdFDe8BA79F6D22Ea9C351";
  let voterProxyOwner = "0x30a8609c9d3f4a9ee8ebd556388c6d8479af77d1";
  let pickleUser = "0xF8dB00cDdEEDd6BEA28dfF88F6BFb1B531A6cBc9";
  let admin = accounts[0];

  // send ether to the checker admin
  let forceSend = await ForceSend.new();
  await forceSend.go(voterProxyOwner, { value: ether("10"), from: admin });

  console.log("deploying from: " + admin);

  // voter proxy
  const voter = await PcikleVoterProxy.at(voterProxyAddress);

  // exchange for pickle
  await pickle.transfer(admin, web3.utils.toWei("16000"), { from: pickleUser });

  await pickle.transfer(voter.address, web3.utils.toWei("1000"), { from: admin });

  // vetoken
  await deployer.deploy(veToken);
  let vetoken = await veToken.deployed();
  addContract("system", "pickle", pickle.address);
  addContract("system", "picklevoterProxy", voter.address);
  addContract("system", "vetoken", vetoken.address);

  // booster
  await deployer.deploy(Booster, voter.address, vetoken.address);
  const booster = await Booster.deployed();
  addContract("system", "pickleBooster", booster.address);
  await voter.setOperator(booster.address, { from: voterProxyOwner });

  // reward factory
  await deployer.deploy(RewardFactory, booster.address);
  const rFactory = await RewardFactory.deployed();
  addContract("system", "rFactory", rFactory.address);

  // token factory
  await deployer.deploy(TokenFactory, booster.address);
  const tFactory = await TokenFactory.deployed();
  addContract("system", "tFactory", tFactory.address);

  // vtPickleToken
  await deployer.deploy(vtPickleToken);
  const vtpickleToken = await vtPickleToken.deployed();
  addContract("system", "vtPickleToken", vtpickleToken.address);

  // crvDepositer
  await deployer.deploy(PickleDepositor, voter.address, vtpickleToken.address);
  const pickleDepositor = await PickleDepositor.deployed();
  addContract("system", "pickleDepositor", pickleDepositor.address);
  await vtpickleToken.setOperator(pickleDepositor.address);
  await voter.setDepositor(pickleDepositor.address, { from: voterProxyOwner });
  await pickleDepositor.initialLock();
  console.log("initial Lock created on DILL");

  // base reward pool for vtpickle(vtDill)
  await deployer.deploy(BaseRewardPool, 0, vtpickleToken.address, pickle.address, booster.address, rFactory.address);
  const vtpickleTokenRewards = await BaseRewardPool.deployed();
  addContract("system", "vtpickleTokenRewards", vtpickleTokenRewards.address);

  // vetokenRewardPool
  await deployer.deploy(
    vetokenRewardPool,
    vetoken.address,
    pickle.address,
    pickleDepositor.address,
    vtpickleTokenRewards.address,
    vtpickleToken.address,
    booster.address,
    admin
  );
  const vetokenRewards = await vetokenRewardPool.deployed();
  addContract("system", "vetokenRewards", vetokenRewards.address);
  await booster.setRewardContracts(vtpickleTokenRewards.address, vetokenRewards.address);

  // poolmanager
  await deployer.deploy(PoolManager, booster.address);
  const poolManager = await PoolManager.deployed();
  addContract("system", "poolManager", poolManager.address);
  await booster.setPoolManager(poolManager.address);
  await booster.setFactories(rFactory.address, tFactory.address);
  await booster.setFeeInfo();
};
