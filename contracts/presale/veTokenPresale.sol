pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// veTokenPresale
contract veTokenPresale is Ownable, ReentrancyGuard {
    using SafeERC20 for ERC20;

    address public constant usdcAddress = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;

    uint256 public salePriceE35 = 0.04 * 1e35;

    uint256 public constant VE3DMaximumSupply = 50 * 1e3 * 1e9;

    // We use a counter to defend against people sending VE3D back
    uint256 public VE3DRemaining = VE3DMaximumSupply;

    uint256 oneHourETH = 269;
    uint256 oneDayETH = oneHourETH * 24;
    uint256 yearHalfDaysETH = oneDayETH * 549;

    uint256 public startBlock;
    uint256 public endBlock;

    mapping(address => uint256) public userVE3DTally;
    mapping(address => bool) public whitelist;

    uint256 public remainingBuyers = 0;

    bool public hasRetrievedUnsoldPresale = false;

    address public immutable VE3DAddress;

    address public immutable treasuryAddress;


    event VE3DPurchased(address sender, uint256 maticSpent, uint256 VE3DReceived);
    event StartBlockChanged(uint256 newStartBlock, uint256 newEndBlock);
    event SalePriceE35Changed(uint256 newSalePriceE5);
    event WhitelistEdit(address participant, bool included);
    event RetrieveUnclaimedTokens(uint256 VE3DAmount);

    constructor(uint256 _startBlock, address _treasuryAddress, address _VE3DAddress) {
        require(block.number < _startBlock, "cannot set start block in the past!");
        require(_treasuryAddress != _VE3DAddress, "_treasuryAddress cannot be equal to _VE3DAddress");
        require(_treasuryAddress != address(0), "_VE3DAddress cannot be the zero address");
        require(_VE3DAddress != address(0), "_VE3DAddress cannot be the zero address");
    
        startBlock = _startBlock;
        endBlock   = _startBlock + yearHalfDaysETH;

        VE3DAddress = _VE3DAddress;
        treasuryAddress = _treasuryAddress;
    }

    function buyVE3D(uint256 usdcToSpend) external nonReentrant {
        require(msg.sender != treasuryAddress, "treasury address cannot partake in presale");
        require(block.number >= startBlock, "presale hasn't started yet, good things come to those that wait");
        require(block.number < endBlock, "presale has ended, come back next time!");
        require(VE3DRemaining > 0, "No more VE3D remaining! Come back next time!");
        require(ERC20(VE3DAddress).balanceOf(address(this)) > 0, "No more VE3D left! Come back next time!");
        require(usdcToSpend > 0, "not enough usdc provided");
        require(whitelist[msg.sender], "presale participant not in the whitelist!");

        uint256 maxVE3DPurchase = VE3DRemaining / remainingBuyers;

        // maybe useful if we allow people to buy a second time
        //require(userVE3DTally[msg.sender] < maxVE3DPurchase, "user has already purchased too much VE3D");

        uint256 originalVE3DAmountUnscaled = (usdcToSpend * salePriceE35) / 1e35;

        uint256 usdcDecimals = ERC20(usdcAddress).decimals();
        uint256 VE3DDecimals = ERC20(VE3DAddress).decimals();

        uint256 originalVE3DAmount = usdcDecimals == VE3DDecimals ?
                                        originalVE3DAmountUnscaled :
                                            usdcDecimals > VE3DDecimals ?
                                                originalVE3DAmountUnscaled / (10 ** (usdcDecimals - VE3DDecimals)) :
                                                originalVE3DAmountUnscaled * (10 ** (VE3DDecimals - usdcDecimals));

        uint256 VE3DPurchaseAmount = originalVE3DAmount;

        if (VE3DPurchaseAmount > maxVE3DPurchase)
            VE3DPurchaseAmount = maxVE3DPurchase;

        // if we dont have enough left, give them the rest.
        if (VE3DRemaining < VE3DPurchaseAmount)
            VE3DPurchaseAmount = VE3DRemaining;

        require(VE3DPurchaseAmount > 0, "user cannot purchase 0 VE3D");

        // shouldn't be possible to fail these asserts.
        assert(VE3DPurchaseAmount <= VE3DRemaining);
        require(VE3DPurchaseAmount <= ERC20(VE3DAddress).balanceOf(address(this)), "not enough VE3D in contract");

        ERC20(VE3DAddress).safeTransfer(msg.sender, VE3DPurchaseAmount);

        VE3DRemaining = VE3DRemaining - VE3DPurchaseAmount;
        userVE3DTally[msg.sender] = userVE3DTally[msg.sender] + VE3DPurchaseAmount;

        uint256 usdcSpent = usdcToSpend;
        if (VE3DPurchaseAmount < originalVE3DAmount) {
            usdcSpent = (VE3DPurchaseAmount * usdcToSpend) / originalVE3DAmount;
        }

        if (usdcSpent > 0)
            ERC20(usdcAddress).safeTransferFrom(msg.sender, treasuryAddress, usdcSpent);

        whitelist[msg.sender] = false;
        if (remainingBuyers > 0)
            remainingBuyers--;

        emit VE3DPurchased(msg.sender, usdcSpent, VE3DPurchaseAmount);
    }

    function sendUnclaimedsToTreasuryAddress() external onlyOwner {
        require(block.number > endBlock, "presale hasn't ended yet!");
        require(!hasRetrievedUnsoldPresale, "can only recover unsold tokens once!");

        hasRetrievedUnsoldPresale = true;

        uint256 VE3DRemainingBalance = ERC20(VE3DAddress).balanceOf(address(this));

        require(VE3DRemainingBalance > 0, "no more VE3D remaining! you sold out!");

        ERC20(VE3DAddress).safeTransfer(treasuryAddress, VE3DRemainingBalance);

        emit RetrieveUnclaimedTokens(VE3DRemainingBalance);
    }


    function addToWhiteList(address participant, bool included) external onlyOwner {
        require(block.number < startBlock, "cannot change whitelist if sale has already commenced");

        if (whitelist[participant] && !included && remainingBuyers > 0)
            remainingBuyers--;
        else if (!whitelist[participant] && included)
            remainingBuyers++;

        whitelist[participant] = included;

        emit WhitelistEdit(participant, included);
    }

    function setStartBlock(uint256 _newStartBlock) external onlyOwner {
        require(block.number < startBlock, "cannot change start block if sale has already commenced");
        require(block.number < _newStartBlock, "cannot set start block in the past");
        startBlock = _newStartBlock;
        endBlock   = _newStartBlock + yearHalfDaysETH;

        emit StartBlockChanged(_newStartBlock, endBlock);
    }

    function setSalePriceE35(uint256 _newSalePriceE35) external onlyOwner {
        require(block.number < startBlock - (oneHourETH * 4), "cannot change price 4 hours before start block");
        require(_newSalePriceE35 >= 0.004 * 1e35, "new price can't be too low");
        require(_newSalePriceE35 <= 0.4 * 1e35, "new price can't be too high");
        salePriceE35 = _newSalePriceE35;

        emit SalePriceE35Changed(salePriceE35);
    }
}