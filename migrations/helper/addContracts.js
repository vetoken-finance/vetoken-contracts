var fs = require("fs");
var created = false;
var contractList;
var systemContracts;
var poolsContracts;
var poolNames;

var addContract = function (group, name, value) {
  if (!created) {
    contractList = {};
    systemContracts = {};
    poolsContracts = [];
    poolNames = [];
    contractList["system"] = systemContracts;
    contractList["pools"] = poolsContracts;
    created = true;
  }
  contractList[group][name] = value;
  var contractListOutput = JSON.stringify(contractList, null, 4);
  fs.writeFileSync("contracts.json", contractListOutput, function (err) {
    if (err) {
      return console.log("Error writing file: " + err);
    }
  });
};

var getContract = function () {
  data = fs.readFileSync("contracts.json", { encoding: "utf8" });
  contractList = {};
  systemContracts = {};
  return JSON.parse(data);
  // console.log(contractList.system);
  // return contractList[name];
  //console.log(JSON.stringify(data));
  //   ,
  //   function (data) {
  //     console.log(data);
  //     contractList = JSON.stringify(data);
  //     console.log(contractList);
  //     return contractList[group][name];
  //   },
  //   function (err) {
  //     if (err) {
  //       return console.log("Error writing file: " + err);
  //     }
  //   }
  // );
};

module.exports = { addContract, getContract };
