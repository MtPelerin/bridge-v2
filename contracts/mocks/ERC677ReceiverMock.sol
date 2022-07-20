pragma solidity 0.6.2;

contract ERC677ReceiverMock {
    event ERC677ReceiverMockedEvent(address indexed from, uint256 indexed amount, bytes encodedData);

    function onTokenTransfer(address from, uint256 amount, bytes calldata data) external returns (bool) {
        emit ERC677ReceiverMockedEvent(from, amount, data);
        return true;
    }
}
