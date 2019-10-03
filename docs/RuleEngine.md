## Rule specifications

Each rule in the Rule Engine has to implement the IRule interface:

```
  function isTransferValid(
    address _token, address _from, address _to, uint256 _amount, uint256 _ruleParam)
    external view returns (uint256 isValid, uint256 reason);
  function beforeTransferHook(
    address _token, address _from, address _to, uint256 _amount, uint256 _ruleParam)
    external returns (uint256 isValid, address updatedTo, uint256 updatedAmount);
  function afterTransferHook(
    address _token, address _from, address _to, uint256 _amount, uint256 _ruleParam)
    external returns (bool updateDone);
```

**isValid allowed values**

* **TRANSFER_INVALID** = 0 - *Returned when the transfer is invalid*
* **TRANSFER_VALID_WITH_NO_HOOK** = 1 - *Returned when the transfer is valid and no further action is needed*
* **TRANSFER_VALID_WITH_BEFORE_HOOK** = 2 - *Returned when the transfer is valid and the ``beforeTransferHook`` function of the same rule has to be called*
* **TRANSFER_VALID_WITH_AFTER_HOOK** = 3 - *Returned when the transfer is valid and the ``afterTransferHook`` function of the same rule has to be called*

## Rules index

1. [Global Freeze Rule](api.md#globalfreezerule)
2. [User Freeze Rule](api.md#userfreezerule)
3. [User Kyc Threshold From Rule](api.md#kycthresholdfromrule)
4. [User Kyc Threshold To Rule](api.md#kycthresholdtorule)
5. [User Valid Rule](api.md#uservalidrule)
6. [Hard Transfer Limit Rule](api.md#hardtransferlimitrule)
7. [Soft Transfer Limit Rule](api.md#softtransferlimitrule)
8. [Max Transfer Rule](api.md#maxtransferrule)
9. [Min Transfer Rule](api.md#mintransferrule)