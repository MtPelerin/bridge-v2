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

import "../lib/ds-math/math.sol";


contract OtcInterface {
  struct OfferInfo {
    uint              pay_amt;
    address           pay_gem;
    uint              buy_amt;
    address           buy_gem;
    address           owner;
    uint64            timestamp;
  }
  mapping (uint => OfferInfo) public offers;
  function getBestOffer(address, address) public view returns (uint);
  function getWorseOffer(uint) public view returns (uint);
}


contract MakerOtcSupportMethods is DSMath {
  function getOffers(OtcInterface otc, address payToken, address buyToken) public view
      returns (uint[100] memory ids, uint[100] memory payAmts, uint[100] memory buyAmts, address[100] memory owners, uint[100] memory timestamps)
  {
    (ids, payAmts, buyAmts, owners, timestamps) = getOffers(otc, otc.getBestOffer(payToken, buyToken));
  }

  function getOffers(OtcInterface otc, uint offerId) public view
      returns (uint[100] memory ids, uint[100] memory payAmts, uint[100] memory buyAmts, address[100] memory owners, uint[100] memory timestamps)
  {
    uint i = 0;
    do {
      (payAmts[i],, buyAmts[i],, owners[i], timestamps[i]) = otc.offers(offerId);
      if (owners[i] == address(0)) 
        break;
      ids[i] = offerId;
      offerId = otc.getWorseOffer(offerId);
    } while (++i < 100);
  }

  function getOffersAmountToSellAll(OtcInterface otc, address payToken, uint payAmt, address buyToken) public view returns (uint ordersToTake, bool takesPartialOrder) {
    uint offerId = otc.getBestOffer(buyToken, payToken);                        // Get best offer for the token pair
    ordersToTake = 0;
    uint payAmt2 = payAmt;
    uint orderBuyAmt = 0;
    (,,orderBuyAmt,,,) = otc.offers(offerId);
    while (payAmt2 > orderBuyAmt) {
      ordersToTake ++;                                                        // New order taken
      payAmt2 = sub(payAmt2, orderBuyAmt);                                    // Decrease amount to pay
      if (payAmt2 > 0) {                                                      // If we still need more offers
        offerId = otc.getWorseOffer(offerId);                               // We look for the next best offer
        require(offerId != 0);                                              // Fails if there are not enough offers to complete
        (,,orderBuyAmt,,,) = otc.offers(offerId);
      }  
    }
    ordersToTake = payAmt2 == orderBuyAmt ? ordersToTake + 1 : ordersToTake;    // If the remaining amount is equal than the latest order, then it will also be taken completely
    takesPartialOrder = payAmt2 < orderBuyAmt;                                  // If the remaining amount is lower than the latest order, then it will take a partial order
  }

  function getOffersAmountToBuyAll(OtcInterface otc, address buyToken, uint buyAmt, address payToken) public view returns (uint ordersToTake, bool takesPartialOrder) {
    uint offerId = otc.getBestOffer(buyToken, payToken);                        // Get best offer for the token pair
    ordersToTake = 0;
    uint buyAmt2 = buyAmt;
    uint orderPayAmt = 0;
    (orderPayAmt,,,,,) = otc.offers(offerId);
    while (buyAmt2 > orderPayAmt) {
      ordersToTake ++;                                                        // New order taken
      buyAmt2 = sub(buyAmt2, orderPayAmt);                                    // Decrease amount to buy
      if (buyAmt2 > 0) {                                                      // If we still need more offers
        offerId = otc.getWorseOffer(offerId);                               // We look for the next best offer
        require(offerId != 0);                                              // Fails if there are not enough offers to complete
        (orderPayAmt,,,,,) = otc.offers(offerId);
      }
    }
    ordersToTake = buyAmt2 == orderPayAmt ? ordersToTake + 1 : ordersToTake;    // If the remaining amount is equal than the latest order, then it will also be taken completely
    takesPartialOrder = buyAmt2 < orderPayAmt;                                  // If the remaining amount is lower than the latest order, then it will take a partial order
  }
}