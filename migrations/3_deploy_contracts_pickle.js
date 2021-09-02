const { ether, balance, constants, time } = require("@openzeppelin/test-helpers");
const addContract = require("./helper/addContracts");

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
const dillABI = require("./helper/dill.json");
const IExchange = artifacts.require("IExchange");
const IERC20 = artifacts.require("IERC20");

module.exports = async function (deployer, network, accounts) {
  let smartWalletWhitelistAddress = "0xca719728Ef172d0961768581fdF35CB116e0B7a4";
  let pickle = await IERC20.at("0x429881672B9AE42b8EbA0E26cD9C73711b891Ca5");
  let checkerAdmin = "0x40907540d8a6c65c637785e8f8b742ae6b0b9968";
  let dillAdmin = "0x9d074E37d408542FD38be78848e8814AFB38db17";
  let dillAddress = "0xbBCf169eE191A1Ba7371F30A1C344bFC498b29Cf";
  let weth = await IERC20.at("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
  let exchange = await IExchange.at("0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D");
  let admin = accounts[0];

  // send ether to the checker admin
  let forceSend = await ForceSend.new();
  await forceSend.go(checkerAdmin, { value: ether("10"), from: admin });
  let checkerBalance = await balance.current(checkerAdmin);
  console.log("Checker Admin balance " + checkerBalance);

  // send ether to the dill admin
  forceSend = await ForceSend.new();
  await forceSend.go(dillAdmin, { value: ether("10"), from: admin });
  let dillBalance = await balance.current(dillAdmin);
  console.log("Dill Admin balance " + dillBalance);

  // start deployment
  console.log("deploying from: " + admin);

  // point checker to dill
  const dillContract = new web3.eth.Contract(dillABI, dillAddress);
  console.log("checker is ", await dillContract.methods.smart_wallet_checker().call());
  await dillContract.methods.commit_smart_wallet_checker(smartWalletWhitelistAddress).send({ from: dillAdmin });
  await dillContract.methods.apply_smart_wallet_checker().send({ from: dillAdmin });
  console.log("checker is ", await dillContract.methods.smart_wallet_checker().call());

  // voter proxy
  await deployer.deploy(PcikleVoterProxy, { from: admin });
  const voter = await PcikleVoterProxy.deployed();
  // whitelist the voter proxy
  const whitelist = await SmartWalletWhitelist.at(smartWalletWhitelistAddress);
  await whitelist.approveWallet(voter.address, { from: checkerAdmin });
  console.log("witelisted is ", await whitelist.check(voter.address));

  // exchange for pickle
  let starttime = await time.latest();
  await weth.sendTransaction({ value: web3.utils.toWei("1.0", "ether"), from: admin });
  let wethForPickle = await weth.balanceOf(admin);
  await weth.approve(exchange.address, 0, { from: admin });
  await weth.approve(exchange.address, wethForPickle, { from: admin });
  await exchange.swapExactTokensForTokens(wethForPickle, 0, [weth.address, pickle.address], admin, starttime + 3000, {
    from: admin,
  });
  let startingpickle = await pickle.balanceOf(admin);
  console.log("pickle to deposit: " + startingpickle);
  // deposit pickle into proxy
  await pickle.transfer(voter.address, startingpickle, { from: admin });

  // vetoken
  await deployer.deploy(veToken, constants.ZERO_ADDRESS, voter.address);
  let vetoken = await veToken.deployed();
  addContract("system", "pickle", pickle.address);
  addContract("system", "picklevoterProxy", voter.address);
  addContract("system", "vetoken", vetoken.address);

  // booster
  await deployer.deploy(Booster, voter.address, vetoken.address);
  const booster = await Booster.deployed();
  addContract("system", "pickleBooster", booster.address);
  await voter.setOperator(booster.address);

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
  await voter.setDepositor(pickleDepositor.address);
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

  // add pools
  await poolManager.addPool("0x1BB74b5DdC1f4fC91D6f9E7906cf68bc93538e33");
  const res = await booster.gaugeMap("0xf5bD1A4894a6ac1D786c7820bC1f36b1535147F6");
  console.log(res);
};
