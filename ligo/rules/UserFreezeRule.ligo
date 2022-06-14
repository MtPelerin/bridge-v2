

#include "../common/Keys.ligo"
#include "../common/Utils.ligo"
#include "../common/Types.ligo"
#include "./common/Types.ligo"

const user_transfer_freeze_direction_key = 120;
const user_transfer_freeze_start_key = 121;
const user_transfer_freeze_end_key = 122;
const user_transfer_freeze_inverted_key = 123;

const reason_from_address_frozen_for_send = 2;
const reason_to_address_frozen_for_receive = 3;

const freeze_direction_none = 0n;
const freeze_direction_receive = 1n;
const freeze_direction_send = 2n;
const freeze_direction_both = 3n;

const freeze_inverted_no = 0n;
const freeze_inverted_yes = 1n;

const allow_not_found = 1n;

const default_userid_result : userIdResult = record [
  userId = 0;
  trustedIntermediary = burn_address;
];
const default_userid_attributes_result : userIdAttributesResult = record[ userIdResult = default_userid_result; attributes = (list [] : list(nat)) ];

type entry_action is 
 | ComplianceRegistryCallback of list(userIdAttributesResult)
 | IsTransferValid of transferParam
 | BeforeTransferHook of transferParam
 | AfterTransferHook of transferParam

type state is record 
  complianceRegistry: address;
  ruleEngine: address;
  allowNotFound: nat;
end;

function _canSend(const fromUserIdAttributesResult_: userIdAttributesResult; const allowNotFound_: bool) : bool is 
  block {
    var isAllowed: bool := False;
    if fromUserIdAttributesResult_.userIdResult.userId = 0 then block {
      isAllowed := allowNotFound_;
    } else block {
      var tail_ : list(nat) := fromUserIdAttributesResult_.attributes;
      const direction_ : nat = case List.head_opt(tail_) of | None -> 0n | Some(x) -> x end;
      tail_ := case List.tail_opt(tail_) of | None -> (list [] : list(nat)) | Some(x) -> x end;
      const start_ : nat = case List.head_opt(tail_) of | None -> 0n | Some(x) -> x end;
      tail_ := case List.tail_opt(tail_) of | None -> (list [] : list(nat)) | Some(x) -> x end;
      const end_ : nat = case List.head_opt(tail_) of | None -> 0n | Some(x) -> x end;
      tail_ := case List.tail_opt(tail_) of | None -> (list [] : list(nat)) | Some(x) -> x end;
      const inverted_ : nat = case List.head_opt(tail_) of | None -> 0n | Some(x) -> x end;
      isAllowed := not((direction_ = freeze_direction_send or direction_ = freeze_direction_both) and (if ((("1970-01-01T00:00:00.000Z":timestamp) + int(start_)) <= Tezos.now and (("1970-01-01T00:00:00.000Z":timestamp) + int(end_)) > Tezos.now) then inverted_ = freeze_inverted_no else inverted_ = freeze_inverted_yes));
    }
  } with (isAllowed)

function _canReceive(const toUserIdAttributesResult_: userIdAttributesResult; const allowNotFound_: bool) : bool is 
  block {
    var isAllowed: bool := False;
    if toUserIdAttributesResult_.userIdResult.userId = 0 then block {
      isAllowed := allowNotFound_;
    } else block {
      var tail_ : list(nat) := toUserIdAttributesResult_.attributes;
      const direction_ : nat = case List.head_opt(tail_) of | None -> 0n | Some(x) -> x end;
      tail_ := case List.tail_opt(tail_) of | None -> (list [] : list(nat)) | Some(x) -> x end;
      const start_ : nat = case List.head_opt(tail_) of | None -> 0n | Some(x) -> x end;
      tail_ := case List.tail_opt(tail_) of | None -> (list [] : list(nat)) | Some(x) -> x end;
      const end_ : nat = case List.head_opt(tail_) of | None -> 0n | Some(x) -> x end;
      tail_ := case List.tail_opt(tail_) of | None -> (list [] : list(nat)) | Some(x) -> x end;
      const inverted_ : nat = case List.head_opt(tail_) of | None -> 0n | Some(x) -> x end;
      isAllowed := not((direction_ = freeze_direction_receive or direction_ = freeze_direction_both) and (if ((("1970-01-01T00:00:00.000Z":timestamp) + int(start_)) <= Tezos.now and (("1970-01-01T00:00:00.000Z":timestamp) + int(end_)) > Tezos.now) then inverted_ = freeze_inverted_no else inverted_ = freeze_inverted_yes));
    }
  } with (isAllowed)

function isTransferValid(var self: state; const from_: address; const to_ : address; const trustedIntermediaries_: list(address); const allowNotFound_ : nat) : (list(operation) * state) is
  block {
    self.allowNotFound := allowNotFound_;
		const complianceRegistryCall_ : contract(attributesForAddressesParam) = case (get_entrypoint_opt("%attributesForAddresses", self.complianceRegistry) : option(contract(attributesForAddressesParam))) of | None -> failwith("RU02") | Some(x) -> x end;
		const attributesForAddressesParam_ : attributesForAddressesParam = record [
			addresses_ = list [from_; to_];
			callback_ = (Tezos.self("%complianceRegistryCallback") : contract(list(userIdAttributesResult)));
      keys_ = list [user_transfer_freeze_direction_key; user_transfer_freeze_start_key; user_transfer_freeze_end_key; user_transfer_freeze_inverted_key];
      trustedIntermediaries_ = trustedIntermediaries_
		];
		const op : operation = Tezos.transaction(attributesForAddressesParam_, 0tez, complianceRegistryCall_);
    const ops : list (operation) = list [op];
  } with (ops, self);

function complianceRegistryCallback(const self: state; const userIdAttributesResults_: list(userIdAttributesResult)): list(operation) is
  block {
    var result : isTransferValidResult := record [
      valid_ = transfer_valid_with_no_hook;
      reason_ = reason_ok;
    ];
    const fromUserIdAttributesResult_ : userIdAttributesResult = case List.head_opt(userIdAttributesResults_) of | None -> default_userid_attributes_result | Some(x) -> x end;
    if _canSend(fromUserIdAttributesResult_, self.allowNotFound = allow_not_found) = False then block {
      result := record [ valid_ = transfer_invalid; reason_ = reason_from_address_frozen_for_send]; 
    } else block {
      const toUserIdAttributesResult_ : userIdAttributesResult = case List.head_opt(case List.tail_opt(userIdAttributesResults_) of | None -> (list []: list(userIdAttributesResult)) | Some(x) -> x end) of | None -> default_userid_attributes_result | Some(x) -> x end;
      if _canReceive(toUserIdAttributesResult_, self.allowNotFound = allow_not_found) = False then result := record [ valid_ = transfer_invalid; reason_ = reason_to_address_frozen_for_receive] else skip; 
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

