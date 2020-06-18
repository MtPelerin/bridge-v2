/*
    Copyright (c) 2019 Mt Pelerin Group Ltd

    This program is free software; you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License version 3
    as published by the Free Software Foundation with the addition of the
    following permission added to Section 15 as permitted in Section 7(a):
    FOR ANY PART OF THE COVERED WORK IN WHICH THE COPYRIGHT IS OWNED BY
    MT PELERIN GROUP LTD. MT PELERIN GROUP LTD DISCLAIMS THE WARRANTY OF NON INFRINGEMENT
    OF THIRD PARTY RIGHTS

    This program is distributed in the hope that it will be useful, but
    WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
    or FITNESS FOR A PARTICULAR PURPOSE.
    See the GNU Affero General Public License for more details.
    You should have received a copy of the GNU Affero General Public License
    along with this program; if not, see http://www.gnu.org/licenses or write to
    the Free Software Foundation, Inc., 51 Franklin Street, Fifth Floor,
    Boston, MA, 02110-1301 USA, or download the license from the following URL:
    https://www.gnu.org/licenses/agpl-3.0.fr.html

    The interactive user interfaces in modified source and object code versions
    of this program must display Appropriate Legal Notices, as required under
    Section 5 of the GNU Affero General Public License.

    You can be released from the requirements of the license by purchasing
    a commercial license. Buying such a license is mandatory as soon as you
    develop commercial activities involving Mt Pelerin Group Ltd software without
    disclosing the source code of your own applications.
    These activities include: offering paid services based/using this product to customers,
    using this product in any application, distributing this product with a closed
    source product.

    For more information, please contact Mt Pelerin Group Ltd at this
    address: hello@mtpelerin.com
*/

pragma solidity 0.6.2;
pragma experimental ABIEncoderV2;

import "@opengsn/gsn/contracts/BasePaymaster.sol";

contract TargetMethodPaymaster is BasePaymaster {
    event TargetMethodUpdated(address target);

	mapping(address => bytes4[]) public targets;  

	/**
  * @dev Set the functions we are willing to pay gas for for a specific contract address
  * @param target the contract address
  * @param methods the encoded method IDs
	*/
	function setTarget(address target, bytes4[] calldata methods) external onlyOwner {
		targets[target] = methods;
		emit TargetMethodUpdated(target);
	}

	/**
  * @dev checks whether we should accept relay cal
  * @param relayRequest GSNTypes.RelayRequest containing request data (target and encodedFunction)
  * @return context the timestamp at which the request was accepted
  */
	function acceptRelayedCall(
		GSNTypes.RelayRequest calldata relayRequest,
    bytes calldata /* signature */,
		bytes calldata /* approvalData */, 
		uint256 /* maxPossibleGas */
	) external view override returns (bytes memory) {
    bytes4 methodId = _getMethodId(relayRequest.encodedFunction);
		for(uint256 i = 0; i < targets[relayRequest.target].length; i++) {
		  if (targets[relayRequest.target][i] == methodId) {
			  return abi.encode(now);
		  }
		}
		revert("PM01");
	}

	function preRelayedCall(
		bytes calldata /* context */
	) external relayHubOnly override returns(bytes32) {
		return bytes32(0);
	}

	function postRelayedCall(
		bytes calldata /* context */,
		bool /* success */,
		bytes32 /* preRetVal */,
		uint256 /* gasUse */,
		GSNTypes.GasData calldata /* gasData */
	) external relayHubOnly override {
	}

  function versionPaymaster() external override view returns (string memory) {
    return "2.0.0";
  }

  function _getMethodId(bytes memory encodedFunction) internal pure returns (bytes4) {
    bytes4 methodId;
    assembly {
      methodId := mload(add(encodedFunction, 32))
    }
    return methodId;
  }
} 