/*
    Copyright (c) 2022 Realt LLC.
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

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "../interfaces/IComplianceRegistry.sol";
import "../interfaces/IGovernable.sol";
import "../interfaces/IOwnable.sol";
import "./abstract/AbstractRule.sol";

/**
 * @title VestingRule
 * @dev Vesting Rule allows a legal authority to enforce an asset freeze, with some exceptions
 *
 * Error messages
 * RU02: Function cannot be called
 *
 * Errors
 * 1: address not found in User Registry
 * 2: address does not have a bypass key
 */

contract VestingRule is Initializable, AbstractRule {
    uint256 public constant VERSION = 1;

    uint256 internal constant BYPASS_KEY = 140;
    uint256 internal constant BYPASS_DIRECTION_NONE = 0;
    uint256 internal constant BYPASS_DIRECTION_RECEIVE = 1;
    uint256 internal constant BYPASS_DIRECTION_SEND = 2;
    uint256 internal constant BYPASS_DIRECTION_BOTH = 3;

    uint256 internal constant REASON_USER_NOT_FOUND = 2;
    uint256 internal constant REASON_TRANSFERS_FROZEN_VESTING = 3;

    IComplianceRegistry private _complianceRegistry;

    /**
     * @dev Initializer (replaces constructor when contract is upgradable)
     * @param complianceRegistry_ The Compliance Registry address that will be used by this rule for compliance checks
     */
    function initialize(IComplianceRegistry complianceRegistry_)
        public
        initializer
    {
        _complianceRegistry = complianceRegistry_;
    }

    /**
     * @dev Validates a transfer if transfers are not frozen or sent by owner or using a bypass key
     * @return transferStatus Valid (1) or invalid transfer (0)
     * @return statusCode details about the transfer status
     */
    function isTransferValid(
        address _token,
        address _from,
        address _to,
        uint256, /* _amount */
        uint256 timestamp
    ) public view override returns (uint256, uint256) {
        if (timestamp > block.timestamp) {
            if (_from == IOwnable(_token).owner())
                return (TRANSFER_VALID_WITH_NO_HOOK, REASON_OK);

            address[] memory trustedIntermediaries = IGovernable(_token)
                .trustedIntermediaries();

            uint256 fromKey = _getBypassKeyValue(trustedIntermediaries, _from);
            if (fromKey == 0) return (TRANSFER_INVALID, REASON_USER_NOT_FOUND);
            uint256 toKey = _getBypassKeyValue(trustedIntermediaries, _to);
            if (toKey == 0) return (TRANSFER_INVALID, REASON_USER_NOT_FOUND);
            if (fromKey < 2 || toKey % 2 == 0)
                return (TRANSFER_INVALID, REASON_TRANSFERS_FROZEN_VESTING);
        }
        return (TRANSFER_VALID_WITH_NO_HOOK, REASON_OK);
    }

    /**
     * @dev Get address bypass keyvalue or 0 if user not found
     * @param trustedIntermediaries array of trusted intermediaries defined at the token level
     * @param userAddress address to check
     * @return Bypass key value + 1 and 0 if user not found
     */
    function _getBypassKeyValue(
        address[] memory trustedIntermediaries,
        address userAddress
    ) private returns (uint256) {
        (uint256 userId, address trustedIntermediary) = complianceRegistry
            .userId(trustedIntermediaries, userAddress);
        if (userId == 0) {
            return TRANSFER_INVALID;
        }
        return
            complianceRegistry.attribute(
                trustedIntermediary,
                userId,
                BYPASS_KEY
            );
    }
}
