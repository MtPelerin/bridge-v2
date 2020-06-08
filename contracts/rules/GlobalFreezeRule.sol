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

pragma solidity 0.6.2;

import "../access/Operator.sol";
import "./abstract/AbstractRule.sol";

/**
* @title GlobalFreezeRule
* @dev GlobalFreezeRule allows a legal authority to enforce a freeze of assets globally
*
* Error messages
* RU02: Function cannot be called
* GF01: end date of the freeze period cannot be in the past
*
* Errors
*
* 1: Transfers are frozen globally
*/


contract GlobalFreezeRule is Initializable, AbstractRule, Operator {

  uint256 public constant VERSION = 1;

  /**
  * @dev GlobalFreeze event is sent when freezeAll is called to notify contract freeze
  * @param until end date (UNIX timestamp) of the freeze period
  */
  event GlobalFreeze(uint256 until);

  /**
  * @dev GlobalUnfreeze event is sent when unfreezeAll is called to notify contract unfreeze
  */
  event GlobalUnfreeze();

  uint256 internal constant REASON_TRANSFERS_FROZEN_GLOBALLY = 1;

  uint256 public allFrozenUntil;

  /**
  * @dev Initializer (replaces constructor when contract is upgradable)
  * @param owner the final owner of the contract
  */
  function initialize(address owner) public override initializer {
    Operator.initialize(owner);
  }

  /**
  * @dev unfreeze all transfers
  * @dev Emits GlobalUnfreeze event
  */
  function unfreezeAll() public
    onlyOperator
  {
    allFrozenUntil = 0;
    emit GlobalUnfreeze();
  }

  /**
  * @dev freeze all transfers until a specific date
  * @dev Throws GF01 if end date is in the past
  * @dev Emits GlobalFreeze event
  * @param _until end date (UNIX timestamp) of the freeze period
  */
  function freezeAll(uint256 _until) public
    onlyOperator
  {
    // solium-disable-next-line security/no-block-members
    require(_until > now, "GF01");
    allFrozenUntil = _until;
    emit GlobalFreeze(_until);
  }

  /**
  * @dev Validates a transfer if transfers are not globally frozen
  * @return transferStatus Invalid transfer when frozen, valid transfer without further actions if not frozen
  * @return statusCode Code indicating that transfer is frozen when frozen, ok if not frozen
  */
  function isTransferValid(
    address /* _token */, address /* _from */, address /* _to */, uint256 /* _amount */, uint256 /*_param*/)
    public override view returns (uint256 transferStatus, uint256 statusCode)
  {
    if (_isFrozen()) {
      return (TRANSFER_INVALID, REASON_TRANSFERS_FROZEN_GLOBALLY);
    }
    return (TRANSFER_VALID_WITH_NO_HOOK, REASON_OK);
  }

  /**
  * @dev Checks if frozen until date is greater than current time
  * @return true if frozen until date is greater than current time, false otherwise
  */
  function _isFrozen() public view returns (bool) {
    // solium-disable-next-line security/no-block-members
    return allFrozenUntil > now ;
  }
}
