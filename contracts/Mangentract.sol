// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "./utils/Stoppable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

contract Mangentract is AccessControlEnumerable, Stoppable {
    using EnumerableSet for EnumerableSet.AddressSet;

    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    string public constant MAX_MEMBER_REASON = "MAX_MEMBER_SATISFIED";
    string public constant DEADLINE_REASON = "DEADLINE_FUNCTION_EXECUTED";

    event ManagerApprovalRequest(
        address indexed _from,
        address indexed _account
    );
    event ManagerApproved(address indexed _from, address indexed _account);
    event StopVoted(address indexed _from);
    event ContractStopped(string indexed reason);

    uint256 public requiredPercentage;
    uint256 public maxManagerCount;
    uint256 public deadline;

    mapping(address => EnumerableSet.AddressSet) managerApprovalQueue;

    mapping(address => bool) stopContractVoters;
    uint256 public stopVotes = 0;

    modifier onlyManager {
        require(
            hasRole(MANAGER_ROLE, msg.sender),
            "Only managers can call this function"
        );
        _;
    }

    modifier deadlinePassed {
        require(
            block.timestamp >= deadline,
            "Contract deadline is not passed!"
        );
        _;
    }

    constructor(
        address[] memory managers,
        uint256 _requiredPercentage,
        uint256 contractLifetime,
        uint256 _maxManagerCount
    ) {
        requiredPercentage = _requiredPercentage;
        deadline = block.timestamp + contractLifetime;
        maxManagerCount = _maxManagerCount;

        _setupRole(MANAGER_ROLE, msg.sender);
        for (uint256 i = 0; i < managers.length; i++) {
            _setupRole(MANAGER_ROLE, managers[i]);
        }
    }

    function isManager(address account) public view returns (bool) {
        return hasRole(MANAGER_ROLE, account);
    }

    function requestManagerApproval(address account)
        external
        whenNotStopped
        onlyManager
        returns (bool)
    {
        require(!hasRole(MANAGER_ROLE, account), "Account is a manager!");
        require(
            managerApprovalQueue[account].length() == 0,
            "Account is already in queue!"
        );
        if (managerApprovalQueue[account].add(msg.sender) == true) {
            emit ManagerApprovalRequest(msg.sender, account);
            return true;
        }
        return false;
    }

    function approveManager(address account)
        external
        whenNotStopped
        onlyManager
        returns (bool)
    {
        require(
            managerApprovalQueue[account].length() > 0,
            "Account is not in queue!"
        );
        require(
            !managerApprovalQueue[account].contains(msg.sender),
            "Sender already confirmed this account!"
        );
        if (managerApprovalQueue[account].add(msg.sender) == true) {
            emit ManagerApproved(msg.sender, account);
            if (
                managerApprovalQueue[account].length() >=
                (getManagerCount() * requiredPercentage) / 100
            ) {
                _grantInQueue(account);
            }
            return true;
        }
        return false;
    }

    function voteToStop() external deadlinePassed onlyManager whenNotStopped {
        require(
            stopContractVoters[msg.sender] == false,
            "Sender already voted to stop!"
        );
        stopContractVoters[msg.sender] = true;
        stopVotes++;
        emit StopVoted(msg.sender);
        if (stopVotes >= (getManagerCount() * requiredPercentage) / 100) {
            _stopContract(DEADLINE_REASON);
        }
    }

    function approvalStatus(address account)
        public
        view
        returns (address[] memory)
    {
        address[] memory addrs =
            new address[](managerApprovalQueue[account].length());

        for (uint256 i = 0; i < managerApprovalQueue[account].length(); i++) {
            address accountAddress = managerApprovalQueue[account].at(i);
            addrs[i] = accountAddress;
        }
        return addrs;
    }

    function stopStatusPercentage()
        public
        view
        deadlinePassed
        returns (uint256)
    {
        return (stopVotes * 100) / getManagerCount();
    }

    function getManagerCount() public view returns (uint256) {
        return getRoleMemberCount(MANAGER_ROLE);
    }

    function _grantInQueue(address account) private {
        _setupRole(MANAGER_ROLE, account);
        delete managerApprovalQueue[account];
        if (getManagerCount() >= maxManagerCount) {
            _stopContract(MAX_MEMBER_REASON);
        }
    }

    function _stopContract(string memory reason) private {
        _stop();
        emit ContractStopped(reason);
    }
}
