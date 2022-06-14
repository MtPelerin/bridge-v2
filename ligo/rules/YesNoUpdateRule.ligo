#include "./common/types.ligo"
#include "../common/Utils.ligo"

const reason_yes_no_is_zero = 1;

type entry_action is 
 | IsTransferValid of transferParam
 | BeforeTransferHook of beforeHookParam
 | AfterTransferHook of afterHookParam

type state is int;

function isTransferValid(const yesNo_ : nat; const callback_ : contract(isTransferValidResult)) : list(operation) is
  block {
    var result : isTransferValidResult := record [
      valid_ = transfer_invalid;
      reason_ = reason_yes_no_is_zero;
    ];
    if yesNo_ > 0n then 
      block {
        result := record [
          valid_ = transfer_valid_with_before_hook;
          reason_ = reason_ok;
        ];
      }
    else skip;
    const op : operation = Tezos.transaction(result, 0tez, callback_);
    const ops : list (operation) = list [op]
  } with (ops);

function beforeTransferHook(const amount_: nat; const to_: address; const yesNo_: nat; const callback_ : contract(beforeTransferHookResult)) : list(operation) is
  block {
    var result : beforeTransferHookResult := record [
      valid_ = transfer_invalid;
      amount_ = amount_;
      to_ = to_;
    ];
    if yesNo_ > 0n then 
      block {
        result := record [
          valid_ = transfer_valid_with_after_hook;
          amount_ = amount_ + 1n;
          to_ = to_;
        ];
      }
    else skip;
    const op : operation = Tezos.transaction(result, 0tez, callback_);
    const ops : list (operation) = list [op]
  } with (ops);
  

function afterTransferHook(var self: state) : (list(operation) * state) is
  block {
    self := (self + 1);
  } with (noOperations, self)

function main (const action : entry_action; const self : state): (list(operation) * state)  is
case action of
| IsTransferValid(param) -> (isTransferValid(param.ruleParam_, param.callback_), self)
| BeforeTransferHook(param) -> (beforeTransferHook(param.amount_, param.to_, param.ruleParam_, param.callback_), self)
| AfterTransferHook(_param) -> afterTransferHook(self)
end

