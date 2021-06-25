pragma solidity 0.6.2;


library CompactAddressArray {
  struct Data {
    mapping(uint256 => uint256) _raw;
  }

  function length(Data storage self) internal view returns(uint256) {
    return self._raw[0] >> 160;
  }

  function at(Data storage self, uint i) internal view returns(address) {
    return address(uint160(self._raw[i]));
  }

  function get(Data storage self) internal view returns(address[] memory arr) {
    uint256 lengthAndFirst = self._raw[0];
    uint256 len = lengthAndFirst >> 160;
    arr = new address[](len);
    arr[0] = address(uint160(lengthAndFirst));
    for (uint i = 1; i < len; i++) {
      arr[i] = address(uint160(self._raw[i]));
    }
  }

  function set(Data storage self, address[] memory arr) internal {
    self._raw[0] = (arr.length << 160) | (arr.length > 0 ? uint160(arr[0]) : 0);
    for (uint i = 1; i < arr.length; i++) {
      self._raw[i] = uint160(arr[i]);
    }
  }
}