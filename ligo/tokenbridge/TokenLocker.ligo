#include "../access/Roles.ligo"
#include "../common/Utils.ligo"
#include "../common/Types.ligo"

type lockParam is record
  to_: bytes;
  token_: address;
  value_: nat;
end;

type unlockParam is record
  to_: address;
  token_: address;
  value_: nat;
end;

type entry_action is 
 | TransferOwnership of address
 | RevokeOwnership
 | IsOperator of isRoleParam
 | AddOperator of address
 | RemoveOperator of address
 | Lock of lockParam
 | Unlock of unlockParam 

type token_locked is record
  from_: address;
  token_: address;
  to_: bytes;
  value_: nat;
end;

type state is record
  owner: address;
  roles : roles;
  events: big_map(nat, list(token_locked))
end;

// Access control functions
function failIfNotOwnerOrOperator(const self: state) : (unit) is
  block {
    require(self.owner = Tezos.sender or ROLES.hasRole(self.roles, "operator", Tezos.sender), "OP01");
  } with (unit);

function failIfNotOwner(const owner: address) : (unit) is
  block {
    require(owner = Tezos.sender, "AD01");
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

function isOperator (const self: state; const operator_ : address; const callback : contract(bool)) : (list(operation) * state) is
  block {
    const value = ROLES.hasRole(self.roles, "operator", operator_);
    const op : operation = Tezos.transaction(value, 0tez, callback);
    const ops : list (operation) = list [op]
  } with (ops, self);

function addOperator (var self : state; const operator_ : address) : (list(operation) * state) is
  block {
    failIfNotOwner(self.owner);
    self.roles := ROLES.addRole(self.roles, "operator", operator_);
  } with (noOperations, self);

function removeOperator (var self : state; const operator_ : address) : (list(operation) * state) is
  block {
    failIfNotOwner(self.owner);
    self.roles := ROLES.removeRole(self.roles, "operator", operator_);
  } with (noOperations, self);

function lock(var self: state; const token_: address; const to_: bytes; const value_: nat) : (list(operation) * state) is
  block {
    const blockEvents: list(token_locked) = case self.events[Tezos.level] of | None -> (list []: list(token_locked)) | Some(x) -> x end;
    self.events[Tezos.level] := record[ from_ = Tezos.sender; token_ = token_; to_ = to_; value_ = value_ ] # blockEvents;
    const contract_ : contract(transfer) = case (Tezos.get_entrypoint_opt("%transfer", token_) : option(contract(transfer))) of | None -> failwith("TL01") | Some(x) -> x end;
    const param_ : transfer = record [
      from_ = Tezos.sender;
      to_ = Tezos.self_address;
      amount_ = value_;
    ];
    const op = Tezos.transaction(param_, 0tez, contract_);
    const ops : list (operation) = list [op];
  } with (ops, self);

function unlock(const self: state; const token_: address; const to_: address; const value_: nat) : list(operation) is
  block {
    failIfNotOwnerOrOperator(self);
    const contract_ : contract(transfer) = case (Tezos.get_entrypoint_opt("%transfer", token_) : option(contract(transfer))) of | None -> failwith("TL01") | Some(x) -> x end;
    const param_ : transfer = record [
      from_ = Tezos.self_address;
      to_ = to_;
      amount_ = value_;
    ];
    const op = Tezos.transaction(param_, 0tez, contract_);
    const ops : list (operation) = list [op];
  } with (ops);

function main (const action : entry_action; const self : state): (list(operation) * state) is
  case action of
 | TransferOwnership(param) -> transferOwnership(self, param)
 | RevokeOwnership(_param) -> revokeOwnership(self)
 | IsOperator(param) -> isOperator(self, param.address_, param.callback_)
 | AddOperator(param) -> addOperator(self, param)
 | RemoveOperator(param) -> removeOperator(self, param)
 | Lock(param) -> lock(self, param.token_, param.to_, param.value_)
 | Unlock(param) -> (unlock(self, param.token_, param.to_, param.value_), self)
end;