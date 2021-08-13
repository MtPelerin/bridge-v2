type transfer is [@layout:comb] record 
  [@annot:from] from_: address;
  [@annot:to] to_: address;
  [@annot:value] amount_: nat
end;

type getBalanceParam is [@layout:comb] record
  [@annot:owner] owner_: address;
  [@annot:callback] callback_: contract(nat);
end;

type rule is record
  ruleId: int;
  ruleParam: nat;
end;

type ruleResponse is record
  reason_: int;
  ruleId_: int;
  valid_: int;
end;

type canTransferResponse is record
  isValid_: bool;
  ruleId_: int;
  reason_: int;
end;

type isTransferValidResponse is record
  amount_: nat;
  ruleResponses_: map(int,ruleResponse);
  from_: address;
  to_: address;
  canTransferCallbackAddress_: option(address); 
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

type isRoleParam is record
  address_: address;
  callback_: contract(bool);
end;

type userIdResult is record
  trustedIntermediary: address;
  userId: int;
end;

type userIdAttributeResult is record
  userIdResult: userIdResult;
  attribute: nat;
end;

type userIdAttributesResult is record
  userIdResult: userIdResult;
  attributes: list(nat);
end;

type userIdAttributesTransfersResult is record
  userIdResult: userIdResult;
  attributes: list(nat);
  monthly: nat;
  yearly: nat;
end;

type attributeForAddressParam is record
  address_: address;
  callback_: contract(userIdAttributeResult);
  key_: int;
  trustedIntermediaries_: list(address);
end;

type attributeForAddressesParam is record
  addresses_: list(address);
  callback_: contract(list(userIdAttributeResult));
  key_: int;
  trustedIntermediaries_: list(address);
end;

type attributesForAddressParam is record
  address_: address;
  callback_: contract(userIdAttributesResult);
  keys_: list(int);
  trustedIntermediaries_: list(address);
end;

type attributesForAddressesParam is record
  addresses_: list(address);
  callback_: contract(list(userIdAttributesResult));
  keys_: list(int);
  trustedIntermediaries_: list(address);
end;

type addressSide is record
  address_: address;
  side_: string
end;

type attributesTransfersForAddressesParam is record
  addresses_: list(addressSide);
  callback_: contract(list(userIdAttributesTransfersResult));
  keys_: list(int);
  realm_: address;
  trustedIntermediaries_: list(address);
end;

type isAddressesValidParam is record
  addresses_: list(address);
  callback_: contract(list(bool));
  trustedIntermediaries_: list(address);
end;

type updateTransfersParam is record  
  from_: address;
  realm_: address;
  to_: address;
  value_: nat;
end;

type addOnHoldTransferParam is record  
  amount_: nat;
  from_: address;
  to_: address;
  token_: address;
  trustedIntermediaries_: list(address);
end;

type onhold_transfer is record
  id_ : int;
  amount_ : nat;
  decision_: int;
  from_ : address;
  to_: address;
  token_: address;
end;


