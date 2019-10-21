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
const { TestHelper } = require('@openzeppelin/cli');
const { Contracts, ZWeb3 } = require('@openzeppelin/upgrades');
const { expectEvent, shouldFail } = require('openzeppelin-test-helpers');

ZWeb3.initialize(web3.currentProvider);

const Contract = Contracts.getFromLocal('ShareBridgeToken');
const PriceOracle = Contracts.getFromLocal('PriceOracle');
const Processor = Contracts.getFromLocal('Processor');
const RuleEngine = Contracts.getFromLocal('RuleEngine');
const YesNoRule = Contracts.getFromLocal('YesNoRule');
const YesNoUpdateRule = Contracts.getFromLocal('YesNoUpdateRule');

const zero = '0x0000000000000000000000000000000000000000';
const INITIAL_TOKENIZED_SHARE_PERCENTAGE = '5528' // 55.28%
const NEW_TOKENIZED_SHARE_PERCENTAGE = '6745' // 67.45%

contract('ShareBridgeToken', function ([_, owner, administrator, trustedIntermediary1, trustedIntermediary2, votingSession, address2]) {
  beforeEach(async function () {
    this.project = await TestHelper();
    this.ruleEngine = await this.project.createProxy(RuleEngine, {initArgs: [owner]});
    this.yesNo = await this.project.createProxy(YesNoRule);
    this.yesNoUpdate = await this.project.createProxy(YesNoUpdateRule);
    await this.ruleEngine.methods.setRules([this.yesNo.address, this.yesNoUpdate.address]).send({from: owner});
    this.processor = await this.project.createProxy(Processor, {initArgs: [owner, this.ruleEngine.address], gas: 100000});
    this.contract = await this.project.createProxy(Contract, {initArgs: [owner, this.processor.address, 'Test token', 'TST', [trustedIntermediary1, trustedIntermediary2], INITIAL_TOKENIZED_SHARE_PERCENTAGE], gas: 100000});
  });

  context('When administrator', function () {
    beforeEach(async function () {
      await this.contract.methods.addAdministrator(administrator).send({from: owner});
    });

    it('can set the tokenized share percentage', async function () {
      (await this.contract.methods.tokenizedSharePercentage().call()).should.equal(INITIAL_TOKENIZED_SHARE_PERCENTAGE);
      ({events: this.events} = await this.contract.methods.setTokenizedSharePercentage(NEW_TOKENIZED_SHARE_PERCENTAGE).send({from: administrator}));
      (await this.contract.methods.tokenizedSharePercentage().call()).should.equal(NEW_TOKENIZED_SHARE_PERCENTAGE);
    }); 

    it('emits a TokenizedSharePercentageSet event', function () {
      this.events.should.have.property('TokenizedSharePercentageSet');
      this.events.TokenizedSharePercentageSet.returnValues.should.have.property('tokenizedSharePercentage', NEW_TOKENIZED_SHARE_PERCENTAGE);
    });

    it('can set the voting session contract address', async function () {
      (await this.contract.methods.votingSession().call()).should.equal(zero);
      ({events: this.events} = await this.contract.methods.setVotingSession(votingSession).send({from: administrator}));
      this.votingSession = votingSession;
      (await this.contract.methods.votingSession().call()).should.equal(votingSession);
    }); 

    it('emits a VotingSessionSet event', function () {
      this.events.should.have.property('VotingSessionSet');
      this.events.VotingSessionSet.returnValues.should.have.property('votingSession', this.votingSession);
    });

    it('can unset (set to 0) the voting session contract address', async function () {
      (await this.contract.methods.votingSession().call()).should.equal(zero);
      await this.contract.methods.setVotingSession(votingSession).send({from: administrator});
      (await this.contract.methods.votingSession().call()).should.equal(votingSession);
      ({events: this.events} = await this.contract.methods.setVotingSession(zero).send({from: administrator}));
      (await this.contract.methods.votingSession().call()).should.equal(zero);
    }); 

    it('emits a VotingSessionSet event', function () {
      this.events.should.have.property('VotingSessionSet');
      this.events.VotingSessionSet.returnValues.should.have.property('votingSession', zero);
    });
  });

  context('When standard user', function () {
    it('can get the contract version', async function () {
      (await this.contract.methods.VERSION().call()).should.equal('1');
    });

    context('Security model', function () {
      it('reverts if trying to set the tokenized share percentage', async function () {
        await shouldFail.reverting.withMessage(this.contract.methods.setTokenizedSharePercentage(NEW_TOKENIZED_SHARE_PERCENTAGE).send({from: address2}), "AD01");
      });

      it('reverts if trying to set the voting session contract address', async function () {
        await shouldFail.reverting.withMessage(this.contract.methods.setVotingSession(votingSession).send({from: address2}), "AD01");
      });
    });
  });
});