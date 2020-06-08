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

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";

interface IExchange {
  event ItemUpdated(uint256 id);
  event OrderTraded(uint256 payAmount, IERC20 indexed payToken, uint256 buyAmount, IERC20 indexed buyToken);
  event OrderMade(
    bytes32  indexed  id,
    bytes32  indexed  pair,
    address  indexed  maker,
    IERC20             payToken,
    IERC20             buyToken,
    uint256           payAmount,
    uint256           buyAmount,
    uint256            timestamp
  );
  event OrderTaken(
    bytes32           id,
    bytes32  indexed  pair,
    address  indexed  maker,
    IERC20             payToken,
    IERC20             buyToken,
    address  indexed  taker,
    uint256           takeAmount,
    uint256           giveAmount,
    uint256            timestamp
  );
  event OrderKilled(
    bytes32  indexed  id,
    bytes32  indexed  pair,
    address  indexed  maker,
    IERC20             payToken,
    IERC20             buyToken,
    uint256           payAmount,
    uint256           buyAmount,
    uint256            timestamp
  );
  event MinSellSet(IERC20 payToken, uint256 minAmount);
  event UnsortedOffer(uint256 id);
  event SortedOffer(uint256 id);
  event RankInserted(address keeper, uint256 id);
  event RankDeleted(address keeper, uint256 id);
}