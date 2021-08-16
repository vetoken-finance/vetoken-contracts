const { ether, balance, constants, time } = require("@openzeppelin/test-helpers");
const addContract = require("./helper/addContracts");
const veToken = artifacts.require("veToken");
const CurveVoterProxy = artifacts.require("CurveVoterProxy");
const RewardFactory = artifacts.require("RewardFactory");
const vtCrvToken = artifacts.require("vtCrvToken");
const CrvDepositor = artifacts.require("CrvDepositor");
const BaseRewardPool = artifacts.require("BaseRewardPool");
const Booster = artifacts.require("Booster");
const TokenFactory = artifacts.require("TokenFactory");
const vetokenRewardPool = artifacts.require("CrvVtRewardPool");
const PoolManager = artifacts.require("PoolManager");
const ForceSend = artifacts.require("ForceSend");
const SmartWalletWhitelist = artifacts.require("SmartWalletWhitelist");
const IExchange = artifacts.require("IExchange");
const IERC20 = artifacts.require("IERC20");

module.exports = async function (deployer, network, accounts) {
  let smartWalletWhitelistAddress = "0xca719728Ef172d0961768581fdF35CB116e0B7a4";
  let crv = await IERC20.at("0xD533a949740bb3306d119CC777fa900bA034cd52");
  let checkerAdmin = "0x40907540d8a6c65c637785e8f8b742ae6b0b9968";
  let weth = await IERC20.at("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
  let exchange = await IExchange.at("0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D");
  let admin = accounts[0];

  // send ether to the checker admin
  let forceSend = await ForceSend.new();
  await forceSend.go(checkerAdmin, { value: ether("10"), from: admin });
  let checkerthBalance = await balance.current(checkerAdmin);
  console.log("Checker Admin balance " + checkerthBalance);

  // start deployment
  console.log("deploying from: " + admin);

  // voter proxy
  await deployer.deploy(CurveVoterProxy, { from: admin });
  const voter = await CurveVoterProxy.deployed();
  // whitelist the voter proxy
  const whitelist = await SmartWalletWhitelist.at(smartWalletWhitelistAddress);
  await whitelist.approveWallet(voter.address, { from: checkerAdmin });
  console.log("witelisted is ", await whitelist.check(voter.address));

  // exchange for crv
  let starttime = await time.latest();
  await weth.sendTransaction({ value: web3.utils.toWei("1.0", "ether"), from: admin });
  let wethForCrv = await weth.balanceOf(admin);
  await weth.approve(exchange.address, 0, { from: admin });
  await weth.approve(exchange.address, wethForCrv, { from: admin });
  await exchange.swapExactTokensForTokens(wethForCrv, 0, [weth.address, crv.address], admin, starttime + 3000, {
    from: admin,
  });
  let startingcrv = await crv.balanceOf(admin);
  console.log("crv to deposit: " + startingcrv);
  // deposit crv into proxy
  await crv.transfer(voter.address, startingcrv, { from: admin });

  // vetoken
  await deployer.deploy(veToken, voter.address, constants.ZERO_ADDRESS);
  let vetoken = await veToken.deployed();
  addContract("system", "crv", crv.address);
  addContract("system", "voterProxy", voter.address);
  addContract("system", "vetoken", vetoken.address);

  // booster
  await deployer.deploy(Booster, voter.address, vetoken.address);
  const booster = await Booster.deployed();
  addContract("system", "booster", booster.address);
  await voter.setOperator(booster.address);

  // reward factory
  await deployer.deploy(RewardFactory, booster.address);
  const rFactory = await RewardFactory.deployed();
  addContract("system", "rFactory", rFactory.address);

  // token factory
  await deployer.deploy(TokenFactory, booster.address);
  const tFactory = await TokenFactory.deployed();
  addContract("system", "tFactory", tFactory.address);

  // vtCrvToken
  await deployer.deploy(vtCrvToken);
  const vtcrvToken = await vtCrvToken.deployed();
  addContract("system", "vtcrvToken", vtcrvToken.address);

  // crvDepositer
  await deployer.deploy(CrvDepositor, voter.address, vtcrvToken.address);
  const crvDepositor = await CrvDepositor.deployed();
  addContract("system", "crvDepositor", crvDepositor.address);
  await vtcrvToken.setOperator(crvDepositor.address);
  await voter.setDepositor(crvDepositor.address);
  await crvDepositor.initialLock();
  console.log("initial Lock created on veCrv");

  // base reward pool for vtcrv
  await deployer.deploy(BaseRewardPool, 0, vtcrvToken.address, crv.address, booster.address, rFactory.address);
  const vtcrvTokenRewards = await BaseRewardPool.deployed();
  addContract("system", "vtcrvTokenRewards", vtcrvTokenRewards.address);

  // vetokenRewardPool
  await deployer.deploy(
    vetokenRewardPool,
    vetoken.address,
    crv.address,
    crvDepositor.address,
    vtcrvTokenRewards.address,
    vtcrvToken.address,
    booster.address,
    admin
  );
  const vetokenRewards = await vetokenRewardPool.deployed();
  addContract("system", "vetokenRewards", vetokenRewards.address);
  await booster.setRewardContracts(vtcrvTokenRewards.address, vetokenRewards.address);

  // poolmanager
  await deployer.deploy(PoolManager, booster.address);
  const poolManager = await PoolManager.deployed();
  addContract("system", "poolManager", poolManager.address);
  await booster.setPoolManager(poolManager.address);
  await booster.setFactories(rFactory.address, constants.ZERO_ADDRESS, tFactory.address);
  await booster.setFeeInfo();
};
