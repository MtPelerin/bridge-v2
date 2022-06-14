

#include "../common/Utils.ligo"
#include "../access/Roles.ligo"
#include "../common/Types.ligo"
#include "./common/Types.ligo"

const max_decimals = 20;

const user_aml_transfer_threshold_key = 110;
const user_aml_monthly_threshold_key = 111;
const user_aml_yearly_threshold_key = 112;

const reason_from_address_not_known = 1;
const reason_from_single_transfer_limit_exceeded = 2;
const reason_from_monthly_transfer_limit_exceeded = 3;
const reason_from_yearly_transfer_limit_exceeded = 4;
const reason_to_address_not_known = 5;
const reason_to_single_transfer_limit_exceeded = 6;
const reason_to_monthly_transfer_limit_exceeded = 7;
const reason_to_yearly_transfer_limit_exceeded = 8;

const default_userid_result : userIdResult = record [
  userId = 0;
  trustedIntermediary = burn_address;
];
const default_userid_attributes_transfers_result : userIdAttributesTransfersResult = record[ userIdResult = default_userid_result; attributes = (list [] : list(nat)); monthly = 0n; yearly = 0n ];

type entry_action is  
 | TransferOwnership of address
 | RevokeOwnership
 | IsOperator of isRoleParam
 | AddOperator of address
 | RemoveOperator of address
 | ComplianceRegistryCallback of list(userIdAttributesTransfersResult)
 | IsTransferValid of transferParam
 | BeforeTransferHook of transferParam
 | AfterTransferHook of transferParam

type state is record 
  owner: address;
  roles : roles;
  complianceRegistry: address;
  ruleEngine: address;
  noCheckThreshold: nat;
  amountInRefCurrency: nat;
end;

function _isTransferFromValid(const self: state; const userIdAttributesTransfersResult_: userIdAttributesTransfersResult) : isTransferValidResult is 
  block {
    const decimals_ : nat = _pow(10n, abs(2n * max_decimals), 1n);
    const noCheckThresholdDecimals_ = self.noCheckThreshold * decimals_;
    var result: isTransferValidResult := record [
      valid_ = transfer_valid_with_after_hook;
      reason_ = reason_ok;
    ];
    if userIdAttributesTransfersResult_.userIdResult.userId = 0 then block {
      if not(self.amountInRefCurrency <= noCheckThresholdDecimals_ and (userIdAttributesTransfersResult_.monthly + self.amountInRefCurrency) <= noCheckThresholdDecimals_ and (userIdAttributesTransfersResult_.yearly + self.amountInRefCurrency) <= noCheckThresholdDecimals_) then block {
        result := record [
          valid_ = transfer_invalid;
          reason_ = reason_from_address_not_known;
        ];
      } else skip;
    } else block {
      var tail_ : list(nat) := userIdAttributesTransfersResult_.attributes;
      const transferLimit_ : nat = case List.head_opt(tail_) of | None -> 0n | Some(x) -> x end;
      tail_ := case List.tail_opt(tail_) of | None -> (list [] : list(nat)) | Some(x) -> x end;
      const monthlyLimit_ : nat = case List.head_opt(tail_) of | None -> 0n | Some(x) -> x end;
      tail_ := case List.tail_opt(tail_) of | None -> (list [] : list(nat)) | Some(x) -> x end;
      const yearlyLimit_ : nat = case List.head_opt(tail_) of | None -> 0n | Some(x) -> x end;
      if transferLimit_ * decimals_ < self.amountInRefCurrency then block {
        result := record [
          valid_ = transfer_invalid;
          reason_ = reason_from_single_transfer_limit_exceeded;
        ];
      } else block {
        if monthlyLimit_ * decimals_ < (userIdAttributesTransfersResult_.monthly + self.amountInRefCurrency) then block {
          result := record [
            valid_ = transfer_invalid;
            reason_ = reason_from_monthly_transfer_limit_exceeded;
          ];
        } else block {
          if yearlyLimit_ * decimals_ < (userIdAttributesTransfersResult_.yearly + self.amountInRefCurrency) then block {
            result := record [
              valid_ = transfer_invalid;
              reason_ = reason_from_yearly_transfer_limit_exceeded;
            ];
          } else skip;
        }
      }
    }
  } with (result);

function _isTransferToValid(const self: state; const userIdAttributesTransfersResult_: userIdAttributesTransfersResult) : isTransferValidResult is 
  block {
    const decimals_ : nat = _pow(10n, abs(2n * max_decimals), 1n);
    const noCheckThresholdDecimals_ = self.noCheckThreshold * decimals_;
    var result: isTransferValidResult := record [
      valid_ = transfer_valid_with_after_hook;
      reason_ = reason_ok;
    ];
    if userIdAttributesTransfersResult_.userIdResult.userId = 0 then block {
      if not(self.amountInRefCurrency <= noCheckThresholdDecimals_ and (userIdAttributesTransfersResult_.monthly + self.amountInRefCurrency) <= noCheckThresholdDecimals_ and (userIdAttributesTransfersResult_.yearly + self.amountInRefCurrency) <= noCheckThresholdDecimals_) then block {
        result := record [
          valid_ = transfer_invalid;
          reason_ = reason_to_address_not_known;
        ];
      } else skip;
    } else block {
      var tail_ : list(nat) := userIdAttributesTransfersResult_.attributes;
      const transferLimit_ : nat = case List.head_opt(tail_) of | None -> 0n | Some(x) -> x end;
      tail_ := case List.tail_opt(tail_) of | None -> (list [] : list(nat)) | Some(x) -> x end;
      const monthlyLimit_ : nat = case List.head_opt(tail_) of | None -> 0n | Some(x) -> x end;
      tail_ := case List.tail_opt(tail_) of | None -> (list [] : list(nat)) | Some(x) -> x end;
      const yearlyLimit_ : nat = case List.head_opt(tail_) of | None -> 0n | Some(x) -> x end;
      if transferLimit_ * decimals_ < self.amountInRefCurrency then block {
        result := record [
          valid_ = transfer_invalid;
          reason_ = reason_to_single_transfer_limit_exceeded;
        ];
      } else block {
        if monthlyLimit_ * decimals_ < (userIdAttributesTransfersResult_.monthly + self.amountInRefCurrency) then block {
          result := record [
            valid_ = transfer_invalid;
            reason_ = reason_to_monthly_transfer_limit_exceeded;
          ];
        } else block {
          if yearlyLimit_ * decimals_ < (userIdAttributesTransfersResult_.yearly + self.amountInRefCurrency) then block {
            result := record [
              valid_ = transfer_invalid;
              reason_ = reason_to_yearly_transfer_limit_exceeded;
            ];
          } else skip;
        }
      }
    }
  } with (result);

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

function isTransferValid(var self: state;  const from_ : address; const to_: address; const amountInRefCurrency_: nat; const realm_: address; const trustedIntermediaries_: list(address); const noCheckThreshold_ : nat) : (list(operation) * state) is
  block {
    self.noCheckThreshold := noCheckThreshold_;
    self.amountInRefCurrency := amountInRefCurrency_;
		const complianceRegistryCall_ : contract(attributesTransfersForAddressesParam) = case (get_entrypoint_opt("%attributesTransfersForAddresses", self.complianceRegistry) : option(contract(attributesTransfersForAddressesParam))) of | None -> failwith("RU02") | Some(x) -> x end;
		const attributesTransfersForAddressesParam_ : attributesTransfersForAddressesParam = record [
			addresses_ = (list [record [address_ = from_; side_ = "out"]; record [address_ = to_; side_ = "in"]] : list(addressSide));
			callback_ = (Tezos.self("%complianceRegistryCallback") : contract(list(userIdAttributesTransfersResult)));
      keys_ = list [user_aml_transfer_threshold_key; user_aml_monthly_threshold_key; user_aml_yearly_threshold_key];
      realm_ = realm_;
      trustedIntermediaries_ = trustedIntermediaries_
		];
		const op : operation = Tezos.transaction(attributesTransfersForAddressesParam_, 0tez, complianceRegistryCall_);
    const ops : list (operation) = list [op];
  } with (ops, self);

function complianceRegistryCallback(const self: state; const userIdAttributesTransfersResult_: list(userIdAttributesTransfersResult)): list(operation) is
  block {
    const fromUserIdAttributesTransfersResult_ = case List.head_opt(userIdAttributesTransfersResult_) of | None -> default_userid_attributes_transfers_result | Some(x) -> x end;
    var result : isTransferValidResult := _isTransferFromValid(self, fromUserIdAttributesTransfersResult_);
    if result.valid_ = transfer_valid_with_after_hook then block {
      const toUserIdAttributesTransfersResult_ = case List.head_opt(case List.tail_opt(userIdAttributesTransfersResult_) of | None -> (list [] : list(userIdAttributesTransfersResult)) | Some(x) -> x end) of | None -> default_userid_attributes_transfers_result | Some(x) -> x end;
      result := _isTransferToValid(self, toUserIdAttributesTransfersResult_);
    } else skip;
    const callback_ : contract(isTransferValidResult) = case (get_entrypoint_opt("%isTransferValidCb", self.ruleEngine) : option(contract(isTransferValidResult))) of | None -> failwith("RU02") | Some(x) -> x end;
    const op : operation = Tezos.transaction(result, 0tez, callback_);
    const ops : list (operation) = list [op];
  } with (ops);

function afterTransferHook(const self: state; const from_ : address; const to_: address; const amountInRefCurrency_: nat; const realm_: address) : (list(operation) * state) is
  block {
    failIfNotOwnerOrOperator(self);
		const complianceRegistryCall_ : contract(updateTransfersParam) = case (get_entrypoint_opt("%updateTransfers", self.complianceRegistry) : option(contract(updateTransfersParam))) of | None -> failwith("RU02") | Some(x) -> x end;
		const updateTransfersParam_ : updateTransfersParam = record [
      from_ = from_;
      to_ = to_;
      value_ = amountInRefCurrency_;
      realm_ = realm_;
		];
		const op : operation = Tezos.transaction(updateTransfersParam_, 0tez, complianceRegistryCall_);
    const ops : list (operation) = list [op];
  } with (ops, self);

function main (const action : entry_action; const self : state): (list(operation) * state)  is
case action of
| TransferOwnership(param) -> transferOwnership(self, param)
| RevokeOwnership(_param) -> revokeOwnership(self)
| IsOperator(param) -> isOperator(self, param.address_, param.callback_)
| AddOperator(param) -> addOperator(self, param)
| RemoveOperator(param) -> removeOperator(self, param)
| IsTransferValid(param) -> isTransferValid(self, param.from_, param.to_, param.amountInRefCurrency_, param.realm_, param.trustedIntermediaries_, param.ruleParam_)
| ComplianceRegistryCallback(param) -> (complianceRegistryCallback(self, param), self)
| BeforeTransferHook(_param) -> failwith("RU02")
| AfterTransferHook(param) -> afterTransferHook(self, param.from_, param.to_, param.amountInRefCurrency_, param.realm_)
end;

