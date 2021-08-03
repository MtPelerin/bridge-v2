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
const INITIAL_TOKENIZED_SHARES = '5528'
const NEW_TOKENIZED_SHARES = '6745'
const BOARD_DOCUMENT_URL = 'https://www.mtpelerin.com/board-resolution.pdf';
const BOARD_DOCUMENT_HASH = '0x175fca35aac7905c1f5c599ae921ed0e19921406cd117be5825717c8c3357b49';
const ZERO_HASH = '0x0000000000000000000000000000000000000000000000000000000000000000';

contract('ShareBridgeToken', function ([_, owner, administrator, trustedIntermediary1, trustedIntermediary2, address2]) {
  beforeEach(async function () {
    this.project = await TestHelper();
    this.ruleEngine = await this.project.createProxy(RuleEngine, {initArgs: [owner]});
    this.yesNo = await this.project.createProxy(YesNoRule);
    this.yesNoUpdate = await this.project.createProxy(YesNoUpdateRule);
    await this.ruleEngine.methods.setRules([this.yesNo.address, this.yesNoUpdate.address]).send({from: owner, gas: 100000});
    this.processor = await this.project.createProxy(Processor, {initArgs: [owner, this.ruleEngine.address], gas: 100000});
    this.contract = await this.project.createProxy(Contract, {initArgs: [owner, this.processor.address, 'Test token', 'TST', [trustedIntermediary1, trustedIntermediary2], INITIAL_TOKENIZED_SHARES], gas: 100000});
  });

  context('When administrator', function () {
    beforeEach(async function () {
      await this.contract.methods.addAdministrator(administrator).send({from: owner});
    });

    it('can set the tokenized shares', async function () {
      (await this.contract.methods.tokenizedShares().call()).should.equal(INITIAL_TOKENIZED_SHARES);
      ({events: this.events} = await this.contract.methods.setTokenizedShares(NEW_TOKENIZED_SHARES).send({from: administrator}));
      (await this.contract.methods.tokenizedShares().call()).should.equal(NEW_TOKENIZED_SHARES);
      const data = await web3.eth.getStorageAt(this.contract.address, 315);
      data.should.equal('0x1a59'); // 6745 in hex
    }); 

    it('emits a TokenizedShares event', function () {
      this.events.should.have.property('TokenizedShares');
      this.events.TokenizedShares.returnValues.should.have.property('tokenizedShares', NEW_TOKENIZED_SHARES);
    });

    it('can set the tokenization terms', async function () {
      (await this.contract.methods.terms().call()).should.equal("");
      (await this.contract.methods.setTerms("https://mtpelerin.com/terms").send({from: administrator}));
      (await this.contract.methods.terms().call()).should.equal("https://mtpelerin.com/terms");
    }); 

    it('can set the board resolution document attributes', async function () {
      (await this.contract.methods.boardResolutionDocumentUrl().call()).should.equal("");
      (await this.contract.methods.boardResolutionDocumentHash().call()).should.equal(ZERO_HASH);
      ({events: this.events} = await this.contract.methods.setBoardResolutionDocument(BOARD_DOCUMENT_URL, BOARD_DOCUMENT_HASH).send({from: administrator, gas: 200000}));
      (await this.contract.methods.boardResolutionDocumentUrl().call()).should.equal(BOARD_DOCUMENT_URL);
      (await this.contract.methods.boardResolutionDocumentHash().call()).should.equal(BOARD_DOCUMENT_HASH);
      const data = await web3.eth.getStorageAt(this.contract.address, 313);
      data.should.equal(BOARD_DOCUMENT_HASH);
    }); 

    it('emits a BoardResolutionDocumentSet event', function () {
      this.events.should.have.property('BoardResolutionDocumentSet');
      this.events.BoardResolutionDocumentSet.returnValues.should.have.property('boardResolutionDocumentHash', BOARD_DOCUMENT_HASH);
    });
  });

  context('When standard user', function () {
    it('can get the contract version', async function () {
      (await this.contract.methods.VERSION().call()).should.equal('3');
    });

    context('Security model', function () {
      it('reverts if trying to set the tokenized shares', async function () {
        await shouldFail.reverting.withMessage(this.contract.methods.setTokenizedShares(NEW_TOKENIZED_SHARES).send({from: address2}), "AD01");
      });

      it('reverts if trying to set the tokenization terms', async function () {
        await shouldFail.reverting.withMessage(this.contract.methods.setTerms("https://mtpelerin.com/terms").send({from: address2}), "AD01");
      });

      it('reverts if trying to set the board resolution document', async function () {
        await shouldFail.reverting.withMessage(this.contract.methods.setBoardResolutionDocument(BOARD_DOCUMENT_URL, BOARD_DOCUMENT_HASH).send({from: address2}), "AD01");
      });
    });
  });
});