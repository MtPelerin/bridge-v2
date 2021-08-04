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

import "../access/Operator.sol";
import "../interfaces/IERC20Detailed.sol";

contract TokenLocker is Operator {
  uint256 public constant VERSION = 1;

  /**
  * @dev Initializer (replaces constructor when contract is upgradable)
  * @param owner the final owner of the contract
  */
  function initialize(address owner) public override initializer {
    Operator.initialize(owner);
  }

  function lock(address _tokenAddress, bytes calldata _recipient, uint256 _value) external {
    address from = _msgSender();
    if (IERC20Detailed(_tokenAddress).transferFrom(from, address(this), _value)) {
      emit TokenLocked(from, _tokenAddress, _recipient, _value);
    }
  }

  function onTokenTransfer(address from, uint256 amount, bytes calldata recipient) external returns (bool) {
    emit TokenLocked(from, _msgSender(), recipient, amount);
    return true;
  }

  function unlock(address _tokenAddress, address _to, uint256 _value) public onlyOperator {
    IERC20Detailed(_tokenAddress).transfer(_to, _value);
  }

  fallback() external payable {
    revert("Not accepting ETH");
  }
  
  event TokenLocked(address indexed from, address indexed token, bytes to, uint256 value);
}