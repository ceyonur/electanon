// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "./SemaphoreOptMF.sol";
import {PairBaseLib} from "../libs/PairBaseLib.sol";

contract ZKPrivatePairVotingMF is SemaphoreOptMF {
    event Proposed(
        uint256 indexed _id,
        address indexed _from,
        string _proposal
    );
    event StateChanged(
        States indexed _from,
        States indexed _to,
        uint256 _stateDeadline
    );
    event ProposersAdded(address indexed _sender, address[] proposers);
    event VoterIdCommitsAdded(
        address indexed _sender,
        uint256[] voterCommits,
        uint256 indexed _root
    );

    event VoterTreeReplaced(
        address indexed _sender,
        uint256[] voterCommits,
        uint256 indexed _root
    );

    enum States {
        Register,
        Proposal,
        Commit,
        Reveal,
        Completed
    }
    States public state;

    uint256 private constant MAX_PROPOSAL_CAP = 30;
    uint256 private proposalIdCt;
    uint256 private deadline;
    uint256 public maxProposalCount;
    uint256 public proposalLifetime;
    uint256 public commitLifetime;
    uint256 public revealLifetime;

    string public question;
    string public voterZKURL;

    mapping(address => bool) private proposers;
    uint256 public proposerCount;
    mapping(uint256 => uint256) private voteCounts;
    uint256 public committedCount;
    uint256 public votedCount;
    mapping(address => bytes32) private secrets;
    uint256[] private ranks;

    modifier deadlineNotPassed() {
        require(block.number >= deadline, "State deadline is passed!");
        _;
    }

    modifier eligibleProposer() {
        require(proposers[msg.sender], "You're not eligible to propose!");
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
        timedTransitionsHelper();
        // The other stages transition by transaction
        _;
    }

    constructor(
        uint256 _maxProposalCount,
        uint256 _proposalLifetime,
        uint256 _commitLifetime,
        uint256 _revealLifetime,
        string memory _question,
        string memory _voterZKURL
    ) SemaphoreOptMF() {
        require(
            maxProposalCount <= MAX_PROPOSAL_CAP,
            "maxProposalCount is too high!"
        );
        maxProposalCount = _maxProposalCount;
        proposalLifetime = _proposalLifetime;
        commitLifetime = _commitLifetime;
        revealLifetime = _revealLifetime;
        question = _question;
        voterZKURL = _voterZKURL;
        toState(States.Register);
    }

    function toState(States _state) internal {
        state = _state;
    }

    function toNextState() external {
        require(timedTransitionsHelper(), "Cannot change to next state!");
    }

    function toProposalState() external onlyOwner {
        require(state == States.Register, "Cannot change state to Proposal!");
        toState(States.Proposal);
        uint256 result = block.number + proposalLifetime;
        deadline = result;
        emit StateChanged(States.Register, States.Proposal, result);
    }

    function toCommitState() internal {
        toState(States.Commit);
        uint256 result = block.number + commitLifetime;
        deadline = result;
        emit StateChanged(States.Proposal, States.Commit, result);
    }

    function toRevealState() internal {
        toState(States.Reveal);
        uint256 result = block.number + revealLifetime;
        deadline = result;
        emit StateChanged(States.Commit, States.Reveal, result);
    }

    function toCompletedState() internal {
        toState(States.Completed);
        emit StateChanged(States.Reveal, States.Completed, block.number);
    }

    function addProposers(address[] calldata proposerList)
        external
        atState(States.Register)
        onlyOwner
    {
        for (uint256 i = 0; i < proposerList.length; i++) {
            _setupProposer(proposerList[i]);
        }
        proposerCount += proposerList.length;
        emit ProposersAdded(msg.sender, proposerList);
    }

    function addIdCommitments(
        uint256[TREE_SIZES] calldata _leaves,
        uint256 _root,
        uint256[2] calldata proofA,
        uint256[2][2] calldata proofB,
        uint256[2] calldata proofC
    ) external atState(States.Register) onlyOwner {
        insertTree(_leaves, _root, proofA, proofB, proofC);
    }

    function replaceIdCommitments(
        uint256 _index,
        uint256[TREE_SIZES] calldata _leaves,
        uint256 _root,
        uint256[2] calldata proofA,
        uint256[2][2] calldata proofB,
        uint256[2] calldata proofC
    ) external atState(States.Register) onlyOwner {
        replaceTree(_index, _leaves, _root, proofA, proofB, proofC);
    }

    function propose(string calldata _proposal)
        external
        timedTransitions
        atState(States.Proposal)
        eligibleProposer
    {
        uint256 ptrProposalIdCt = proposalIdCt++ + 1;
        proposers[msg.sender] = false;
        emit Proposed(proposalIdCt, msg.sender, _proposal);
        if (
            ptrProposalIdCt == maxProposalCount ||
            ptrProposalIdCt == proposerCount
        ) {
            toCommitState();
        }
    }

    function commitVote(
        bytes32 _secretHash,
        uint256 _treeIndex,
        uint256[8] calldata _proof,
        uint256 _nullifiersHash
    ) external timedTransitions atState(States.Commit) {
        require(_secretHash != 0, "secretHash cannot be 0");
        broadcastSignal(_secretHash, _proof, _nullifiersHash, _treeIndex);
        secrets[msg.sender] = _secretHash;
        committedCount++;
        if (committedCount == getForestSize()) {
            toRevealState();
        }
    }

    function revealVote(uint256 _voteRank, bytes32 _salt)
        external
        timedTransitions
        atState(States.Reveal)
    {
        require(secrets[msg.sender] != 0, "You have no pending vote commit!");
        require(
            keccak256(abi.encodePacked(_voteRank, _salt)) ==
                secrets[msg.sender],
            "Wrong credentials"
        );
        if (voteCounts[_voteRank] == 0) {
            // might not be needed (instead use perm ids)
            ranks.push(_voteRank);
        }
        voteCounts[_voteRank]++;
        votedCount++;
        delete secrets[msg.sender];
        if (votedCount == committedCount) {
            toCompletedState();
        }
    }

    function checkVote(uint256 _voteRank, uint256 _salt)
        external
        view
        returns (bool)
    {
        return
            keccak256(abi.encodePacked(_voteRank, _salt)) ==
            secrets[msg.sender];
    }

    /* solhint-disable */
    //https://math.libretexts.org/Bookshelves/Applied_Mathematics/Book%3A_College_Mathematics_for_Everyday_Life_(Inigo_et_al)
    //https://en.wikipedia.org/wiki/Ranked_pairs
    /* solhint-enable */
    function electionResult() external view atCompletedState returns (uint256) {
        uint256 matrixSize = proposalIdCt;
        uint256[] memory rankIds = ranks;
        return PairBaseLib.calculateResult(matrixSize, rankIds, voteCounts);
    }

    function isEligibleProposer(address account) external view returns (bool) {
        return proposers[account];
    }

    function currentState() external view returns (string memory) {
        if (state == States.Register) return "Register";
        if (state == States.Proposal) return "Proposal";
        if (state == States.Commit) return "Commit";
        if (state == States.Reveal) return "Reveal";
        if (isCompletedState()) return "Completed";
        return "";
    }

    function currentRealState() external view returns (string memory) {
        if (isCompletedState()) return "Completed";
        if (isRevealState()) return "Reveal";
        if (isCommitState()) return "Commit";
        if (state == States.Proposal) return "Proposal";
        if (state == States.Register) return "Register";
        return "";
    }

    function getRank(uint256[] calldata vec) external pure returns (uint256) {
        uint256 n = vec.length;
        uint256[] memory v = new uint256[](n);
        uint256[] memory inv = new uint256[](n);

        for (uint256 i = 0; i < n; i++) {
            v[i] = vec[i];
            inv[vec[i] - 1] = i + 1;
        }
        uint256 r = PairBaseLib._mr_rank1(n, v, inv);
        return r;
    }

    function getVoterZKURL() external view returns (string memory) {
        return voterZKURL;
    }

    /// PRIVATE CODE

    // Perform timed transitions. Be sure to mention
    // this modifier first, otherwise the guards
    // will not take the new stage into account.
    function timedTransitionsHelper() private returns (bool) {
        if (changableToCommit()) {
            toCommitState();
            return true;
        } else if (changableToReveal()) {
            toRevealState();
            return true;
        } else if (changableToCompleted()) {
            toCompletedState();
            return true;
        } else {
            return false;
        }
    }

    function isCompletedState() private view returns (bool) {
        return state == States.Completed || changableToCompleted();
    }

    function isCommitState() private view returns (bool) {
        return state == States.Commit || changableToCommit();
    }

    function isRevealState() private view returns (bool) {
        return state == States.Reveal || changableToReveal();
    }

    function changableToCommit() private view returns (bool) {
        return state == States.Proposal && block.number >= deadline;
    }

    function changableToReveal() private view returns (bool) {
        return state == States.Commit && block.number >= deadline;
    }

    function changableToCompleted() private view returns (bool) {
        return state == States.Reveal && block.number >= deadline;
    }

    function currentProposals() public view returns (uint256[] memory) {
        uint256[] memory result = new uint256[](proposalIdCt);
        for (uint256 i = 0; i < proposalIdCt; i++) {
            result[i] = i + 1;
        }
        return result;
    }

    function _setupProposer(address account) private {
        bool proposerAdded = proposers[account];
        require(proposerAdded == false, "Proposer is added already.");
        proposers[account] = true;
    }
}
