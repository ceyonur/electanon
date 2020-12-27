// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import "hardhat/console.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract Gentract is AccessControl, Pausable {
    string public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    event Suggestion(address indexed _from, string _value);

    struct GenesisProposal {
        string value; // short name (up to 32 bytes)
        uint256 voteCount; // number of accumulated votes
    }

    string public platform;
    Proposal public proposedGenesis;
    mapping(address => string) public platformAddresses;
    string public genesis;

    modifier onlyManager {
        require(
            hasRole(MANAGER_ROLE, msg.sender),
            "Only managers can call this function"
        );
        _;
    }

    constructor(address[] memory managers) public {
        for (uint256 i = 0; i < managers.length; i++) {
            _setupRole(MANAGER_ROLE, managers[i]);
        }
        _unpause();
    }

    function registerPlatformAddress(string memory platformAddress)
        public
        onlyManager
    {
        platformAddresses[msg.sender] = platformAddress;
    }

    function suggestGenesis(string memory proposal)
        public
        onlyManager
        whenNotPaused
    {
        _pause();
        proposedGenesis = proposal;
        emit Suggestion(msg.sender, proposedGenesis);
    }

    function vote(uint256 proposal) public onlyManager whenPaused {
        Voter storage sender = voters[msg.sender];
        require(sender.weight != 0, "Has no right to vote");
        require(!sender.voted, "Already voted.");
        sender.voted = true;
        sender.vote = proposal;

        // If `proposal` is out of the range of the array,
        // this will throw automatically and revert all
        // changes.
        proposals[proposal].voteCount += sender.weight;
    }
}
