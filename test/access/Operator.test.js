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

const Contract = Contracts.getFromLocal('OperatorMock');

contract('Operator', function ([_, initializer, owner, address1, address2]) {
  beforeEach(async function () {
    this.project = await TestHelper();
    this.contract = await this.project.createProxy(Contract, {initArgs: [owner]});
  });

  context('When owner', function () {
    it('has proper owner', async function () {
      (await this.contract.methods.owner().call()).should.equal(owner);
    });

    it('can add operator', async function () {
      ({events: this.events} = await this.contract.methods.addOperator(address1).send({from: owner}));
      (await this.contract.methods.isOperator(address1).call()).should.equal(true);
    });

    it('emits a OperatorAdded event', function () {
      this.events.should.have.property('OperatorAdded');
      this.events.OperatorAdded.returnValues.should.have.property('operator', address1);
    });

    it('can remove operator', async function () {
      await this.contract.methods.addOperator(address1).send({from: owner});
      (await this.contract.methods.isOperator(address1).call()).should.equal(true);
      ({events: this.events} = await this.contract.methods.removeOperator(address1).send({from: owner}));
      (await this.contract.methods.isOperator(address1).call()).should.equal(false);
    });

    it('emits a OperatorRemoved event', function () {
      this.events.should.have.property('OperatorRemoved');
      this.events.OperatorRemoved.returnValues.should.have.property('operator', address1);
    });
  });

  context('When not owner', function () {
    it('reverts when trying to add operator from non-owner', async function () {
      await shouldFail.reverting(this.contract.methods.addOperator(address2).send({from: address1}));
    });

    it('reverts when trying to remove operator from non-owner', async function () {
      await shouldFail.reverting(this.contract.methods.removeOperator(address2).send({from: address1}));
    });
  });

  context('When operator', function () {
    beforeEach(async function () {
      await this.contract.methods.addOperator(address1).send({from: owner});
    });

    it('can call unrestricted actions', async function () {
      (await this.contract.methods.count().call()).should.equal('0');
      await this.contract.methods.normalAction().send({from: address1});
      (await this.contract.methods.count().call()).should.equal('1');
    });

    it('can call restricted actions', async function () {
      (await this.contract.methods.count().call()).should.equal('0');
      await this.contract.methods.restrictedAction().send({from: address1});
      (await this.contract.methods.count().call()).should.equal('2');
    });
  });

  context('When not operator', function () {
    beforeEach(async function () {
      await this.contract.methods.addOperator(address1).send({from: owner});
    });

    it('can call unrestricted actions', async function () {
      (await this.contract.methods.count().call()).should.equal('0');
      await this.contract.methods.normalAction().send({from: address2});
      (await this.contract.methods.count().call()).should.equal('1');
    });

    it('reverts when calling restricted actions', async function () {
      (await this.contract.methods.count().call()).should.equal('0');
      await shouldFail.reverting.withMessage(this.contract.methods.restrictedAction().send({from: address2}), 'OP01');
    });
  });
});