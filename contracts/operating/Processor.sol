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
import "../interfaces/IProcessor.sol";
import "../interfaces/IRule.sol";
import "../interfaces/IRuleEngine.sol";
import "../interfaces/IOwnable.sol";
import "../interfaces/ISeizable.sol";
import "../interfaces/ISuppliable.sol";
import "../interfaces/IRulable.sol";
import "../token/abstract/BridgeERC20.sol";

import "../access/Operator.sol";

/**
 * @title Processor
 * @dev The Processor orchestrate most of the operations on each token
 *
 * Error messages
 * TR01: Token already registered
 * TR02: Empty name
 * TR03: Empty symbol
 * ER01: Cannot send tokens to 0x0
 * ER02: Owner cannot be 0x0
 * ER03: Spender cannot be 0x0
 * RU03: Rule Engine rejected the transfer
 * SE01: Cannot seize from 0x0
 * SE02: Caller does not have the seizer role
 * MT01: Cannot mint to 0x0
 * MT03: Cannot redeem from 0x0
 * SU01: Caller does not have the supplier role
**/


contract Processor is Initializable, IProcessor, Operator {
  using SafeMath for uint256;

  uint256 public constant VERSION = 1;

  uint256 internal constant TRANSFER_INVALID = 0;
  uint256 internal constant TRANSFER_VALID_WITH_NO_HOOK = 1;
  uint256 internal constant TRANSFER_VALID_WITH_BEFORE_HOOK = 2;
  uint256 internal constant TRANSFER_VALID_WITH_AFTER_HOOK = 3;

  struct TokenData {
    string name;
    string symbol;
    uint8 decimals;
    mapping(address => uint256) balances;
    mapping (address => mapping (address => uint256)) allowed;
    uint256 totalSupply;
  }

  mapping(address => TokenData) _tokens;

  IRuleEngine public ruleEngine;

  /**
  * @dev Initializer (replaces constructor when contract is upgradable)
  * @param owner the final owner of the contract
  * @param _ruleEngine the rule engine library used by this processor
  */
  function initialize(address owner, IRuleEngine _ruleEngine) public initializer {
    Operator.initialize(owner);
    ruleEngine = _ruleEngine;
  }

  /**
  * @dev Set the rule engine library used by this processor
  * @param _ruleEngine the rule engine library used by this processor
  */
  function setRuleEngine(
    IRuleEngine _ruleEngine
  ) 
    public onlyOperator
  {
    ruleEngine = _ruleEngine;
  }

  /**
  * @dev Registers a token with this processor
  * @dev Intended to be called by the token contract itself when initialized
  * @dev name, symbol and decimals are immutable
  * @dev Throws TR01 if the token is already registered with this processor
  * @dev Throws TR02 if the token name is empty
  * @dev Throws TR03 if the token symbol is empty
  * @param _name The token's name
  * @param _symbol The token's symbol
  * @param _decimals The token's number of decimals
  */
  function register(string calldata _name, string calldata _symbol, uint8 _decimals) external override {
    require(keccak256(abi.encodePacked(_name)) != keccak256(""), "TR02");
    require(keccak256(abi.encodePacked(_symbol)) != keccak256(""), "TR03");
    require(keccak256(abi.encodePacked(_tokens[_msgSender()].name)) == keccak256(""), "TR01");
    _tokens[_msgSender()].name = _name;
    _tokens[_msgSender()].symbol = _symbol;
    _tokens[_msgSender()].decimals = _decimals;
  }

  /* ERC20 */
  /**
  * @dev Returns the name of the token
  * @dev Intended to be called by the token contract
  * @return name The name of the token
  */
  function name() public override view returns (string memory) {
    return _tokens[_msgSender()].name;
  }

  /**
  * @dev Returns the symbol of the token
  * @dev Intended to be called by the token contract
  * @return symbol The symbol of the token
  */
  function symbol() public override view returns (string memory) {
    return _tokens[_msgSender()].symbol;
  }

  /**
  * @dev Returns the decimals of the token
  * @dev Intended to be called by the token contract
  * @dev For example, if `decimals` equals `2`, a balance of `505` tokens should
  * be displayed to a user as `5,05` (`505 / 10 ** 2`).
  * @return decimals The decimals of the token
  */
  function decimals() public override view returns (uint8) {
    return _tokens[_msgSender()].decimals;
  }

  /**
  * @dev Returns the total supply of the token
  * @dev Intended to be called by the token contract
  * @return totalSupply The total supply of the token
  */
  function totalSupply() public override view returns (uint256) {
    return _tokens[_msgSender()].totalSupply;
  }

  /**
  * @dev Returns the token balance for the address given in parameter
  * @dev Intended to be called by the token contract
  * @param _owner The address for which the balance has to be retrieved
  * @return balance The token balance for the address given in parameter
  */
  function balanceOf(address _owner) public override view returns (uint256) {
    return _tokens[_msgSender()].balances[_owner];
  }

  /**
  * @dev Determines whether a specific amount of tokens can be transfered from an address to another
  * @dev Intended to be called by the token contract
  * @param _from The sender of the tokens
  * @param _to The receiver of the tokens
  * @param _amount The amount of tokens to transfer
  * @return isValid True if the transfer is valid, false otherwise
  * @return ruleId The ruleId that first rejected the transfer
  * @return reason The reason code for the transfer rejection
  */
  function canTransfer(address _from, address _to, uint256 _amount) public override view returns (bool, uint256, uint256) {
    uint256[] memory rulesParams;
    uint256[] memory ruleIds;
    (ruleIds, rulesParams) = IRulable(_msgSender()).rules();
    return ruleEngine.validateTransferWithRules(
      ruleIds, 
      rulesParams, 
      _msgSender(),
      _from, 
      _to, 
      _amount
    );
  }

  /**
  * @dev Transfer a specific amount of tokens from an address to another
  * @dev Intended to be called by the token contract
  * @dev The receiver address and the amount can be updated by the token enforced rules
  * @dev Throws ER01 if receiver address is 0x0
  * @dev Throws RU03 if one of the rule rejects the transfer
  * @param _from The sender of the tokens
  * @param _to The intended receiver of the tokens
  * @param _value The intended amount of tokens to send
  * @return isSuccessful True if the transfer is successful, false otherwise
  * @return updatedTo The real address the tokens were sent to
  * @return updatedValue The real amount of tokens sent
  */
  function transferFrom(address _from, address _to, uint256 _value) 
    public override returns (bool, address updatedTo, uint256 updatedValue) 
  {
    require(_to != address(0), "ER01");
    uint256[] memory rulesParams;
    uint256[] memory ruleIds;
    uint256 i;
    (ruleIds, rulesParams) = IRulable(_msgSender()).rules();
    IRule[] memory rules = ruleEngine.rules(ruleIds);
    uint256[] memory ruleValid = new uint256[](ruleIds.length);
    /* Transfer check */
    for (i = 0; i < rules.length; i++) {
      (ruleValid[i], ) = rules[i].isTransferValid(
        _msgSender(), _from, _to, _value, rulesParams[i]);
      require(ruleValid[i] > TRANSFER_INVALID, "RU03");
    }
    /* Before transfer hook execution if needed */
    for (i = 0; i < rules.length; i++) {
      if (ruleValid[i] == TRANSFER_VALID_WITH_BEFORE_HOOK) {
        (ruleValid[i], _to, _value) = rules[i].beforeTransferHook(
          _msgSender(), _from, _to, _value, rulesParams[i]);
        require(ruleValid[i] > TRANSFER_INVALID, "RU03");
      }
    }
    /* Update */
    _subBalance(_from, _value);
    _addBalance(_to, _value);
    /* After transfer hook execution if needed */
    for (i = 0; i < rules.length; i++) {
      if (ruleValid[i] == TRANSFER_VALID_WITH_AFTER_HOOK) {
        rules[i].afterTransferHook(
          _msgSender(), _from, _to, _value, rulesParams[i]);
      }
    }
    return (true, _to, _value);
  }

  /**
  * @dev Approves a specific amount of tokens to be spent by a spender from an address
  * @dev Intended to be called by the token contract
  * @dev Throws ER02 if owner address is 0x0
  * @dev Throws ER03 if spender address is 0x0
  * @param _owner The owner of the tokens to be allowed for spending
  * @param _spender The spender address to allow
  * @param _value The maximum amount of tokens that can be allowed for spending
  */
  function approve(address _owner, address _spender, uint256 _value) public override {
    require(_owner != address(0), "ER02");
    require(_spender != address(0), "ER03");

    _setAllowance(_owner, _spender, _value);
  }

  /**
  * @dev Returns the amount of tokens that are allowed to be spent by a spender from an address
  * @dev Intended to be called by the token contract
  * @param _owner The owner of the tokens to be spent
  * @param _spender The spender for which we want the allowed amount
  * @return The amount of tokens that can be spent by the spender from the owning address
  */
  function allowance(address _owner, address _spender) public override view returns (uint256) {
    return _tokens[_msgSender()].allowed[_owner][_spender];
  }

  /**
  * @dev Increases the spending approval of tokens to be spent by a spender from an address by a specific amount
  * @dev Intended to be called by the token contract
  * @dev Throws ER02 if owner address is 0x0
  * @dev Throws ER03 if spender address is 0x0
  * @param _owner The owner of the tokens to be allowed for spending
  * @param _spender The spender address to allow
  * @param _addedValue The number of tokens for the approval increase
  */
  function increaseApproval(address _owner, address _spender, uint _addedValue) public override {
    require(_owner != address(0), "ER02");
    require(_spender != address(0), "ER03");
    _setAllowance(_owner, _spender, _tokens[_msgSender()].allowed[_owner][_spender].add(_addedValue));
  }

  /**
  * @dev Decreases the spending approval of tokens to be spent by a spender from an address by a specific amount
  * @dev Intended to be called by the token contract
  * @dev Throws ER02 if owner address is 0x0
  * @dev Throws ER03 if spender address is 0x0
  * @param _owner The owner of the tokens to be allowed for spending
  * @param _spender The spender address to allow
  * @param _subtractedValue The number of tokens for the approval decrease
  */
  function decreaseApproval(address _owner, address _spender, uint _subtractedValue) public override {
    require(_owner != address(0), "ER02");
    require(_spender != address(0), "ER03");
    _setAllowance(_owner, _spender, _tokens[_msgSender()].allowed[_owner][_spender].sub(_subtractedValue));
  }

  /* Seizable */
  /**
  * @dev Seizes a specific amount of tokens from an address and transfers it to the caller address
  * @dev Intended to be called by the token contract
  * @dev Throws SE01 if the address for seize is 0x0
  * @dev Throws SE02 if the caller does not have the `Seizer` role
  * @param _caller The address that wants to seize the tokens
  * @param _account The address from which the tokens will be seized
  * @param _value The amount of tokens to seize
  */
  function seize(address _caller, address _account, uint256 _value) public override {
    require(_account != address(0), "SE01"); 
    require(ISeizable(_msgSender()).isSeizer(_caller), "SE02");
    _subBalance(_account, _value);
    _addBalance(_caller, _value);
  }

  /* Mintable */
  /**
  * @dev Mints a specific amount of tokens to an address
  * @dev Intended to be called by the token contract
  * @dev Throws SU01 if the caller does not have the `Supplier` role
  * @param _caller The address that wants to mint tokens
  * @param _to The address on which the tokens will be minted
  * @param _amount The amount of tokens to mint
  */
  function mint(address _caller, address _to, uint256 _amount) public override {
    require(_to != address(0), "MT01");
    require(ISuppliable(_msgSender()).isSupplier(_caller), "SU01");
    _tokens[_msgSender()].totalSupply = _tokens[_msgSender()].totalSupply.add(_amount);
    _addBalance(_to, _amount);
  }

  /**
  * @dev Burns a specific amount of tokens to an address
  * @dev Intended to be called by the token contract
  * @dev Throws SU01 if the caller does not have the `Supplier` role
  * @param _caller The address that wants to burn tokens
  * @param _from The address from which the tokens will be burnt
  * @param _amount The amount of tokens to burn
  */
  function burn(address _caller, address _from, uint256 _amount) public override {
    require(_from != address(0), "MT03");
    require(ISuppliable(_msgSender()).isSupplier(_caller), "SU01");
    _tokens[_msgSender()].totalSupply = _tokens[_msgSender()].totalSupply.sub(_amount);
    _subBalance(_from, _amount);
  }

  /* Internals */
  /**
  * @dev Adds a specific amount of tokens to an address balance
  * @dev Intended to be called by the token contract
  * @param _owner The address on which the amount will be added
  * @param _value The amount fo tokens to add
  */
  function _addBalance(address _owner, uint256 _value) internal {
    _tokens[_msgSender()].balances[_owner] = _tokens[_msgSender()].balances[_owner].add(_value);
  }

  /**
  * @dev Removes a specific amount of tokens to an address balance
  * @dev Intended to be called by the token contract
  * @param _owner The address from which the amount will be removed
  * @param _value The amount fo tokens to remove
  */
  function _subBalance(address _owner, uint256 _value) internal {
    _tokens[_msgSender()].balances[_owner] = _tokens[_msgSender()].balances[_owner].sub(_value);
  }

  /**
  * @dev Sets the number of tokens that are allowed to be spent by the spender from the owner address
  * @dev Intended to be called by the token contract
  * @param _owner The owner of the tokens to be allowed for spending
  * @param _spender The spender address to allow
  * @param _value The maximum amount of tokens that can be allowed for spending
  */
  function _setAllowance(address _owner, address _spender, uint256 _value) internal {
    _tokens[_msgSender()].allowed[_owner][_spender] = _value;
  }
}