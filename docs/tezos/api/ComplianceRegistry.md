# Compliance Registry API

## Storage

```
  type user_attributes_map is map(bytes,user_attributes);
  type address_transfers_map is map(bytes,monthly_transfers);
  type address_users_map is big_map(bytes, int);
  type onhold_transfers_map is big_map(bytes,onhold_transfer);
  type trusted_intermediary_state_map is big_map(address,trusted_intermediary_state);
  type user_addresses_map is map(bytes,user_addresses); 

  addressTransfers: address_transfers_map;
  addressUsers: address_users_map;
  onHoldTransfers: onhold_transfers_map;
  owner: address;
  roles: roles;
  trustedIntermediaries: trusted_intermediary_state_map;
  userAttributes: user_attributes_map;
  userAddresses: user_addresses_map;
```

## Entrypoints

- ````TransferOwnership of address````
- ````RevokeOwnership````
- ````IsOperator of isRoleParam````
- ````AddOperator of address````
- ````RemoveOperator of address````
- ````UserCount of userCountParam````
- ````UserId of userIdParam````
- ````UserIds of userIdsParam````
- ````Attribute of attributeParam````
- ````AttributeForAddress of attributeForAddressParam````
- ````AttributeForAddresses of attributeForAddressesParam````
- ````ValidUntil of validUntilParam````
- ````Attributes of attributesParam````
- ````AttributesForAddress of attributesForAddressParam````
- ````AttributesForAddresses of attributesForAddressesParam````
- ````AttributesTransfersForAddresses of attributesTransfersForAddressesParam````
- ````IsValid of isValidParam````
- ````IsAddressValid of isAddressValidParam````
- ````IsAddressesValid of isAddressesValidParam````
- ````RegisterUser of registerUserParam````
- ````RegisterUsers of registerUsersParam````
- ````AttachAddress of attachAddressParam````
- ````AttachAddresses of attachAddressesParam````
- ````DetachAddress of address````
- ````DetachAddresses of list(address)````
- ````UpdateUserAttributes of updateUserAttributesParam````
- ````UpdateUsersAttributes of updateUsersAttributesParam````
- ````UpdateTransfers of updateTransfersParam````
- ````MonthlyTransfers of xlyTransfersParam````
- ````YearlyTransfers of xlyTransfersParam````
- ````MonthlyInTransfers of xlyTransfersParam````
- ````MonthlyOutTransfers of xlyTransfersParam````
- ````YearlyInTransfers of xlyTransfersParam````
- ````YearlyOutTransfers of xlyTransfersParam````
- ````AddOnHoldTransfer of addOnHoldTransferParam````
- ````GetOnHoldTransfers of getOnHoldTransfersParam````
- ````ProcessOnHoldTransfer of processOnHoldTransferParam````
- ````UpdateOnHoldMinBoundary of int````
- ````CancelOnHoldTransfer of cancelOnHoldTransferParam````

with

```
type userCountParam is record
  callback_: contract(int);
  trustedIntermediary_: address;
end;

type userIdParam is record
  address_: address;
  callback_: contract(userIdResult);
  trustedIntermediaries_: list(address);
end;

type userIdsParam is record
  addresses_: list(address);
  callback_: contract(list(userIdResult));
  trustedIntermediaries_: list(address);
end;

type attributeParam is record
  callback_: contract(nat);
  key_: int;
  trustedIntermediary_: address;
  userId_: int;
end;

type validUntilParam is record
  callback_: contract(nat);
  trustedIntermediary_: address;
  userId_: int;
end;

type attributesParam is record  
  callback_: contract(list(nat));
  keys_: list(int);
  trustedIntermediary_: address;
  userId_: int;
end;

type isValidParam is record
  callback_: contract(bool);
  trustedIntermediary_: address;
  userId_: int;
end;

type isAddressValidParam is record
  address_: address;
  callback_: contract(bool);
  trustedIntermediaries_: list(address);
end;

type registerUserParam is record
  address_: address;
  attributeKeys_: list(int);
  attributeValues_: list(nat);
end;

type registerUsersParam is record
  addresses_: list(address);
  attributeKeys_: list(int);
  attributeValues_: list(nat);
end;

type attachAddressParam is record
  address_: address;
  userId_: int;
end;

type attachAddressesParam is record
  addresses_: list(address);
  userIds_: list(int);
end;

type updateUserAttributesParam is record
  attributeKeys_: list(int);
  attributeValues_: list(nat);
  userId_: int;
end;

type updateUsersAttributesParam is record
  attributeKeys_: list(int);
  attributeValues_: list(nat);
  userIds_: list(int);
end;

type xlyTransfersParam is record
  address_: address;
  callback_: contract(nat);
  realm_: address;
  trustedIntermediaries_: list(address);
end;

type getOnHoldTransfersParam is record
  callback_: contract(list(onhold_transfer));
  trustedIntermediary_: address;
end;

type processOnHoldTransferParam is record
  amountInRefCurrency_: nat;
  realm_: address;
  skipMinBoundaryUpdate_: bool;
  transferDecision_: int;
  transferId_: int;
end;

type cancelOnHoldTransferParam is record
  skipMinBoundaryUpdate_: bool;
  transferId_: int;
  trustedIntermediary_: address;
end;
```