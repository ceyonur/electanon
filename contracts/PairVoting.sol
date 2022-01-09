// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import {TidemanLib as TallyLib} from "./libs/tally/TidemanLib.sol";
import "./libs/Ownable.sol";
import {PermutationLib} from "./libs/PermutationLib.sol";

contract PairVoting is Ownable {
    event Proposed(
        uint256 indexed _id,
        address indexed _from,
        string _platformName
    );
    event StateChanged(States indexed _from, States indexed _to);

    enum States {
        Register,
        Proposal,
        Voting,
        Completed
    }
    States state;

    uint256 constant MAX_PROPOSAL_CAP = 30;
    uint256 proposalIdCt = 0;
    uint256 proposalLifetime;
    uint256 proposalDeadline;
    uint256 maxProposalCount;
    uint256 votingDeadline;
    uint256 votingLifetime;
    uint256 managerCount = 0;
    uint256 voterCount = 0;

    mapping(address => uint256) managers;
    mapping(uint256 => uint256) voteCounts;

    modifier onlyManager() {
        require(
            managers[msg.sender] > 0,
            "Only managers can call this function"
        );
        _;
    }

    modifier proposalDeadlineNotPassed() {
        require(
            block.timestamp >= proposalDeadline,
            "Proposal deadline is passed!"
        );
        _;
    }

    modifier notAlreadyProposed() {
        require(managers[msg.sender] > 2, "You already proposed!");
        _;
    }

    modifier notAlreadyVoted() {
        require(managers[msg.sender] > 1, "You already voted!");
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
        } else if (
            state == States.Voting && block.timestamp >= votingDeadline
        ) {
            toCompletedState();
        }
        // The other stages transition by transaction
        _;
    }

    constructor(
        uint256 _maxProposalCount,
        uint256 _proposalLifetime,
        uint256 _votingLifetime
    ) Ownable() {
        require(
            _maxProposalCount <= MAX_PROPOSAL_CAP,
            "maxProposalCount is too high!"
        );
        maxProposalCount = _maxProposalCount;
        votingLifetime = _votingLifetime;
        proposalLifetime = _proposalLifetime;
        toState(States.Register);
    }

    function toState(States _state) internal {
        state = _state;
    }

    function addManager(address manager)
        external
        onlyOwner
        atState(States.Register)
    {
        require(managers[manager] == 0, "You already registered this account");
        managers[manager] = 3;
        managerCount++;
    }

    function toProposalState() external onlyOwner {
        toState(States.Proposal);
        proposalDeadline = block.timestamp + proposalLifetime;
        emit StateChanged(States.Register, States.Proposal);
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

    function propose(string calldata _platformName)
        external
        onlyManager
        timedTransitions
        atState(States.Proposal)
        notAlreadyProposed
    {
        proposalIdCt++;
        managers[msg.sender] = 2;
        emit Proposed(proposalIdCt, msg.sender, _platformName);

        if (proposalIdCt >= maxProposalCount) {
            toVotingState();
        }
    }

    function vote(uint256 rank)
        external
        onlyManager
        notAlreadyVoted
        timedTransitions
        atState(States.Voting)
    {
        managers[msg.sender] = 1;
        voterCount++;
        TallyLib.tally(proposalIdCt, rank, voteCounts);
        if (voterCount == managerCount) {
            toCompletedState();
        }
    }

    /* solhint-disable */
    //https://math.libretexts.org/Bookshelves/Applied_Mathematics/Book%3A_College_Mathematics_for_Everyday_Life_(Inigo_et_al)
    //https://en.wikipedia.org/wiki/Ranked_pairs
    /* solhint-enable */
    function electionResult() external view atCompletedState returns (uint256) {
        uint256 matrixSize = proposalIdCt;
        return TallyLib.calculateResult(matrixSize, voteCounts);
    }

    function isManager(address account) public view returns (bool) {
        return managers[account] > 0;
    }

    function currentState() external view returns (string memory) {
        if (state == States.Register) return "Register";
        if (state == States.Proposal) return "Proposal";
        if (state == States.Voting) return "Voting";
        if (isCompletedState()) return "Completed";
        return "";
    }

    /// PRIVATE CODE

    function currentProposals() public view returns (uint256[] memory) {
        uint256[] memory result = new uint256[](proposalIdCt);
        for (uint256 i = 0; i < proposalIdCt; i++) {
            result[i] = i + 1;
        }
        return result;
    }

    function getRank(uint256[] memory vec) public pure returns (uint256) {
        uint256 n = vec.length;
        uint256[] memory v = new uint256[](n);
        uint256[] memory inv = new uint256[](n);

        for (uint256 i = 0; i < n; i++) {
            v[i] = vec[i];
            inv[vec[i] - 1] = i + 1;
        }
        uint256 r = PermutationLib.getRank(n, v, inv);
        return r;
    }

    function getVector(uint256 rank)
        external
        view
        returns (uint256[] memory vec)
    {
        uint256[] memory v = PermutationLib.getPermutation(rank, proposalIdCt);
        return v;
    }

    function isCompletedState() private view returns (bool) {
        return state == States.Completed || block.timestamp >= votingDeadline;
    }

    function _setupRole(address account) private {
        managers[account] = 3;
    }
}
