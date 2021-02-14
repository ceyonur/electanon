// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import "@openzeppelin/contracts/utils/EnumerableSet.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "hardhat/console.sol";

contract Platgentract is AccessControl {
    using EnumerableSet for EnumerableSet.UintSet;

    event Proposed(address indexed _from, uint256 indexed _id);
    event StateChanged(States indexed _from, States indexed _to);

    struct Proposal {
        string platform;
        address proposer;
    }
    enum States {Proposal, Voting, Completed}

    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    uint256 public constant MAX_PROPOSAL_CAP = 40;

    States state;
    uint256 proposalIdCt = 0;
    EnumerableSet.UintSet private proposalIds;
    uint256 public proposalDeadline;

    uint256 maxProposalCount;
    mapping(address => bool) proposerMap;
    mapping(bytes32 => bool) platformMap;

    mapping(uint256 => Proposal) proposals;

    uint256 public votingDeadline;
    uint256 public votingLifetime;

    mapping(address => bool) voters;
    uint256 voterCount = 0;
    mapping(bytes32 => uint256) rankVotes;
    mapping(bytes32 => uint256[]) voteDict;
    bytes32[] voteHashes;

    modifier onlyManager {
        require(
            hasRole(MANAGER_ROLE, msg.sender),
            "Only managers can call this function"
        );
        _;
    }

    modifier proposalDeadlineNotPassed {
        require(
            block.timestamp >= proposalDeadline,
            "Proposal deadline is passed!"
        );
        _;
    }

    modifier notAlreadyProposed {
        require(proposerMap[msg.sender] == false, "You already proposed!");
        _;
    }

    modifier notAlreadyVoted {
        require(voters[msg.sender] == false, "You already voted!");
        _;
    }

    modifier atState(States _state) {
        require(state == _state, "Function cannot be called at this time.");
        _;
    }

    modifier atCompletedState() {
        require(isCompletedState(), "Function cannot be called at this time.");
        _;
    }

    // Perform timed transitions. Be sure to mention
    // this modifier first, otherwise the guards
    // will not take the new stage into account.
    modifier timedTransitions() {
        if (state == States.Proposal && block.timestamp >= proposalDeadline) {
            toVotingState();
        }
        if (state == States.Voting && block.timestamp >= votingDeadline) {
            toCompletedState();
        }
        // The other stages transition by transaction
        _;
    }

    constructor(
        address[] memory managers,
        uint256 _maxProposalCount,
        uint256 proposalLifetime,
        uint256 _votingLifetime
    ) {
        require(
            maxProposalCount < MAX_PROPOSAL_CAP,
            "maxProposalCount is too high!"
        );
        _setupRole(MANAGER_ROLE, msg.sender);
        for (uint256 i = 0; i < managers.length; i++) {
            _setupRole(MANAGER_ROLE, managers[i]);
        }
        toState(States.Proposal);
        maxProposalCount = _maxProposalCount;
        proposalDeadline = block.timestamp + proposalLifetime;
        votingLifetime = _votingLifetime;
    }

    function toState(States _state) internal {
        state = _state;
    }

    //TODO: should not change if not enough proposals
    function toVotingState() internal {
        toState(States.Voting);
        votingDeadline = block.timestamp + votingLifetime;
        emit StateChanged(States.Proposal, States.Voting);
    }

    function toCompletedState() internal {
        toState(States.Completed);
        emit StateChanged(States.Voting, States.Completed);
    }

    function propose(string calldata _platform)
        external
        onlyManager
        timedTransitions
        atState(States.Proposal)
        notAlreadyProposed
    {
        require(
            platformMap[keccak256(abi.encode(_platform))] == false,
            "Platform is already proposed"
        );

        proposalIdCt++;
        uint256 newId = proposalIdCt;
        require(newId > 0);
        Proposal storage p = proposals[newId];
        p.proposer = msg.sender;
        p.platform = _platform;
        proposerMap[msg.sender] = true;
        platformMap[keccak256(abi.encode(_platform))] = true;
        proposalIds.add(newId);
        emit Proposed(msg.sender, newId);

        if (proposalIds.length() >= maxProposalCount) {
            toVotingState();
        }
    }

    function vote(uint256[] memory votedIds)
        external
        onlyManager
        timedTransitions
        atState(States.Voting)
        notAlreadyVoted
    {
        require(
            votedIds.length == proposalIds.length(),
            "You need to include every proposal id in your voting"
        );
        bool[] memory set = new bool[](proposalIdCt + 1);
        for (uint256 i = 0; i < votedIds.length; i++) {
            uint256 votedId = votedIds[i];
            require(
                set[votedId] == false,
                "You need to use proposalIds only once"
            );
            require(proposalIds.contains(votedId), "Proposal ID is not valid!");
            set[votedId] = true;
        }
        bytes32 key = keccak256(abi.encode(votedIds));
        rankVotes[key] += 1;
        if (voteDict[key].length == 0) {
            voteHashes.push(key);
        }
        voteDict[key] = votedIds;
        voters[msg.sender] = true;
        voterCount++;
        if (voterCount == memberCount()) {
            toCompletedState();
        }
    }

    /* solhint-disable */
    //https://math.libretexts.org/Bookshelves/Applied_Mathematics/Book%3A_College_Mathematics_for_Everyday_Life_(Inigo_et_al)
    //https://en.wikipedia.org/wiki/Ranked_pairs
    /* solhint-enable */
    function electionResult() external view returns (uint256) {
        bool[][] memory locked = _getLockedPairs();
        for (uint256 i = 0; i < proposalIds.length(); i++) {
            bool source = true;
            for (uint256 j = 0; j < proposalIds.length(); j++) {
                uint256 a = proposalIds.at(i);
                uint256 b = proposalIds.at(j);

                if (locked[b][a]) {
                    source = false;
                    break;
                }
            }
            if (source) {
                return proposalIds.at(i);
            }
        }
    }

    function isManager(address account) public view returns (bool) {
        return hasRole(MANAGER_ROLE, account);
    }

    function currentState() external view returns (string memory) {
        if (state == States.Proposal) return "Proposal";
        if (state == States.Voting) return "Voting";
        if (isCompletedState()) return "Completed";
    }

    function getIndex(uint256[] memory data, uint256 val)
        private
        pure
        returns (int256)
    {
        for (uint256 i = 0; i < data.length; i++) {
            if (data[i] == val) {
                return int256(i);
            }
        }
        return -1;
    }

    function currentProposals() public view returns (uint256[] memory) {
        uint256[] memory result = new uint256[](proposalIds.length());
        for (uint256 i = 0; i < proposalIds.length(); i++) {
            result[i] = proposalIds.at(i);
        }
        return result;
    }

    function getPlatform(uint256 proposalId)
        external
        view
        returns (string memory)
    {
        Proposal storage p = proposals[proposalId];
        return p.platform;
    }

    function getProposer(uint256 proposalId) external view returns (address) {
        Proposal storage p = proposals[proposalId];
        return p.proposer;
    }

    function _countingSort(uint256[3][] memory data, uint256 setSize)
        private
        pure
        returns (uint256[3][] memory)
    {
        uint256 length = data.length;
        uint256[] memory set = new uint256[](setSize);
        uint256[3][] memory result = new uint256[3][](length);
        for (uint256 i = 0; i < length; i++) {
            set[data[i][2]]++;
        }
        for (uint256 i = 1; i < set.length; i++) {
            set[i] += set[i - 1];
        }
        for (uint256 i = 0; i < data.length; i++) {
            uint256 reverse = data.length - i - 1;
            result[set[(data[reverse][2])] - 1] = data[reverse];
            set[data[reverse][2]]--;
        }
        return result;
    }

    function _checkCycle(
        uint256 from,
        uint256 to,
        uint256 count,
        bool[][] memory locked
    ) private pure returns (bool) {
        if (from == to) {
            return true; // path is present hence cycle is present
        }

        for (uint256 i = 0; i < count; i++) {
            if (
                locked[from][i]
            ) //checking for a path element by element (candidate by candidate)
            {
                return _checkCycle(i, to, count, locked);
            }
        }
        return false; // cycle is not present
    }

    function _getPrefPairs() private view returns (uint256[4][] memory) {
        uint256 counter = 0;
        uint256 prefLength =
            (proposalIds.length() * (proposalIds.length() - 1)) / 2;
        uint256[4][] memory prefs = new uint256[4][](prefLength);
        for (uint256 i = 0; i < proposalIds.length(); i++) {
            for (uint256 k = i + 1; k < proposalIds.length(); k++) {
                for (uint256 j = 0; j < voteHashes.length; j++) {
                    uint256 a = proposalIds.at(i);
                    uint256 b = proposalIds.at(k);
                    bytes32 voteHash = voteHashes[j];
                    uint256[] memory v = voteDict[voteHash];
                    uint256 votes = rankVotes[voteHash];
                    prefs[counter][0] = a;
                    prefs[counter][1] = b;
                    if (getIndex(v, a) < getIndex(v, b)) {
                        prefs[counter][2] += votes;
                    } else {
                        prefs[counter][3] += votes;
                    }
                }
                counter++;
            }
        }
        return prefs;
    }

    function _getWinningPairs() private view returns (uint256[3][] memory) {
        uint256[4][] memory prefs = _getPrefPairs();

        uint256 pairLength =
            (proposalIds.length() * (proposalIds.length() - 1)) / 2;
        uint256[3][] memory pairWinners = new uint256[3][](pairLength);
        for (uint256 i = 0; i < prefs.length; i++) {
            if (prefs[i][2] > prefs[i][3]) {
                // winner
                pairWinners[i][0] = prefs[i][0];
                // loser
                pairWinners[i][1] = prefs[i][1];
                pairWinners[i][2] = prefs[i][2];
            } else if (prefs[i][2] < prefs[i][3]) {
                pairWinners[i][0] = prefs[i][1];
                pairWinners[i][1] = prefs[i][0];
                pairWinners[i][2] = prefs[i][3];
            }
        }
        return pairWinners;
    }

    //https://github.com/Federico-abss/CS50-intro-course/blob/master/C/pset3/tideman/tideman.c
    function _getLockedPairs() private view returns (bool[][] memory) {
        uint256[3][] memory sortedPairs =
            _countingSort(
                _getWinningPairs(),
                getRoleMemberCount(MANAGER_ROLE) + 1
            );
        bool[][] memory locked = initMultiArray(proposalIdCt + 1);
        for (uint256 i = 0; i < sortedPairs.length; i++) {
            if (
                !_checkCycle(
                    sortedPairs[i][1],
                    sortedPairs[i][0],
                    proposalIds.length(),
                    locked
                )
            ) {
                locked[sortedPairs[i][0]][sortedPairs[i][1]] = true;
            }
        }
        return locked;
    }

    function isCompletedState() private view returns (bool) {
        return state == States.Completed || block.timestamp >= votingDeadline;
    }

    function memberCount() public view returns (uint256) {
        return getRoleMemberCount(MANAGER_ROLE);
    }

    function initMultiArray(uint256 size)
        private
        pure
        returns (bool[][] memory)
    {
        bool[][] memory result = new bool[][](size);
        for (uint256 i = 0; i < size; i++) {
            result[i] = new bool[](size);
        }
        return result;
    }
}
