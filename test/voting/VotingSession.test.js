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

require('chai').should()
const { TestHelper } = require('@openzeppelin/cli');
const { Contracts, ZWeb3 } = require('@openzeppelin/upgrades');
const { expectEvent, shouldFail } = require('openzeppelin-test-helpers');

ZWeb3.initialize(web3.currentProvider);

const bytes32 = function (val) {
  return web3.utils.fromAscii(val);
};

const bytes32Pad = function (val) {
  return web3.utils.fromAscii(val).padEnd(66, '0');
};

const Contract = Contracts.getFromLocal('VotingSession');

contract('VotingSession', function ([_, owner, operator, address1, address2, address3, address4, address5, address6]) {
  beforeEach(async function () {
    this.project = await TestHelper();
    this.contract = await this.project.createProxy(Contract, {initArgs: [owner]});
  });

  context('When owner', function () {
    it('has proper owner', async function () {
      (await this.contract.methods.owner().call()).should.equal(owner);
    });
    it('can add operator', async function () {
      await this.contract.methods.addOperator(operator).send({from: owner});
      (await this.contract.methods.isOperator(operator).call()).should.equal(true);
    });
    it('can remove operator', async function () {
      await this.contract.methods.addOperator(operator).send({from: owner});
      (await this.contract.methods.isOperator(operator).call()).should.equal(true);
      await this.contract.methods.removeOperator(operator).send({from: owner});
      (await this.contract.methods.isOperator(operator).call()).should.equal(false);
    });
  });

  context('When operator', function () {
    beforeEach(async function () {
      await this.contract.methods.addOperator(operator).send({from: owner});
    });

    context('Add new resolutions', function () {
      it('can add new resolutions in the session', async function () {
        (await this.contract.methods.resolutionCount().call()).should.equal('0');
        ({ events: this.events } = await this.contract.methods.addResolutions([bytes32('QUESTION1'), bytes32('QUESTION2')], [bytes32('https://mtpelerin.com/v1/q1'), bytes32('https://mtpelerin.com/v1/q2')], [2, 3]).send({from: operator, gas: 500000}));
        (await this.contract.methods.resolutionCount().call()).should.equal('2');
      });

      it('emits 2 ResolutionAdded events', function () {
        this.events.should.have.property('ResolutionAdded');
        this.events.ResolutionAdded.should.have.length(2);
        this.events.ResolutionAdded[0].returnValues.should.have.property('name', bytes32Pad('QUESTION1'));
        this.events.ResolutionAdded[1].returnValues.should.have.property('name', bytes32Pad('QUESTION2'));
        this.events.ResolutionAdded[0].returnValues.should.have.property('url', bytes32Pad('https://mtpelerin.com/v1/q1'));
        this.events.ResolutionAdded[1].returnValues.should.have.property('url', bytes32Pad('https://mtpelerin.com/v1/q2'));
        this.events.ResolutionAdded[0].returnValues.should.have.property('proposalCount', '2');
        this.events.ResolutionAdded[1].returnValues.should.have.property('proposalCount', '3');
      });

      it('reverts if names array length is different than urls array length', async function () {
        await shouldFail.reverting.withMessage(this.contract.methods.addResolutions([bytes32('QUESTION1')], [bytes32('https://mtpelerin.com/v1/q1'), bytes32('https://mtpelerin.com/v1/q2')], [2, 3]).send({from: operator, gas: 500000}), "VO01");
      });

      it('reverts if names array length is different than proposalCount array length', async function () {
        await shouldFail.reverting.withMessage(this.contract.methods.addResolutions([bytes32('QUESTION1'), bytes32('QUESTION2')], [bytes32('https://mtpelerin.com/v1/q1'), bytes32('https://mtpelerin.com/v1/q2')], [2, 3, 4]).send({from: operator, gas: 500000}), "VO02");
      });
    });

    context('Register voters', function () {
      it('can add new voters in the session', async function () {
        ({ events: this.events } = await this.contract.methods.registerVoters([address1, address2, address3, address4, address5], [100, 200, 300, 400, 500]).send({from: operator, gas: 500000}));
      });

      it('emits 5 VoterRegistered events', function () {
        this.events.should.have.property('VoterRegistered');
        this.events.VoterRegistered.should.have.length(5);
        this.events.VoterRegistered[0].returnValues.should.have.property('voter', address1);
        this.events.VoterRegistered[1].returnValues.should.have.property('voter', address2);
        this.events.VoterRegistered[2].returnValues.should.have.property('voter', address3);
        this.events.VoterRegistered[3].returnValues.should.have.property('voter', address4);
        this.events.VoterRegistered[4].returnValues.should.have.property('voter', address5);
        this.events.VoterRegistered[0].returnValues.should.have.property('weight', '100');
        this.events.VoterRegistered[1].returnValues.should.have.property('weight', '200');
        this.events.VoterRegistered[2].returnValues.should.have.property('weight', '300');
        this.events.VoterRegistered[3].returnValues.should.have.property('weight', '400');
        this.events.VoterRegistered[4].returnValues.should.have.property('weight', '500');

      });

      it('reverts if voters array length is different than weights array length', async function () {
        await shouldFail.reverting.withMessage(this.contract.methods.registerVoters([address1, address2, address3, address4], [100, 200, 300, 400, 500]).send({from: operator, gas: 500000}), "VO03");
      });
    });    

    context('Set voting period', function () {
      it('can set voting period', async function () {
        ({ events: this.events } = await this.contract.methods.setVotingPeriod(1564569000, 1564669000).send({from: operator, gas: 500000}));
      });

      it('emits VotingPeriodSet event', function () {
        this.events.should.have.property('VotingPeriodSet');
        this.events.VotingPeriodSet.returnValues.should.have.property('votingStart', '1564569000');
        this.events.VotingPeriodSet.returnValues.should.have.property('votingEnd', '1564669000');
      });

      it('reverts if trying to set voting period start to 0', async function () {
        await shouldFail.reverting.withMessage(this.contract.methods.setVotingPeriod(0, 0).send({from: operator, gas: 500000}), "VO12");
      });

      it('reverts if trying to set voting period with end date greater than start date', async function () {
        await shouldFail.reverting.withMessage(this.contract.methods.setVotingPeriod(1564669000, 1564569000).send({from: operator, gas: 500000}), "VO13");
      });
    });  

    context('When voting started', function () {
      beforeEach(async function () {
        await this.contract.methods.setVotingPeriod(1564509000, 6604669000).send({from: operator});
      });

      it('reverts when trying to add new resolutions in the session', async function () {
        await shouldFail.reverting.withMessage(this.contract.methods.addResolutions([bytes32('QUESTION1'), bytes32('QUESTION2')], [bytes32('https://mtpelerin.com/v1/q1'), bytes32('https://mtpelerin.com/v1/q2')], [2, 3]).send({from: operator, gas: 500000}), "VO11");
      });

      it('reverts when trying to register new voters in the session', async function () {
        await shouldFail.reverting.withMessage(this.contract.methods.registerVoters([address1, address2, address3, address4, address5], [100, 200, 300, 400, 500]).send({from: operator, gas: 500000}), "VO11");
      });

      it('reverts when trying to set voting period', async function () {
        await shouldFail.reverting.withMessage(this.contract.methods.setVotingPeriod(1564569000, 1564669000).send({from: operator, gas: 500000}), "VO11");
      });
    });
  });

  context('When standard user', function () {
    beforeEach(async function () {
      await this.contract.methods.addOperator(operator).send({from: owner});
      await this.contract.methods.addResolutions([bytes32('QUESTION1'), bytes32('QUESTION2')], [bytes32('https://mtpelerin.com/v1/q1'), bytes32('https://mtpelerin.com/v1/q2')], [2, 3]).send({from: operator, gas: 500000})
      await this.contract.methods.registerVoters([address1, address2, address3, address4], [100, 200, 300, 400]).send({from: operator, gas: 500000})
    });

    it('can get the contract version', async function () {
      (await this.contract.methods.VERSION().call()).should.equal('1');
    });

    context('Resolutions', function () {
      it('can get resolution count', async function () {
        (await this.contract.methods.resolutionCount().call()).should.equal('2');
      });

      it('can get resolution information by id', async function () {
        const ret = await this.contract.methods.resolutions(0).call();
        ret['0'].should.equal(bytes32Pad('QUESTION1'));
        ret['1'].should.equal(bytes32Pad('https://mtpelerin.com/v1/q1'));
      });

      it('reverts if trying to add new resolutions when not authorized', async function () {
        await shouldFail.reverting.withMessage(this.contract.methods.addResolutions([bytes32('QUESTION1'), bytes32('QUESTION2')], [bytes32('https://mtpelerin.com/v1/q1'), bytes32('https://mtpelerin.com/v1/q2')], [2, 3]).send({from: address1, gas: 500000}), "OP01");
      });
    });

    context('Voters', function () {
      context('Before vote session start', function () {
        beforeEach(async function () {
          await this.contract.methods.setVotingPeriod(6404669000, 6604669000).send({from: operator});
        });

        it('can delegate vote to a delegate', async function () {
          await this.contract.methods.delegateVote(address5).send({from: address1});
          const ret = await this.contract.methods.voters(address1).call();
          ret['0'].should.equal('100');
          ret['1'].should.equal(address5);
        });

        it('reverts if trying to delegate vote when not voter', async function () {
          await shouldFail.reverting.withMessage(this.contract.methods.delegateVote(address5).send({from: address6}), "VO06");
        });

        it('reverts if trying to add new voters when not authorized', async function () {
          await shouldFail.reverting.withMessage(this.contract.methods.registerVoters([address1, address2, address3, address4, address5], [100, 200, 300, 400, 500]).send({from: address1, gas: 500000}), "OP01");
        });

        it('reverts if trying to vote', async function () {
          await shouldFail.reverting.withMessage(this.contract.methods.vote(address1, 0, 0).send({from : address1}), "VO10");
        });
      });

      context('When voting started', function () {
        beforeEach(async function () {
          await this.contract.methods.setVotingPeriod(1564509000, 6604669000).send({from: operator});
        });

        it('reverts if trying to delegate vote to a delegate', async function () {
          await shouldFail.reverting.withMessage(this.contract.methods.delegateVote(address5).send({from: address1}), "VO11");
        });

        it('can vote for a proposal on a resolution', async function () {
          let ret;
          ret = await this.contract.methods.getResolutionResults(0).call();
          ret['0'].should.equal('0');
          ({ events: this.events } = await this.contract.methods.vote(address1, 0, 0).send({from : address1, gas: 500000}));
          ret = await this.contract.methods.getResolutionResults(0).call();
          ret['0'].should.equal('100');
        });

        it('emits Vote event', async function () {
          this.events.should.have.property('Vote');
          this.events.Vote.returnValues.should.have.property('voter', address1);
          this.events.Vote.returnValues.should.have.property('resolutionId', '0');
          this.events.Vote.returnValues.should.have.property('proposalId', '0');
          this.events.Vote.returnValues.should.have.property('weight', '100');
        });

        it('can check if voter has already voted', async function() {
          (await this.contract.methods.hasVotedForResolution(address1, 0).call()).should.equal(false);
          await this.contract.methods.vote(address1, 0, 0).send({from : address1});
          (await this.contract.methods.hasVotedForResolution(address1, 0).call()).should.equal(true);
        });

        it('can vote for a proposal on multiple resolution', async function () {
          let ret;
          ret = await this.contract.methods.getResolutionResults(0).call();
          ret['0'].should.equal('0');
          ret = await this.contract.methods.getResolutionResults(1).call();
          ret['0'].should.equal('0');
          await this.contract.methods.vote(address1, 0, 0).send({from : address1});
          ret = await this.contract.methods.getResolutionResults(0).call();
          ret['0'].should.equal('100');
          await this.contract.methods.vote(address1, 1, 0).send({from : address1});
          ret = await this.contract.methods.getResolutionResults(0).call();
          ret['0'].should.equal('100');
        });

        it('reverts when trying to vote for someone else and not delegate', async function () {
          await shouldFail.reverting.withMessage(this.contract.methods.vote(address2, 0, 0).send({from: address1}), "VO05");
        });

        it('reverts when trying to vote and weight is zero', async function () {
          await shouldFail.reverting.withMessage(this.contract.methods.vote(address5, 0, 0).send({from: address5}), "VO06");
        });

        it('reverts when trying to vote for a non existing resolution', async function () {
          await shouldFail.reverting.withMessage(this.contract.methods.vote(address1, 3, 0).send({from: address1}), "VO07");
        });

        it('reverts when trying to vote for a non existing proposal', async function () {
          await shouldFail.reverting.withMessage(this.contract.methods.vote(address1, 0, 6).send({from: address1}), "VO08");
        });

        it('reverts when trying to vote twice for the same resolution', async function () {
          await this.contract.methods.vote(address1, 0, 0).send({from : address1});
          await shouldFail.reverting.withMessage(this.contract.methods.vote(address1, 0, 1).send({from: address1}), "VO09");
        });
      });

      context('When voting ended', function () {
        beforeEach(async function () {
          await this.contract.methods.setVotingPeriod(1564509000, 1564509100).send({from: operator});
        });

        it('reverts if trying to delegate vote to a delegate', async function () {
          await shouldFail.reverting.withMessage(this.contract.methods.delegateVote(address5).send({from: address1}), "VO11");
        });

        it('reverts if trying to vote', async function () {
          await shouldFail.reverting.withMessage(this.contract.methods.vote(address1, 0, 0).send({from : address1}), "VO10");
        });
      });
    });  
    
    context('When delegate', function () {
      beforeEach(async function () {
        await this.contract.methods.delegateVote(address5).send({from: address1});
        await this.contract.methods.setVotingPeriod(1564509000, 6604669000).send({from: operator});
      });

      it('can vote on behalf of address which has delegated his vote', async function () {
        let ret;
        ret = await this.contract.methods.getResolutionResults(0).call();
        ret['0'].should.equal('0');
        (await this.contract.methods.hasVotedForResolution(address1, 0).call()).should.equal(false);
        await this.contract.methods.vote(address1, 0, 0).send({from : address5});
        (await this.contract.methods.hasVotedForResolution(address1, 0).call()).should.equal(true);
        ret = await this.contract.methods.getResolutionResults(0).call();
        ret['0'].should.equal('100');
      });

      it('reverts if trying to vote on behalf of address which has not delegated his vote', async function () {
        let ret;
        ret = await this.contract.methods.getResolutionResults(0).call();
        ret['0'].should.equal('0');
        (await this.contract.methods.hasVotedForResolution(address2, 0).call()).should.equal(false);
        await shouldFail.reverting.withMessage(this.contract.methods.vote(address2, 0, 0).send({from : address5}), "VO05");
        (await this.contract.methods.hasVotedForResolution(address2, 0).call()).should.equal(false);
        ret = await this.contract.methods.getResolutionResults(0).call();
        ret['0'].should.equal('0');
      });
    });
  }); 
});