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
 * @title FreezeRule
 * @dev FreezeRule allows trusted authorities to enforce a freeze of assets for specific addresses
 *
 * Error messages
 * RU02: Function cannot be called
 *
 * Errors
 * 2: from address is frozen for send operations
 * 3: to address is frozen for receive operations
 */


contract UserFreezeRule is Initializable, AbstractRule {

  uint256 constant internal USER_TRANSFER_FREEZE_DIRECTION_KEY = 120;
  uint256 constant internal USER_TRANSFER_FREEZE_START_KEY = 121;
  uint256 constant internal USER_TRANSFER_FREEZE_END_KEY = 122;
  uint256 constant internal USER_TRANSFER_FREEZE_INVERTED_KEY = 123;

  uint256 internal constant REASON_FROM_ADDRESS_FROZEN_FOR_SEND = 2;
  uint256 internal constant REASON_TO_ADDRESS_FROZEN_FOR_RECEIVE = 3;

  uint256 constant internal FREEZE_DIRECTION_NONE = 0;
  uint256 constant internal FREEZE_DIRECTION_RECEIVE = 1;
  uint256 constant internal FREEZE_DIRECTION_SEND = 2;
  uint256 constant internal FREEZE_DIRECTION_BOTH = 3;

  uint256 constant internal FREEZE_INVERTED_NO = 0;
  uint256 constant internal FREEZE_INVERTED_YES = 1;

  uint256 constant internal ALLOW_NOT_FOUND = 1;

  IComplianceRegistry public complianceRegistry;

  /**
  * @dev Initializer (replaces constructor when contract is upgradable)
  * @param _complianceRegistry The Compliance Registry address that will be used by this rule for compliance checks
  */
  function initialize(IComplianceRegistry _complianceRegistry) public initializer {
    complianceRegistry = _complianceRegistry;
  }

  /**
  * @dev Validates a transfer if the from address can send the tokens (not frozen for send) and the to address can receive it (not frozen for receive)
  * @param _token Address of the contract that represent the token to be transfered
  * @param _from Sender address
  * @param _to Receiver address
  * @param _allowNotFound whether the rule rejects the transfer if the sender or the receiver are not found in the user registry
  * @return transferStatus Invalid transfer if one of the address is frozen, valid transfer without further action otherwise
  * @return statusCode The reason of the transfer rejection indicating which address is frozen
  */
  function isTransferValid(
    address _token, address _from, address _to, uint256 /* _amount */, uint256 _allowNotFound)
    public view returns (uint256, uint256)
  {
    address[] memory trustedIntermediaries = IGovernable(_token).trustedIntermediaries();
    if (!_canSend(trustedIntermediaries, _from, _allowNotFound == ALLOW_NOT_FOUND)) {
      return (TRANSFER_INVALID, REASON_FROM_ADDRESS_FROZEN_FOR_SEND);
    }
    if (!_canReceive(trustedIntermediaries, _to, _allowNotFound == ALLOW_NOT_FOUND)) {
      return (TRANSFER_INVALID, REASON_TO_ADDRESS_FROZEN_FOR_RECEIVE);
    }
    return (TRANSFER_VALID_WITH_NO_HOOK, REASON_OK);
  }

  /**
  * @dev Checks if an address can send tokens
  * @param trustedIntermediaries array of trusted intermediaries defined at the token level
  * @param _from address to check
  * @return True if the address can send, false otherwise
  */
  function _canSend(address[] memory trustedIntermediaries, address _from, bool _allowNotFound) internal view returns (bool) {
    uint256 userId;
    address trustedIntermediary;
    (userId, trustedIntermediary) = complianceRegistry.userId(trustedIntermediaries, _from);
    if (userId == 0) {
      return _allowNotFound;
    }
    uint256[] memory attributeKeys = new uint256[](4);
    attributeKeys[0] = USER_TRANSFER_FREEZE_DIRECTION_KEY;
    attributeKeys[1] = USER_TRANSFER_FREEZE_START_KEY;
    attributeKeys[2] = USER_TRANSFER_FREEZE_END_KEY;
    attributeKeys[3] = USER_TRANSFER_FREEZE_INVERTED_KEY;
    uint256[] memory userAttributes = complianceRegistry.attributes(
      trustedIntermediary,
      userId,
      attributeKeys
    );
    return 
      !((userAttributes[0] == FREEZE_DIRECTION_SEND || userAttributes[0] == FREEZE_DIRECTION_BOTH) &&
      (userAttributes[1] <= now && userAttributes[2] > now ? // solium-disable-line security/no-block-members
        (userAttributes[3] == FREEZE_INVERTED_NO) 
        : 
        (userAttributes[3] == FREEZE_INVERTED_YES)
      )); 
  }

  /**
  * @dev Checks if an address can receive tokens
  * @param trustedIntermediaries array of trusted intermediaries defined at the token level
  * @param _to address to check
  * @return True if the address can receive, false otherwise
  */
  function _canReceive(address[] memory trustedIntermediaries, address _to, bool _allowNotFound) internal view returns (bool) {
    uint256 userId;
    address trustedIntermediary;
    (userId, trustedIntermediary) = complianceRegistry.userId(trustedIntermediaries, _to);
    if (userId == 0) {
      return _allowNotFound;
    }
    uint256[] memory attributeKeys = new uint256[](4);
    attributeKeys[0] = USER_TRANSFER_FREEZE_DIRECTION_KEY;
    attributeKeys[1] = USER_TRANSFER_FREEZE_START_KEY;
    attributeKeys[2] = USER_TRANSFER_FREEZE_END_KEY;
    attributeKeys[3] = USER_TRANSFER_FREEZE_INVERTED_KEY;
    uint256[] memory userAttributes = complianceRegistry.attributes(
      trustedIntermediary,
      userId,
      attributeKeys
    );
    return 
      !((userAttributes[0] == FREEZE_DIRECTION_RECEIVE || userAttributes[0] == FREEZE_DIRECTION_BOTH) &&
      (userAttributes[1] <= now && userAttributes[2] > now ? // solium-disable-line security/no-block-members
        (userAttributes[3] == FREEZE_INVERTED_NO) 
        : 
        (userAttributes[3] == FREEZE_INVERTED_YES)
      )); 
  }
}
