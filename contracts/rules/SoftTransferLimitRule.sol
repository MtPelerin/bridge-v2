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
import "./abstract/AbstractRule.sol";
import "../interfaces/IComplianceRegistry.sol";
import "../interfaces/IPriceOracle.sol";
import "../interfaces/IGovernable.sol";
import "../interfaces/IPriceable.sol";
import "../access/Operator.sol";

 /**
 * @title SoftTransferLimitRule
 * @dev SoftTransferLimitRule checks the different transfer thresholds of the
 * attached compliance registry for the from and to addresses and reroute the
 * transfer to the Compliance Registry where the transfer will be on-hold for
 * for processing by one of the trusted authorities
 *
 * Thresholds:
 * - Transfer threshold
 * - Monthly transfer threshold (30 days moving period)
 * - Yearly transfer threshold (12 * 30 days moving period)
 *
 * Error messages
 * RU02: Function cannot be called
 * SR01: from address not found in User Registry
 *
 * Errors
 * 1: from address not found in User Registry
 * 2: from user single transfer limit exceeded
 * 3: from user monthly transfer limit exceeded
 * 4: from user yearly transfer limit exceeded
 * 5: to address not found in User Registry
 * 6: to user single transfer limit exceeded
 * 7: to user monthly transfer limit exceeded
 * 8: to user yearly transfer limit exceeded
 */

 
contract SoftTransferLimitRule is Initializable, AbstractRule, Operator {
  using SafeMath for uint256;

  IComplianceRegistry public complianceRegistry;

  uint8 constant internal MAX_DECIMALS = 20;

  uint256 constant internal USER_AML_TRANSFER_THRESHOLD_KEY = 110;
  uint256 constant internal USER_AML_MONTHLY_THRESHOLD_KEY = 111;
  uint256 constant internal USER_AML_YEARLY_THRESHOLD_KEY = 112;

  uint256 internal constant REASON_FROM_ADDRESS_NOT_KNOWN = 1;
  uint256 internal constant REASON_FROM_SINGLE_TRANSFER_LIMIT_EXCEEDED = 2;
  uint256 internal constant REASON_FROM_MONTHLY_TRANSFER_LIMIT_EXCEEDED = 3;
  uint256 internal constant REASON_FROM_YEARLY_TRANSFER_LIMIT_EXCEEDED = 4;
  uint256 internal constant REASON_TO_ADDRESS_NOT_KNOWN = 5;
  uint256 internal constant REASON_TO_SINGLE_TRANSFER_LIMIT_EXCEEDED = 6;
  uint256 internal constant REASON_TO_MONTHLY_TRANSFER_LIMIT_EXCEEDED = 7;
  uint256 internal constant REASON_TO_YEARLY_TRANSFER_LIMIT_EXCEEDED = 8;

  string constant public REF_CURRENCY = "CHF";

  /**
  * @dev Initializer (replaces constructor when contract is upgradable)
  * @param owner the final owner of the contract
  * @param _complianceRegistry The Compliance Registry address that will be used by this rule for compliance checks 
  */
  function initialize(
    address owner,
    IComplianceRegistry _complianceRegistry
  ) public initializer 
  {
    Operator.initialize(owner);
    complianceRegistry = _complianceRegistry;
  }

  /**
  * @dev Validates a transfer if transfer amounts (single, monthly, yearly) are below the thresholds
  * @param _token Address of the contract that represent the token to be transfered
  * @param _from Sender address
  * @param _to Receiver address
  * @param _amount Amount of tokens to send
  * @param _noCheckThreshold Threshold above which we apply this rule
  * @return transferStatus Valid transfer with before hook action when thresholds are broken, valid transfer with after hook action when transfer is allowed
  * @return statusCode The reason of the transfer rejection indicating which threshold is broken
  */
  function isTransferValid(
    address _token, address _from, address _to, uint256 _amount, uint256 _noCheckThreshold)
    public view returns (uint256, uint256)
  {
    address[] memory trustedIntermediaries = IGovernable(_token).trustedIntermediaries();
    address realm = IGovernable(_token).realm();
    /* Call internal function to avoid local stack limits */
    return _isTransferValid(
      _token, realm, trustedIntermediaries, _from, _to, _amount, _noCheckThreshold.mul(10**uint256(2*MAX_DECIMALS))
    );
  }

  /**
  * @dev Reroutes the transfer to the Compliance Registry where the transfer will be on-hold for
  * for processing by one of the trusted authorities
  * @param _token Address of the contract that represent the token to be transfered
  * @param _from Sender address
  * @param _to Receiver address
  * @param _amount Amount of tokens to send
  * @return transferStatus Valid transfer with before hook action
  * @return updatedTo Address of the compliance registry where the tokens will be held 
  * before processing by one of the trusted authorities
  * @return updatedAmount Initial transfer amount. The amount is not changed by this rule
  */
  function beforeTransferHook(
    address _token, address _from, address _to, uint256 _amount, uint256 /* _param */)
    external onlyOperator returns (uint256, address, uint256)
  {
    address[] memory trustedIntermediaries = IGovernable(_token).trustedIntermediaries();
    uint256 userId;
    address trustedIntermediary;
    (userId, trustedIntermediary) = complianceRegistry.userId(trustedIntermediaries, _from);
    // Normally, userId = 0 should not happen but it's worth checking it otherwise the tokens would end up locked 
    require(userId > 0, "SR01");
    complianceRegistry.addOnHoldTransfer(
      trustedIntermediary,
      _token,
      _from, 
      _to, 
      _amount
    );
    /* After adding the onHold transfer to the compliance registry, instead of transferring the tokens 
    * to the _to address, we transfer them to the compliance registry where the transfer will then 
    * be approved (tokens sent to the _to address) or rejected (tokens sent back to the _from address)
    */
    return (TRANSFER_VALID_WITH_BEFORE_HOOK, address(complianceRegistry), _amount);
  }

  /**
  * @dev Updates the compliance registry transfer counters after the transfer happened
  * @param _token Address of the contract that represent the token to be transfered
  * @param _from Sender address
  * @param _to Receiver address
  * @param _amount Amount of tokens to send
  */
  function afterTransferHook(
    address _token, address _from, address _to, uint256 _amount, uint256 /* _param */)
    external onlyOperator returns (bool)
  {
    address realm = IGovernable(_token).realm();
    uint256 amountInRefCurrency = IPriceable(_token).convertTo(_amount, REF_CURRENCY, MAX_DECIMALS);
    complianceRegistry.updateTransfers(
      realm, 
      _from, 
      _to, 
      amountInRefCurrency
    );
  }

  /**
  * @dev Checks if the transfer is valid
  */
  function _isTransferValid(
    address _token, 
    address realm, 
    address[] memory trustedIntermediaries,
    address _from, 
    address _to,
    uint256 _amount,
    uint256 _noCheckThresholdDecimals
  ) 
    internal view returns(uint256 isValid, uint256 reason)
  {
    /* Exclude compliance registry from check to avoid infinite loop when releasing funds
     from compliance registry by trusted intermediary */
    if (_from == address(complianceRegistry) || _to == address(complianceRegistry)) {
      return (TRANSFER_VALID_WITH_NO_HOOK, REASON_OK);
    }
    uint256 amountInRefCurrency = IPriceable(_token).convertTo(_amount, REF_CURRENCY, MAX_DECIMALS); 
    (isValid, reason) = _isTransferFromValid(
      realm, trustedIntermediaries, _from, amountInRefCurrency, _noCheckThresholdDecimals
    );
    if (isValid == TRANSFER_VALID_WITH_AFTER_HOOK) {
      (isValid, reason) = _isTransferToValid(
        realm, trustedIntermediaries, _to, amountInRefCurrency, _noCheckThresholdDecimals
      );
    }
    return (isValid, reason);
  }

  /**
  * @dev Checks if the transfer is valid for the sender address
  */
  function _isTransferFromValid(    
    address realm, 
    address[] memory trustedIntermediaries,
    address _address,
    uint256 _amountInRefCurrency,
    uint256 _noCheckThresholdDecimals
  ) 
    internal view returns (uint256, uint256) 
  {
    uint256 userId;
    address trustedIntermediary;
    (userId, trustedIntermediary) = complianceRegistry.userId(trustedIntermediaries, _address);
    if (userId == 0) {
      // Allow transaction if amount is less than noCheckThreshold
      if (_amountInRefCurrency <= _noCheckThresholdDecimals && 
        complianceRegistry.monthlyOutTransfers(realm, trustedIntermediaries, _address).add(_amountInRefCurrency) <= _noCheckThresholdDecimals &&
        complianceRegistry.yearlyOutTransfers(realm, trustedIntermediaries, _address).add(_amountInRefCurrency) <= _noCheckThresholdDecimals) {
        return (TRANSFER_VALID_WITH_AFTER_HOOK, REASON_OK);
      }
      // Reject otherwise
      return (TRANSFER_INVALID, REASON_FROM_ADDRESS_NOT_KNOWN);
    }
    uint256[] memory attributeKeys = new uint256[](3);
    attributeKeys[0] = USER_AML_TRANSFER_THRESHOLD_KEY;
    attributeKeys[1] = USER_AML_MONTHLY_THRESHOLD_KEY;
    attributeKeys[2] = USER_AML_YEARLY_THRESHOLD_KEY;
    uint256[] memory userAttributes = complianceRegistry.attributes(
      trustedIntermediary,
      userId,
      attributeKeys
    );
    if (userAttributes[0].mul(10**uint256(2*MAX_DECIMALS)) < 
      _amountInRefCurrency) {
      return (TRANSFER_VALID_WITH_BEFORE_HOOK, REASON_FROM_SINGLE_TRANSFER_LIMIT_EXCEEDED);
    }
    if (userAttributes[1].mul(10**uint256(2*MAX_DECIMALS)) < 
      complianceRegistry.monthlyOutTransfers(realm, trustedIntermediaries, _address).add(_amountInRefCurrency)) {
      return (TRANSFER_VALID_WITH_BEFORE_HOOK, REASON_FROM_MONTHLY_TRANSFER_LIMIT_EXCEEDED);
    }
    if (userAttributes[2].mul(10**uint256(2*MAX_DECIMALS)) < 
      complianceRegistry.yearlyOutTransfers(realm, trustedIntermediaries, _address).add(_amountInRefCurrency)) {
      return (TRANSFER_VALID_WITH_BEFORE_HOOK, REASON_FROM_YEARLY_TRANSFER_LIMIT_EXCEEDED);
    }
    return (TRANSFER_VALID_WITH_AFTER_HOOK, REASON_OK);
  }

  /**
  * @dev Checks if the transfer is valid for the receiver address
  */
  function _isTransferToValid(    
    address realm, 
    address[] memory trustedIntermediaries,
    address _address,
    uint256 _amountInRefCurrency,
    uint256 _noCheckThresholdDecimals
  ) 
    internal view returns (uint256, uint256) 
  {
    uint256 userId;
    address trustedIntermediary;
    (userId, trustedIntermediary) = complianceRegistry.userId(trustedIntermediaries, _address);
    if (userId == 0) {
      // Allow transaction if amount is less than noCheckThreshold
      if (_amountInRefCurrency <= _noCheckThresholdDecimals && 
        complianceRegistry.monthlyInTransfers(realm, trustedIntermediaries, _address).add(_amountInRefCurrency) <= _noCheckThresholdDecimals &&
        complianceRegistry.yearlyInTransfers(realm, trustedIntermediaries, _address).add(_amountInRefCurrency) <= _noCheckThresholdDecimals) {
        return (TRANSFER_VALID_WITH_AFTER_HOOK, REASON_OK);
      }
      // Reject otherwise
      return (TRANSFER_INVALID, REASON_TO_ADDRESS_NOT_KNOWN);
    }
    uint256[] memory attributeKeys = new uint256[](3);
    attributeKeys[0] = USER_AML_TRANSFER_THRESHOLD_KEY;
    attributeKeys[1] = USER_AML_MONTHLY_THRESHOLD_KEY;
    attributeKeys[2] = USER_AML_YEARLY_THRESHOLD_KEY;
    uint256[] memory userAttributes = complianceRegistry.attributes(
      trustedIntermediary,
      userId,
      attributeKeys
    );
    if (userAttributes[0].mul(10**uint256(2*MAX_DECIMALS)) < 
      _amountInRefCurrency) {
      return (TRANSFER_VALID_WITH_BEFORE_HOOK, REASON_TO_SINGLE_TRANSFER_LIMIT_EXCEEDED);
    }
    if (userAttributes[1].mul(10**uint256(2*MAX_DECIMALS)) < 
      complianceRegistry.monthlyInTransfers(realm, trustedIntermediaries, _address).add(_amountInRefCurrency)) {
      return (TRANSFER_VALID_WITH_BEFORE_HOOK, REASON_TO_MONTHLY_TRANSFER_LIMIT_EXCEEDED);
    }
    if (userAttributes[2].mul(10**uint256(2*MAX_DECIMALS)) < 
      complianceRegistry.yearlyInTransfers(realm, trustedIntermediaries, _address).add(_amountInRefCurrency)) {
      return (TRANSFER_VALID_WITH_BEFORE_HOOK, REASON_TO_YEARLY_TRANSFER_LIMIT_EXCEEDED);
    }
    return (TRANSFER_VALID_WITH_AFTER_HOOK, REASON_OK);
  }
}
