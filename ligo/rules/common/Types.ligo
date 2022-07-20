type isTransferValidResult is record
  reason_: int;
  valid_: int;
end;

type beforeTransferHookResult is record
  valid_: int;
  to_: address;
  amount_: nat;
end;

type transferParam is record
  amount_: nat;
  amountInRefCurrency_: nat;
  callback_: contract(isTransferValidResult);
  from_: address;
  realm_: address;
  ruleParam_ : nat;
  to_: address;
  token_ : address;
  trustedIntermediaries_: list(address);
end; 

type beforeHookParam is record
  amount_: nat;
  amountInRefCurrency_: nat;
  callback_: contract(beforeTransferHookResult);
  from_: address;
  realm_: address;
  ruleParam_ : nat;
  to_: address;
  token_ : address;
  trustedIntermediaries_: list(address);
end; 

type afterHookParam is record
  amount_: nat;
  amountInRefCurrency_: nat;
  from_: address;
  realm_: address;
  ruleParam_ : nat;
  to_: address;
  token_ : address;
  trustedIntermediaries_: list(address);
end; 


const transfer_invalid = 0;
const transfer_valid_with_no_hook = 1;
const transfer_valid_with_before_hook = 2;
const transfer_valid_with_after_hook = 3;

const reason_ok = 0;
