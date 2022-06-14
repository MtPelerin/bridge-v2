function _keyWithInt(const address_: address; const int_: int) : bytes is Crypto.sha256(Bytes.pack((address_, int_)));
function _keyWithAddress(const address1_: address; const address2_: address) : bytes is Crypto.sha256(Bytes.pack((address1_, address2_)));
function _keyWithBytes(const bytes1_: bytes; const bytes2_: bytes) : bytes is Crypto.sha256(Bytes.pack((bytes1_, "/", bytes2_)));

function _merge_operation_lists(const list1 : list(operation); const list2 : list(operation)) : list(operation) is
  block {
    function operationIterator (var acc: list(operation); const op: operation) : list(operation) is 
      block {
        acc := op # acc;
      } with (acc);
  } with List.fold(operationIterator, list1, list2);