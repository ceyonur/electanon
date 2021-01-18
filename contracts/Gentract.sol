// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract Gentract is AccessControl {
    using EnumerableSet for EnumerableSet.AddressSet;

    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    uint256 public constant REQUIRED_PERCENTAGE = 75;

    event ManagerApprovalRequest(
        address indexed _from,
        address _account
    );
    event ManagerApproved(
        address indexed _from,
        address _account
    );

    mapping(address => EnumerableSet.AddressSet) managerApprovalQueue;

    modifier onlyManager {
        require(
            hasRole(MANAGER_ROLE, msg.sender),
            "Only managers can call this function"
        );
        _;
    }

    constructor(address[] memory managers) public {
        _setupRole(MANAGER_ROLE, msg.sender);
        for (uint256 i = 0; i < managers.length; i++) {
            _setupRole(MANAGER_ROLE, managers[i]);
        }

    }

    function isManager(address account) public view returns(bool){
        return hasRole(MANAGER_ROLE, account);
    }

    function requestManagerApproval(address account) public onlyManager returns(bool){
        require(!hasRole(MANAGER_ROLE, account), "Account is a manager!");
        require(managerApprovalQueue[account].length() == 0, "Account is already in queue!");
        if (managerApprovalQueue[account].add(msg.sender) == true) {
            emit ManagerApprovalRequest(msg.sender, account);
            return true;
        }
        return false;
    }

    function approveManager(address account) public onlyManager returns(bool) {
        require(managerApprovalQueue[account].length() > 0, "Account is not in queue!");
        require(!managerApprovalQueue[account].contains(msg.sender), "Sender already confirmed this account!");
        if (managerApprovalQueue[account].add(msg.sender) == true) {
            emit ManagerApproved(msg.sender, account);
            if(managerApprovalQueue[account].length() > getRoleMemberCount(MANAGER_ROLE) * REQUIRED_PERCENTAGE / 100){
                _setupRole(MANAGER_ROLE, account);
                delete managerApprovalQueue[account];
            }
            return true;
        }
        return false;
    }

    function approvalStatus(address account) public view returns(address[] memory){
        address[] memory addrs = new address[](managerApprovalQueue[account].length());

        for (uint i = 0; i < managerApprovalQueue[account].length(); i++) {
            address accountAddress = managerApprovalQueue[account].at(i);
            addrs[i] = accountAddress;
        }
        return addrs;
    }

}
