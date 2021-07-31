

#include "../common/Keys.ligo"
#include "../common/Utils.ligo"
#include "../common/Types.ligo"
#include "./common/Types.ligo"

const user_valid_flag_both = 0n;
const user_valid_flag_from = 1n;
const user_valid_flag_to = 2n;

const reason_unsupported_flag = 1;
const reason_invalid_from_address = 2;
const reason_invalid_to_address = 3;

type entry_action is 
 | ComplianceRegistryCallback of list(bool)
 | IsTransferValid of transferParam
 | BeforeTransferHook of transferParam
 | AfterTransferHook of transferParam

type state is record 
  complianceRegistry: address;
  ruleEngine: address;
  userValidFlag: nat;
end;

function isTransferValid(var self: state; const from_ : address; const to_ : address; const trustedIntermediaries_: list(address); const userValidFlag_ : nat) : (list(operation) * state) is
  block {
    self.userValidFlag := userValidFlag_;
		const complianceRegistryCall_ : contract(isAddressesValidParam) = case (get_entrypoint_opt("%isAddressesValid", self.complianceRegistry) : option(contract(isAddressesValidParam))) of | None -> failwith("RU02") | Some(x) -> x end;
		const isAddressesValidParam_ : isAddressesValidParam = record [
			addresses_ = list [from_; to_];
			callback_ = (Tezos.self("%complianceRegistryCallback") : contract(list(bool)));
      trustedIntermediaries_ = trustedIntermediaries_
		];
		const op : operation = Tezos.transaction(isAddressesValidParam_, 0tez, complianceRegistryCall_);
    const ops : list (operation) = list [op];
  } with (ops, self);

function complianceRegistryCallback(const self: state; const addressesValid: list(bool)): list(operation) is
  block {
    var result : isTransferValidResult := record [
      valid_ = transfer_valid_with_no_hook;
      reason_ = reason_ok;
    ];
    if self.userValidFlag > user_valid_flag_to then block {
      result := record [ valid_ = transfer_invalid; reason_ = reason_unsupported_flag];
    } else block {
      const isFromAddressValid = case List.head_opt(addressesValid) of | None -> False | Some(x) -> x end;
      if (self.userValidFlag = user_valid_flag_from or self.userValidFlag = user_valid_flag_both) and isFromAddressValid = False then block {
        result := record [ valid_ = transfer_invalid; reason_ = reason_invalid_from_address];
      } else block {
        const isToAddressValid = case List.head_opt(case List.tail_opt(addressesValid) of | None -> (list []: list(bool)) | Some(x) -> x end) of | None -> False | Some(x) -> x end;
        if (self.userValidFlag = user_valid_flag_to or self.userValidFlag = user_valid_flag_both) and isToAddressValid = False then block {
          result := record [ valid_ = transfer_invalid; reason_ = reason_invalid_to_address];
        } else skip;
      }
    };
    const callback_ : contract(isTransferValidResult) = case (get_entrypoint_opt("%isTransferValidCb", self.ruleEngine) : option(contract(isTransferValidResult))) of | None -> failwith("RU02") | Some(x) -> x end;
    const op : operation = Tezos.transaction(result, 0tez, callback_);
    const ops : list (operation) = list [op];
  } with (ops);

function main (const action : entry_action; const self : state): (list(operation) * state)  is
case action of
| IsTransferValid(param) -> isTransferValid(self, param.from_, param.to_, param.trustedIntermediaries_, param.ruleParam_)
| ComplianceRegistryCallback(param) -> (complianceRegistryCallback(self, param), self)
| BeforeTransferHook(_param) -> failwith("RU02")
| AfterTransferHook(_param) -> failwith("RU02")
end

