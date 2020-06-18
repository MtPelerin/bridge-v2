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

require('chai/register-should');
const { expectEvent, shouldFail } = require('openzeppelin-test-helpers');

const bytes32 = function (val) {
  return web3.utils.fromAscii(val);
};

const bytes32Pad = function (val) {
  return web3.utils.fromAscii(val).padEnd(66, '0');
};

const timeout = function (ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const Contract = artifacts.require('ShareholderMeeting');

contract('ShareholderMeeting', function ([_, owner, operator, address1, address2, address3, address4, address5, address6, relay, from]) {
  beforeEach(async function () {
    this.contract = await Contract.new({from: owner});
  });

  context('When owner', function () {
    it('has proper owner', async function () {
      (await this.contract.owner()).should.equal(owner);
    });

    context('Add new resolutions', function () {
      it('can add new resolutions in the session', async function () {
        (await this.contract.resolutionCount()).should.be.bignumber.equal('0');
        ({ logs: this.logs } = await this.contract.addResolutions([bytes32('QUESTION1'), bytes32('QUESTION2')], [bytes32('https://mtpelerin.com/v1/q1'), bytes32('https://mtpelerin.com/v1/q2')], [2, 3], {from: owner, gas: 500000}));
        (await this.contract.resolutionCount()).should.be.bignumber.equal('2');
      });

      it('emits 2 ResolutionAdded events', function () {
        this.logs.should.have.length(2);
        this.logs[0].args.should.have.property('name', bytes32Pad('QUESTION1'));
        this.logs[1].args.should.have.property('name', bytes32Pad('QUESTION2'));
        this.logs[0].args.should.have.property('url', bytes32Pad('https://mtpelerin.com/v1/q1'));
        this.logs[1].args.should.have.property('url', bytes32Pad('https://mtpelerin.com/v1/q2'));
        this.logs[0].args.should.have.property('proposalCount');
        this.logs[0].args.proposalCount.should.be.bignumber.equal('2');
        this.logs[1].args.should.have.property('proposalCount');
        this.logs[1].args.proposalCount.should.be.bignumber.equal('3');
      });

      it('reverts if names array length is different than urls array length', async function () {
        await shouldFail.reverting.withMessage(this.contract.addResolutions([bytes32('QUESTION1')], [bytes32('https://mtpelerin.com/v1/q1'), bytes32('https://mtpelerin.com/v1/q2')], [2, 3], {from: owner, gas: 500000}), "VO01");
      });

      it('reverts if names array length is different than proposalCount array length', async function () {
        await shouldFail.reverting.withMessage(this.contract.addResolutions([bytes32('QUESTION1'), bytes32('QUESTION2')], [bytes32('https://mtpelerin.com/v1/q1'), bytes32('https://mtpelerin.com/v1/q2')], [2, 3, 4], {from: owner, gas: 500000}), "VO02");
      });
    });

    context('Register voters', function () {
      it('can add new voters in the session', async function () {
        ({ logs: this.logs } = await this.contract.registerVoters([address1, address2, address3, address4, address5], [100, 200, 300, 400, 500], {from: owner, gas: 500000}));
      });

      it('emits 5 VoterRegistered events', function () {
        this.logs.should.have.length(5);
        this.logs[0].args.should.have.property('voter', address1);
        this.logs[1].args.should.have.property('voter', address2);
        this.logs[2].args.should.have.property('voter', address3);
        this.logs[3].args.should.have.property('voter', address4);
        this.logs[4].args.should.have.property('voter', address5);
        this.logs[0].args.should.have.property('weight');
        this.logs[0].args.weight.should.be.bignumber.equal('100');
        this.logs[1].args.should.have.property('weight');
        this.logs[1].args.weight.should.be.bignumber.equal('200');
        this.logs[2].args.should.have.property('weight');
        this.logs[2].args.weight.should.be.bignumber.equal('300');
        this.logs[3].args.should.have.property('weight');
        this.logs[3].args.weight.should.be.bignumber.equal('400');
        this.logs[4].args.should.have.property('weight');
        this.logs[4].args.weight.should.be.bignumber.equal('500');

      });

      it('reverts if voters array length is different than weights array length', async function () {
        await shouldFail.reverting.withMessage(this.contract.registerVoters([address1, address2, address3, address4], [100, 200, 300, 400, 500], {from: owner, gas: 500000}), "VO03");
      });
    });    

    context('Open resolution for vote', function () {
      beforeEach(async function () {
        await this.contract.addResolutions([bytes32('QUESTION1'), bytes32('QUESTION2')], [bytes32('https://mtpelerin.com/v1/q1'), bytes32('https://mtpelerin.com/v1/q2')], [2, 3], {from: owner, gas: 500000});      
      });

      it('can open resolution for vote', async function () {
        ({ logs: this.logs } = await this.contract.openResolutionVote(0, 300, {from: owner}));
      });

      it('emits ResolutionOpen event', function () {
        this.logs[0].args.should.have.property('votingEnd');
      });

      it('reverts if trying to open resolution that does not exist', async function () {
        await shouldFail.reverting.withMessage(this.contract.openResolutionVote(3, 300, {from: owner}), "VO07");
      });
    });  

    context('When voting started', function () {
      beforeEach(async function () {
        ({ logs: this.logs } = await this.contract.addResolutions([bytes32('QUESTION1'), bytes32('QUESTION2')], [bytes32('https://mtpelerin.com/v1/q1'), bytes32('https://mtpelerin.com/v1/q2')], [2, 3], {from: owner, gas: 500000}));
        await this.contract.openResolutionVote(0, 300, {from: owner});
      });

      it('reverts when trying to add new resolutions in the session', async function () {
        await shouldFail.reverting.withMessage(this.contract.addResolutions([bytes32('QUESTION1'), bytes32('QUESTION2')], [bytes32('https://mtpelerin.com/v1/q1'), bytes32('https://mtpelerin.com/v1/q2')], [2, 3], {from: owner, gas: 500000}), "VO11");
      });

      it('reverts when trying to register new voters in the session', async function () {
        await shouldFail.reverting.withMessage(this.contract.registerVoters([address1, address2, address3, address4, address5], [100, 200, 300, 400, 500], {from: owner, gas: 500000}), "VO11");
      });
    });
  });

  context('When standard user', function () {
    beforeEach(async function () {
      await this.contract.addResolutions([bytes32('QUESTION1'), bytes32('QUESTION2')], [bytes32('https://mtpelerin.com/v1/q1'), bytes32('https://mtpelerin.com/v1/q2')], [2, 3],{from: owner, gas: 500000})
      await this.contract.registerVoters([address1, address2, address3, address4], [100, 200, 300, 400],{from: owner, gas: 500000})
    });

    it('can get the contract version', async function () {
      (await this.contract.VERSION()).should.be.bignumber.equal('1');
    });

    context('Security model', function () {
      it('reverts if trying to withdraw deposited ETH', async function () {
        await shouldFail.reverting.withMessage(this.contract.withdraw({from: address1, gas: 500000}), "Ownable: caller is not the owner");
      });
    });

    context('Resolutions', function () {
      it('can get resolution count', async function () {
        (await this.contract.resolutionCount()).should.be.bignumber.equal('2');
      });

      it('can get resolution information by id', async function () {
        const ret = await this.contract.resolutions(0);
        ret['0'].should.equal(bytes32Pad('QUESTION1'));
        ret['1'].should.equal(bytes32Pad('https://mtpelerin.com/v1/q1'));
      });

      it('reverts if trying to add new resolutions when not authorized', async function () {
        await shouldFail.reverting.withMessage(this.contract.addResolutions([bytes32('QUESTION1'), bytes32('QUESTION2')], [bytes32('https://mtpelerin.com/v1/q1'), bytes32('https://mtpelerin.com/v1/q2')], [2, 3],{from: address1, gas: 500000}), "Ownable: caller is not the owner");
      });

      it('reverts if trying to open resolution for voting when not authorized', async function () {
        await shouldFail.reverting.withMessage(this.contract.openResolutionVote(0, 300,{from: address1}), "Ownable: caller is not the owner");
      });
    });

    context('Voters', function () {
      context('Before vote session start', function () {
        it('can delegate vote to a delegate', async function () {
          await this.contract.delegateVote(address5,{from: address1});
          const ret = await this.contract.voters(address1);
          ret['0'].should.be.bignumber.equal('100');
          ret['1'].should.equal(address5);
        });

        it('reverts if trying to delegate vote when not voter', async function () {
          await shouldFail.reverting.withMessage(this.contract.delegateVote(address5,{from: address6}), "VO06");
        });

        it('reverts if trying to add new voters when not authorized', async function () {
          await shouldFail.reverting.withMessage(this.contract.registerVoters([address1, address2, address3, address4, address5], [100, 200, 300, 400, 500],{from: address1, gas: 500000}), "Ownable: caller is not the owner");
        });

        it('reverts if trying to vote', async function () {
          await shouldFail.reverting.withMessage(this.contract.vote(address1, 0, 0,{from : address1}), "VO10");
        });
      });

      context('When voting started', function () {
        beforeEach(async function () {
          await this.contract.openResolutionVote(0, 5,{from: owner});
        });

        it('reverts if trying to delegate vote to a delegate', async function () {
          await shouldFail.reverting.withMessage(this.contract.delegateVote(address5,{from: address1}), "VO11");
        });

        it('can vote for a proposal on a resolution', async function () {
          let ret;
          ret = await this.contract.getResolutionResults(0);
          ret['0'].should.be.bignumber.equal('0');
          ({ logs: this.logs } = await this.contract.vote(address1, 0, 0,{from : address1, gas: 500000}));
          ret = await this.contract.getResolutionResults(0);
          ret['0'].should.be.bignumber.equal('100');
        });

        it('emits Vote event', async function () {
          this.logs[0].args.should.have.property('voter', address1);
          this.logs[0].args.should.have.property('resolutionId');
          this.logs[0].args.resolutionId.should.be.bignumber.equal('0');
          this.logs[0].args.should.have.property('proposalId');
          this.logs[0].args.proposalId.should.be.bignumber.equal('0');
          this.logs[0].args.should.have.property('weight');
          this.logs[0].args.weight.should.be.bignumber.equal('100');
        });

        it('can vote for a proposal on a resolution when still open', async function () {
          let ret;
          ret = await this.contract.getResolutionResults(0);
          ret['0'].should.be.bignumber.equal('0');
          await timeout(2000);
          ({ logs: this.logs } = await this.contract.vote(address1, 0, 0,{from : address1, gas: 500000}));
          ret = await this.contract.getResolutionResults(0);
          ret['0'].should.be.bignumber.equal('100');
        });

        it('can check if voter has already voted', async function() {
          (await this.contract.hasVotedForResolution(address1, 0)).should.equal(false);
          await this.contract.vote(address1, 0, 0,{from : address1});
          (await this.contract.hasVotedForResolution(address1, 0)).should.equal(true);
        });

        context('Multiple resolutions', function () {
          beforeEach(async function () {
            await this.contract.openResolutionVote(1, 300,{from: owner});
          });

          it('can vote for a proposal on multiple resolution', async function () {
            let ret;
            ret = await this.contract.getResolutionResults(0);
            ret['0'].should.be.bignumber.equal('0');
            ret = await this.contract.getResolutionResults(1);
            ret['0'].should.be.bignumber.equal('0');
            await this.contract.vote(address1, 0, 0,{from : address1});
            ret = await this.contract.getResolutionResults(0);
            ret['0'].should.be.bignumber.equal('100');
            await this.contract.vote(address1, 1, 0,{from : address1});
            ret = await this.contract.getResolutionResults(0);
            ret['0'].should.be.bignumber.equal('100');
          });
        });

        it('reverts when trying to vote for someone else and not delegate', async function () {
          await shouldFail.reverting.withMessage(this.contract.vote(address2, 0, 0,{from: address1}), "VO05");
        });

        it('reverts when trying to vote and weight is zero', async function () {
          await shouldFail.reverting.withMessage(this.contract.vote(address5, 0, 0,{from: address5}), "VO06");
        });

        it('reverts when trying to vote for a non existing resolution', async function () {
          await shouldFail.reverting.withMessage(this.contract.vote(address1, 3, 0,{from: address1}), "VO07");
        });

        it('reverts when trying to vote for a non existing proposal', async function () {
          await shouldFail.reverting.withMessage(this.contract.vote(address1, 0, 6,{from: address1}), "VO08");
        });

        it('reverts when trying to vote twice for the same resolution', async function () {
          await this.contract.vote(address1, 0, 0,{from : address1});
          await shouldFail.reverting.withMessage(this.contract.vote(address1, 0, 1,{from: address1}), "VO09");
        });
      });

      context('When voting ended', function () {
        beforeEach(async function () {
          await this.contract.openResolutionVote(0, 1,{from: owner});
          await timeout(2000);
        });

        it('reverts if trying to delegate vote to a delegate', async function () {
          await shouldFail.reverting.withMessage(this.contract.delegateVote(address5,{from: address1}), "VO11");
        });

        it('reverts if trying to vote', async function () {
          await shouldFail.reverting.withMessage(this.contract.vote(address1, 0, 0,{from : address1}), "VO10");
        });
      });
    });  
    
    context('When delegate', function () {
      beforeEach(async function () {
        await this.contract.delegateVote(address5,{from: address1});
        await this.contract.openResolutionVote(0, 300,{from: owner});
      });

      it('can vote on behalf of address which has delegated his vote', async function () {
        let ret;
        ret = await this.contract.getResolutionResults(0);
        ret['0'].should.be.bignumber.equal('0');
        (await this.contract.hasVotedForResolution(address1, 0)).should.equal(false);
        await this.contract.vote(address1, 0, 0,{from : address5});
        (await this.contract.hasVotedForResolution(address1, 0)).should.equal(true);
        ret = await this.contract.getResolutionResults(0);
        ret['0'].should.be.bignumber.equal('100');
      });

      it('reverts if trying to vote on behalf of address which has not delegated his vote', async function () {
        let ret;
        ret = await this.contract.getResolutionResults(0);
        ret['0'].should.be.bignumber.equal('0');
        (await this.contract.hasVotedForResolution(address2, 0)).should.equal(false);
        await shouldFail.reverting.withMessage(this.contract.vote(address2, 0, 0,{from : address5}), "VO05");
        (await this.contract.hasVotedForResolution(address2, 0)).should.equal(false);
        ret = await this.contract.getResolutionResults(0);
        ret['0'].should.be.bignumber.equal('0');
      });
    });
  }); 

  context('Meta transaction', function () {
    it('should allow meta transaction for delegateVote', async function () {
      const delegateVoteEncodedFunction = '0xb31e1d4d000000000000000000000000e84da28128a48dd5585d1abb1ba67276fdd70776';
      ret = await this.contract.acceptRelayedCall(relay, from, delegateVoteEncodedFunction, 10, 10, 10, 10, '0x', 100);
      ret['0'].should.be.bignumber.equal('0');
    });

    it('should allow meta transaction for vote', async function () {
      const voteEncodedFunction = '0x2a4a1b73000000000000000000000000ce42bdb34189a93c55de250e011c68faee374dd300000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';
      ret = await this.contract.acceptRelayedCall(relay, from, voteEncodedFunction, 10, 10, 10, 10, '0x', 100);
      ret['0'].should.be.bignumber.equal('0');
    });

    it('should deny meta transaction with anything else', async function () {
      const badEncodedFunction = '0x2a4b1b73000000000000000000000000ce42bdb34189a93c55de250e011c68faee374dd300000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';
      ret = await this.contract.acceptRelayedCall(relay, from, badEncodedFunction, 10, 10, 10, 10, '0x', 100);
      ret['0'].should.be.bignumber.equal('1');
    });
  });
});