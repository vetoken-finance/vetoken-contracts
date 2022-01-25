const SnowVoterProxy = artifacts.require("SnowVoterProxy");

module.exports = async function (deployer) {
  // await deployer.deploy(SnowVoterProxy);
  const snowVoterProxy = await SnowVoterProxy.at("0x175a7b546cfaef85089b263d978611bc1e0d96ab");

  const tx = await snowVoterProxy.setOwner("0x30a8609c9D3F4a9ee8EBD556388C6d8479af77d1");
  console.log(`Transaction Transfer Ownership, hash ${tx.tx}`);
};
