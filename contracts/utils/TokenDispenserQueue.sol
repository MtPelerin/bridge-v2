/*
    Copyright (c) 2019 Mt Pelerin Group Ltd

    This program is free software; you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License version 3
    as published by the Free Software Foundation with the addition of the
    following permission added to Section 15 as permitted in Section 7(a):
    FOR ANY PART OF THE COVERED WORK IN WHICH THE COPYRIGHT IS OWNED BY
    MT PELERIN GROUP LTD. MT PELERIN GROUP LTD DISCLAIMS THE WARRANTY OF NON INFRINGEMENT
    OF THIRD PARTY RIGHTS

    This program is distributed in the hope that it will be useful, but
    WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
    or FITNESS FOR A PARTICULAR PURPOSE.
    See the GNU Affero General Public License for more details.
    You should have received a copy of the GNU Affero General Public License
    along with this program; if not, see http://www.gnu.org/licenses or write to
    the Free Software Foundation, Inc., 51 Franklin Street, Fifth Floor,
    Boston, MA, 02110-1301 USA, or download the license from the following URL:
    https://www.gnu.org/licenses/agpl-3.0.fr.html

    The interactive user interfaces in modified source and object code versions
    of this program must display Appropriate Legal Notices, as required under
    Section 5 of the GNU Affero General Public License.

    You can be released from the requirements of the license by purchasing
    a commercial license. Buying such a license is mandatory as soon as you
    develop commercial activities involving Mt Pelerin Group Ltd software without
    disclosing the source code of your own applications.
    These activities include: offering paid services based/using this product to customers,
    using this product in any application, distributing this product with a closed
    source product.

    For more information, please contact Mt Pelerin Group Ltd at this
    address: hello@mtpelerin.com
*/

pragma solidity 0.5.2;

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "../interfaces/IERC20Detailed.sol";
import "../access/Operator.sol";

/**
 * @title TokenDispenserQueue
 * @dev The token dispenser queue allows a trusted operator to add pending token transfers that have to be validated by another signing address
 *
 * Error messages
 * DQ01: Caller must be validator
 * DQ02: Transfer and transfer decisions must have the same length
 * DQ03: Unsuccessful transfer
 * DQ04: to array and amount array must have the same length
*/
contract TokenDispenserQueue is Initializable, Operator {
  using SafeMath for uint256;
  using Roles for Roles.Role;

  /* Events */
  event ValidatorAdded(address indexed validator);
  event ValidatorRemoved(address indexed validator);
  event TransferPending(address to, uint256 amount);
  event TransferApproved(address indexed validator, address to, uint256 amount);
  event TransferRejected(address indexed validator, address to, uint256 amount);

  /* Constants */
  uint256 public constant VERSION = 1;
  uint8 constant internal TRANSFER_PENDING = 0;
  uint8 constant internal TRANSFER_APPROVE = 1;
  uint8 constant internal TRANSFER_REJECT = 2;

  /* Structures */
  struct PendingTransfer {
    uint8 decision;
    address to;
    uint256 amount;
  }

  /* Variables */
  Roles.Role internal _validators;
  address public token;
  mapping(uint256 => PendingTransfer) internal pendingTransfers;
  uint256 public pendingMinBoundary;
  uint256 public pendingMaxBoundary;

  /**
  * @dev Initializer (replaces constructor when contract is upgradable)
  * @param owner the final owner of the contract
  * @param _token the address of the token to dispense
  */
  function initialize(address owner, address _token) public initializer {
    Operator.initialize(owner);
    token = _token;
  }

  /* Validators related functions */
  modifier onlyValidator() {
    require(isValidator(msg.sender), "DQ01");
    _;
  }

  function isValidator(address _address) public view returns (bool) {
    return _validators.has(_address);
  }

  function addValidator(address _address) public onlyOwner {
    _validators.add(_address);
    emit ValidatorAdded(_address);
  }

  function removeValidator(address _address) public onlyOwner {
    _validators.remove(_address);
    emit ValidatorRemoved(_address);
  }

  /**
  * @dev Adds a transfer to the pending queue that will be validated one of the validators
  * @param to the array of receiver addresses of the token transfer
  * @param amount the array of amounts of tokens to transfer
  */
  function addPendingTransfers(
    address[] calldata to, 
    uint256[] calldata amount
  )
    external onlyOperator
  {
    require(to.length == amount.length, "DQ04");
    uint256 maxBoundary = pendingMaxBoundary;
    for (uint256 i = 0; i < to.length; i++) {
      pendingTransfers[maxBoundary++] = PendingTransfer(
        TRANSFER_PENDING, to[i], amount[i]
      );
      emit TransferPending(
        to[i], 
        amount[i]
      );
    }
    pendingMaxBoundary = maxBoundary;
  }

  /**
  * @dev Fetch pending transfers to be processed by validators
  * @return length the number of pending transfers
  * @return id the array of ids for pending transfers
  * @return to the array of receiver addresses for pending transfers
  * @return amount the array of amounts for pending transfers
  */
  function getPendingTransfers()
    public view returns (
      uint256 length,
      uint256[] memory id, 
      address[] memory to, 
      uint256[] memory amount
    ) 
  {
    uint256 initLength = pendingMaxBoundary - pendingMinBoundary;
    id = new uint256[](initLength);
    to = new address[](initLength);
    amount = new uint256[](initLength);
    for (uint256 i = pendingMinBoundary; i < pendingMaxBoundary; i++) {
      PendingTransfer memory transfer = pendingTransfers[i];
      if (transfer.decision == TRANSFER_PENDING) {
        /* because of local variable number limitation, length is used as an index */
        id[length] = i;
        to[length] = transfer.to;
        amount[length] = transfer.amount;
        length++;
      }
    }
    return (length, id, to, amount);
  }

  /**
  * @dev Processes pending transfers
  * @dev Transfer decision: 1 = Approve, 2 = Reject
  * @dev Emits either a TransferApproved or a TransferRejected event that can be listened by wallets for improved UX experience
  * @dev When transfer is approved, tokens are transfered to the receiver of the tokens
  * @dev When transfer is rejected, nothing is done
  * @dev If transfer is not pending, it will be ignored without notification
  * @param transfers array of transfer ids to process
  * @param transferDecisions array of transfer decisions applied to transfers
  * @param skipMinBoundaryUpdate whether to skip the minBoundary update or not. Updating minBoundary can result in out of gas exception.
  * Skipping the update will process the transfers and the user will be able to update minBoundary by calling the updatePendingMinBoundary multiple times
  */
  function processPendingTransfers(uint256[] calldata transfers, uint8[] calldata transferDecisions, bool skipMinBoundaryUpdate) external onlyValidator {
    require(transfers.length == transferDecisions.length, "DQ02");
    for (uint256 i = 0; i < transfers.length; i++) {
      /* Only process pending transfers, other statuses are ignored */
      if (pendingTransfers[transfers[i]].decision == TRANSFER_PENDING) {
        pendingTransfers[transfers[i]].decision = transferDecisions[i];
        if (transferDecisions[i] == TRANSFER_APPROVE) {
          _approvePendingTransfer(transfers[i]);
        } else {
          _rejectPendingTransfer(transfers[i]);
        }
      }
    }
    if (!skipMinBoundaryUpdate) {
      _updatePendingMinBoundary(pendingMinBoundary, pendingMaxBoundary);
    }
  }

  /**
  * @dev Updates the minBoundary index but limiting iterations to avoid out of gas exceptions
  * @param maxIterations number of iterations allowed for the loop
  */
  function updatePendingMinBoundary(uint256 maxIterations) public onlyValidator {
    uint256 minBoundary = pendingMinBoundary;
    uint256 maxBoundary = pendingMaxBoundary;
    if (minBoundary + maxIterations < maxBoundary) {
      maxBoundary = minBoundary + maxIterations;
    }
    _updatePendingMinBoundary(minBoundary, maxBoundary);
  }

  /**
  * @dev Approves pending transfer
  * @dev Throws DQ03 if token transfer is not successful
  * @param transferIndex the id of the transfer to approve
  */
  function _approvePendingTransfer(uint256 transferIndex) internal {
    /* Send the token to the transfer recipient */
    PendingTransfer memory transfer = pendingTransfers[transferIndex];
    require(IERC20Detailed(token).transfer(transfer.to, transfer.amount), "DQ03");
    emit TransferApproved(
      msg.sender, 
      transfer.to, 
      transfer.amount
    );
  }

  /**
  * @dev Rejects opending transfer
  * @param transferIndex the id of the transfer to reject
  */
  function _rejectPendingTransfer(uint256 transferIndex) internal {
    /* Send the tokens back to the transfer originator */
    PendingTransfer memory transfer = pendingTransfers[transferIndex];
    emit TransferRejected(
      msg.sender, 
      transfer.to, 
      transfer.amount
    );
  }

  /* 
  * @dev Updates the minBoundary index
  * @param trustedIntermediary the trusted intermediary
  * @param minBoundary the initial min boundary
  * @param maxBoundary the final max boundary
  */
  function _updatePendingMinBoundary(uint256 minBoundary, uint256 maxBoundary) internal {
    for (uint256 i = minBoundary; i < maxBoundary; i++) {
      if (pendingTransfers[i].decision != TRANSFER_PENDING) {
        minBoundary++;
      } else {
        break;
      }
    }
    pendingMinBoundary = minBoundary;
  }

}