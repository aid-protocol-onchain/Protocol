// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "./CampaignEscrow.sol";

/// @title AidEscrowFactory
/// @notice Owns the role keys and the token allowlist, and deploys one isolated
///         CampaignEscrow per campaign. Separation of duties: `authority` (a Safe
///         multisig) releases funds; `approver` (a separate Safe multisig) records
///         proof and approved amounts. Each escrow reads both roles and the
///         allowlist from this factory, so rotating a role applies everywhere.
contract AidEscrowFactory {
    address public authority; // releases funds
    address public approver; // records proof / approves amounts
    mapping(address => bool) public allowedToken;
    mapping(address => bool) public isStableToken;
    mapping(bytes32 => address) public campaignOf; // campaign id => escrow address
    address[] public campaigns;

    event CampaignCreated(bytes32 indexed id, address indexed escrow, address requester, uint8 tier);
    event TokenRegistered(address indexed token, bool stable);
    event TokenUnregistered(address indexed token);
    event AuthorityChanged(address indexed previous, address indexed next);
    event ApproverChanged(address indexed previous, address indexed next);

    error NotAuthority();
    error ZeroAddress();
    error AlreadyExists();

    constructor(address _authority) {
        if (_authority == address(0)) revert ZeroAddress();
        authority = _authority;
        approver = _authority; // default; set a distinct approver for separation of duties
    }

    modifier onlyAuthority() {
        if (msg.sender != authority) revert NotAuthority();
        _;
    }

    function setAuthority(address newAuthority) external onlyAuthority {
        if (newAuthority == address(0)) revert ZeroAddress();
        emit AuthorityChanged(authority, newAuthority);
        authority = newAuthority;
    }

    function setApprover(address newApprover) external onlyAuthority {
        if (newApprover == address(0)) revert ZeroAddress();
        emit ApproverChanged(approver, newApprover);
        approver = newApprover;
    }

    function registerToken(address token, bool stable) external onlyAuthority {
        if (token == address(0)) revert ZeroAddress();
        allowedToken[token] = true;
        isStableToken[token] = stable;
        emit TokenRegistered(token, stable);
    }

    function unregisterToken(address token) external onlyAuthority {
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
