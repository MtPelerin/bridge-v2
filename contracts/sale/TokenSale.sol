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
import "@openzeppelin/contracts-ethereum-package/contracts/lifecycle/Pausable.sol";
import "../token/BridgeToken.sol";
import "../access/Operator.sol";


/**
 * @title TokenSale
 * @dev TokenSale contract
 *
 * Error messages
 * TS01: Sale is currently closed
 * TS02: Start date must be lower than end date
 * TS03: Ether withdrawal error
 * TS04: Transfer rejected by token rules
 * TS05: Ether and refCurrency amount must be mutually exclusive
 * TS06: Token to Ether rate is 0
 * TS07: Token transfer error
 * TS08: Call to default function with data forbidden
 * TS09: Token to ref currency rate is 0
 * TS10: Computed token amount is 0
 * TS11: Sale has already started
 */
contract TokenSale is Initializable, Pausable, Operator {
  using SafeMath for uint256;

  uint256 public constant VERSION = 1;

  BridgeToken public token;
  address payable public etherVault;
  address public tokenVault;
  string public refCurrency;
  uint8 public refCurrencyDecimals;
  uint256 public startAt;
  uint256 public endAt;
  uint256 public maxEtherBalance;

  uint8 internal constant MAX_DECIMALS = 20;
  uint8 internal constant ETH_DECIMALS = 18;

  function initialize(
    address _owner,
    BridgeToken _token,
    address payable _etherVault,
    address _tokenVault,
    string memory _refCurrency,
    uint8 _refCurrencyDecimals
  ) 
    public initializer 
  {
    Operator.initialize(_owner);
    Pausable.initialize(_owner);
    token = _token;
    etherVault = _etherVault;
    tokenVault = _tokenVault;
    refCurrency = _refCurrency;
    refCurrencyDecimals = _refCurrencyDecimals;
    maxEtherBalance = 10 ether;
  }

  modifier isOpen {
    require(_currentTime() >= startAt && _currentTime() <= endAt, "TS01");
    _;
  }

  modifier beforeOpen {
    require(startAt == 0 || _currentTime() < startAt, "TS11");
    _;
  }

  function setMaxEtherBalance(uint256 _maxEtherBalance) public onlyOperator {
    maxEtherBalance = _maxEtherBalance;
    _rebalance();
  }

  function setSchedule(uint256 _startAt, uint256 _endAt) public onlyOperator beforeOpen {
    require(_startAt < _endAt, "TS02");
    startAt = _startAt;
    endAt = _endAt;
  }

  function investRefCurrency(address _investor, uint256 _amount) public onlyOperator {
    _investRefCurrency(_investor, _amount);
  }

  function withdrawEther() public onlyOperator {
    // solium-disable-next-line security/no-send
    require(etherVault.send(address(this).balance), "TS03");
  }

  function () external isOpen whenNotPaused payable {
    require(msg.data.length == 0, "TS08");
    _investEther(msg.sender, msg.value);
    _rebalance();
  }

  function investEther() public isOpen whenNotPaused payable {
    _investEther(msg.sender, msg.value);
    _rebalance();
  }

  function _investEther(address _investor, uint256 etherAmount) internal {
    require(etherAmount != 0, "TS05");
    uint256 rate;
    uint256 tokenAmount;
    rate = token.convertTo(10 ** uint256(token.decimals()), "ETH", MAX_DECIMALS);
    require(rate != 0, "TS06");
    tokenAmount = etherAmount.mul(10**(uint256(2*MAX_DECIMALS) - uint256(ETH_DECIMALS))).div(rate);
    require(tokenAmount > 0, "TS10");
    require(token.transferFrom(tokenVault, _investor, tokenAmount), "TS07");
  }

  function _investRefCurrency(address _investor, uint256 refCurrencyAmount) internal {
    require(refCurrencyAmount != 0, "TS05");
    uint256 rate;
    uint256 tokenAmount;
    rate = token.convertTo(10 ** uint256(token.decimals()), refCurrency, MAX_DECIMALS);
    require(rate != 0, "TS09");
    tokenAmount = refCurrencyAmount.mul(10**(uint256(2*MAX_DECIMALS) - uint256(refCurrencyDecimals))).div(rate);
    require(tokenAmount > 0, "TS10");
    require(token.transferFrom(tokenVault, _investor, tokenAmount), "TS07");
  }

  function _rebalance() internal {
    uint256 balance = address(this).balance;
    if (balance > maxEtherBalance) {
      // solium-disable-next-line security/no-send
      require(etherVault.send(balance), "TS03"); 
    }
  }

  function _currentTime() private view returns (uint256) {
    // solium-disable-next-line security/no-block-members
    return now;
  }
}
