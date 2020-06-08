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

import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "../access/Roles.sol";
import "../interfaces/IGovernable.sol";
import "../interfaces/IERC20Detailed.sol";
import "../interfaces/IPriceOracle.sol";
import "../interfaces/IPriceable.sol";
import "../interfaces/IAdministrable.sol";
import "../interfaces/IMintable.sol";

/**
* @title BridgeERC20Mock
* @dev Mocks BridgeERC20 token, used for testing
*/


contract BridgeERC20Mock is IGovernable, IPriceable, IMintable, IAdministrable, IERC20Detailed {
  using Roles for Roles.Role;
  using SafeMath for uint256;
  
  mapping (address => uint256) internal _balances;
  uint256 internal _totalSupply;
  address internal _realm;
  address[] internal _trustedIntermediaries;
  Roles.Role internal _administrators;
  Roles.Role internal _realmAdministrators;
  string internal _name;
  string internal _symbol;
  uint8 internal _decimals;
  IPriceOracle internal _priceOracle;

  constructor(
    IPriceOracle priceOracle, 
    string memory name, 
    string memory symbol, 
    uint8 decimals
  ) public 
  {
    _realm = address(this);
    _name = name;
    _symbol = symbol;
    _decimals = decimals;
    _priceOracle = priceOracle;
  }

  function realm() public override view returns (address) {
    return _realm;
  }

  function setRealm(address newRealm) public override {
    _realm = newRealm;
  } 

  function trustedIntermediaries() public override view returns (address[] memory) {
    return _trustedIntermediaries;
  }

  function setTrustedIntermediaries(address[] calldata newTrustedIntermediaries) external override {
    _trustedIntermediaries = newTrustedIntermediaries;
  }  

  function isRealmAdministrator(address _administrator) public override view returns (bool) {
    return _realmAdministrators.has(_administrator);
  }

  function addRealmAdministrator(address _administrator) public override {
    _realmAdministrators.add(_administrator);
    emit RealmAdministratorAdded(_administrator);
  }

  function removeRealmAdministrator(address _administrator) public override {
    _realmAdministrators.remove(_administrator);
    emit RealmAdministratorRemoved(_administrator);
  }

  /* Administrable */
  function isAdministrator(address _administrator) public override view returns (bool) {
    return _administrators.has(_administrator);
  }

  function addAdministrator(address _administrator) public override {
    _administrators.add(_administrator);
    emit AdministratorAdded(_administrator);
  }

  function removeAdministrator(address _administrator) public override {
    _administrators.remove(_administrator);
    emit AdministratorRemoved(_administrator);
  }

  /* Mintable */
  function mint(address _to, uint256 _amount) public override
  {
    _totalSupply = _totalSupply.add(_amount);
    _balances[_to] = _balances[_to].add(_amount);
  }

  function burn(address _from, uint256 _amount) public override
  {
    _totalSupply = _totalSupply.sub(_amount);
    _balances[_from] = _balances[_from].sub(_amount);
  }

  function priceOracle() public override view returns (IPriceOracle) {
    return _priceOracle;
  }

  function setPriceOracle(IPriceOracle newPriceOracle) public override {
    _priceOracle = newPriceOracle;
  }

  function convertTo(
    uint256 _amount, string calldata _currency, uint8 maxDecimals
  ) 
    external override view returns(uint256) 
  {
    uint256 amountToConvert = _amount;
    uint256 xrate;
    uint256 xrateDecimals;
    uint256 tokenDecimals = _decimals;
    (xrate, xrateDecimals) = _priceOracle.getPrice(_symbol, _currency);
    if (xrateDecimals > maxDecimals) {
      xrate = xrate.div(10**(xrateDecimals - maxDecimals));
      xrateDecimals = maxDecimals;
    }
    if (tokenDecimals > maxDecimals) {
      amountToConvert = amountToConvert.div(10**(tokenDecimals - maxDecimals));
      tokenDecimals = maxDecimals;
    }
    /* Multiply amount in token decimals by xrate in xrate decimals */
    return amountToConvert.mul(xrate).mul(10**((2*maxDecimals)-xrateDecimals-tokenDecimals));
  }

  function name() external override view returns (string memory) {
    return _name;
  }

  function symbol() external override view returns (string memory) {
    return _symbol;
  }

  function decimals() external override view returns (uint8) {
    return _decimals;
  }

  function transfer(address /* to */, uint256 /* value */) external override returns (bool) {
    return true;
  }

  function approve(address /* spender */, uint256 /* value */) external override returns (bool) {
    return true;
  }

  function transferFrom(address /* from */, address /* to */, uint256 /* value */) external override returns (bool) {
    return true;
  }

  function totalSupply() external override view returns (uint256) {
    return _totalSupply;
  }

  function balanceOf(address account) external override view returns (uint256) {
    return _balances[account];
  }

  function allowance(address /* owner */, address /* spender */) external override view returns (uint256) {
    return 0;
  }
}