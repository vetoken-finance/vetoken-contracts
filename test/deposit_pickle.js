const { time } = require("@openzeppelin/test-helpers");
var jsonfile = require("jsonfile");
var contractList = jsonfile.readFileSync("contracts.json");

const PickleDepositor = artifacts.require("PickleDepositor");
const PcikleVoterProxy = artifacts.require("PickleVoterProxy");
const vtDillToken = artifacts.require("vtDillToken");
const IExchange = artifacts.require("IExchange");
const IERC20 = artifacts.require("IERC20");
const PickleBooster = artifacts.require("PickleBooster");
const BigNumber = require("bignumber.js");

const veToken = artifacts.require("veToken");

contract("Pickle Depositor Test", async (accounts) => {
  it("should deposit pickle and test locking", async () => {
    let account = accounts[0];
    let pickle = await IERC20.at("0x429881672B9AE42b8EbA0E26cD9C73711b891Ca5");
    let weth = await IERC20.at("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
    let dill = await IERC20.at("0xbBCf169eE191A1Ba7371F30A1C344bFC498b29Cf");
    let exchange = await IExchange.at("0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D");
    let p3CRVFarm = await IERC20.at("0xf5bD1A4894a6ac1D786c7820bC1f36b1535147F6");
    let p3CRV = await IERC20.at("0x1BB74b5DdC1f4fC91D6f9E7906cf68bc93538e33");

    let admin = accounts[0];
    let userA = accounts[1];
    let userB = accounts[2];
    let userC = "0x1fe5F397e38fFe61E663d96821F41bCF83ed7959";

    //system
    let voteproxy = await PcikleVoterProxy.at(contractList.system.picklevoterProxy);
    let pickleDeposit = await PickleDepositor.at(contractList.system.pickleDepositor);
    let vtPickle = await vtDillToken.at(contractList.system.vtPickleToken);
    let booster = await PickleBooster.at(contractList.system.pickleBooster);
    let vetoken = await veToken.at(contractList.system.vetoken);

    //console.log("current block time: " + starttime);
    await time.latestBlock().then((a) => console.log("current block: " + a));

    await pickle.balanceOf(dill.address).then((a) => console.log("pickle on dill after lock: " + a));
    await dill.balanceOf(voteproxy.address).then((a) => console.log("dill on proxy after lock: " + a));
    //console.log("create lock");

    //exchange for pickle userA
    let starttime = await time.latest();
    console.log("current block time: " + starttime);
    await weth.sendTransaction({ value: web3.utils.toWei("1.0", "ether"), from: userA });
    wethForPickle = await weth.balanceOf(userA);
    await weth.approve(exchange.address, 0, { from: userA });
    await weth.approve(exchange.address, wethForPickle, { from: userA });
    await exchange.swapExactTokensForTokens(wethForPickle, 0, [weth.address, pickle.address], userA, starttime + 3000, {
      from: userA,
    });
    startingpickle = await pickle.balanceOf(userA);

    //deposit pickle
    await pickle.approve(pickleDeposit.address, 0, { from: userA });
    await pickle.approve(pickleDeposit.address, startingpickle, { from: userA });
    await pickleDeposit.deposit(startingpickle, true, "0x0000000000000000000000000000000000000000", { from: userA });
    console.log("pickle deposited");

    await pickle.balanceOf(userA).then((a) => console.log("pickle on wallet: " + a));
    await vtPickle.balanceOf(userA).then((a) => console.log("vtPickle on wallet: " + a));
    await vtPickle.totalSupply().then((a) => console.log("vtPickle supply: " + a));
    await pickle.balanceOf(pickleDeposit.address).then((a) => console.log("depositor pickle: " + a));
    await pickle.balanceOf(voteproxy.address).then((a) => console.log("proxy pickle: " + a)); //0
    await pickle.balanceOf(dill.address).then((a) => console.log("pickle on dill after deposit: " + a));
    await dill.balanceOf(voteproxy.address).then((a) => console.log("dill on proxy after deposit: " + a));

    // deposit pickle lp token
    await p3CRVFarm.balanceOf(voteproxy.address).then((a) => console.log("p3crv on farm before: " + a));
    await p3CRV.balanceOf(userC).then((a) => console.log("p3CRV on wallet before: " + a));

    await p3CRV.approve(booster.address, web3.utils.toWei("100", "ether"), { from: userC });
    await booster.deposit(0, web3.utils.toWei("100", "ether"), false, { from: userC });

    await p3CRVFarm.balanceOf(voteproxy.address).then((a) => console.log("p3CRV balance of proxy: " + a));
    await p3CRV.balanceOf(userC).then((a) => console.log("p3CRV on wallet after: " + a));
    console.log("p3CRV balance of proxy: ", new BigNumber(await voteproxy.balanceOfPool(p3CRVFarm.address)).toString());
  });
});
