#include "../common/Keys.ligo"
#include "../common/Utils.ligo"
#include "../common/Types.ligo"
#include "./common/Types.ligo"

const user_attribute_threshold = 1n;
const whitelisted_key = 130;

const reason_address_not_registered = 1;
const reason_attribute_less_than_threshold = 2;

type entry_action is 
 | ComplianceRegistryCallback of userIdAttributesResult
 | IsTransferValid of transferParam
 | BeforeTransferHook of transferParam
 | AfterTransferHook of transferParam

type state is record 
  complianceRegistry: address;
  ruleEngine: address;
end;

function isTransferValid(var self: state; const to_ : address; const trustedIntermediaries_: list(address); const _attributeKey : nat) : (list(operation) * state) is
  block {
		const complianceRegistryCall_ : contract(attributesForAddressParam) = case (get_entrypoint_opt("%attributesForAddress", self.complianceRegistry) : option(contract(attributesForAddressParam))) of | None -> failwith("RU02") | Some(x) -> x end;
		const attributesForAddressParam_ : attributesForAddressParam = record [
			address_ = to_;
			callback_ = (Tezos.self("%complianceRegistryCallback") : contract(userIdAttributesResult));
      keys_ = list [whitelisted_key; int(_attributeKey)];
      trustedIntermediaries_ = trustedIntermediaries_
		];
		const op : operation = Tezos.transaction(attributesForAddressParam_, 0tez, complianceRegistryCall_);
    const ops : list (operation) = list [op];
  } with (ops, self);

function complianceRegistryCallback(const self: state; const userIdAttributesResult_: userIdAttributesResult): list(operation) is
  block {
    var result : isTransferValidResult := record [
      valid_ = transfer_valid_with_no_hook;
      reason_ = reason_ok;
    ];
    if userIdAttributesResult_.userIdResult.userId = 0 then block {
      result := record [ valid_ = transfer_invalid; reason_ = reason_address_not_registered] 
    } else block {
      const whitelisted_attribute = case List.head_opt(userIdAttributesResult_.attributes) of | None -> 0n | Some(x) -> x end;
      const param_attribute = case List.head_opt(case List.tail_opt(userIdAttributesResult_.attributes) of | None -> (list [] : list(nat)) | Some(x) -> x end) of | None -> 0n | Some(x) -> x end;
      if whitelisted_attribute < user_attribute_threshold and param_attribute < user_attribute_threshold then result := record [ valid_ = transfer_invalid; reason_ = reason_attribute_less_than_threshold] else skip; 
    };
    const callback_ : contract(isTransferValidResult) = case (get_entrypoint_opt("%isTransferValidCb", self.ruleEngine) : option(contract(isTransferValidResult))) of | None -> failwith("RU02") | Some(x) -> x end;
    const op : operation = Tezos.transaction(result, 0tez, callback_);
    const ops : list (operation) = list [op];
  } with (ops);

function main (const action : entry_action; const self : state): (list(operation) * state)  is
case action of
| IsTransferValid(param) -> isTransferValid(self, param.to_, param.trustedIntermediaries_, param.ruleParam_)
| ComplianceRegistryCallback(param) -> (complianceRegistryCallback(self, param), self)
| BeforeTransferHook(_param) -> failwith("RU02")
| AfterTransferHook(_param) -> failwith("RU02")
end

