#include "../access/Roles.ligo"
#include "../common/Utils.ligo"
#include "../common/Types.ligo"
#include "../rules/common/Types.ligo"


type findRuleIdParam is record
  callback_: contract(int);
  rule_: address;
end;

type ruleParam is record
  callback_: contract(address);
  ruleId_: int;
end;

type entry_action is 
 | TransferOwnership of address
 | RevokeOwnership
 | IsOperator of isRoleParam
 | AddOperator of address
 | RemoveOperator of address
 | SetRules of map(int, address)
 | FindRuleId of findRuleIdParam
 | Rule of ruleParam
 | IsTransferValid of isTransferValidParam
 | IsTransferValidCb of isTransferValidResult
 | BeforeTransferHook of beforeTransferHookParam
 | BeforeTransferHookCb of beforeTransferHookResult
 | AfterTransferHook of afterTransferHookParam

type internal_state is record
  isTransferValidParam_: isTransferValidParam;
  ruleResponses_: map(int, ruleResponse);
  beforeTransferHookParam_: beforeTransferHookParam;
end;

type state is record
  owner: address;
  roles : roles;
  rules: map(int, address);
  internalState: internal_state;
end;

type transferIsTransferValidCbEntrypoint is TransferIsTransferValidCb of bool

const default_rule_response: ruleResponse = record [
  reason_ = reason_ok;
  valid_ = transfer_invalid;
  ruleId_ = 0;
]

function _findRuleId(const rules_: map(int, address); const rule_: address): int is
  block {
    function ruleIterator (var acc: (bool * int); const rule: (int * address)): (bool * int) is 
      block {
        if acc.0 = False then block {
          if rule.1 = rule_ then block { 
            acc.1 := rule.0;
            acc.0 := True;
          } else skip;
        }
        else skip;
      } with (acc);
    const result = Map.fold(ruleIterator, rules_, (False, 0));
    var ruleId_: int := -1;
    if (result.0 = True) then ruleId_ := result.1 else skip;
  } with (ruleId_)

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

function setRules (var self: state; const rules_ : map(int, address)) : (list(operation) * state) is
  block {
    failIfNotOwnerOrOperator(self);
    self.rules := rules_;
  } with (noOperations, self);

function findRuleId(const self: state; const rule: address; const callback_: contract(int)): list (operation) is 
  block {
    const ruleId_: int = _findRuleId(self.rules, rule);
    const op : operation = Tezos.transaction(ruleId_, 0tez, callback_);
    const ops : list (operation) = list [op]
  } with (ops);

function rule(const self: state; const ruleId_: int; const callback_: contract(address)) : list(operation) is
  block {
    require(ruleId_ >= 0 and ruleId_ < int(Map.size(self.rules)), "RE01");
    const rule_: address = case self.rules[ruleId_] of | None -> burn_address | Some(x) -> x end;
    const op : operation = Tezos.transaction(rule_, 0tez, callback_);
    const ops : list (operation) = list [op]
  } with (ops);

function isTransferValid(var self: state; const isTransferValidParam_: isTransferValidParam; const selfCallback_: contract(isTransferValidResult)) : (list(operation) * state) is
  block {
    self.internalState.ruleResponses_ := (map [] : map(int, ruleResponse));
    self.internalState.isTransferValidParam_ := isTransferValidParam_;
    var ops : list (operation) := list [];
    if List.length(isTransferValidParam_.rules_) = 0n then block {
      const isTransferValidResponse_: isTransferValidResponse = record [
        amount_ = isTransferValidParam_.amount_;
        ruleResponses_ = (map []: map(int, ruleResponse));
        from_ = isTransferValidParam_.from_;
        to_ = isTransferValidParam_.to_;
        canTransferCallbackAddress_ = isTransferValidParam_.canTransferCallbackAddress_;
      ];
      const callback_: contract(isTransferValidResponse) = case (Tezos.get_entrypoint_opt("%transferIsTransferValidCb", self.internalState.isTransferValidParam_.token_): option(contract(isTransferValidResponse))) of | None -> failwith("RU05") | Some(x) -> x end;
      const op = Tezos.transaction(isTransferValidResponse_, 0tez, callback_);
      ops := op # ops;
    } else block {
      const rules_: map(int, address) = self.rules;
      function ruleIterator(var acc: list(operation); const rule_: rule): list(operation) is
        block {
          const ruleAddress_: address = case rules_[rule_.ruleId] of | None -> burn_address | Some(x) -> x end;
          const isTransferValidCall_: contract(transferParam) = case (get_entrypoint_opt("%isTransferValid", ruleAddress_) : option(contract(transferParam))) of | None -> failwith("RU05") | Some(x) -> x end;
          const isTransferValidParam_: transferParam = record [
            amount_ = isTransferValidParam_.amount_;
            amountInRefCurrency_ = isTransferValidParam_.amountInRefCurrency_;
            callback_ = selfCallback_;
            from_ = isTransferValidParam_.from_;
            realm_ = isTransferValidParam_.realm_;
            ruleParam_ = rule_.ruleParam;
            to_ = isTransferValidParam_.to_;
            token_ = isTransferValidParam_.token_;
            trustedIntermediaries_ = isTransferValidParam_.trustedIntermediaries_;
          ];
          const op : operation = Tezos.transaction(isTransferValidParam_, 0tez, isTransferValidCall_);
          acc := op # acc
        } with (acc);
      ops := List.fold(ruleIterator, isTransferValidParam_.rules_, (list []: list(operation)));
    }
  } with (ops, self);

function isTransferValidCb(var self: state; const isTransferValidResult_: isTransferValidResult): (list(operation) * state) is
  block {
    const ruleId_ : int = _findRuleId(self.rules, Tezos.sender);
    const ruleResponse_: ruleResponse = record [
      ruleId_ = ruleId_;
      valid_ = isTransferValidResult_.valid_;
      reason_ = isTransferValidResult_.reason_;
    ];
    self.internalState.ruleResponses_[ruleId_] := ruleResponse_;
    var ops: list(operation) := list [];
    if Map.size(self.internalState.ruleResponses_) = List.length(self.internalState.isTransferValidParam_.rules_) then block {
      const isTransferValidResponse_: isTransferValidResponse = record [
        amount_ = self.internalState.isTransferValidParam_.amount_;
        ruleResponses_ = self.internalState.ruleResponses_;
        from_ = self.internalState.isTransferValidParam_.from_;
        to_ = self.internalState.isTransferValidParam_.to_;
        canTransferCallbackAddress_ = self.internalState.isTransferValidParam_.canTransferCallbackAddress_;
      ];
      const callback_: contract(isTransferValidResponse) = case (Tezos.get_entrypoint_opt("%transferIsTransferValidCb", self.internalState.isTransferValidParam_.token_): option(contract(isTransferValidResponse))) of | None -> failwith("RU05") | Some(x) -> x end;
      const op = Tezos.transaction(isTransferValidResponse_, 0tez, callback_);
      ops := op # ops;
    } else skip;
  } with (ops, self);

function beforeTransferHook(var self: state; const beforeTransferHookParam_: beforeTransferHookParam; const selfCallback_: contract(beforeTransferHookResult)) : (list(operation) * state) is
  block {
    self.internalState.ruleResponses_ := (map [] : map(int, ruleResponse));
    self.internalState.beforeTransferHookParam_ := beforeTransferHookParam_;
    var ops : list (operation) := list [];
    if List.length(beforeTransferHookParam_.rules_) = 0n then block {
      const isTransferValidResponse_: isTransferValidResponse = record [
        amount_ = beforeTransferHookParam_.amount_;
        ruleResponses_ = (map []: map(int, ruleResponse));
        from_ = beforeTransferHookParam_.from_;
        to_ = beforeTransferHookParam_.to_;
        canTransferCallbackAddress_ = (None: option(address));
      ];
      const callback_: contract(isTransferValidResponse) = case (Tezos.get_entrypoint_opt("%transferBeforeTransferHookCb", self.internalState.beforeTransferHookParam_.token_): option(contract(isTransferValidResponse))) of | None -> failwith("RU05") | Some(x) -> x end;
      const op = Tezos.transaction(isTransferValidResponse_, 0tez, callback_);
      ops := op # ops;
    } else block {
      const rules_: map(int, address) = self.rules;
      function ruleIterator(var acc: (list(operation) * state); const rule_: rule): (list(operation) * state) is
        block {
          const ruleResponse_: ruleResponse = case beforeTransferHookParam_.ruleResponses_[rule_.ruleId] of | None -> default_rule_response | Some(x) -> x end;
          if ruleResponse_.valid_ = transfer_valid_with_before_hook then block {
            const ruleAddress_: address = case rules_[rule_.ruleId] of | None -> burn_address | Some(x) -> x end;
            const beforeTransferHookCall_: contract(beforeHookParam) = case (get_entrypoint_opt("%beforeTransferHook", ruleAddress_) : option(contract(beforeHookParam))) of | None -> failwith("RU05") | Some(x) -> x end;
            const beforeHookParam_: beforeHookParam = record [
              amount_ = beforeTransferHookParam_.amount_;
              amountInRefCurrency_ = beforeTransferHookParam_.amountInRefCurrency_;
              callback_ = selfCallback_;
              from_ = beforeTransferHookParam_.from_;
              realm_ = beforeTransferHookParam_.realm_;
              ruleParam_ = rule_.ruleParam;
              to_ = beforeTransferHookParam_.to_;
              token_ = beforeTransferHookParam_.token_;
              trustedIntermediaries_ = beforeTransferHookParam_.trustedIntermediaries_;
            ];
            const op : operation = Tezos.transaction(beforeHookParam_, 0tez, beforeTransferHookCall_);
            acc.0 := op # acc.0
          } else block {
            acc.1.internalState.ruleResponses_[rule_.ruleId] := ruleResponse_;
          }
        } with (acc);
      const result = List.fold(ruleIterator, beforeTransferHookParam_.rules_, ((list []: list(operation)), self));
      ops := result.0;
      self := result.1;
      if Map.size(self.internalState.ruleResponses_) = List.length(self.internalState.beforeTransferHookParam_.rules_) then block {
        const isTransferValidResponse_: isTransferValidResponse = record [
          amount_ = self.internalState.beforeTransferHookParam_.amount_;
          ruleResponses_ = self.internalState.ruleResponses_;
          from_ = self.internalState.beforeTransferHookParam_.from_;
          to_ = self.internalState.beforeTransferHookParam_.to_;
          canTransferCallbackAddress_ = (None : option(address));
        ];
        const callback_: contract(isTransferValidResponse) = case (Tezos.get_entrypoint_opt("%transferBeforeTransferHookCb", self.internalState.beforeTransferHookParam_.token_): option(contract(isTransferValidResponse))) of | None -> failwith("RU05") | Some(x) -> x end;
        const op = Tezos.transaction(isTransferValidResponse_, 0tez, callback_);
        ops := op # ops;
      } else skip;
    }
  } with (ops, self);

function beforeTransferHookCb(var self: state; const beforeTransferHookResult_: beforeTransferHookResult): (list(operation) * state) is
  block {
    const ruleId_ = _findRuleId(self.rules, Tezos.sender);
    const ruleResponse_: ruleResponse = record [
      ruleId_ = ruleId_;
      reason_ = reason_ok;
      valid_ = beforeTransferHookResult_.valid_;
    ];
    self.internalState.ruleResponses_[ruleId_] := ruleResponse_;
    self.internalState.beforeTransferHookParam_.amount_ := beforeTransferHookResult_.amount_;
    self.internalState.beforeTransferHookParam_.to_ := beforeTransferHookResult_.to_;
    var ops: list(operation) := list [];
    if Map.size(self.internalState.ruleResponses_) = List.length(self.internalState.beforeTransferHookParam_.rules_) then block {
      const isTransferValidResponse_: isTransferValidResponse = record [
        amount_ = self.internalState.beforeTransferHookParam_.amount_;
        ruleResponses_ = self.internalState.ruleResponses_;
        from_ = self.internalState.beforeTransferHookParam_.from_;
        to_ = self.internalState.beforeTransferHookParam_.to_;
        canTransferCallbackAddress_ = (None : option(address));
      ];
      const callback_: contract(isTransferValidResponse) = case (Tezos.get_entrypoint_opt("%transferBeforeTransferHookCb", self.internalState.beforeTransferHookParam_.token_): option(contract(isTransferValidResponse))) of | None -> failwith("RU05") | Some(x) -> x end;
      const op = Tezos.transaction(isTransferValidResponse_, 0tez, callback_);
      ops := op # ops;
    } else skip;
  } with (ops, self);

function afterTransferHook(const self: state; const afterTransferHookParam_: afterTransferHookParam) : (list(operation) * state) is
  block {
    function ruleIterator(var acc: list(operation); const rule_: rule): list(operation) is
      block {
        const ruleResponse_: ruleResponse = case afterTransferHookParam_.ruleResponses_[rule_.ruleId] of | None -> default_rule_response | Some(x) -> x end;
        if ruleResponse_.valid_ = transfer_valid_with_after_hook then block {
          const ruleAddress_: address = case self.rules[rule_.ruleId] of | None -> burn_address | Some(x) -> x end;
          const afterTransferHookCall_: contract(afterHookParam) = case (get_entrypoint_opt("%afterTransferHook", ruleAddress_) : option(contract(afterHookParam))) of | None -> failwith("RU05") | Some(x) -> x end;
          const afterHookParam_: afterHookParam = record [
            amount_ = afterTransferHookParam_.amount_;
            amountInRefCurrency_ = afterTransferHookParam_.amountInRefCurrency_;
            from_ = afterTransferHookParam_.from_;
            realm_ = afterTransferHookParam_.realm_;
            ruleParam_ = rule_.ruleParam;
            to_ = afterTransferHookParam_.to_;
            token_ = afterTransferHookParam_.token_;
            trustedIntermediaries_ = afterTransferHookParam_.trustedIntermediaries_;
          ];
          const op : operation = Tezos.transaction(afterHookParam_, 0tez, afterTransferHookCall_);
          acc := op # acc
        } else skip;
      } with (acc);
    const ops = List.fold(ruleIterator, afterTransferHookParam_.rules_, (list []: list(operation)));
  } with (ops, self);

function main (const action : entry_action; const self : state): (list(operation) * state) is
  case action of
 | TransferOwnership(param) -> transferOwnership(self, param)
 | RevokeOwnership(_param) -> revokeOwnership(self)
 | IsOperator(param) -> isOperator(self, param.address_, param.callback_)
 | AddOperator(param) -> addOperator(self, param)
 | RemoveOperator(param) -> removeOperator(self, param)
 | SetRules(param) -> setRules(self, param)
 | FindRuleId(param) -> (findRuleId(self, param.rule_, param.callback_), self)
 | Rule(param) -> (rule(self, param.ruleId_, param.callback_), self)
 | IsTransferValid(param) -> isTransferValid(self, param, (Tezos.self("%isTransferValidCb") : contract(isTransferValidResult)))
 | IsTransferValidCb(param) -> isTransferValidCb(self, param)
 | BeforeTransferHook(param) -> beforeTransferHook(self, param, (Tezos.self("%beforeTransferHookCb") : contract(beforeTransferHookResult)))
 | BeforeTransferHookCb(param) -> beforeTransferHookCb(self, param)
 | AfterTransferHook(param) -> afterTransferHook(self, param)
end;
