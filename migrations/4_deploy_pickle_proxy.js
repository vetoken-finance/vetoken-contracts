const PickleVoterProxy = artifacts.require("PickleVoterProxy");

module.exports = async function (deployer) {
  await deployer.deploy(PickleVoterProxy);
  const pickleVoterProxy = await PickleVoterProxy.deployed();
  const tx = await pickleVoterProxy.setOwner("0x30a8609c9D3F4a9ee8EBD556388C6d8479af77d1");
  console.log(`Transaction Transfer Ownership, hash ${tx.tx}`);
};
