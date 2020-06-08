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

    This contract is a modified version of Maker OTC contracts: https://github.com/makerdao/maker-otc
*/

pragma solidity 0.6.2;

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";
import "../lib/ds-math/math.sol";
import "../interfaces/IExchange.sol";
import "../access/Operator.sol";

/**
* Errors:
* EX00: reentrancy attempt
* EX01: order is not active
* EX02: Offer can not be cancelled because user is not owner, and market is open, and offer sells required amount of tokens
* EX03: error during buy
* EX04: error during cancel
* EX06: cannot unsort order
* EX07: cannot hide order
* EX08: order already sorted
* EX09: order is already active
* EX10: order is already deleted
* EX14: no offer found
* EX15: no offer found for wanted amount
* EX16: pay amount is less than minimum amount for token
* EX17: pay token is 0x0
* EX18: buy amount is less than minimum amount for token
* EX19: buy token is 0x0
* EX20: pay token is buy token
* EX21: cannot transfer pay token from seller
* EX23: cannot transfer buy token from buyer
* EX24: cannot transfer pay token to buyer
* EX25: cannot refund pay token to seller
* EX26: id is not strictly positive
* EX27: no sorted offer for this token pair
* EX28: offer has been deleted or is not sorted
* EX29: sorted linked list pointer error
* EX30: sorted offer cannot be hidden
**/


contract Exchange is IExchange, DSMath, Operator {

  uint256 public constant VERSION = 1;
  
  struct SortInfo {
    uint256 next;  //points to id of next higher offer
    uint256 prev;  //points to id of previous lower offer
    uint256 delb;  //the blocknumber where this entry was marked for delete
  }

  struct OfferInfo {
    uint256    payAmount;
    IERC20    payToken;
    uint256     buyAmount;
    IERC20    buyToken;
    address  owner;
    uint256   timestamp;
  }

  uint256 public lastOfferId;
  mapping (uint256 => OfferInfo) public offers;
  bool locked;                                                      //lock mechanism to avoid reentrancy

  mapping(uint256 => SortInfo) public _rank;                        //doubly linked lists of sorted offer ids
  mapping(address => mapping(address => uint256)) public _best;     //id of the highest offer for a token pair 
  mapping(address => mapping(address => uint256)) public _span;     //number of offers stored for token pair in sorted orderbook
  mapping(address => uint256) public _dust;                         //minimum sell amount for a token to avoid dust offers
  mapping(uint => uint256) public _near;                            //next unsorted offer id 
  uint _head;                                                       //first unsorted offer id   
  uint public dustId;                                               // id of the latest offer marked as dust 

  // after close, no new buys are allowed
  modifier canBuy(uint256 id) {
    require(isActive(id), "EX01");
    _;
  }

  // anyone can cancel a dust offer
  modifier canCancel(uint256 id) {
    require(isActive(id), "EX01");
    require(
      _msgSender() == getOwner(id) || id == dustId,
      "EX02"
    );
    _;
  }

  function initialize(address owner) public override initializer {
    Operator.initialize(owner);
  }

  function isActive(uint256 id) public view returns (bool active) {
    return offers[id].timestamp > 0;
  }

  function getOwner(uint256 id) public view returns (address owner) {
    return offers[id].owner;
  }

  function getOffer(uint256 id) public view returns (uint256, IERC20, uint256, IERC20) {
    return (offers[id].payAmount, offers[id].payToken, offers[id].buyAmount, offers[id].buyToken);
  }

  // ---- Public entrypoints ---- //
  function make(
    IERC20 payToken,
    IERC20 buyToken,
    uint256 payAmount,
    uint256 buyAmount
  )
    public
    returns (bytes32)
  {
    return bytes32(
      offer(
        payAmount, 
        payToken, 
        buyAmount, 
        buyToken
      )
    );
  }

  function take(bytes32 id, uint256 maxTakeAmount) public {
    require(buy(uint256(id), maxTakeAmount), "EX03");
  }

  function kill(bytes32 id) public {
    require(cancel(uint256(id)), "EX04");
  }

  // Make a new offer. Takes funds from the caller into market escrow.
  function offer(
    uint256 payAmount,    //maker (ask) sell how much
    IERC20 payToken,   //maker (ask) sell which token
    uint256 buyAmount,    //taker (ask) buy how much
    IERC20 buyToken    //taker (ask) buy which token
  )
    public
    returns (uint256)
  {
    require(!locked, "EX00");
    return _offerUnsorted(
      payAmount, 
      payToken, 
      buyAmount, 
      buyToken
    );
  }

  // Make a new offer. Takes funds from the caller into market escrow.
  function offer(
    uint256 payAmount,    //maker (ask) sell how much
    IERC20 payToken,   //maker (ask) sell which token
    uint256 buyAmount,    //maker (ask) buy how much
    IERC20 buyToken,   //maker (ask) buy which token
    uint256 pos         //position to insert offer, 0 should be used if unknown
  )
    public
    returns (uint256)
  {
    return offer(
      payAmount, 
      payToken, 
      buyAmount, 
      buyToken, 
      pos, 
      true
    );
  }

  function offer(
    uint256 payAmount,    //maker (ask) sell how much
    IERC20 payToken,   //maker (ask) sell which token
    uint256 buyAmount,    //maker (ask) buy how much
    IERC20 buyToken,   //maker (ask) buy which token
    uint256 pos,        //position to insert offer, 0 should be used if unknown
    bool rounding    //match "close enough" orders?
  )
    public
    returns (uint256)
  {
    require(!locked, "EX00");
    require(_dust[address(payToken)] <= payAmount, "EX05");
    return _matchOrder(
      payAmount, 
      payToken, 
      buyAmount, 
      buyToken, 
      pos, 
      rounding
    );
  }

  //Transfers funds from caller to offer maker, and from market to caller.
  function buy(uint256 id, uint256 amount)
    public
    canBuy(id)
    returns (bool)
  {
    require(!locked, "EX00");
    return _buy(id, amount);
  }

  // Cancel an offer. Refunds offer maker.
  function cancel(uint256 id)
    public
    canCancel(id)
    returns (bool success)
  {
    require(!locked, "EX00");
    if (isOfferSorted(id)) {
      require(_unsort(id), "EX06");
    } else {
      require(_hide(id), "EX07");
    }
    return _cancel(id);    //delete the offer.
  }

  //insert offer into the sorted list
  //keepers need to use this function
  function insert(
    uint256 id,   //maker (ask) id
    uint256 pos   //position to insert into
  )
    public
    returns (bool)
  {
    require(!locked, "EX00");
    require(!isOfferSorted(id), "EX08");    //make sure offers[id] is not yet sorted
    require(isActive(id), "EX01");          //make sure offers[id] is active

    _hide(id);                      //remove offer from unsorted offers list
    _sort(id, pos);                 //put offer into the sorted offers list
    emit RankInserted(_msgSender(), id);
    return true;
  }

  //deletes _rank [id]
  //  Function should be called by keepers.
  function deleteRank(uint256 id)
    public
    returns (bool)
  {
    require(!locked, "EX00");
    require(!isActive(id), "EX09");
    require(_rank[id].delb != 0 && _rank[id].delb < block.number - 10, "EX10");
    delete _rank[id];
    emit RankDeleted(_msgSender(), id);
    return true;
  }

  //set the minimum sell amount for a token
  //    Function is used to avoid "dust offers" that have
  //    very small amount of tokens to sell, and it would
  //    cost more gas to accept the offer, than the value
  //    of tokens received.
  function setMinSell(
    IERC20 payToken,     //token to assign minimum sell amount to
    uint256 dust          //maker (ask) minimum sell amount
  )
    public
    onlyOperator
    returns (bool)
  {
    _dust[address(payToken)] = dust;
    emit MinSellSet(payToken, dust);
    return true;
  }

  //returns the minimum sell amount for an offer
  function getMinSell(
    IERC20 payToken      //token for which minimum sell amount is queried
  )
    public
    view
    returns (uint256)
  {
    return _dust[address(payToken)];
  }

  //return the best offer for a token pair
  //      the best offer is the lowest one if it's an ask,
  //      and highest one if it's a bid offer
  function getBestOffer(IERC20 sellToken, IERC20 buyToken) public view returns(uint256) {
    return _best[address(sellToken)][address(buyToken)];
  }

  //return the next worse offer in the sorted list
  //      the worse offer is the higher one if its an ask,
  //      a lower one if its a bid offer,
  //      and in both cases the newer one if they're equal.
  function getWorseOffer(uint256 id) public view returns(uint256) {
    return _rank[id].prev;
  }

  //return the next better offer in the sorted list
  //      the better offer is in the lower priced one if its an ask,
  //      the next higher priced one if its a bid offer
  //      and in both cases the older one if they're equal.
  function getBetterOffer(uint256 id) public view returns(uint256) {
    return _rank[id].next;
  }

  //return the amount of better offers for a token pair
  function getOfferCount(IERC20 sellToken, IERC20 buyToken) public view returns(uint256) {
    return _span[address(sellToken)][address(buyToken)];
  }

  //get the first unsorted offer that was inserted by a contract
  //      Contracts can't calculate the insertion position of their offer because it is not an O(1) operation.
  //      Their offers get put in the unsorted list of offers.
  //      Keepers can calculate the insertion position offchain and pass it to the insert() function to insert
  //      the unsorted offer into the sorted list. Unsorted offers will not be matched, but can be bought with buy().
  function getFirstUnsortedOffer() public view returns(uint256) {
    return _head;
  }

  //get the next unsorted offer
  //      Can be used to cycle through all the unsorted offers.
  function getNextUnsortedOffer(uint256 id) public view returns(uint256) {
    return _near[id];
  }

  function isOfferSorted(uint256 id) public view returns(bool) {
    return _rank[id].next != 0 || 
      _rank[id].prev != 0 || 
      _best[address(offers[id].payToken)][address(offers[id].buyToken)] == id;
  }

  // solium-disable-next-line security/no-assign-params
  function sellAllAmount(
    IERC20 payToken, 
    uint256 payAmount, 
    IERC20 buyToken, 
    uint256 minFillAmount
  )
    public
    returns (uint256 fillAmount)
  {
    require(!locked, "EX00");
    uint256 offerId;
    while (payAmount > 0) {                           //while there is amount to sell
      offerId = getBestOffer(buyToken, payToken);   //Get the best offer for the token pair
      require(offerId != 0, "EX14");                      //Fails if there are not more offers

      // There is a chance that payAmount is smaller than 1 wei of the other token
      if (payAmount * 1 ether < wdiv(offers[offerId].buyAmount, offers[offerId].payAmount)) {
        break;                                  //We consider that all amount is sold
      }
      if (payAmount >= offers[offerId].buyAmount) { 
        //If amount to sell is higher or equal than current offer amount to buy
        fillAmount = add(fillAmount, offers[offerId].payAmount);          //Add amount bought to acumulator
        payAmount = sub(payAmount, offers[offerId].buyAmount);            //Decrease amount to sell
        take(bytes32(offerId), uint128(offers[offerId].payAmount));   //We take the whole offer
      } else { 
        // if lower
        uint256 baux = rmul(payAmount * 10 ** 9, rdiv(offers[offerId].payAmount, offers[offerId].buyAmount)) / 10 ** 9;
        fillAmount = add(fillAmount, baux);         //Add amount bought to acumulator
        take(bytes32(offerId), uint128(baux));  //We take the portion of the offer that we need
        payAmount = 0;                            //All amount is sold
      }
    }
    require(fillAmount >= minFillAmount, "EX15");
  }

  // solium-disable-next-line security/no-assign-params
  function buyAllAmount(
    IERC20 buyToken, 
    uint256 buyAmount, 
    IERC20 payToken, 
    uint256 maxFillAmount
  )
    public
    returns (uint256 fillAmount)
  {
    require(!locked, "EX00");
    uint offerId;
    while (buyAmount > 0) {                           //Meanwhile there is amount to buy
      offerId = getBestOffer(buyToken, payToken);   //Get the best offer for the token pair
      require(offerId != 0, "EX14");

      // There is a chance that buyAmount is smaller than 1 wei of the other token
      if (buyAmount * 1 ether < wdiv(offers[offerId].payAmount, offers[offerId].buyAmount)) {
        break;                                  //We consider that all amount is sold
      }
      if (buyAmount >= offers[offerId].payAmount) {  
        //If amount to buy is higher or equal than current offer amount to sell
        fillAmount = add(fillAmount, offers[offerId].buyAmount);          //Add amount sold to acumulator
        buyAmount = sub(buyAmount, offers[offerId].payAmount);            //Decrease amount to buy
        take(bytes32(offerId), uint128(offers[offerId].payAmount));   //We take the whole offer
      } else {                                                        
        //if lower
        fillAmount = add(fillAmount, rmul(buyAmount * 10 ** 9, rdiv(offers[offerId].buyAmount, offers[offerId].payAmount)) / 10 ** 9); //Add amount sold to acumulator
        take(bytes32(offerId), uint128(buyAmount));                   //We take the portion of the offer that we need
        buyAmount = 0;                                                //All amount is bought
      }
    }
    require(fillAmount <= maxFillAmount, "EX15");
  }

  // solium-disable-next-line security/no-assign-params
  function getBuyAmount(
    IERC20 buyToken, 
    IERC20 payToken, 
    uint256 payAmount
  )
    public view 
    returns (uint256 fillAmount) 
  {
    uint256 offerId = getBestOffer(buyToken, payToken);           //Get best offer for the token pair
    while (payAmount > offers[offerId].buyAmount) {
      fillAmount = add(fillAmount, offers[offerId].payAmount);  //Add amount to buy accumulator
      payAmount = sub(payAmount, offers[offerId].buyAmount);    //Decrease amount to pay
      if (payAmount > 0) {                                  //If we still need more offers
        offerId = getWorseOffer(offerId);               //We look for the next best offer
        require(offerId != 0, "EX14");                  //Fails if there are not enough offers to complete
      }
    }
    //Add proportional amount of last offer to buy accumulator
    fillAmount = add(
      fillAmount, 
      rmul(
        payAmount * 10 ** 9, 
        rdiv(offers[offerId].payAmount, offers[offerId].buyAmount)
      ) / 10 ** 9
    ); 
  }

  // solium-disable-next-line security/no-assign-params
  function getPayAmount(
    IERC20 payToken, 
    IERC20 buyToken, 
    uint256 buyAmount
  ) 
    public view 
    returns (uint256 fillAmount) 
  {
    uint256 offerId = getBestOffer(buyToken, payToken);           //Get best offer for the token pair
    while (buyAmount > offers[offerId].payAmount) {
      fillAmount = add(fillAmount, offers[offerId].buyAmount);  //Add amount to pay accumulator
      buyAmount = sub(buyAmount, offers[offerId].payAmount);    //Decrease amount to buy
      if (buyAmount > 0) {                                  //If we still need more offers
        offerId = getWorseOffer(offerId);               //We look for the next best offer
        require(offerId != 0, "EX14");                          //Fails if there are not enough offers to complete
      }
    }
    //Add proportional amount of last offer to pay accumulator
    fillAmount = add(
      fillAmount, 
      rmul(
        buyAmount * 10 ** 9,
        rdiv(offers[offerId].buyAmount, offers[offerId].payAmount)
      ) / 10 ** 9
    );
  }

  // ---- Internal Functions ---- //

  function _lock() internal {
    locked = true;
  }

  function _unlock() internal {
    locked = false;
  }

  function _offer(
    uint256 payAmount, 
    IERC20 payToken, 
    uint256 buyAmount, 
    IERC20 buyToken
  )
    internal
    returns (uint256 id)
  {
    _lock();

    OfferInfo memory info;
    info.payAmount = payAmount;
    info.payToken = payToken;
    info.buyAmount = buyAmount;
    info.buyToken = buyToken;
    info.owner = _msgSender();
    // solium-disable-next-line security/no-block-members
    info.timestamp = now;
    id = _nextId();
    offers[id] = info;

    require(payToken.transferFrom(_msgSender(), address(this), payAmount), "EX21");

    emit ItemUpdated(id);
    emit OrderMade(
      bytes32(id),
      keccak256(abi.encodePacked(payToken, buyToken)),
      _msgSender(),
      payToken,
      buyToken,
      payAmount,
      buyAmount,
      info.timestamp
    );

    _unlock();
  }

  function _buy(uint256 id, uint256 quantity)
    internal
    canBuy(id)
    returns (bool)
  {
    if (quantity == offers[id].payAmount) {
      if(isOfferSorted(id)) {
        //offers[id] must be removed from sorted list because all of it is bought
        _unsort(id);
      } else {
        _hide(id);
      }
    }

    OfferInfo memory currentOffer = offers[id];
    uint256 spend = mul(quantity, currentOffer.buyAmount) / currentOffer.payAmount;

    // For backwards semantic compatibility.
    if (quantity == 0 || spend == 0 ||
        quantity > currentOffer.payAmount || spend > currentOffer.buyAmount)
    {
      return false;
    }

    _lock();
    offers[id].payAmount = sub(currentOffer.payAmount, quantity);
    offers[id].buyAmount = sub(currentOffer.buyAmount, spend);
    require(currentOffer.buyToken.transferFrom(_msgSender(), currentOffer.owner, spend), "EX23");
    require(currentOffer.payToken.transfer(_msgSender(), quantity), "EX24");

    emit ItemUpdated(id);
    emit OrderTaken(
      bytes32(id),
      keccak256(abi.encodePacked(currentOffer.payToken, currentOffer.buyToken)),
      currentOffer.owner,
      currentOffer.payToken,
      currentOffer.buyToken,
      _msgSender(),
      quantity,
      spend,
      // solium-disable-next-line security/no-block-members
      now
    );
    emit OrderTraded(
      quantity, 
      currentOffer.payToken, 
      spend, 
      currentOffer.buyToken
    );

    if (offers[id].payAmount == 0) {
      delete offers[id];
    }

    _unlock();

    // If offer has become dust during buy, we cancel it
    if (isActive(id) && offers[id].payAmount < _dust[address(offers[id].payToken)]) {
      dustId = id; //enable current _msgSender() to call cancel(id)
      cancel(id);
    }

    return true;
  }

  function _cancel(uint256 id)
    internal
    canCancel(id)
    returns (bool success)
  {
    // read-only currentOffer. Modify an offer by directly accessing offers[id]
    _lock();
    OfferInfo memory currentOffer = offers[id];
    delete offers[id];

    require(currentOffer.payToken.transfer(currentOffer.owner, currentOffer.payAmount), "EX25");
    _unlock();

    emit ItemUpdated(id);
    emit OrderKilled(
      bytes32(id),
      keccak256(abi.encodePacked(currentOffer.payToken, currentOffer.buyToken)),
      currentOffer.owner,
      currentOffer.payToken,
      currentOffer.buyToken,
      currentOffer.payAmount,
      currentOffer.buyAmount,
      // solium-disable-next-line security/no-block-members
      now
    );

    success = true;
  }

  function _nextId()
    internal
    returns (uint256)
  {
    lastOfferId++; 
    return lastOfferId;
  }

  //find the id of the next higher offer after offers[id]
  function _find(uint256 id)
    internal
    view
    returns (uint256)
  {
    require(id > 0, "EX26");

    address buyToken = address(offers[id].buyToken);
    address payToken = address(offers[id].payToken);
    uint256 top = _best[payToken][buyToken];
    uint256 oldTop = 0;

    // Find the larger-than-id order whose successor is less-than-id.
    while (top != 0 && _isPricedLtOrEq(id, top)) {
      oldTop = top;
      top = _rank[top].prev;
    }
    return oldTop;
  }

  //find the id of the next higher offer after offers[id]
  function _findpos(uint256 id, uint256 pos)
    internal
    view
    returns (uint)
  {
    require(id > 0, "EX26");
    uint256 _pos = pos;

    // Look for an active order.
    while (_pos != 0 && !isActive(_pos)) {
      _pos = _rank[_pos].prev;
    }

    if (_pos == 0) {
        //if we got to the end of list without a single active offer
      return _find(id);

    } else {
        // if we did find a nearby active offer
        // Walk the order book down from there...
      if (_isPricedLtOrEq(id, _pos)) {
        uint oldPos;

        // Guaranteed to run at least once because of
        // the prior if statements.
        while (_pos != 0 && _isPricedLtOrEq(id, _pos)) {
          oldPos = _pos;
          _pos = _rank[_pos].prev;
        }
        return oldPos;
      // ...or walk it up.
      } else {
        while (_pos != 0 && !_isPricedLtOrEq(id, _pos)) {
          _pos = _rank[_pos].next;
        }
        return _pos;
      }
    }
  }

  //return true if offers[low] priced less than or equal to offers[high]
  function _isPricedLtOrEq(
    uint low,   //lower priced offer's id
    uint high   //higher priced offer's id
  )
      internal
      view
      returns (bool)
  {
    return mul(offers[low].buyAmount, offers[high].payAmount) >= mul(offers[high].buyAmount, offers[low].payAmount);
  }

  //these variables are global only because of solidity local variable limit

  //match offers with taker offer, and execute token transactions
  // solium-disable-next-line security/no-assign-params
  function _matchOrder(
    uint256 takerPayAmount,    //taker sell how much
    IERC20 takerPayToken,   //taker sell which token
    uint256 takerBuyAmount,    //taker buy how much
    IERC20 takerBuyToken,   //taker buy which token
    uint256 pos,          //position id
    bool rounding      //match "close enough" orders?
  )
    internal
    returns (uint256 id)
  {
    uint256 bestMakerId;    //highest maker id
    uint256 takerBuyAmountOld;    //taker buy how much saved
    uint256 makerBuyAmount;        //maker offer wants to buy this much token
    uint256 makerPayAmount;        //maker offer wants to sell this much token

    require(takerPayToken != IERC20(0x0), "EX17");
    require(takerBuyToken != IERC20(0x0), "EX19");
    require(takerPayToken != takerBuyToken, "EX20");
    require(_dust[address(takerPayToken)] < takerPayAmount, "EX16");
    require(_dust[address(takerBuyToken)] < takerBuyAmount, "EX18");

    // there is at least one offer stored for token pair
    while (_best[address(takerBuyToken)][address(takerPayToken)] > 0) {
      bestMakerId = _best[address(takerBuyToken)][address(takerPayToken)];
      makerBuyAmount = offers[bestMakerId].buyAmount;
      makerPayAmount = offers[bestMakerId].payAmount;

      // Ugly hack to work around rounding errors. Based on the idea that
      // the furthest the amounts can stray from their "true" values is 1.
      // Ergo the worst case has takerPayAmount and makerPayAmount at +1 away from
      // their "correct" values and makerBuyAmount and takerBuyAmount at -1.
      // Since (c - 1) * (d - 1) > (a + 1) * (b + 1) is equivalent to
      // c * d > a * b + a + b + c + d, we write...
      if (mul(makerBuyAmount, takerBuyAmount) > mul(takerPayAmount, makerPayAmount) +
          (rounding ? makerBuyAmount + takerBuyAmount + takerPayAmount + makerPayAmount : 0))
      {
        break;
      }
      // ^ The `rounding` parameter is a compromise borne of a couple days
      // of discussion.
      buy(bestMakerId, min(makerPayAmount, takerBuyAmount));
      takerBuyAmountOld = takerBuyAmount;
      takerBuyAmount = sub(takerBuyAmount, min(makerPayAmount, takerBuyAmount));
      takerPayAmount = mul(takerBuyAmount, takerPayAmount) / takerBuyAmountOld;

      if (takerPayAmount == 0 || takerBuyAmount == 0) {
        break;
      }
    }

    if (takerBuyAmount > 0 && takerPayAmount > 0 && takerPayAmount >= _dust[address(takerPayToken)]) {
      //new offer should be created
      id = _offer(
        takerPayAmount, 
        takerPayToken, 
        takerBuyAmount, 
        takerBuyToken
      );
      //insert offer into the sorted list
      _sort(id, pos);
    }
  }

  // Make a new offer without putting it in the sorted list.
  // Takes funds from the caller into market escrow.
  // ****Available to authorized contracts only!**********
  // Keepers should call insert(id,pos) to put offer in the sorted list.
  function _offerUnsorted(
    uint256 payAmount,      //maker (ask) sell how much
    IERC20 payToken,     //maker (ask) sell which token
    uint256 buyAmount,      //maker (ask) buy how much
    IERC20 buyToken      //maker (ask) buy which token
  )
    internal
    returns (uint256 id)
  {
    require(payToken != IERC20(0x0), "EX17");
    require(buyToken != IERC20(0x0), "EX19");
    require(payToken != buyToken, "EX20");
    require(_dust[address(payToken)] < payAmount, "EX16");
    require(_dust[address(buyToken)] < buyAmount, "EX18");
    id = _offer(
      payAmount, 
      payToken, 
      buyAmount, 
      buyToken
    );
    _near[id] = _head;
    _head = id;
    emit UnsortedOffer(id);
  }

  //put offer into the sorted list
  function _sort(
    uint256 id,    //maker (ask) id
    uint256 pos    //position to insert into
  )
    internal
  {
    require(isActive(id), "EX01");

    address buyToken = address(offers[id].buyToken);
    address payToken = address(offers[id].payToken);
    uint256 prevId;                                      //maker (ask) id
    uint256 _pos = pos;

    _pos = _pos == 0 || address(offers[_pos].payToken) != address(payToken) || address(offers[_pos].buyToken) != address(buyToken) || !isOfferSorted(_pos)
    ?
      _find(id)
    :
      _findpos(id, _pos);

    if (_pos != 0) {                                    //offers[id] is not the highest offer
      prevId = _rank[_pos].prev;
      _rank[_pos].prev = id;
      _rank[id].next = _pos;
    } else {                                           //offers[id] is the highest offer
      prevId = _best[payToken][buyToken];
      _best[payToken][buyToken] = id;
    }

    if (prevId != 0) {                               //if lower offer does exist
      _rank[prevId].next = id;
      _rank[id].prev = prevId;
    }

    _span[payToken][buyToken]++;
    emit SortedOffer(id);
  }

  // Remove offer from the sorted list (does not cancel offer)
  function _unsort(
    uint256 id    //id of maker (ask) offer to remove from sorted list
  )
    internal
    returns (bool)
  {
    address buyToken = address(offers[id].buyToken);
    address payToken = address(offers[id].payToken);
    require(_span[payToken][buyToken] > 0, "EX27");

    require(_rank[id].delb == 0 && isOfferSorted(id), "EX28");        //assert id is in the sorted list

    if (id != _best[payToken][buyToken]) {              // offers[id] is not the highest offer
      require(_rank[_rank[id].next].prev == id, "EX29");
      _rank[_rank[id].next].prev = _rank[id].prev;
    } else {                                          //offers[id] is the highest offer
      _best[payToken][buyToken] = _rank[id].prev;
    }

    if (_rank[id].prev != 0) {                        //offers[id] is not the lowest offer
      require(_rank[_rank[id].prev].next == id, "EX29");
      _rank[_rank[id].prev].next = _rank[id].next;
    }

    _span[payToken][buyToken]--;
    _rank[id].delb = block.number;                    //mark _rank[id] for deletion
    return true;
  }

  //Hide offer from the unsorted order book (does not cancel offer)
  function _hide(
    uint256 id     //id of maker offer to remove from unsorted list
  )
    internal
    returns (bool)
  {
    uint256 uid = _head;               //id of an offer in unsorted offers list
    uint256 pre = uid;                 //id of previous offer in unsorted offers list

    require(!isOfferSorted(id), "EX30");    //make sure offer id is not in sorted offers list

    if (_head == id) {              //check if offer is first offer in unsorted offers list
      _head = _near[id];          //set head to new first unsorted offer
      _near[id] = 0;              //delete order from unsorted order list
      return true;
    }
    while (uid > 0 && uid != id) {  //find offer in unsorted order list
      pre = uid;
      uid = _near[uid];
    }
    if (uid != id) {                //did not find offer id in unsorted offers list
      return false;
    }
    _near[pre] = _near[id];         //set previous unsorted offer to point to offer after offer id
    _near[id] = 0;                  //delete order from unsorted order list
    return true;
  }
}
