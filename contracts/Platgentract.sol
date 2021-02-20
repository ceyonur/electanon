// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

contract Platgentract {
    event Proposed(
        uint256 indexed _id,
        address indexed _from,
        bytes32 _platformName
    );
    event StateChanged(States indexed _from, States indexed _to);

    enum States {Proposal, Voting, Completed}
    States state;

    //uint256 constant MAX_PROPOSAL_CAP = 40;
    uint256 proposalIdCt = 0;
    uint256 proposalDeadline;
    uint256 maxProposalCount;
    uint256 votingDeadline;
    uint256 votingLifetime;
    uint256 managerCount = 0;
    uint256 voterCount = 0;

    mapping(address => uint256) managers;
    mapping(uint256 => uint256) voteCounts;

    uint256[] ranks;

    modifier onlyManager {
        require(
            managers[msg.sender] > 0,
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
        require(managers[msg.sender] > 2, "You already proposed!");
        _;
    }

    modifier notAlreadyVoted {
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
        }
        if (state == States.Voting && block.timestamp >= votingDeadline) {
            toCompletedState();
        }
        // The other stages transition by transaction
        _;
    }

    constructor(
        address[] memory managerList,
        uint256 _maxProposalCount,
        uint256 proposalLifetime,
        uint256 _votingLifetime
    ) {
        // require(
        //     maxProposalCount < MAX_PROPOSAL_CAP,
        //     "maxProposalCount is too high!"
        // );
        _setupRole(msg.sender);
        uint256 temp = 0;
        for (uint256 i = 0; i < managerList.length; i++) {
            _setupRole(managerList[i]);
            temp++;
        }
        managerCount = temp;
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

    function propose(bytes32 _platformName)
        external
        onlyManager
        timedTransitions
        atState(States.Proposal)
        notAlreadyProposed
    {
        proposalIdCt++;
        managers[msg.sender]--;
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
        if (voteCounts[rank] == 0) {
            ranks.push(rank);
        }
        voteCounts[rank]++;
        managers[msg.sender]--;
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
        for (uint256 i = 0; i < proposalIdCt; i++) {
            bool source = true;
            uint256 a = i + 1;
            for (uint256 j = 0; j < proposalIdCt; j++) {
                uint256 b = j + 1;

                if (locked[b][a]) {
                    source = false;
                    break;
                }
            }
            if (source) {
                return a;
            }
        }
        return 0;
    }

    function isManager(address account) public view returns (bool) {
        return managers[account] > 0;
    }

    function currentState() external view returns (string memory) {
        if (state == States.Proposal) return "Proposal";
        if (state == States.Voting) return "Voting";
        if (isCompletedState()) return "Completed";
        return "";
    }

    /// PRIVATE CODE

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
        uint256 r = _mr_rank1(n, v, inv);
        return r;
    }

    //https://rosettacode.org/wiki/Permutations/Rank_of_a_permutation
    function _mr_unrank1(
        uint256 rank,
        uint256 n,
        uint256[] memory vec
    ) private pure {
        uint256 q = 0;
        uint256 r = 0;
        if (n < 1) {
            return;
        }

        q = rank / n;
        r = rank % n;
        uint256 tmp = vec[r];
        vec[r] = vec[n - 1];
        vec[n - 1] = tmp;
        _mr_unrank1(q, n - 1, vec);
    }

    function _mr_rank1(
        uint256 n,
        uint256[] memory vec,
        uint256[] memory inv
    ) private pure returns (uint256) {
        uint256 s = 0;
        if (n < 2) {
            return 0;
        }

        s = vec[n - 1] - 1;
        uint256 tmp = vec[n - 1];
        vec[n - 1] = vec[inv[n - 1] - 1];
        vec[inv[n - 1] - 1] = tmp;

        uint256 tmp2 = inv[s];
        inv[s] = inv[n - 1];
        inv[n - 1] = tmp2;
        return s + n * _mr_rank1(n - 1, vec, inv);
    }

    function get_permutation(uint256 rank, uint256 size)
        private
        pure
        returns (uint256[] memory)
    {
        uint256 i;
        uint256[] memory vec = new uint256[](size);
        for (i = 0; i < size; i++) {
            vec[i] = i + 1;
        }
        _mr_unrank1(rank, size, vec);

        return vec;
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
        uint256 prefLength = (proposalIdCt * (proposalIdCt - 1)) / 2;
        uint256[4][] memory prefs = new uint256[4][](prefLength);
        for (uint256 i = 0; i < proposalIdCt; i++) {
            for (uint256 k = i + 1; k < proposalIdCt; k++) {
                for (uint256 j = 0; j < ranks.length; j++) {
                    uint256 a = i + 1;
                    uint256 b = k + 1;
                    uint256[] memory v =
                        get_permutation(ranks[j], proposalIdCt);
                    uint256 votes = voteCounts[ranks[j]];
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

        uint256 pairLength = (proposalIdCt * (proposalIdCt - 1)) / 2;
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
            _countingSort(_getWinningPairs(), memberCount() + 1);
        bool[][] memory locked = initMultiArray(proposalIdCt + 1);
        for (uint256 i = 0; i < sortedPairs.length; i++) {
            if (
                !_checkCycle(
                    sortedPairs[i][1],
                    sortedPairs[i][0],
                    proposalIdCt,
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
        return managerCount;
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

    function _setupRole(address account) private {
        managers[account] = 3;
    }
}
