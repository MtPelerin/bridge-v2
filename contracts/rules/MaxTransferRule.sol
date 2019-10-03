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
import "./abstract/AbstractRule.sol";

/**
* @title MaxTransferRule
* @dev MaxTransferRule restricts the transfer if the amount of token is above a specific threshold
*
* Error messages
* RU02: Function cannot be called
*
* Errors:
* 1: amount is more than maxAmount
*/


contract MaxTransferRule is Initializable, AbstractRule {

  uint256 internal constant REASON_AMOUNT_EXCEEDS_MAX_AMOUNT = 1;

  /**
  * @dev Validates a transfer if the amount of token is below _maxAmount
  * @param _amount amount of tokens to transfer
  * @param _maxAmount Maximum amount of tokens allowed to transfer
  * @return transferStatus Invalid transfer when amount is above maximum amount, valid transfer without further action otherwise
  * @return statusCode The reason of the transfer rejection indicating that maximum amount is reached
  */
  function isTransferValid(
    address /* _token */,
    address /* _from */,
    address /*_to */,
    uint256 _amount,
    uint256 _maxAmount)
    public view returns (uint256, uint256)
  {
    if (_amount <= _maxAmount) {
      return (TRANSFER_VALID_WITH_NO_HOOK, REASON_OK);
    }
    return (TRANSFER_INVALID, REASON_AMOUNT_EXCEEDS_MAX_AMOUNT);
  }
}
