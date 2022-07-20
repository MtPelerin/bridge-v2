#include "../access/Roles.ligo"
#include "../common/Utils.ligo"
#include "../common/Keys.ligo"
#include "../common/Types.ligo"

type mintParam is record
  amount_: nat;
  to_: address;
end;

type burnSeizeParam is record
  amount_: nat;
  from_: address;
end;

type canTransferParam is record
  amount_: nat;
  callbackAddress_: address;
  from_: address;
  to_: address;
end;

type setBoardResolutionDocumentParam is record
  boardResolutionDocumentHash_: bytes;
  boardResolutionDocumentUrl_: string;
end;

type getAllowanceParam is record
  callback_: contract(nat);
  owner_: address;
  spender_: address;
end;

type approveParam is record
  amount_: nat;
  spender_: address;
end;

type setPricesParam is record
  currencies_: list(string);
  decimals_: list(nat);
  prices_: list(nat);
end;

type setPriceParam is record
  currency_: string;
  decimal_: nat;
  price_: nat;
end;

type getPriceParam is record
  callback_: contract((nat * nat));
  currency_: string;
end;

type getPriceLastUpdatedParam is record
  callback_: contract(timestamp);
  currency_: string;
end;

type convertToParam is record
  amount_: nat;
  callback_: contract(nat);
  currency_: string;
  maxDecimals_: nat;
end;

type entry_action is 
 | TransferOwnership of address
 | RevokeOwnership
 | IsAdministrator of isRoleParam
 | AddAdministrator of address
 | RemoveAdministrator of address
 | IsRealmAdministrator of isRoleParam
 | AddRealmAdministrator of address
 | RemoveRealmAdministrator of address
 | IsSupplier of isRoleParam
 | AddSupplier of address
 | RemoveSupplier of address
 | IsSeizer of isRoleParam
 | AddSeizer of address
 | RemoveSeizer of address
 | Mint of mintParam
 | Burn of burnSeizeParam
 | Seize of burnSeizeParam
 | Rules of contract(list(rule))
 | SetRules of list(rule)
 | CanTransfer of canTransferParam
 | CanTransferIsTransferValidCb of isTransferValidResponse
 | SetRealm of address
 | SetRealmIsRealmAdministratorCb of bool
 | SetTrustedIntermediaries of list(address)
 | SetRuleEngine of address
 | SetTokenizedSharePercentage of nat
 | SetBoardResolutionDocument of setBoardResolutionDocumentParam
 | SetContact of string
 | Name of contract(string)
 | Symbol of contract(string)
 | Decimals of contract(nat)
 | GetTotalSupply of contract(nat)
 | Transfer of transfer
 | TransferIsTransferValidCb of isTransferValidResponse
 | TransferBeforeTransferHookCb of isTransferValidResponse
 | Approve of approveParam
 | GetBalance of getBalanceParam
 | GetAllowance of getAllowanceParam
 | IncreaseApproval of approveParam
 | DecreaseApproval of approveParam
 | SetPrices of setPricesParam
 | SetPrice of setPriceParam
 | GetPrice of getPriceParam
 | GetPriceLastUpdated of getPriceLastUpdatedParam
 | ConvertTo of convertToParam

type balance_map is map(address, nat);
type allowance_map is big_map(bytes, nat);

type internal_transfer_callback_state is transfer;

type price is record
  price: nat;
  decimals: nat;
  lastUpdated: timestamp;
end;

const default_price = record [ price = 0n; decimals = 0n; lastUpdated = ("1970-01-01T00:00:00.000Z" : timestamp)];

type state is record
  owner: address;
  roles: roles;
  name: string;
  symbol: string;
  totalSupply: nat;
  balances: balance_map;
  allowances: allowance_map;
  rules: list(rule);
  trustedIntermediaries: list(address);
  realm: address;
  prices: big_map(string, price);
  ruleEngine: address;
  contact: string;
  tokenizedSharePercentage: nat;
  boardResolutionDocumentUrl: string;
  boardResolutionDocumentHash: bytes;
  tempRealm: address;
  decimals: nat;
end;

function _isRuleResponseValid(const ruleResponses_: map(int, ruleResponse)): bool is 
  block {
    function responseIterator(var acc: bool; const ruleResponse_ : (int * ruleResponse)) : bool is acc and (ruleResponse_.1.reason_ = 0);
    const isValid_ = Map.fold(responseIterator, ruleResponses_, True);
  } with (isValid_)
  
function _allowance(const self: state; const owner_: address; const spender_: address) : nat is 
  block {
    const addressKey_: bytes = _keyWithAddress(owner_, spender_);
    const allowance_ : nat = case self.allowances[addressKey_] of | None -> 0n | Some(x) -> x end;
  } with (allowance_);

function _addBalance(var self: state; const owner_: address; const amount_: nat) : state is 
  block {
    const balance_ : nat = case self.balances[owner_] of | None -> 0n | Some(x) -> x end;
    self.balances[owner_] := balance_ + amount_;
  } with (self);

function _subBalance(var self: state; const owner_: address; const amount_: nat) : state is 
  block {
    const balance_ : nat = case self.balances[owner_] of | None -> 0n | Some(x) -> x end;
    require(balance_ >= amount_, "BA01");
    self.balances[owner_] := abs(balance_ - amount_);
  } with (self);

function _increaseApproval(var self: state; const owner_: address; const spender_: address; const addedValue_: nat) : state is
  block {
    const addressKey_: bytes = _keyWithAddress(owner_, spender_);
    const currentAllowance_: nat = case self.allowances[addressKey_] of | None -> 0n | Some(x) -> x end;
    self.allowances[addressKey_] := currentAllowance_ + addedValue_;
  } with (self);

function _decreaseApproval(var self: state; const owner_: address; const spender_: address; const subtractedValue_: nat) : state is
  block {
    const addressKey_: bytes = _keyWithAddress(owner_, spender_);
    const currentAllowance_: nat = case self.allowances[addressKey_] of | None -> 0n | Some(x) -> x end;
    self.allowances[addressKey_] := case is_nat(currentAllowance_ - subtractedValue_) of | None -> 0n | Some(x) -> x end;
  } with (self);

function _convertTo(const self: state; const amount_: nat; const currency_: string; const maxDecimals_: nat) : nat is 
  block {
    const price_ : price = case self.prices[currency_] of | None -> default_price | Some(x) -> x end;
    var xrate_: nat := price_.price;
    var xrateDecimals_ : nat := price_.decimals;
    var tokenDecimals_ : nat := self.decimals;
    var amountToConvert_ : nat := amount_;
    if xrateDecimals_ > maxDecimals_ then block {
      xrate_ := xrate_ / _pow(10n, abs(xrateDecimals_ - maxDecimals_), 1n);
      xrateDecimals_ := maxDecimals_
    } else skip;
    if tokenDecimals_ > maxDecimals_ then block {
      amountToConvert_ := amountToConvert_ / _pow(10n, abs(tokenDecimals_ - maxDecimals_), 1n);
      tokenDecimals_ := maxDecimals_;
    } else skip;
  } with (amountToConvert_ * xrate_ * _pow(10n, abs((2*maxDecimals_)-xrateDecimals_-tokenDecimals_), 1n));

function _realm(const self: state) : address is if self.realm = burn_address then Tezos.self_address else self.realm;

// Access control functions
function failIfNotOwner(const owner: address) : (unit) is
  block {
    require(owner = Tezos.sender, "OW01");
  } with (unit);

function transferOwnership (var self : state; const new_owner : address) : (list(operation) * state) is
  block {
    failIfNotOwner(self.owner);
    self.owner := new_owner;
  } with (noOperations, self);

function revokeOwnership (var self : state) : (list(operation) * state) is
  block {
    failIfNotOwner(self.owner);
    self.owner := burn_address;
  } with (noOperations, self);

// Administrator
function failIfSourceNotOwnerOrAdministrator(const self: state) : (unit) is
  block {
    require(self.owner = Tezos.source or ROLES.hasRole(self.roles, "administrator", Tezos.source), "AD01");
  } with (unit);

function failIfNotOwnerOrAdministrator(const self: state) : (unit) is
  block {
    require(self.owner = Tezos.sender or ROLES.hasRole(self.roles, "administrator", Tezos.sender), "AD01");
  } with (unit);

function isAdministrator (const self: state; const administrator_ : address; const callback : contract(bool)) : (list(operation) * state) is
  block {
    const value = ROLES.hasRole(self.roles, "administrator", administrator_);
    const op : operation = Tezos.transaction(value, 0tez, callback);
    const ops : list (operation) = list [op]
  } with (ops, self);

function addAdministrator (var self : state; const administrator_ : address) : (list(operation) * state) is
  block {
    failIfNotOwner(self.owner);
    self.roles := ROLES.addRole(self.roles, "administrator", administrator_);
  } with (noOperations, self);

function removeAdministrator (var self : state; const administrator_ : address) : (list(operation) * state) is
  block {
    failIfNotOwner(self.owner);
    self.roles := ROLES.removeRole(self.roles, "administrator", administrator_);
  } with (noOperations, self);

// RealmAdministrator
function isRealmAdministrator (const self: state; const realmAdministrator_ : address; const callback : contract(bool)) : (list(operation) * state) is
  block {
    const value = ROLES.hasRole(self.roles, "realmAdministrator", realmAdministrator_);
    const op : operation = Tezos.transaction(value, 0tez, callback);
    const ops : list (operation) = list [op]
  } with (ops, self);

function addRealmAdministrator (var self : state; const realmAdministrator_ : address) : (list(operation) * state) is
  block {
    failIfNotOwnerOrAdministrator(self);
    self.roles := ROLES.addRole(self.roles, "realmAdministrator", realmAdministrator_);
  } with (noOperations, self);

function removeRealmAdministrator (var self : state; const realmAdministrator_ : address) : (list(operation) * state) is
  block {
    failIfNotOwnerOrAdministrator(self);
    self.roles := ROLES.removeRole(self.roles, "realmAdministrator", realmAdministrator_);
  } with (noOperations, self);

// Supplier
function failIfNotSupplier(const self: state) : (unit) is
  block {
    require(ROLES.hasRole(self.roles, "supplier", Tezos.sender), "SU01");
  } with (unit);

function isSupplier (const self: state; const supplier_ : address; const callback : contract(bool)) : (list(operation) * state) is
  block {
    const value = ROLES.hasRole(self.roles, "supplier", supplier_);
    const op : operation = Tezos.transaction(value, 0tez, callback);
    const ops : list (operation) = list [op]
  } with (ops, self);

function addSupplier(var self : state; const supplier_ : address) : (list(operation) * state) is
  block {
    failIfNotOwnerOrAdministrator(self);
    self.roles := ROLES.addRole(self.roles, "supplier", supplier_);
  } with (noOperations, self);

function removeSupplier (var self : state; const supplier_ : address) : (list(operation) * state) is
  block {
    failIfNotOwnerOrAdministrator(self);
    self.roles := ROLES.removeRole(self.roles, "supplier", supplier_);
  } with (noOperations, self);

// Seizer
function failIfNotSeizer(const self: state) : (unit) is
  block {
    require(ROLES.hasRole(self.roles, "seizer", Tezos.sender), "SE02");
  } with (unit);

function isSeizer (const self: state; const seizer_ : address; const callback : contract(bool)) : (list(operation) * state) is
  block {
    const value = ROLES.hasRole(self.roles, "seizer", seizer_);
    const op : operation = Tezos.transaction(value, 0tez, callback);
    const ops : list (operation) = list [op]
  } with (ops, self);

function addSeizer (var self : state; const seizer_ : address) : (list(operation) * state) is
  block {
    failIfNotOwnerOrAdministrator(self);
    self.roles := ROLES.addRole(self.roles, "seizer", seizer_);
  } with (noOperations, self);

function removeSeizer (var self : state; const seizer_ : address) : (list(operation) * state) is
  block {
    failIfNotOwnerOrAdministrator(self);
    self.roles := ROLES.removeRole(self.roles, "seizer", seizer_);
  } with (noOperations, self);

function mint(var self: state; const to_: address; const amount_: nat) : (list(operation) * state) is
  block {
    require(to_ =/= burn_address, "MT01");
    failIfNotSupplier(self);
    self.totalSupply := self.totalSupply + amount_;
    self := _addBalance(self, to_, amount_);
  } with (noOperations, self);

function burn(var self: state; const from_: address; const amount_: nat) : (list(operation) * state) is
  block {
    require(from_ =/= burn_address, "MT03");
    failIfNotSupplier(self);
    require(self.totalSupply >= amount_, "TT01");
    self.totalSupply := abs(self.totalSupply - amount_);
    self := _subBalance(self, from_, amount_);
  } with(noOperations, self);

function seize(var self: state; const from_: address; const amount_: nat) : (list(operation) * state) is
  block {
    require(from_ =/= burn_address, "SE01");
    failIfNotSeizer(self);
    self := _subBalance(self, from_, amount_);
    self := _addBalance(self, Tezos.sender, amount_);
  } with (noOperations, self);

function rules(const self: state; const callback_: contract(list(rule))) : list(operation) is 
  block {
    const op : operation = Tezos.transaction(self.rules, 0tez, callback_);
    const ops : list (operation) = list [op]
  } with (ops);

function setRules(var self: state; const rules_: list(rule)) : (list(operation) * state) is
  block {
    failIfNotOwnerOrAdministrator(self);
    self.rules := rules_;
  } with (noOperations, self);

function canTransfer(const self: state; const from_: address; const to_: address; const amount_: nat; const callbackAddress_: address) : list(operation) is 
  block {
		const isTransferValidCall_ : contract(isTransferValidParam) = case (get_entrypoint_opt("%isTransferValid", self.ruleEngine) : option(contract(isTransferValidParam))) of | None -> failwith("RU03") | Some(x) -> x end;
		const isTransferValidParam_ : isTransferValidParam = record [
			amount_ = amount_;
      amountInRefCurrency_ = _convertTo(self, amount_, ref_currency, max_decimals);
      from_ = from_;
      realm_ = _realm(self);
      rules_ = self.rules;
      to_ = to_;
      token_ = Tezos.self_address;
      trustedIntermediaries_ = self.trustedIntermediaries;
      canTransferCallbackAddress_ = Some(callbackAddress_);
		];
		const op : operation = Tezos.transaction(isTransferValidParam_, 0tez, isTransferValidCall_);
    const ops : list (operation) = list [op];
  } with (ops);

function canTransferIsTransferValidCallback(const self: state; const ruleResponses_: map(int, ruleResponse); const callbackAddress_: option(address)) : list(operation) is 
  block {
    require(Tezos.sender = self.ruleEngine, "RU04");
    const callback_: contract(canTransferResponse) = case (get_entrypoint_opt("%canTransferCb", case callbackAddress_ of | None -> burn_address | Some(x) -> x end) : option(contract(canTransferResponse))) of | None -> failwith("RU04") | Some(x) -> x end;
    const isValid_ : bool = _isRuleResponseValid(ruleResponses_);
    var ruleResult : (int * int) := (0,0);
    if isValid_ = False then block {
      function ruleIterator (var acc: (int * int); const ruleResponse_: (int * ruleResponse)): (int * int) is 
        block {
          if (ruleResponse_.1.reason_ > 0) then acc := (ruleResponse_.1.ruleId_, ruleResponse_.1.reason_);
          else skip;
        } with (acc);
      ruleResult := Map.fold(ruleIterator, ruleResponses_, (0, 0));
    } else skip;
    const response_: canTransferResponse = record[isValid_ = isValid_; ruleId_ = ruleResult.0; reason_ = ruleResult.1];
		const op : operation = Tezos.transaction(response_, 0tez, callback_);
    const ops : list (operation) = list [op];
  } with (ops);

function setRealm(var self: state; const realm_: address; const selfCallback_: contract(bool)) : (list(operation) * state) is 
  block {
    failIfNotOwnerOrAdministrator(self);
    self.tempRealm := realm_;
  	const isRealmAdministratorCall_ : contract(isRoleParam) = case (get_entrypoint_opt("%isRealmAdministrator", realm_) : option(contract(isRoleParam))) of | None -> failwith("KI03") | Some(x) -> x end;
		const isRealmAdministratorParam_ : isRoleParam = record [
      address_ = Tezos.sender;
			callback_ = selfCallback_;
		];
    const op : operation = Tezos.transaction(isRealmAdministratorParam_, 0tez, isRealmAdministratorCall_);
    const ops : list (operation) = list [op];
  } with (ops, self);

function setRealmIsRealmAdministratorCallback(var self: state; const isRealmAdministrator_: bool): (list(operation) * state) is
  block {
    failIfSourceNotOwnerOrAdministrator(self);
    require(isRealmAdministrator_ = True, "KI01");
    require(self.tempRealm = Tezos.sender, "KI02");
    self.realm := Tezos.sender;
  } with (noOperations, self);

function setTrustedIntermediaries(var self: state; const trustedIntermediaries_: list(address)) : (list (operation) * state) is
  block {
    failIfNotOwnerOrAdministrator(self);
    self.trustedIntermediaries := trustedIntermediaries_;
  } with (noOperations, self);

function setRuleEngine(var self: state; const ruleEngine_: address) : (list(operation) * state) is
  block {
    failIfNotOwnerOrAdministrator(self);
    self.ruleEngine := ruleEngine_;
  } with (noOperations, self);

function setTokenizedSharePercentage(var self: state; const tokenizedSharePercentage_: nat): (list(operation) * state) is
  block {
    failIfNotOwnerOrAdministrator(self);
    self.tokenizedSharePercentage := tokenizedSharePercentage_;
  } with (noOperations, self);

function setBoardResolutionDocument(var self: state; const boardResolutionDocumentUrl_: string; const boardResolutionDocumentHash_: bytes): (list(operation) * state) is
  block {
    failIfNotOwnerOrAdministrator(self);
    self.boardResolutionDocumentUrl := boardResolutionDocumentUrl_;
    self.boardResolutionDocumentHash := boardResolutionDocumentHash_;
  } with (noOperations, self);

function setContact(var self: state; const contact_: string) : (list(operation) * state) is
  block {
    failIfNotOwnerOrAdministrator(self);
    self.contact := contact_;
  } with (noOperations, self);

function name(const self: state; const callback_: contract(string)) : list(operation) is
  block {
    const op : operation = Tezos.transaction(self.name, 0tez, callback_);
    const ops : list (operation) = list [op]
  } with (ops);

function symbol(const self: state; const callback_: contract(string)) : list(operation) is
  block {
    const op : operation = Tezos.transaction(self.symbol, 0tez, callback_);
    const ops : list (operation) = list [op]
  } with (ops);

function decimals(const self: state; const callback_: contract(nat)) : list(operation) is
  block {
    const op : operation = Tezos.transaction(self.decimals, 0tez, callback_);
    const ops : list (operation) = list [op];
  } with (ops)

function getTotalSupply(const self: state; const callback_: contract(nat)) : list(operation) is
  block {
    const op : operation = Tezos.transaction(self.totalSupply, 0tez, callback_);
    const ops : list (operation) = list [op]
  } with (ops);

function transfer(const self: state; const from_: address; const to_: address; const amount_: nat) : (list(operation) * state) is
  block {
    const isFromSender_ : bool = (Tezos.sender = from_);
    const allowance_ : nat = _allowance(self, from_, Tezos.sender);
    require(isFromSender_ or allowance_ >= amount_, "AL01");
    // Dispatch checks to rule engine
		const isTransferValidCall_ : contract(isTransferValidParam) = case (get_entrypoint_opt("%isTransferValid", self.ruleEngine) : option(contract(isTransferValidParam))) of | None -> failwith("RU03") | Some(x) -> x end;
		const isTransferValidParam_ : isTransferValidParam = record [
			amount_ = amount_;
      amountInRefCurrency_ = _convertTo(self, amount_, ref_currency, max_decimals);
      from_ = from_;
      realm_ = _realm(self);
      rules_ = self.rules;
      to_ = to_;
      token_ = Tezos.self_address;
      trustedIntermediaries_ = self.trustedIntermediaries;
      canTransferCallbackAddress_ = (None : option(address));
		];
		const op : operation = Tezos.transaction(isTransferValidParam_, 0tez, isTransferValidCall_);
    const ops : list (operation) = list [op];
  } with (ops, self);

function transferIsTransferValidCallback(var self: state; const ruleResponses_: map(int,ruleResponse); const from_: address; const to_: address; const amount_: nat) : (list(operation) * state) is 
  block {
    require(Tezos.sender = self.ruleEngine, "RU04");
    const isValid_ = _isRuleResponseValid(ruleResponses_);
    var ops : list (operation) := list [];
    if isValid_ then block {
      const beforeTransferHookCall_ : contract(beforeTransferHookParam) = case (get_entrypoint_opt("%beforeTransferHook", self.ruleEngine) : option(contract(beforeTransferHookParam))) of | None -> failwith("RU03") | Some(x) -> x end;
      const beforeTransferHookParam_ : beforeTransferHookParam = record [
        amount_ = amount_;
        amountInRefCurrency_ = _convertTo(self, amount_, ref_currency, max_decimals);
        from_ = from_;
        realm_ = _realm(self);
        rules_ = self.rules;
        ruleResponses_ = ruleResponses_;
        to_ = to_;
        token_ = Tezos.self_address;
        trustedIntermediaries_ = self.trustedIntermediaries;
      ];
      const op : operation = Tezos.transaction(beforeTransferHookParam_, 0tez, beforeTransferHookCall_);
      ops := op # ops;
    } else failwith("RU03");
  } with (ops, self);

function transferBeforeTransferHookCallback(var self: state; const ruleResponses_: map(int,ruleResponse);const from_: address; const to_: address; const amount_: nat) : (list(operation) * state) is 
  block {
    require(Tezos.sender = self.ruleEngine, "RU04");
    const isValid_ = _isRuleResponseValid(ruleResponses_);
    var ops : list (operation) := list [];
    if isValid_ then block {
      self := _subBalance(self, from_, amount_);
      self := _addBalance(self, to_, amount_);
      if (Tezos.source =/= from_) then block {
        self := _decreaseApproval(self, from_, Tezos.source, amount_);
      } else skip;
      const afterTransferHookCall_ : contract(afterTransferHookParam) = case (get_entrypoint_opt("%afterTransferHook", self.ruleEngine) : option(contract(afterTransferHookParam))) of | None -> failwith("RU03") | Some(x) -> x end;
      const afterTransferHookParam_ : afterTransferHookParam = record [
        amount_ = amount_;
        amountInRefCurrency_ = _convertTo(self, amount_, ref_currency, max_decimals);
        from_ = from_;
        realm_ = _realm(self);
        rules_ = self.rules;
        ruleResponses_ = ruleResponses_;
        to_ = to_;
        token_ = Tezos.self_address;
        trustedIntermediaries_ = self.trustedIntermediaries;
      ];
      const op : operation = Tezos.transaction(afterTransferHookParam_, 0tez, afterTransferHookCall_);
      ops := op # ops;
    } else failwith("RU03");
  } with (ops, self);

function convertTo(const self: state; const amount_: nat; const currency_: string; const maxDecimals_: nat; const callback_: contract(nat)) : list(operation) is 
  block {
    const amountInCurrency_ : nat = _convertTo(self, amount_, currency_, maxDecimals_);
    const op : operation = Tezos.transaction(amountInCurrency_, 0tez, callback_);
    const ops : list (operation) = list [op];
  } with (ops);

function approve(var self: state; const spender_: address; const amount_: nat) : (list(operation) * state) is
  block {
    const addressKey_: bytes = _keyWithAddress(Tezos.sender, spender_);
    self.allowances[addressKey_] := amount_;
  } with (noOperations, self);

function getBalance(const self: state; const owner_: address; const callback_: contract(nat)) : list(operation) is
  block {
    const balance_ : nat = case self.balances[owner_] of | None -> 0n | Some(x) -> x end;
    const op : operation = Tezos.transaction(balance_, 0tez, callback_);
    const ops : list (operation) = list [op]
  } with (ops);

function getAllowance(const self: state; const owner_: address; const spender_: address; const callback_ : contract(nat))  : list(operation) is
  block {
    const allowance_ : nat = _allowance(self, owner_, spender_);
    const op : operation = Tezos.transaction(allowance_, 0tez, callback_);
    const ops : list (operation) = list [op]
  } with (ops);

function increaseApproval(var self: state; const spender_: address; const addedAmount_: nat) : (list(operation) * state) is
  block {
    self := _increaseApproval(self, Tezos.sender, spender_, addedAmount_);
  } with (noOperations, self);

function decreaseApproval(var self: state; const spender_: address; const subtractedAmount_: nat) : (list(operation) * state) is
  block {
    self := _decreaseApproval(self, Tezos.sender, spender_, subtractedAmount_);
  } with (noOperations, self);

function setPrices(var self: state; const currencies_: list(string); const prices_: list(nat); const decimals_: list(nat)) : (list(operation) * state) is 
  block {
    require(List.length(prices_) = List.length(currencies_), "PO01");
    require(List.length(currencies_) = List.length(decimals_), "PO02");
    failIfNotOwnerOrAdministrator(self);
    function stringIterator(var acc: (state * list(nat) * list(nat)); const currency_: string) : (state * list(nat) * list(nat)) is
      block {
        const price_ : nat = case List.head_opt (acc.1) of | None -> 0n | Some(x) -> x end;
        const decimal_ : nat = case List.head_opt (acc.2) of | None -> 0n | Some(x) -> x end;
        acc.0.prices[currency_] := record [ price = price_; lastUpdated = Tezos.now; decimals = decimal_];
        acc.1 := case List.tail_opt(acc.1) of | None -> (list [] : list(nat)) | Some(x) -> x end;
        acc.2 := case List.tail_opt(acc.2) of | None -> (list [] : list(nat)) | Some(x) -> x end;
      } with (acc);
    const result_ : (state * list(nat) * list(nat)) = List.fold(stringIterator, currencies_, (self, prices_, decimals_));
  } with (noOperations, result_.0);

function setPrice(var self: state; const currency_: string; const price_: nat; const decimal_: nat) : (list(operation) * state) is
  block {
    failIfNotOwnerOrAdministrator(self);
    self.prices[currency_] := record [ price = price_; lastUpdated = Tezos.now; decimals = decimal_];
  } with (noOperations, self);

function getPrice(const self: state; const currency_: string; const callback_: contract((nat * nat))) : list(operation) is
  block {
    const price_: price = case self.prices[currency_] of | None -> default_price | Some(x) -> x end;
    const op : operation = Tezos.transaction((price_.price, price_.decimals), 0tez, callback_);
    const ops : list (operation) = list [op];
  } with (ops);

function getPriceLastUpdated(const self: state;const currency_: string; const callback_: contract(timestamp)) : list(operation) is
  block {
    const price_: price = case self.prices[currency_] of | None -> default_price | Some(x) -> x end;
    const op : operation = Tezos.transaction(price_.lastUpdated, 0tez, callback_);
    const ops : list (operation) = list [op];
  } with (ops);

function main (const action : entry_action; const self : state): (list(operation) * state) is
  case action of
 | TransferOwnership(param) -> transferOwnership(self, param)
 | RevokeOwnership(_param) -> revokeOwnership(self)
 | IsAdministrator(param) -> isAdministrator(self, param.address_, param.callback_)
 | AddAdministrator(param) -> addAdministrator(self, param)
 | RemoveAdministrator(param) -> removeAdministrator(self, param)
 | IsRealmAdministrator(param) -> isRealmAdministrator(self, param.address_, param.callback_)
 | AddRealmAdministrator(param) -> addRealmAdministrator(self, param)
 | RemoveRealmAdministrator(param) -> removeRealmAdministrator(self, param)
 | IsSupplier(param) -> isSupplier(self, param.address_, param.callback_)
 | AddSupplier(param) -> addSupplier(self, param)
 | RemoveSupplier(param) -> removeSupplier(self, param)
 | IsSeizer(param) -> isSeizer(self, param.address_, param.callback_)
 | AddSeizer(param) -> addSeizer(self, param)
 | RemoveSeizer(param) -> removeSeizer(self, param)
 | Mint(param) -> mint(self, param.to_, param.amount_)
 | Burn(param) -> burn(self, param.from_, param.amount_)
 | Seize(param) -> seize(self, param.from_, param.amount_)
 | Rules(param) -> (rules(self, param), self)
 | SetRules(param) -> setRules(self, param)
 | CanTransfer(param) -> (canTransfer(self, param.from_, param.to_, param.amount_, param.callbackAddress_), self)
 | CanTransferIsTransferValidCb(param) -> (canTransferIsTransferValidCallback(self, param.ruleResponses_, param.canTransferCallbackAddress_), self)
 | SetRealm(param) -> setRealm(self, param, (Tezos.self("%setRealmIsRealmAdministratorCb") : contract(bool)))
 | SetRealmIsRealmAdministratorCb(param) -> setRealmIsRealmAdministratorCallback(self, param)
 | SetTrustedIntermediaries(param) -> setTrustedIntermediaries(self, param)
 | SetRuleEngine(param) -> setRuleEngine(self, param)
 | SetTokenizedSharePercentage(param) -> setTokenizedSharePercentage(self, param)
 | SetBoardResolutionDocument(param) -> setBoardResolutionDocument(self, param.boardResolutionDocumentUrl_, param.boardResolutionDocumentHash_)
 | SetContact(param) -> setContact(self, param)
 | Name(param) -> (name(self, param), self)
 | Symbol(param) -> (symbol(self, param), self)
 | Decimals(param) -> (decimals(self, param), self)
 | GetTotalSupply(param) -> (getTotalSupply(self, param), self)
 | Transfer(param) -> transfer(self, param.from_, param.to_, param.amount_)
 | TransferIsTransferValidCb(param) -> transferIsTransferValidCallback(self, param.ruleResponses_, param.from_, param.to_, param.amount_)
 | TransferBeforeTransferHookCb(param) -> transferBeforeTransferHookCallback(self, param.ruleResponses_, param.from_, param.to_, param.amount_)
 | Approve(param) -> approve(self, param.spender_, param.amount_)
 | GetBalance(param) -> (getBalance(self, param.owner_, param.callback_), self)
 | GetAllowance(param) -> (getAllowance(self, param.owner_, param.spender_, param.callback_), self)
 | IncreaseApproval(param) -> increaseApproval(self, param.spender_, param.amount_)
 | DecreaseApproval(param) -> decreaseApproval(self, param.spender_, param.amount_)
 | SetPrices(param) -> setPrices(self, param.currencies_, param.prices_, param.decimals_)
 | SetPrice(param) -> setPrice(self, param.currency_, param.price_, param.decimal_)
 | GetPrice(param) -> (getPrice(self, param.currency_, param.callback_), self)
 | GetPriceLastUpdated(param) -> (getPriceLastUpdated(self, param.currency_, param.callback_), self)
 | ConvertTo(param) -> (convertTo(self, param.amount_, param.currency_, param.maxDecimals_, param.callback_), self)
 end