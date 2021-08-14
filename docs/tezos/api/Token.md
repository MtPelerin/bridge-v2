# Compliance Registry API

## Storage

```
  type account is record
    balance: nat;
    allowances: map (address, nat);
  end;
  type rule is record
    ruleId: int;
    ruleParam: nat;
  end;
  type price is record
    price: nat;
    decimals: nat;
    lastUpdated: timestamp;
  end;
  
  owner: address;
  roles: roles;
  name: string;
  symbol: string;
  totalSupply: nat;
  ledger: big_map(address, account);
  rules: list(rule);
  trustedIntermediaries: list(address);
  realm: address;
  prices: big_map(string, price);
  ruleEngine: address;
  contact: string;
  tokenizedSharePercentage: nat;
  boardResolutionDocumentUrl: string;
  boardResolutionDocumentHash: bytes;
  tempRealm: address;
  decimals: nat;
```

## Entrypoints

- ````TransferOwnership of address````
- ````RevokeOwnership````
- ````IsAdministrator of isRoleParam````
- ````AddAdministrator of address````
- ````RemoveAdministrator of address````
- ````IsRealmAdministrator of isRoleParam````
- ````AddRealmAdministrator of address````
- ````RemoveRealmAdministrator of address````
- ````IsSupplier of isRoleParam````
- ````AddSupplier of address````
- ````RemoveSupplier of address````
- ````IsSeizer of isRoleParam````
- ````AddSeizer of address````
- ````RemoveSeizer of address````
- ````Mint of mintParam````
- ````Burn of burnSeizeParam````
- ````Seize of burnSeizeParam````
- ````Rules of contract(list(rule))````
- ````SetRules of list(rule)````
- ````CanTransfer of canTransferParam````
- ````CanTransferIsTransferValidCb of isTransferValidResponse````
- ````SetRealm of address````
- ````SetRealmIsRealmAdministratorCb of bool````
- ````SetTrustedIntermediaries of list(address)````
- ````SetRuleEngine of address````
- ````SetTokenizedSharePercentage of nat````
- ````SetBoardResolutionDocument of setBoardResolutionDocumentParam````
- ````SetContact of string````
- ````Name of contract(string)````
- ````Symbol of contract(string)````
- ````Decimals of contract(nat)````
- ````GetTotalSupply of getTotalSupplyParam````
- ````Transfer of transfer````
- ````TransferIsTransferValidCb of isTransferValidResponse````
- ````TransferBeforeTransferHookCb of isTransferValidResponse````
- ````Approve of approveParam````
- ````GetBalance of getBalanceParam````
- ````GetAllowance of getAllowanceParam````
- ````IncreaseApproval of approveParam````
- ````DecreaseApproval of approveParam````
- ````SetPrices of setPricesParam````
- ````SetPrice of setPriceParam````
- ````GetPrice of getPriceParam````
- ````GetPriceLastUpdated of getPriceLastUpdatedParam````
- ````ConvertTo of convertToParam````

with

```
type isRoleParam is record
  address_: address;
  callback_: contract(bool);
end;

type mintParam is record
  amount_: nat;
  to_: address;
end;

type burnSeizeParam is record
  amount_: nat;
  from_: address;
end;

type canTransferParam is record
  amount_: nat;
  callbackAddress_: address;
  from_: address;
  to_: address;
end;

type isTransferValidResponse is record
  amount_: nat;
  ruleResponses_: map(int,ruleResponse);
  from_: address;
  to_: address;
  canTransferCallbackAddress_: option(address); 
end;

type transfer is [@layout:comb] record 
  [@annot:from] from_: address;
  [@annot:to] to_: address;
  [@annot:value] amount_: nat
end;

type getBalanceParam is [@layout:comb] record
  [@annot:owner] owner_: address;
  [@annot:callback] callback_: contract(nat);
end;

type setBoardResolutionDocumentParam is record
  boardResolutionDocumentHash_: bytes;
  boardResolutionDocumentUrl_: string;
end;

type allowanceKey is record
  [@annot:owner] owner_: address;
  [@annot:spender] spender_: address;
end;

type getAllowanceParam is [@layout:comb] record
  request : allowanceKey;
  [@annot:callback] callback_: contract(nat);
end;

type getTotalSupplyParam is [@layout:comb] record
  request: unit;
  [@annot:callback] callback_: contract(nat);
end;

type approveParam is record
  [@annot:value] amount_: nat;
  [@annot:spender] spender_: address;
end;

type setPricesParam is record
  currencies_: list(string);
  decimals_: list(nat);
  prices_: list(nat);
end;

type setPriceParam is record
  currency_: string;
  decimal_: nat;
  price_: nat;
end;

type getPriceParam is record
  callback_: contract((nat * nat));
  currency_: string;
end;

type getPriceLastUpdatedParam is record
  callback_: contract(timestamp);
  currency_: string;
end;

type convertToParam is record
  amount_: nat;
  callback_: contract(nat);
  currency_: string;
  maxDecimals_: nat;
end;
```