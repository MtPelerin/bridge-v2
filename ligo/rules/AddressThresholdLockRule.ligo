#include "../common/Keys.ligo"
#include "../common/Utils.ligo"
#include "../common/Types.ligo"
#include "./common/Types.ligo"

const reason_locked_threshold_reached = 1;

type setAddressLockThresholdParam is record
  addressToLock_: address;
  lockThreshold_: nat;
  token_: address;
end;

type addressLockThresholdParam is record
  addressToLock_: address;
  callback_: contract(nat);
  token_: address;
end;

type entry_action is 
 | SetAddressLockThreshold of setAddressLockThresholdParam
 | AddressLockThreshold of addressLockThresholdParam
 | TokenBalanceCallback of nat
 | TokenIsAdministratorCallback of bool
 | IsTransferValid of transferParam
 | BeforeTransferHook of transferParam
 | AfterTransferHook of transferParam

type address_threshold_lock is big_map(bytes, nat);

type internal_callback_state is record
  token_: address;
  address_: address;
  amount_: nat;
end;

type state is record 
  internalState: internal_callback_state;
  ruleEngine: address;
  addressThresholdLock: address_threshold_lock;
end;

function setAddressLockThreshold(var self: state; const token_: address; const addressToLock_: address; const lockThreshold_: nat) : (list(operation) * state) is
  block {
		patch self.internalState with record[token_ = token_; address_ = addressToLock_; amount_ = lockThreshold_];
		const isAdministratorCall_ : contract(isRoleParam) = case (get_entrypoint_opt("%isAdministrator", token_) : option(contract(isRoleParam))) of | None -> failwith("AD01") | Some(x) -> x end;
		const isAdministratorParam_ : isRoleParam = record [
			address_ = Tezos.sender;
			callback_ = (Tezos.self("%tokenIsAdministratorCallback") : contract(bool));
		];
		const op : operation = Tezos.transaction(isAdministratorParam_, 0tez, isAdministratorCall_);
    const ops : list (operation) = list [op]
  } with (ops, self)

function tokenIsAdministratorCallback(var self: state; const isAdministrator_: bool) : (list(operation) * state) is 
  block {
		require(Tezos.sender = self.internalState.token_, "TO02");
		require(isAdministrator_ = True, "AD01");
		const addressKey_ : bytes = _keyWithAddress(self.internalState.token_, self.internalState.address_);
		self.addressThresholdLock[addressKey_] := self.internalState.amount_;
	} with(noOperations, self)

function addressLockThreshold(const self: state; const token_ : address; const addressToLock_: address; const callback_: contract(nat)) : list(operation) is
  block {
    const addressKey_: bytes = _keyWithAddress(token_, addressToLock_);
		const threshold_: nat = case self.addressThresholdLock[addressKey_] of | None -> 0n | Some(x) -> x end;
		const op : operation = Tezos.transaction(threshold_, 0tez, callback_);
    const ops : list (operation) = list [op]
  } with (ops);

function isTransferValid(var self: state; const token_ : address; const from_ : address; const amount_ : nat) : (list(operation) * state) is
  block {
    self.internalState.token_ := token_;
    self.internalState.address_ := from_;
    self.internalState.amount_ := amount_;
		const balanceCall_ : contract(getBalanceParam) = case (get_entrypoint_opt("%getBalance", token_) : option(contract(getBalanceParam))) of | None -> failwith("TO01") | Some(x) -> x end;
		const getBalanceParam_ : getBalanceParam = record [
			owner_ = from_;
			callback_ = (Tezos.self("%tokenBalanceCallback") : contract(nat));
		];
		const op : operation = Tezos.transaction(getBalanceParam_, 0tez, balanceCall_);
    const ops : list (operation) = list [op];
  } with (ops, self);

function tokenBalanceCallback(const self: state; const balance_: nat) : (list(operation) * state) is
  block {
    require(Tezos.sender = self.internalState.token_, "TO02");
    var result : isTransferValidResult := record [
      valid_ = transfer_valid_with_no_hook;
      reason_ = reason_ok;
    ];
    if balance_ > 0n then
		  block {
				const addressKey_ : bytes = _keyWithAddress(self.internalState.token_, self.internalState.address_);
				const threshold_: nat = case self.addressThresholdLock[addressKey_] of | None -> 0n | Some(x) -> x end;
				if self.internalState.amount_ <= balance_ and abs(balance_ - self.internalState.amount_) < threshold_ then
					result := record [valid_ = transfer_invalid; reason_ = reason_locked_threshold_reached];
				else skip;
			}
    else skip;
    const callback_ : contract(isTransferValidResult) = case (get_entrypoint_opt("%isTransferValidCb", self.ruleEngine) : option(contract(isTransferValidResult))) of | None -> failwith("RU02") | Some(x) -> x end;
    const op : operation = Tezos.transaction(result, 0tez, callback_);
    const ops : list (operation) = list [op]
  } with (ops, self);

function main (const action : entry_action; const self : state): (list(operation) * state)  is
case action of
| SetAddressLockThreshold(param) -> setAddressLockThreshold(self, param.token_, param.addressToLock_, param.lockThreshold_)
| AddressLockThreshold(param) -> (addressLockThreshold(self, param.token_, param.addressToLock_, param.callback_), self)
| TokenBalanceCallback(param) -> tokenBalanceCallback(self, param)
| TokenIsAdministratorCallback(param) -> tokenIsAdministratorCallback(self, param)
| IsTransferValid(param) -> isTransferValid(self, param.token_, param.from_, param.amount_)
| BeforeTransferHook(_param) -> failwith("RU02")
| AfterTransferHook(_param) -> failwith("RU02")
end

