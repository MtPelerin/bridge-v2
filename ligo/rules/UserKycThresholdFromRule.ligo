

#include "../common/Keys.ligo"
#include "../common/Utils.ligo"
#include "../common/Types.ligo"
#include "./common/Types.ligo"

const user_kyc_key = 100;

const reason_address_not_registered = 1;
const reason_kyc_less_than_threshold = 2;

type entry_action is 
 | ComplianceRegistryCallback of userIdAttributeResult
 | IsTransferValid of transferParam
 | BeforeTransferHook of transferParam
 | AfterTransferHook of transferParam

type state is record 
  complianceRegistry: address;
  ruleEngine: address;
  kycThreshold: nat;
end;

function isTransferValid(var self: state; const from_ : address; const trustedIntermediaries_: list(address); const kycThreshold_ : nat) : (list(operation) * state) is
  block {
    self.kycThreshold := kycThreshold_;
		const complianceRegistryCall_ : contract(attributeForAddressParam) = case (get_entrypoint_opt("%attributeForAddress", self.complianceRegistry) : option(contract(attributeForAddressParam))) of | None -> failwith("RU02") | Some(x) -> x end;
		const attributeForAddressParam_ : attributeForAddressParam = record [
			address_ = from_;
			callback_ = (Tezos.self("%complianceRegistryCallback") : contract(userIdAttributeResult));
      key_ = user_kyc_key;
      trustedIntermediaries_ = trustedIntermediaries_
		];
		const op : operation = Tezos.transaction(attributeForAddressParam_, 0tez, complianceRegistryCall_);
    const ops : list (operation) = list [op];
  } with (ops, self);

function complianceRegistryCallback(const self: state; const userIdAttributeResult_: userIdAttributeResult): list(operation) is
  block {
    var result : isTransferValidResult := record [
      valid_ = transfer_valid_with_no_hook;
      reason_ = reason_ok;
    ];
    if userIdAttributeResult_.userIdResult.userId = 0 then block {
      result := record [ valid_ = transfer_invalid; reason_ = reason_address_not_registered] 
    } else block {
      if userIdAttributeResult_.attribute < self.kycThreshold then result := record [ valid_ = transfer_invalid; reason_ = reason_kyc_less_than_threshold] else skip; 
    };
    const callback_ : contract(isTransferValidResult) = case (get_entrypoint_opt("%isTransferValidCb", self.ruleEngine) : option(contract(isTransferValidResult))) of | None -> failwith("RU02") | Some(x) -> x end;
    const op : operation = Tezos.transaction(result, 0tez, callback_);
    const ops : list (operation) = list [op];
  } with (ops);

function main (const action : entry_action; const self : state): (list(operation) * state)  is
case action of
| IsTransferValid(param) -> isTransferValid(self, param.from_, param.trustedIntermediaries_, param.ruleParam_)
| ComplianceRegistryCallback(param) -> (complianceRegistryCallback(self, param), self)
| BeforeTransferHook(_param) -> failwith("RU02")
| AfterTransferHook(_param) -> failwith("RU02")
end

