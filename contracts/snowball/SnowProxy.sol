// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface ISnowGauge {
    function deposit(uint256) external;

    function balanceOf(address) external view returns (uint256);

    function withdraw(uint256) external;

    function getReward() external;

    function vote(address[] calldata, uint256[] calldata) external;
}

interface ISnowVoteEscrow {
    function create_lock(uint256, uint256) external;

    function increase_amount(uint256) external;

    function increase_unlock_time(uint256) external;

    function withdraw() external;
}

interface IVoting {
    function vote(
        uint256,
        bool,
        bool
    ) external;
}

interface IFeeDistro {
    function claim() external;
}

interface IDeposit {
    function isShutdown() external view returns (bool);
}

contract SnowVoterProxy {
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    address public constant snop = address(0xC38f41A296A4493Ff429F1238e030924A1542e50);

    address public constant escrow = address(0x83952E7ab4aca74ca96217D6F8f7591BEaD6D64E);
    address public constant gaugeProxy = address(0x215D5eDEb6A6a3f84AE9d72962FEaCCdF815BF27);

    address public owner;
    address public operator;
    address public depositor;

    mapping(address => bool) private protectedTokens;

    constructor() {
        owner = msg.sender;
    }

    function getName() external pure returns (string memory) {
        return "SnowballVoterProxy";
    }

    function setOwner(address _owner) external {
        require(msg.sender == owner, "!auth");
        owner = _owner;
    }

    function setOperator(address _operator) external {
        require(msg.sender == owner, "!auth");
        require(
            operator == address(0) || IDeposit(operator).isShutdown() == true,
            "needs shutdown"
        );

        operator = _operator;
    }

    function setDepositor(address _depositor) external {
        require(msg.sender == owner, "!auth");

        depositor = _depositor;
    }

    function deposit(address _token, address _gauge) external returns (bool) {
        require(msg.sender == operator, "!auth");
        if (protectedTokens[_token] == false) {
            protectedTokens[_token] = true;
        }
        if (protectedTokens[_gauge] == false) {
            protectedTokens[_gauge] = true;
        }
        uint256 balance = IERC20(_token).balanceOf(address(this));
        if (balance > 0) {
            IERC20(_token).safeApprove(_gauge, 0);
            IERC20(_token).safeApprove(_gauge, balance);
            ISnowGauge(_gauge).deposit(balance);
        }
        return true;
    }

    // Withdraw partial funds
    function withdraw(
        address _token,
        address _gauge,
        uint256 _amount
    ) public returns (bool) {
        require(msg.sender == operator, "!auth");
        uint256 _balance = IERC20(_token).balanceOf(address(this));
        if (_balance < _amount) {
            _amount = _withdrawSome(_gauge, _amount.sub(_balance));
            _amount = _amount.add(_balance);
        }
        IERC20(_token).safeTransfer(msg.sender, _amount);
        return true;
    }

    function withdrawAll(address _token, address _gauge) external returns (bool) {
        require(msg.sender == operator, "!auth");
        uint256 amount = balanceOfPool(_gauge).add(IERC20(_token).balanceOf(address(this)));
        withdraw(_token, _gauge, amount);
        return true;
    }

    function _withdrawSome(address _gauge, uint256 _amount) internal returns (uint256) {
        ISnowGauge(_gauge).withdraw(_amount);
        return _amount;
    }

    function createLock(uint256 _value, uint256 _unlockTime) external returns (bool) {
        require(msg.sender == depositor, "!auth");
        IERC20(snop).safeApprove(escrow, 0);
        IERC20(snop).safeApprove(escrow, _value);
        ISnowVoteEscrow(escrow).create_lock(_value, _unlockTime);
        return true;
    }

    function increaseAmount(uint256 _value) external returns (bool) {
        require(msg.sender == depositor, "!auth");
        IERC20(snop).safeApprove(escrow, 0);
        IERC20(snop).safeApprove(escrow, _value);
        ISnowVoteEscrow(escrow).increase_amount(_value);
        return true;
    }

    function increaseTime(uint256 _value) external returns (bool) {
        require(msg.sender == depositor, "!auth");
        ISnowVoteEscrow(escrow).increase_unlock_time(_value);
        return true;
    }

    function release() external returns (bool) {
        require(msg.sender == depositor, "!auth");
        ISnowVoteEscrow(escrow).withdraw();
        return true;
    }

    function vote(
        uint256 _voteId,
        address _votingAddress,
        bool _support
    ) external returns (bool) {
        require(msg.sender == operator, "!auth");
        IVoting(_votingAddress).vote(_voteId, _support, false);
        return true;
    }

    function voteGaugeWeight(address[] calldata _tokenVote, uint256[] calldata _weight)
        external
        returns (bool)
    {
        require(msg.sender == operator, "!auth");

        //vote
        ISnowGauge(gaugeProxy).vote(_tokenVote, _weight);
        return true;
    }

    function claimSnow(address _gauge) external returns (uint256) {
        require(msg.sender == operator, "!auth");

        uint256 _balance = 0;
        try ISnowGauge(_gauge).getReward() {
            _balance = IERC20(snop).balanceOf(address(this));
            IERC20(snop).safeTransfer(operator, _balance);
        } catch {}

        return _balance;
    }

    function claimFees(address _distroContract, address _token) external returns (uint256) {
        require(msg.sender == operator, "!auth");
        IFeeDistro(_distroContract).claim();
        uint256 _balance = IERC20(_token).balanceOf(address(this));
        IERC20(_token).safeTransfer(operator, _balance);
        return _balance;
    }

    function balanceOfPool(address _gauge) public view returns (uint256) {
        return ISnowGauge(_gauge).balanceOf(address(this));
    }
}
