#include "./common/Types.ligo"
#include "../access/Roles.ligo"
#include "../common/Types.ligo"

const reason_transfers_frozen_globally = 1;

type entry_action is 
 | TransferOwnership of address
 | RevokeOwnership
 | IsOperator of isRoleParam
 | AddOperator of address
 | RemoveOperator of address
 | FreezeAll of timestamp
 | UnfreezeAll of unit
 | IsTransferValid of transferParam
 | BeforeTransferHook of transferParam
 | AfterTransferHook of transferParam

type state is record
  owner: address;
  roles : roles;
  allFrozenUntil: timestamp;
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

// Freeze/unfreeze functions
function unfreezeAll (var self : state ) : (list(operation) * state) is
  block {
    failIfNotOwnerOrOperator(self);
    self.allFrozenUntil := ("1970-01-01T00:00:00Z" : timestamp);
  } with (noOperations, self);

function freezeAll (var self: state; const until: timestamp) : (list(operation) * state) is
  block {
    failIfNotOwnerOrOperator(self);
    require(until > Tezos.now, "GF01");
    self.allFrozenUntil := until;
  } with (noOperations, self);

// Valid transfer function
function isTransferValid(const self: state; const callback_ : contract(isTransferValidResult)) : list(operation) is
  block {
    var result : isTransferValidResult := record [
      valid_ = transfer_valid_with_no_hook;
      reason_ = reason_ok;
    ];
    if self.allFrozenUntil > Tezos.now then 
      block {
        result := record [
          valid_ = transfer_invalid;
          reason_ = reason_transfers_frozen_globally;
        ];
      }
    else skip;
    const op : operation = Tezos.transaction(result, 0tez, callback_);
    const ops : list (operation) = list [op]
  } with (ops);

function main (const action : entry_action; const self : state): (list(operation) * state)  is
case action of  
| TransferOwnership(param) -> transferOwnership(self, param)
| RevokeOwnership(_param) -> revokeOwnership(self)
| IsOperator(param) -> isOperator(self, param.address_, param.callback_)
| AddOperator(param) -> addOperator(self, param)
| RemoveOperator(param) -> removeOperator(self, param)
| FreezeAll(param) -> freezeAll(self, param)
| UnfreezeAll(_param) -> unfreezeAll(self)
| IsTransferValid(param) -> (isTransferValid(self, param.callback_), self)
| BeforeTransferHook(_param) -> failwith("RU02")
| AfterTransferHook(_param) -> failwith("RU02")
end
