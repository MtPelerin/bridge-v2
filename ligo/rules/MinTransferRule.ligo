#include "./common/types.ligo"

const reason_amount_less_then_min_amount = 1;

type entry_action is 
 | IsTransferValid of transferParam
 | BeforeTransferHook of transferParam
 | AfterTransferHook of transferParam

type state is unit;

function isTransferValid(const amount_ : nat; const minAmount_ : nat; const callback_ : contract(isTransferValidResult)) : list(operation) is
  block {
    var result : isTransferValidResult := record [
      valid_ = transfer_invalid;
      reason_ = reason_amount_less_then_min_amount;
    ];
    if amount_ >= minAmount_ then 
      block {
        result := record [
          valid_ = transfer_valid_with_no_hook;
          reason_ = reason_ok;
        ];
      }
    else skip;
    const op : operation = Tezos.transaction(result, 0tez, callback_);
    const ops : list (operation) = list [op]
  } with (ops);

function main (const action : entry_action; const self : state): (list(operation) * state)  is
case action of
| IsTransferValid(param) -> (isTransferValid(param.amount_, param.ruleParam_, param.callback_), self)
| BeforeTransferHook(_param) -> failwith("RU02")
| AfterTransferHook(_param) -> failwith("RU02")
end
