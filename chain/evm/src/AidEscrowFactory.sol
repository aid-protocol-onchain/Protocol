// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "./CampaignEscrow.sol";

/// @title AidEscrowFactory
/// @notice Owns the role keys and the token allowlist, and deploys one isolated
///         CampaignEscrow per campaign. Separation of duties: `authority` (a Safe
///         multisig) releases funds; `approver` (a separate Safe multisig) records
///         proof and approved amounts. Each escrow reads both roles and the
///         allowlist from this factory, so rotating a role applies everywhere.
///
///         Roles are distinct by construction (`approver != authority`, enforced
///         at deployment, on propose, and re-checked on accept). Role rotation is a
///         two-step propose/accept handshake (`Ownable2Step`-style): the current
///         authority proposes a `pendingAuthority` / `pendingApprover`, and the
///         incoming key must call `acceptAuthority` / `acceptApprover` to take
///         effect. A mistyped or non-controllable address can never take a role
///         because it can never submit the accept transaction, so a single bad
///         propose can never brick the protocol.
contract AidEscrowFactory {
    address public authority; // releases funds
    address public approver; // records proof / approves amounts
    address public pendingAuthority; // proposed next authority (two-step transfer)
    address public pendingApprover; // proposed next approver (two-step transfer)
    mapping(address => bool) public allowedToken;
    mapping(address => bool) public isStableToken;
    mapping(bytes32 => address) public campaignOf; // campaign id => escrow address
    address[] public campaigns;

    event CampaignCreated(bytes32 indexed id, address indexed escrow, address requester, uint8 tier);
    event TokenRegistered(address indexed token, bool stable);
    event TokenUnregistered(address indexed token);
    event AuthorityTransferStarted(address indexed previous, address indexed pending);
    event AuthorityChanged(address indexed previous, address indexed next);
    event ApproverTransferStarted(address indexed previous, address indexed pending);
    event ApproverChanged(address indexed previous, address indexed next);

    error NotAuthority();
    error NotPending();
    error ZeroAddress();
    error AlreadyExists();
    error RolesMustDiffer();

    /// @param _authority the Safe multisig that releases funds.
    /// @param _approver  a DISTINCT Safe multisig that records proofs / approves
    ///                    amounts. Must not equal `_authority` (AD-3 separation of
    ///                    duties); the constructor reverts otherwise.
    constructor(address _authority, address _approver) {
        if (_authority == address(0) || _approver == address(0)) revert ZeroAddress();
        if (_authority == _approver) revert RolesMustDiffer();
        authority = _authority;
        approver = _approver;
    }

    modifier onlyAuthority() {
        if (msg.sender != authority) revert NotAuthority();
        _;
    }

    // ---- two-step role transfer (Ownable2Step-style) ----

    /// @notice Propose a new authority. Does NOT change `authority`; the proposed
    ///         address must call `acceptAuthority` from its own key to take effect.
    function setAuthority(address newAuthority) external onlyAuthority {
        if (newAuthority == address(0)) revert ZeroAddress();
        pendingAuthority = newAuthority;
        emit AuthorityTransferStarted(authority, newAuthority);
    }

    /// @notice Accept a pending authority transfer. Callable only by the pending
    ///         authority. Re-checks separation of duties against the live approver.
    function acceptAuthority() external {
        if (msg.sender != pendingAuthority) revert NotPending();
        if (msg.sender == approver) revert RolesMustDiffer();
        emit AuthorityChanged(authority, msg.sender);
        authority = msg.sender;
        pendingAuthority = address(0);
    }

    /// @notice Propose a new approver. Does NOT change `approver`; the proposed
    ///         address must call `acceptApprover` from its own key to take effect.
    function setApprover(address newApprover) external onlyAuthority {
        if (newApprover == address(0)) revert ZeroAddress();
        pendingApprover = newApprover;
        emit ApproverTransferStarted(approver, newApprover);
    }

    /// @notice Accept a pending approver transfer. Callable only by the pending
    ///         approver. Re-checks separation of duties against the live authority.
    function acceptApprover() external {
        if (msg.sender != pendingApprover) revert NotPending();
        if (msg.sender == authority) revert RolesMustDiffer();
        emit ApproverChanged(approver, msg.sender);
        approver = msg.sender;
        pendingApprover = address(0);
    }

    // ---- token allowlist ----
    // The allowlist must admit only standard, non-fee-on-transfer ERC-20s (e.g.
    // USDC/USDT). CampaignEscrow.donateToken credits `raisedToken` from the call
    // argument, not a measured balance delta, so a fee-on-transfer or rebasing
    // token would desync the books from custody. Do not register such tokens.

    function registerToken(address token, bool stable) external onlyAuthority {
        if (token == address(0)) revert ZeroAddress();
        allowedToken[token] = true;
        isStableToken[token] = stable;
        emit TokenRegistered(token, stable);
    }

    function unregisterToken(address token) external onlyAuthority {
        if (token == address(0)) revert ZeroAddress();
        allowedToken[token] = false;
        isStableToken[token] = false;
        emit TokenUnregistered(token);
    }

    function isAllowed(address token) external view returns (bool) {
        return allowedToken[token];
    }

    function createCampaign(bytes32 id, address requester, uint8 tier)
        external
        onlyAuthority
        returns (address escrow)
    {
        if (campaignOf[id] != address(0)) revert AlreadyExists();
        escrow = address(new CampaignEscrow(requester, tier));
        campaignOf[id] = escrow;
        campaigns.push(escrow);
        emit CampaignCreated(id, escrow, requester, tier);
    }

    function campaignCount() external view returns (uint256) {
        return campaigns.length;
    }
}
