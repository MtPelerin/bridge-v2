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

import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "../gsn_1/GsnUtils.sol";
import "../gsn_1/IRelayHub.sol";
import "../gsn_1/RelayRecipient.sol";
import "../access/Operator.sol";

/**
* @title ShareholderMeeting
* @dev ShareholderMeeting enables the organisation of the voting part of a shareholder meeting
*
* Error messages
* VO01: names length is not the same as urls length
* VO02: names length is not the same as proposals length
* VO03: voters length is not the same as weights length
* VO04: delegate cannot be 0x0
* VO05: caller not allowed has delegate
* VO06: voter has not been invited to vote
* VO07: Resolution id overflow
* VO08: Proposal id overflow
* VO09: Resolution already voted
* VO10: Resolution is not open for vote
* VO11: Voting session has already been open
*/


contract ShareholderMeeting is Initializable, Operator, RelayRecipient {
  using SafeMath for uint256;

  uint256 public constant VERSION = 1;
  address private constant RELAY_HUB = 0xD216153c06E857cD7f72665E0aF1d7D82172F494;
  bytes4 private constant VOTE_METHOD_ID = 0x2a4a1b73;
  bytes4 private constant DELEGATE_METHOD_ID = 0xb31e1d4d;
          
  event ResolutionAdded(bytes32 indexed name, bytes32 url, uint256 proposalCount);
  event ResolutionOpen(uint256 votingEnd);
  event VoterRegistered(address indexed voter, uint256 weight);
  event Vote(address indexed voter, uint256 indexed resolutionId, uint256 indexed proposalId, uint256 weight);

  struct Resolution {
    bytes32 name;
    bytes32 url;
    uint256[] proposals;
    uint256 votingEnd;
  }

  struct Voter {
    uint256 weight;
    address delegate;
    mapping(uint256 => bool) voted;
  }

  bool votingStarted;
  mapping(address => Voter) public voters;
  Resolution[] public resolutions;

  /**
  * @dev Initializer (replaces constructor when contract is upgradable)
  * @param owner the final owner of the contract
  */
  function initialize(address owner) public override initializer {
    Operator.initialize(owner);
    setRelayHub(IRelayHub(RELAY_HUB));
  }


  /**
   * @dev Throws VO11 if called after voting session starts
   */
  modifier beforeVotingSession {
    require(!votingStarted, "VO11");
    _;
  }

  /**
  * @dev Throws VO14 if caller is not voter
  */
  modifier isVoter {
    require(voters[getSender()].weight > 0, "VO06");
    _;
  }

  /**
  * @dev Adds a new set of resolutions to the voting session
  * @dev Throws VO01 if names length is not the same as urls length
  * @dev Throws VO02 if names length is not the same as proposal counts length
  * @dev Throws VO11 if the voting session has already started
  * @param _names Array of vote names
  * @param _urls Array of bytes where each vote details can be found
  * @param _proposalCounts Array containing the count of proposals for each vote (proposals should be detailed in the vote url)
  */
  function addResolutions(bytes32[] calldata _names, bytes32[] calldata _urls, uint256[] calldata _proposalCounts) external onlyOperator beforeVotingSession {
    require(_names.length == _urls.length, "VO01");
    require(_names.length == _proposalCounts.length, "VO02");
    for (uint256 i = 0; i < _names.length; i++) {
      resolutions.push(Resolution(_names[i], _urls[i], new uint256[](_proposalCounts[i]), 0));
      emit ResolutionAdded(_names[i], _urls[i], _proposalCounts[i]);
    }
  }

  /**
  * @dev Sets a resolution a open for voting
  * @dev Throws VO07 if resolution id overflows
  * @param resolutionId the id of the resolution to open
  * @param voteDuration the duration in seconds during which the vote is possible
  */
  function openResolutionVote(uint256 resolutionId, uint256 voteDuration) external onlyOperator {
    require(resolutionId < resolutions.length, "VO07");
    if (!votingStarted) {
      votingStarted = true;
    }
    resolutions[resolutionId].votingEnd = now.add(voteDuration);
    emit ResolutionOpen(resolutions[resolutionId].votingEnd);
  }

  /**
  * @dev Returns the number of resolutions in the voting session
  * @return resolutionCount Number of resolutions in the voting session
  */
  function resolutionCount() public view returns (uint256) {
    return resolutions.length;
  }

  /**
  * @dev Set the addresses allowed to vote with their respective weight
  * @dev Throws VO02 if voters length is not the same as weights length
  * @dev Throws VO11 if the voting session has already started
  * @param _voters array of addresses allowed to vote
  * @param _weights array of weigths, each weight corresponding to a voter
  */
  function registerVoters(address[] calldata _voters, uint256[] calldata _weights) external onlyOperator beforeVotingSession {
    require(_voters.length == _weights.length, "VO03");
    for (uint256 i = 0; i < _voters.length; i++) {
      voters[_voters[i]].weight = _weights[i];
      emit VoterRegistered(_voters[i], _weights[i]);
    }
  }

  /**
  * @dev Allows a voter or potential voter to delegate their vote to another address
  * @dev Throws VO03 if the delegate is 0x0
  * @dev Throws VO11 if the voting session has already started
  * @param delegate The address of the delegate
  */
  function delegateVote(address delegate) public isVoter beforeVotingSession {
    require(delegate != address(0), "VO04");
    voters[getSender()].delegate = delegate;
  }

  /**
  * @dev Allows a voter (or his delegate) to vote for a proposal in a vote
  * @dev Throws VO05 if function caller is not allowed to vote for voter (not voter or not delegate)
  * @dev Throws VO06 if voter has not been registered
  * @dev Throws VO07 if resolution id overflows
  * @dev Throws VO08 if proposal id overflows
  * @dev Throws VO09 if voter has already voted for this resolution
  * @param voter the final voter address 
  * @param resolutionId Id of the resolution to vote for
  * @param proposalId Id of the proposal to vote for
  */
  function vote(address voter, uint256 resolutionId, uint256 proposalId) public {
    require(resolutionId < resolutions.length, "VO07");
    require(proposalId < resolutions[resolutionId].proposals.length, "VO08");
    require(resolutions[resolutionId].votingEnd > 0 && resolutions[resolutionId].votingEnd > now, "VO10");
    // Check if function caller is allowed to vote
    require(voter == getSender() || voters[voter].delegate == getSender(), "VO05");
    require(voters[voter].weight > 0, "VO06");
    require(voters[voter].voted[resolutionId] == false, "VO09");
    voters[voter].voted[resolutionId] = true;
    resolutions[resolutionId].proposals[proposalId] = resolutions[resolutionId].proposals[proposalId].add(voters[voter].weight);
    emit Vote(voter, resolutionId, proposalId, voters[voter].weight);
  }

  /**
  * @dev Returns the proposals results for a vote
  * @dev Throws VO07 if resolution id overflows
  * @param resolutionId Id of the resolution
  * @return array of result for each proposal
  */
  function getResolutionResults(uint256 resolutionId) public view returns (uint256[] memory) {
    require(resolutionId < resolutions.length, "VO07");
    return resolutions[resolutionId].proposals;
  }

  /**
  * @dev Returns if a voter has voted for a specific resolution
  * @dev Throws VO07 if resolution id overflows
  * @param voter Address of the voter
  * @param resolutionId Id of the resolution
  * @return true if the voter has voted, false otherwise
  */
  function hasVotedForResolution(address voter, uint256 resolutionId) public view returns (bool) {
    require(resolutionId < resolutions.length, "VO07");
    return voters[voter].voted[resolutionId];
  }

  function preRelayedCall(bytes calldata /* context */) external override returns (bytes32) {
  }

  function acceptRelayedCall(
      address /* relay */,
      address /* from */,
      bytes calldata encodedFunction,
      uint256 /* transactionFee */,
      uint256 /* gasPrice */,
      uint256 /* gasLimit  */,
      uint256 /* nonce */,
      bytes calldata /* approvalData */,
      uint256 /* maxPossibleCharge */
  )
  external
  override
  view
  returns (uint256, bytes memory) {
    bytes4 methodId = _getMethodId(encodedFunction);
    if (methodId == VOTE_METHOD_ID || methodId == DELEGATE_METHOD_ID) {
      return (0, abi.encode(now));
    }
    return (1, '');
  }

  function postRelayedCall(bytes calldata /* context */, bool /* success */, uint /* actualCharge */, bytes32 /*  preRetVal */) external override {
  }

  function _getMethodId(bytes memory encodedFunction) internal pure returns (bytes4) {
    bytes4 methodId;
    assembly {
      methodId := mload(add(encodedFunction, 32))
    }
    return methodId;
  }

  function withdraw() public onlyOperator {
    uint256 balance = getRelayHub().balanceOf(address(this));
    getRelayHub().withdraw(balance, payable(address(this)));
    msg.sender.transfer(balance);
  }
}
