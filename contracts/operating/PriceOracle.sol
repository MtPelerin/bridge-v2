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

import "../interfaces/IPriceOracle.sol";
import "../access/Operator.sol";

/**
 * @title PriceOracle
 * @dev The Price Oracle stores price related data for currency/token price conversion
 *
 * Error messages
 * PO01: Currency1 length does not match price length 
 * PO02: Currency1 length does not match decimals length 
 * PO03: Currency1 length does not match currency2 length
*/


contract PriceOracle is Initializable, IPriceOracle, Operator {

  uint256 public constant VERSION = 1;

  mapping(bytes32 => mapping(bytes32 => Price)) _prices;

  /**
  * @dev Initializer (replaces constructor when contract is upgradable)
  * @param owner the final owner of the contract
  */
  function initialize(address owner) public override initializer {
    Operator.initialize(owner);
  }

  /**
  * @dev Set prices for multiple pairs at the same time
  * @param _currency1 array of source tokens/currencies to update prices for
  * @param _currency2 array of destination tokens/currencies to update prices for
  * @param _price array of prices
  * @param _decimals array of decimals of the price to be set
  */
  function setPrices(
    bytes32[] calldata _currency1,
    bytes32[] calldata _currency2,
    uint256[] calldata _price, 
    uint8[] calldata _decimals
  ) 
    external override onlyOperator 
  {
    require(_currency1.length == _price.length, "PO01");
    require(_currency1.length == _decimals.length, "PO02");
    require(_currency1.length == _currency2.length, "PO03");
    for (uint256 i = 0; i < _currency1.length; i++) {
      // solium-disable-next-line security/no-block-members
      _prices[_currency1[i]][_currency2[i]] = Price(_price[i], _decimals[i], now);
      // solium-disable-next-line security/no-block-members
      emit PriceSet(_currency1[i], _currency2[i], _price[i], _decimals[i], now);
    }
  }
  
  /**
  * @dev Set prices for multiple pairs at the same time
  * @param _currency1 source token/currency to update the price for
  * @param _currency2 destination token/currency to update the price for
  * @param _price new price
  * @param _decimals decimals of the price to be set
  */
  function setPrice(bytes32 _currency1, bytes32 _currency2, uint256 _price, uint8 _decimals) public override onlyOperator {
    // solium-disable-next-line security/no-block-members
    _prices[_currency1][_currency2] = Price(_price, _decimals, now);
    // solium-disable-next-line security/no-block-members
    emit PriceSet(_currency1, _currency2, _price, _decimals, now);
  }

  /**
  * @dev Get the price information for a specific pair of tokens/currencies
  * @param _currency1 source token/currency to retrieve the price for
  * @param _currency2 destination token/currency to retrieve the price for
  * @return price price in decimals for the wanted pair
  * @return decimals number of decimals for the returns pair price
  */
  function getPrice(bytes32 _currency1, bytes32 _currency2) public override view returns (uint256, uint8) {
    return (_prices[_currency1][_currency2].price, _prices[_currency1][_currency2].decimals);
  }

  /**
  * @dev Get the price information for a specific pair of tokens/currencies
  * @param _currency1 First token/currency symbol string
  * @param _currency2 Second token/currency symbol string
  * @return price price in decimals for the wanted pair
  * @return decimals number of decimals for the returns pair price
  */
  function getPrice(string calldata _currency1, string calldata _currency2) external override view returns (uint256, uint8) {
    return getPrice(_asBytes32(_currency1), _asBytes32(_currency2));
  }

  /**
  * @dev Get the last update date for a specific pair of tokens/currencies
  * @param _currency1 source token/currency to retrieve the last update date for
  * @param _currency2 destination token/currency to retrieve the last update date for
  * @return lastUpdateDate last update date for the required pair
  */
  function getLastUpdated(bytes32 _currency1, bytes32 _currency2) public override view returns (uint256) {
    return _prices[_currency1][_currency2].lastUpdated;
  }

  /**
  * @dev Get the decimals for a specific pair of tokens/currencies
  * @param _currency1 source token/currency to retrieve the decimals for
  * @param _currency2 destination token/currency to retrieve the decimals for
  * @return decimals last update date for the required pair
  */
  function getDecimals(bytes32 _currency1, bytes32 _currency2) public override view returns (uint8) {
    return _prices[_currency1][_currency2].decimals;
  }

  /**
  * @dev Get the bytes32 representation of a token/currency symbol string
  * @param _currency token/currency symbol string
  * @return result the bytes32 representation of the token/currency symbol string as bytes32
  */
  function _asBytes32(string memory _currency) internal pure returns (bytes32 result) {
    bytes memory _currencyAsBytes = bytes(_currency);

    /* Returns 32 first bytes _currencyAsBytes */
    // solium-disable-next-line security/no-inline-assembly
    assembly {
      result := mload(add(_currencyAsBytes, 32))
    }
  }
}