

#include "../common/Keys.ligo"
#include "../common/Utils.ligo"
#include "../common/Types.ligo"
#include "./common/Types.ligo"

const user_kyc_key = 100;

const reason_from_address_not_registered = 1;
const reason_from_kyc_less_than_threshold = 2;
const reason_to_address_not_registered = 3;
const reason_to_kyc_less_than_threshold = 4;

type entry_action is 
 | ComplianceRegistryCallback of list(userIdAttributeResult)
 | IsTransferValid of transferParam
 | BeforeTransferHook of transferParam
 | AfterTransferHook of transferParam

const default_userid_result : userIdResult = record [
  userId = 0;
  trustedIntermediary = burn_address;
];
const default_userid_attribute_result : userIdAttributeResult = record[ userIdResult = default_userid_result; attribute = 0n ];

type state is record 
  complianceRegistry: address;
  ruleEngine: address;
  kycThreshold: nat;
end;

function isTransferValid(var self: state; const from_ : address; const to_: address; const trustedIntermediaries_: list(address); const kycThreshold_ : nat) : (list(operation) * state) is
  block {
    self.kycThreshold := kycThreshold_;
		const complianceRegistryCall_ : contract(attributeForAddressesParam) = case (get_entrypoint_opt("%attributeForAddresses", self.complianceRegistry) : option(contract(attributeForAddressesParam))) of | None -> failwith("RU02") | Some(x) -> x end;
		const attributeForAddressesParam_ : attributeForAddressesParam = record [
			addresses_ = list [from_; to_];
			callback_ = (Tezos.self("%complianceRegistryCallback") : contract(list(userIdAttributeResult)));
      key_ = user_kyc_key;
      trustedIntermediaries_ = trustedIntermediaries_
		];
		const op : operation = Tezos.transaction(attributeForAddressesParam_, 0tez, complianceRegistryCall_);
    const ops : list (operation) = list [op];
  } with (ops, self);

function complianceRegistryCallback(const self: state; const userIdAttributeResults_: list(userIdAttributeResult)): list(operation) is
  block {
    var result : isTransferValidResult := record [
      valid_ = transfer_valid_with_no_hook;
      reason_ = reason_ok;
    ];
    const fromUserIdAttributeResult_: userIdAttributeResult = case List.head_opt(userIdAttributeResults_) of None -> default_userid_attribute_result | Some(x) -> x end;
    if fromUserIdAttributeResult_.userIdResult.userId = 0 then block {
      result := record [ valid_ = transfer_invalid; reason_ = reason_from_address_not_registered] 
    } else block {
      if fromUserIdAttributeResult_.attribute < self.kycThreshold then block {
        result := record [ valid_ = transfer_invalid; reason_ = reason_from_kyc_less_than_threshold] 
      } else block {
        const toUserIdAttributeResult_: userIdAttributeResult = case List.head_opt(case List.tail_opt(userIdAttributeResults_) of None -> (list []: list(userIdAttributeResult)) | Some(x) -> x end) of None -> default_userid_attribute_result | Some(x) -> x end;
        if toUserIdAttributeResult_.userIdResult.userId = 0 then block {
          result := record [ valid_ = transfer_invalid; reason_ = reason_to_address_not_registered] 
        } else block {
          if toUserIdAttributeResult_.attribute < self.kycThreshold then result := record [ valid_ = transfer_invalid; reason_ = reason_to_kyc_less_than_threshold] else skip; 
        };
      }; 
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

