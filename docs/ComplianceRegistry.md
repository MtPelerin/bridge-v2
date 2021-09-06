## Attributes nomenclature

Attributes is an array of uint256 for EVM chains, nat for Tezos chain.

Attribute id | Attribute name | Attribute description
--- | --- | ---
0 | **ATTRIBUTE_VALID_UNTIL** | User validity end date (*UNIX timestamp*)
100 | **ATTRIBUTE_USER_KYC** | User KYC level
110 | **ATTRIBUTE_AML_TRANSFER_LIMIT** | User single transfer limit in CHF  
111 | **ATTRIBUTE_AML_MONTHLY_LIMIT** | User monthly transfer limit in CHF  
112 | **ATTRIBUTE_AML_YEARLY_LIMIT** | User yearly transfer limit in CHF
120 | **ATTRIBUTE_FREEZE_DIRECTION** | User freeze direction  
  || *FREEZE_DIRECTION_NONE* (0) | Not frozen  
  || *FREEZE_DIRECTION_RECEIVE* (1) | Frozen as token receiver  
  || *FREEZE_DIRECTION_SEND* (2) | Frozen as token sender  
  || *FREEZE_DIRECTION_BOTH* (3) | Frozen as token sender and receiver  
121 | **ATTRIBUTE_FREEZE_START** | User freeze start date (*UNIX timestamp*)  
122 | **ATTRIBUTE_FREEZE_END** | User freeze end date (*UNIX timestamp*)  
123 | **ATTRIBUTE_FREEZE_INVERTED** | Specifies if start date and end date period has to be inverted  
  || *FREEZE_INVERTED_NO* (0) | Freeze period not inverted  
  || *FREEZE_INVERTED_YES* (1) | Freeze period inverted  