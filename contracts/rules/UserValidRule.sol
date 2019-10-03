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
import "../interfaces/IComplianceRegistry.sol";
import "../interfaces/IGovernable.sol";

/**
 * @title UserValidRule
 * @dev UserValidRule checks if sender/receiver addresses of a transfer
 * are known and valid in the compliance registry and rejects the transfer if not
 *
 * Error messages
 * RU02: Function cannot be called
 *
 * Errors:
 * 1: unsupported flag
 * 2: invalid from address
 * 3: invalid to address
 */


contract UserValidRule is Initializable, AbstractRule {

  IComplianceRegistry public complianceRegistry;
  uint256 public constant USER_VALID_FLAG_BOTH = 0;
  uint256 public constant USER_VALID_FLAG_FROM = 1;
  uint256 public constant USER_VALID_FLAG_TO = 2;

  uint256 internal constant REASON_UNSUPPORTED_FLAG = 1;
  uint256 internal constant REASON_INVALID_FROM_ADDRESS = 2;
  uint256 internal constant REASON_INVALID_TO_ADDRESS = 3;

  /**
  * @dev Initializer (replaces constructor when contract is upgradable)
  * @param _complianceRegistry The Compliance Registry address that will be used by this rule for compliance checks
  */
  function initialize(IComplianceRegistry _complianceRegistry) public initializer {
    complianceRegistry = _complianceRegistry;
  }

  /**
  * @dev Validates a transfer if from/to addresses are known and valid
  * @param _token Address of the contract that represent the token to be transfered
  * @param _from Sender address
  * @param _to Receiver address
  * @param _userValidFlag Flag indicating which address to check (0 = Both, 1 = From, 2 = To)
  * @return transferStatus Invalid transfer if one of the addresses is not known or not valid, valid transfer without further action otherwise
  * @return statusCode The reason of the transfer rejection
  */
  function isTransferValid(
    address _token, address _from, address _to, uint256 /* _amount */, uint256 _userValidFlag)
    public view returns (uint256, uint256)
  {
    address[] memory trustedIntermediaries = IGovernable(_token).trustedIntermediaries();
    if (_userValidFlag > USER_VALID_FLAG_TO) {
      return (TRANSFER_INVALID, REASON_UNSUPPORTED_FLAG);
    }
    if ((_userValidFlag == USER_VALID_FLAG_FROM || _userValidFlag == USER_VALID_FLAG_BOTH) && 
      !complianceRegistry.isAddressValid(trustedIntermediaries, _from)) {
      return (TRANSFER_INVALID, REASON_INVALID_FROM_ADDRESS);
    }
    if ((_userValidFlag == USER_VALID_FLAG_TO || _userValidFlag == USER_VALID_FLAG_BOTH) && 
      !complianceRegistry.isAddressValid(trustedIntermediaries, _to)) {
      return (TRANSFER_INVALID, REASON_INVALID_TO_ADDRESS);
    }
    return (TRANSFER_VALID_WITH_NO_HOOK, REASON_OK);
  }
}
