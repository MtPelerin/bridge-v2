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

const Contract = Contracts.getFromLocal('RuleEngine');
const YesNoRule = Contracts.getFromLocal('YesNoRule');
const YesNoUpdateRule = Contracts.getFromLocal('YesNoUpdateRule');

contract('RuleEngine', function ([_, initializer, owner, processor, token1, address1, address2]) {
  beforeEach(async function () {
    this.project = await TestHelper();
    this.contract = await this.project.createProxy(Contract, {initArgs: [owner]});
    this.yesNo = await this.project.createProxy(YesNoRule);
    this.yesNoUpdate = await this.project.createProxy(YesNoUpdateRule);
  });

  context('When owner', function () {
    it('can set rules', async function () {
      (await this.contract.methods.ruleLength().call()).should.equal('0');
      await this.contract.methods.setRules([this.yesNo.address, this.yesNoUpdate.address]).send({from: owner});
      (await this.contract.methods.ruleLength().call()).should.equal('2');
      (await this.contract.methods.rule(0).call()).should.equal(this.yesNo.address);
      (await this.contract.methods.rule(1).call()).should.equal(this.yesNoUpdate.address);
    });
    it('can validate transfer', async function () {
      await this.contract.methods.setRules([this.yesNo.address, this.yesNoUpdate.address]).send({from: owner});
      const ret1 = await this.contract.methods.validateTransferWithRules([0, 1], [0, 1], token1, address1, address2, 10000).call();
      ret1['0'].should.equal(false);
      ret1['1'].should.equal('0');
      ret1['2'].should.equal('1');
      const ret2 = await this.contract.methods.validateTransferWithRules([0, 1], [1, 0], token1, address1, address2, 10000).call();
      ret2['0'].should.equal(false);
      ret2['1'].should.equal('1');
      ret2['2'].should.equal('1');
      const ret3 = await this.contract.methods.validateTransferWithRules([0, 1], [1, 1], token1, address1, address2, 10000).call();
      ret3['0'].should.equal(true);
      ret3['1'].should.equal('0');
      ret3['2'].should.equal('0');
    });
  });

  context('When normal user', function () {
    beforeEach(async function () {
      await this.contract.methods.addOperator(processor).send({from: owner});
      await this.contract.methods.setRules([this.yesNo.address, this.yesNoUpdate.address]).send({from: owner});
    });

    it('can get a single rule', async function () {
      (await this.contract.methods.rule(0).call()).should.equal(this.yesNo.address);
      (await this.contract.methods.rule(1).call()).should.equal(this.yesNoUpdate.address);
    });

    it('reverts if trying to get a rule that is not in the rule registry', async function () {
      /* Use try catch because shouldFail only works with send */
      try {
        const ret = await this.contract.methods.rule(2).call();
        // Should not happen
        ret.should.equal(null);
      } catch (e) {
        e.should.have.property('message');
        e.message.should.have.string('RE01');
      }
    });

    it('can get multiple rules at once', async function () {
      const ret = await this.contract.methods.rules([0,1]).call();
      ret[0].should.equal(this.yesNo.address);
      ret[1].should.equal(this.yesNoUpdate.address);
    });

    it('reverts if trying to get rules that are not in the rule registry', async function () {
      /* Use try catch because shouldFail only works with send */
      try {
        const ret = await this.contract.methods.rules([0, 2]).call();
        // Should not happen
        ret.should.equal(null);
      } catch (e) {
        e.should.have.property('message');
        e.message.should.have.string('RE01');
      }
    });

    it('can validate transfer', async function () {
      const ret = await this.contract.methods.validateTransferWithRules([0, 1], [1, 1], token1, address1, address2, 10000).call();
      ret['0'].should.equal(true);
      ret['1'].should.equal('0');
      ret['2'].should.equal('0');
    });

    it('can validate transfer even if rule index overflows', async function () {
      const ret = await this.contract.methods.validateTransferWithRules([0, 1, 2], [1, 1, 1], token1, address1, address2, 10000).call();
      ret['0'].should.equal(true);
      ret['1'].should.equal('0');
      ret['2'].should.equal('0');
    });

    it('reverts if rule keys is not the same length as rule params', async function () {
      /* Use try catch because shouldFail only works with send */
      try {
        const ret = await this.contract.methods.validateTransferWithRules([0, 1, 2], [1, 1, 1, 0], token1, address1, address2, 10000).call();
        // Should not happen
        ret.should.equal(null);
      } catch (e) {
        e.should.have.property('message');
        e.message.should.have.string('RE02');
      }
    });

    it('should return that transfer is not valid if rule is not valid', async function () {
      const ret = await this.contract.methods.validateTransferWithRules([0, 1], [1, 0], token1, address1, address2, 10000).call();
      ret['0'].should.equal(false);
      ret['1'].should.equal('1');
      ret['2'].should.equal('1');
    });
  });
});