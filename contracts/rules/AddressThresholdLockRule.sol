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
import "@openzeppelin/contracts-ethereum-package/contracts/ownership/Ownable.sol";
import "./abstract/AbstractRule.sol";
import "../interfaces/IAdministrable.sol";
import "../interfaces/IERC20Detailed.sol";

/**
 * @title FreezeRule
 * @dev FreezeRule allows trusted authorities to enforce a freeze of assets for specific addresses
 *
 * Error messages
 * RU02: Function cannot be called
 * AD01: Caller is not token administrator
 *
 * Errors
 * 1: Locked threshold reached
 */


contract AddressThresholdLockRule is Initializable, AbstractRule {
  using SafeMath for uint256;
  
  uint256 public constant VERSION = 1;

  uint256 internal constant REASON_LOCKED_THRESHOLD_REACHED = 1;

  mapping(address => mapping(address => uint256)) internal addressThresholdLock;

  /**
  * @dev Validates a transfer if the balance of token on the from address after transfer is still higher or equal to the address lock threshold
  * @param _token Address of the contract that represent the token to be transfered
  * @param _from Sender address
  * @param _amount The amount of tokens to send
  * @return transferStatus Invalid transfer if the balance of token on the from address after transfer is lower than the address lock threshold, valid transfer without further action otherwise
  * @return statusCode The reason of the transfer rejection indicating than the lock threshold is reached
  */
  function isTransferValid(
    address _token, address _from, address /* _to */, uint256 _amount , uint256 /* */)
    public view returns (uint256, uint256)
  {
    uint256 balance = IERC20Detailed(_token).balanceOf(_from);
    if (balance > 0) {
      if (_amount <= balance && balance.sub(_amount) < addressThresholdLock[_token][_from]) {
        return (TRANSFER_INVALID, REASON_LOCKED_THRESHOLD_REACHED);
      }
    }
    return (TRANSFER_VALID_WITH_NO_HOOK, REASON_OK);
  }

  /**
  * @param _token Address of the contract that represent the token to be transfered
  * @param _address Address to be queried for lock threshold
  * @return threshold the amount of locked tokens
  */
  function addressLockThreshold(address _token, address _address) public view returns (uint256) {
    return addressThresholdLock[_token][_address];
  }

  /**
  * @param _token Address of the contract that represent the token to be transfered
  * @param _addressToLock Address to be queried for lock threshold
  * @param _lockThreshold the amount of locked tokens for _addressToLock
  */
  function setAddressLockThreshold(address _token, address _addressToLock, uint256 _lockThreshold) public 
  {
    require(IAdministrable(_token).isAdministrator(msg.sender), "AD01");
    addressThresholdLock[_token][_addressToLock] = _lockThreshold;
  }
  
}
