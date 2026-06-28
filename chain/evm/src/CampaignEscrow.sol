// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

interface IAidFactory {
    function authority() external view returns (address);
    function approver() external view returns (address);
    function isAllowed(address token) external view returns (bool);
}

/// @title CampaignEscrow
/// @notice One isolated escrow per campaign (deployed by AidEscrowFactory). Holds
///         native ETH plus whitelisted ERC-20s for a single campaign. Release is
///         bound by proof: the approver commits a content hash and an approved
///         amount per tranche per asset, and the authority can release only up to
///         that approved amount (separation of duties; no live-percentage cap, so
///         later donations cannot enlarge an unproven release). When fraud is
///         found, donors claim pro-rata refunds of the undisbursed balance.
contract CampaignEscrow {
    address public immutable factory;
    address public immutable requester;
    uint8 public immutable tier;

    bool public frozen;
    bool public refunding;

    uint256 public raisedNative;
    uint256 public releasedNative;
    mapping(address => uint256) public raisedToken;
    mapping(address => uint256) public releasedToken;

    mapping(address => uint256) public donorNative;
    mapping(address => mapping(address => uint256)) public donorToken;
    mapping(address => uint256) public refundedNative;
    mapping(address => mapping(address => uint256)) public refundedToken;

    // Proof and approved amounts. asset == address(0) means native ETH.
    mapping(uint256 => bytes32) public proofHash; // tranche => committed content hash
    mapping(uint256 => mapping(address => uint256)) public approved; // tranche => asset => approved amount
    mapping(uint256 => mapping(address => uint256)) public releasedForTranche; // tranche => asset => released

    address internal constant NATIVE = address(0);

    event DonationNative(address indexed donor, uint256 amount, bool isAnonymous);
    event DonationToken(address indexed donor, address indexed token, uint256 amount, bool isAnonymous);
    event ProofRecorded(uint256 indexed tranche, bytes32 hash, address indexed asset, uint256 amount);
    event ReleasedNative(uint256 indexed tranche, address to, uint256 amount);
    event ReleasedToken(address indexed token, uint256 indexed tranche, address to, uint256 amount);
    event Frozen();
    event RefundsEnabled();
    event RefundNative(address indexed donor, uint256 amount);
    event RefundToken(address indexed donor, address indexed token, uint256 amount);

    error NotAuthority();
    error NotApprover();
    error FrozenCampaign();
    error NotRefunding();
    error NothingToRefund();
    error NotApproved();
    error ExceedsApproved();
    error TransferFailed();
    error ZeroAddress();
    error TokenNotAllowed();

    constructor(address _requester, uint8 _tier) {
        if (_requester == address(0)) revert ZeroAddress();
        factory = msg.sender;
        requester = _requester;
        tier = _tier;
    }

    modifier onlyAuthority() {
        if (msg.sender != IAidFactory(factory).authority()) revert NotAuthority();
        _;
    }

    modifier onlyApprover() {
        if (msg.sender != IAidFactory(factory).approver()) revert NotApprover();
        _;
    }

    // ---- donations ----

    function donateNative(bool isAnonymous) external payable {
        if (frozen) revert FrozenCampaign(); // refund mode also sets frozen
        raisedNative += msg.value;
        donorNative[msg.sender] += msg.value;
        emit DonationNative(msg.sender, msg.value, isAnonymous);
    }

    function donateToken(address token, uint256 amount, bool isAnonymous) external {
        if (frozen) revert FrozenCampaign();
        if (!IAidFactory(factory).isAllowed(token)) revert TokenNotAllowed();
        raisedToken[token] += amount;
        donorToken[msg.sender][token] += amount;
        emit DonationToken(msg.sender, token, amount, isAnonymous);
        _safeTransferFrom(token, msg.sender, address(this), amount);
    }

    // ---- proof (approver) ----

    /// @notice Approver commits a proof hash and the amount approved for a tranche+asset.
    ///         Approved amounts are fixed here and never scale with later donations.
    function recordProof(uint256 tranche, bytes32 hash, address asset, uint256 amount) external onlyApprover {
        if (hash == bytes32(0)) revert NotApproved();
        proofHash[tranche] = hash;
        approved[tranche][asset] += amount;
        emit ProofRecorded(tranche, hash, asset, amount);
    }

    // ---- release (authority) ----

    function releaseNative(uint256 tranche, uint256 amount, address payable to) external onlyAuthority {
        if (to == address(0)) revert ZeroAddress();
        if (frozen) revert FrozenCampaign();
        _checkRelease(tranche, NATIVE, amount);
        releasedForTranche[tranche][NATIVE] += amount;
        releasedNative += amount;
        emit ReleasedNative(tranche, to, amount);
        (bool sent,) = to.call{value: amount}("");
        if (!sent) revert TransferFailed();
    }

    function releaseToken(address token, uint256 tranche, uint256 amount, address to) external onlyAuthority {
        if (to == address(0)) revert ZeroAddress();
        if (frozen) revert FrozenCampaign();
        _checkRelease(tranche, token, amount);
        releasedForTranche[tranche][token] += amount;
        releasedToken[token] += amount;
        emit ReleasedToken(token, tranche, to, amount);
        _safeTransfer(token, to, amount);
    }

    // ---- authority controls ----

    function freeze() external onlyAuthority {
        frozen = true;
        emit Frozen();
    }

    function enableRefunds() external onlyAuthority {
        frozen = true;
        refunding = true;
        emit RefundsEnabled();
    }

    // ---- refunds (donor-callable once refunding) ----

    function refundNative() external {
        if (!refunding) revert NotRefunding();
        uint256 owed = _refundable(donorNative[msg.sender], raisedNative, releasedNative) - refundedNative[msg.sender];
        if (owed == 0) revert NothingToRefund();
        refundedNative[msg.sender] += owed;
        emit RefundNative(msg.sender, owed);
        (bool sent,) = payable(msg.sender).call{value: owed}("");
        if (!sent) revert TransferFailed();
    }

    function refundToken(address token) external {
        if (!refunding) revert NotRefunding();
        uint256 owed =
            _refundable(donorToken[msg.sender][token], raisedToken[token], releasedToken[token])
            - refundedToken[msg.sender][token];
        if (owed == 0) revert NothingToRefund();
        refundedToken[msg.sender][token] += owed;
        emit RefundToken(msg.sender, token, owed);
        _safeTransfer(token, msg.sender, owed);
    }

    // ---- internals ----

    function _checkRelease(uint256 tranche, address asset, uint256 amount) internal view {
        if (proofHash[tranche] == bytes32(0)) revert NotApproved();
        if (releasedForTranche[tranche][asset] + amount > approved[tranche][asset]) revert ExceedsApproved();
    }

    function _refundable(uint256 contributed, uint256 raised, uint256 released) internal pure returns (uint256) {
        if (raised == 0) return 0;
        uint256 remaining = raised - released;
        return (contributed * remaining) / raised;
    }

    function _safeTransfer(address token, address to, uint256 amount) internal {
        (bool ok, bytes memory data) = token.call(abi.encodeWithSelector(IERC20.transfer.selector, to, amount));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }

    function _safeTransferFrom(address token, address from, address to, uint256 amount) internal {
        (bool ok, bytes memory data) =
            token.call(abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, amount));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }
}
