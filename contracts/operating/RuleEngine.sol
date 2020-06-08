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

import "../interfaces/IRule.sol";
import "../interfaces/IRuleEngine.sol";
import "../access/Operator.sol";

/**
 * @title RuleEngine
 * @dev Rule Engine library defines rules that can be applied to all tokens restrict their transferability

 * Errors:
 * RE01: Rule id overflow
 * RE02: Rule keys does not have the same length as rule params
 **/


contract RuleEngine is Initializable, Operator {

  uint256 public constant VERSION = 1;

  IRule[] internal _rules;

  /**
  * @dev Initializer (replaces constructor when contract is upgradable)
  * @param owner the final owner of the contract
  */
  function initialize(address owner) public override initializer {
    Operator.initialize(owner);
  }

  /**
  * @dev set the rules of the library (replacing existing rules)
  * @param rules Array of rules that will replace the existing rules
  */
  function setRules(IRule[] calldata rules) external onlyOperator {
    _rules = rules;
  }

  /**
   * @dev Returns the number of rules in the library
   * @return The number of rules in the library
   */
  function ruleLength() public view returns (uint256) {
    return _rules.length;
  }

  /**
   * @dev Returns the rule associated to a specific id
   * @dev Throws RE01 if id is outside the rule array
   * @param _ruleId id of the rule to retrieve
   * @return rule Address of the rule
   */
  function rule(uint256 _ruleId) public view returns (IRule) {
    require(_ruleId < _rules.length, "RE01");
    return _rules[_ruleId];
  }

  /**
   * @dev Returns the rules associated to specific ids
   * @dev Throws RE01 if id is outside the rule array
   * @param _ruleIds Array of ids of the rules to retrieve
   * @return result Array of addresses of the rules
   */
  function rules(uint256[] calldata _ruleIds) external view returns(IRule[] memory result) {
    result = new IRule[](_ruleIds.length);
    uint256 length = _rules.length;
    for (uint256 i = 0; i < _ruleIds.length; i++) {
      require(_ruleIds[i] < length, "RE01");
      result[i] = _rules[_ruleIds[i]];
    }
    return result;
  }

  /**
   * @dev Check if a transfer is valid according to the rules and rule parameters passed in parameters
   * @param _tokenRuleKeys Array of rule ids that have to be checked
   * @param _tokenRuleParams Array of rule parameters that are enforced for rules
   * @param _token Address of the contract that represent the token to be transfered
   * @param _from Sender address
   * @param _to Receiver address
   * @param _amount Amount of token to transfer
   * @return isValid True if the transfer is valid according to all rules, false otherwise
   * @return ruleId Id of the first invalid rule
   * @return reason Code representing the rule rejection reason
   */
  function validateTransferWithRules(
    uint256[] calldata _tokenRuleKeys, 
    uint256[] calldata _tokenRuleParams, 
    address _token,
    address _from, 
    address _to, 
    uint256 _amount)
    external view returns (bool isValid, uint256 ruleId, uint256 reason)
  {
    require(_tokenRuleKeys.length == _tokenRuleParams.length, "RE02");
    uint256 ruleValid;
    for (ruleId = 0; ruleId < _tokenRuleKeys.length; ruleId++) {
      if (_tokenRuleKeys[ruleId] < _rules.length) {
        (ruleValid, reason) = _rules[_tokenRuleKeys[ruleId]].isTransferValid(
          _token, _from, _to, _amount, _tokenRuleParams[ruleId]);
        if (ruleValid == 0) {
          return (false, _tokenRuleKeys[ruleId], reason);
        }
      }
    }
    return (true, 0, 0);
  }
}