# Rule Engine API

## Storage

```
  type internal_state is record
    isTransferValidParam_: isTransferValidParam;
    ruleResponses_: map(int, ruleResponse);
    beforeTransferHookParam_: beforeTransferHookParam;
  end;

  owner: address;
  roles : roles;
  rules: map(int, address);
  internalState: internal_state;
```

## Entrypoints

- ````TransferOwnership of address````
- ````RevokeOwnership````
- ````IsOperator of isRoleParam````
- ````AddOperator of address````
- ````RemoveOperator of address````
- ````SetRules of map(int, address)````
- ````FindRuleId of findRuleIdParam````
- ````Rule of ruleParam````
- ````IsTransferValid of isTransferValidParam````
- ````IsTransferValidCb of isTransferValidResult````
- ````BeforeTransferHook of beforeTransferHookParam````
- ````BeforeTransferHookCb of beforeTransferHookResult````
- ````AfterTransferHook of afterTransferHookParam````

with

```
type isRoleParam is record
  address_: address;
  callback_: contract(bool);
end;

type findRuleIdParam is record
  callback_: contract(int);
  rule_: address;
end;

type isTransferValidParam is record 
  amount_: nat;
  amountInRefCurrency_: nat;
  canTransferCallbackAddress_: option(address); 
  from_: address;
  realm_: address;
  rules_: list(rule);
  to_: address;
  token_ : address;
  trustedIntermediaries_: list(address);
end;

type beforeTransferHookParam is record 
  amount_: nat;
  amountInRefCurrency_: nat;
  from_: address;
  realm_: address;
  ruleResponses_: map(int,ruleResponse);
  rules_: list(rule);
  to_: address;
  token_ : address;
  trustedIntermediaries_: list(address);
end;

type afterTransferHookParam is record
  amount_: nat;
  amountInRefCurrency_: nat;
  from_: address;
  realm_: address;
  ruleResponses_: map(int,ruleResponse);
  rules_: list(rule);
  to_: address;
  token_ : address;
  trustedIntermediaries_: list(address);
end;

type isTransferValidResult is record
  reason_: int;
  valid_: int;
end;

type beforeTransferHookResult is record
  valid_: int;
  to_: address;
  amount_: nat;
end;
```