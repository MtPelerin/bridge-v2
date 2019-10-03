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
import "@openzeppelin/contracts-ethereum-package/contracts/access/Roles.sol";
import "./abstract/SeizableBridgeERC20.sol";
import "../interfaces/IRulable.sol";
import "../interfaces/ISuppliable.sol";
import "../interfaces/IMintable.sol";
import "../interfaces/IProcessor.sol";

/**
 * @title BridgeToken
 * @dev BridgeToken contract
 *
 * Error messages
 * SU01: Caller is not supplier
 * RU01: Rules and rules params don't have the same length
 * RE01: Rule id overflow
**/


contract BridgeToken is Initializable, IRulable, ISuppliable, IMintable, SeizableBridgeERC20 {
  using Roles for Roles.Role;
  
  Roles.Role internal _suppliers;
  uint256[] internal _rules;
  uint256[] internal _rulesParams;

  function initialize(
    address owner,
    IProcessor processor,
    string memory name,
    string memory symbol,
    uint8 decimals,
    address[] memory trustedIntermediaries
  ) 
    public initializer 
  {
    SeizableBridgeERC20.initialize(owner, processor);
    processor.register(name, symbol, decimals);
    _trustedIntermediaries = trustedIntermediaries;
    emit TrustedIntermediariesChanged(trustedIntermediaries);
  }

  modifier onlySupplier() {
    require(isSupplier(msg.sender), "SU01");
    _;
  }

  /* Mintable */
  function isSupplier(address _supplier) public view returns (bool) {
    return _suppliers.has(_supplier);
  }

  function addSupplier(address _supplier) public onlyAdministrator {
    _suppliers.add(_supplier);
    emit SupplierAdded(_supplier);
  }

  function removeSupplier(address _supplier) public onlyAdministrator {
    _suppliers.remove(_supplier);
    emit SupplierRemoved(_supplier);
  }  

  function mint(address _to, uint256 _amount)
    public onlySupplier hasProcessor
  {
    _processor.mint(msg.sender, _to, _amount);
    emit Mint(_to, _amount);
    emit Transfer(address(0), _to, _amount);
  }

  function burn(address _from, uint256 _amount)
    public onlySupplier hasProcessor 
  {
    _processor.burn(msg.sender, _from, _amount);
    emit Burn(_from, _amount);
    emit Transfer(_from, address(0), _amount);
  }

  /* Rulable */
  function rules() public view returns (uint256[] memory, uint256[] memory) {
    return (_rules, _rulesParams);
  }
  
  function rule(uint256 ruleId) public view returns (uint256, uint256) {
    require(ruleId < _rules.length, "RE01");
    return (_rules[ruleId], _rulesParams[ruleId]);
  }

  function canTransfer(
    address _from, address _to, uint256 _amount
  ) 
    public hasProcessor view returns (bool, uint256, uint256) 
  {
    return _processor.canTransfer(_from, _to, _amount);
  }

  function setRules(
    uint256[] calldata newRules, 
    uint256[] calldata newRulesParams
  ) 
    external onlyAdministrator
  {
    require(newRules.length == newRulesParams.length, "RU01");
    _rules = newRules;
    _rulesParams = newRulesParams;
    emit RulesChanged(_rules, _rulesParams);
  }
}