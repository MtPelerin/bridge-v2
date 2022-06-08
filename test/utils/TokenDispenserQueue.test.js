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

const Contract = Contracts.getFromLocal('TokenDispenserQueue');
const BridgeERC20Mock = artifacts.require('BridgeERC20Mock');
const PriceOracle = Contracts.getFromLocal('PriceOracle');

contract('TokenDispenserQueue', function ([_, owner, tokenOwner, operator, validator, address1, address2, address3]) {
  beforeEach(async function () {
    this.project = await TestHelper();
    this.priceOracle = await this.project.createProxy(PriceOracle, {initArgs: [owner]});
    this.MPS = await BridgeERC20Mock.new(this.priceOracle.address, 'Mt Pelerin Shares', 'MPS', 0, { from: tokenOwner });
    this.contract = await this.project.createProxy(Contract, {initArgs: [owner, this.MPS.address], gas: 100000});
  });

  it('can get the contract version', async function () {
    (await this.contract.methods.VERSION().call()).should.equal('1');
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
    it('can add validator', async function () {
      await this.contract.methods.addValidator(validator).send({from: owner});
      (await this.contract.methods.isValidator(validator).call()).should.equal(true);
    });
    it('can remove validator', async function () {
      await this.contract.methods.addValidator(validator).send({from: owner});
      (await this.contract.methods.isValidator(validator).call()).should.equal(true);
      await this.contract.methods.removeValidator(validator).send({from: owner});
      (await this.contract.methods.isValidator(validator).call()).should.equal(false);
    });
  });

  context('When not owner', function () {
    it('reverts when trying to add operator from non-owner', async function () {
      await shouldFail.reverting(this.contract.methods.addOperator(address2).send({from: address1}));
    });

    it('reverts when trying to remove operator from non-owner', async function () {
      await shouldFail.reverting(this.contract.methods.removeOperator(address2).send({from: address1}));
    });

    it('reverts when trying to add validator from non-owner', async function () {
      await shouldFail.reverting(this.contract.methods.addValidator(address2).send({from: address1}));
    });

    it('reverts when trying to remove validator from non-owner', async function () {
      await shouldFail.reverting(this.contract.methods.removeValidator(address2).send({from: address1}));
    });

    it('reverts when trying to process pending transfers from non-validator', async function () {
      await shouldFail.reverting.withMessage(this.contract.methods.processPendingTransfers([], [], true).send({from: address1}), "DQ01");
    });

    it('reverts when trying to update pending min boundary from non-validator', async function () {
      await shouldFail.reverting.withMessage(this.contract.methods.updatePendingMinBoundary(10).send({from: address1}), "DQ01");
    });
  });

  context('When operator', function () {
    beforeEach(async function () {
      await this.contract.methods.addOperator(operator).send({from: owner});
    });
    context('Security checks', function () {
      it('reverts when trying to add validator from non-owner', async function () {
        await shouldFail.reverting(this.contract.methods.addValidator(address2).send({from: operator}));
      });
  
      it('reverts when trying to remove validator from non-owner', async function () {
        await shouldFail.reverting(this.contract.methods.removeValidator(address2).send({from: operator}));
      });
      
      it('reverts when trying to process pending transfers from non-validator', async function () {
        await shouldFail.reverting.withMessage(this.contract.methods.processPendingTransfers([], [], true).send({from: operator}), "DQ01");
      });

      it('reverts when trying to update pending min boundary from non-validator', async function () {
        await shouldFail.reverting.withMessage(this.contract.methods.updatePendingMinBoundary(10).send({from: operator}), "DQ01");
      });
    });
    context('Add pending transfers', function () {
      it('can add pending transfers', async function () {
        (await this.contract.methods.getPendingTransfers().call())['length'].should.equal('0');
        ({events: this.events} = await this.contract.methods.addPendingTransfers([address1, address2, address3], [1, 2, 3]).send({from: operator, gas: 300000}));
        const ret = await this.contract.methods.getPendingTransfers().call();
        ret['length'].should.equal('3');
        ret['id'][0].should.equal('0');
        ret['to'][0].should.equal(address1);
        ret['amount'][0].should.equal('1');
        ret['id'][1].should.equal('1');
        ret['to'][1].should.equal(address2);
        ret['amount'][1].should.equal('2');
        ret['id'][2].should.equal('2');
        ret['to'][2].should.equal(address3);
        ret['amount'][2].should.equal('3');
        (await this.contract.methods.pendingMinBoundary().call()).should.equal('0');
        (await this.contract.methods.pendingMaxBoundary().call()).should.equal('3');
      });

      it('emits TransferPending events', function () {
        this.events.should.have.property('TransferPending');
        this.events.TransferPending.length.should.equal(3);
        this.events.TransferPending[0].returnValues.should.have.property('to', address1);
        this.events.TransferPending[0].returnValues.should.have.property('amount', '1');
        this.events.TransferPending[1].returnValues.should.have.property('to', address2);
        this.events.TransferPending[1].returnValues.should.have.property('amount', '2');
        this.events.TransferPending[2].returnValues.should.have.property('to', address3);
        this.events.TransferPending[2].returnValues.should.have.property('amount', '3');
      });
    });
  });

  context('When validator', function () {
    beforeEach(async function () {
      await this.contract.methods.addOperator(operator).send({from: owner});
      await this.contract.methods.addPendingTransfers([address1, address2, address3], [1, 2, 3]).send({from: operator, gas: 300000});
      await this.contract.methods.addValidator(validator).send({from: owner});
    });

    it('should be able to approve/reject transfers updating minBoundary', async function () {
      (await this.contract.methods.getPendingTransfers().call())['length'].should.equal('3');
      (await this.contract.methods.pendingMinBoundary().call()).should.equal('0');
      ({events: this.events} = await this.contract.methods.processPendingTransfers([0, 2], [1, 2], false).send({from: validator, gas: 200000}));
      const ret = await this.contract.methods.getPendingTransfers().call();
      ret['length'].should.equal('1');
      ret['id'][0].should.equal('1');
      ret['to'][0].should.equal(address2);
      ret['amount'][0].should.equal('2');
      (await this.contract.methods.pendingMinBoundary().call()).should.equal('1');
    });

    it('emits a TransferApproved event', function () {
      this.events.should.have.property('TransferApproved');
      this.events.TransferApproved.returnValues.should.have.property('validator', validator);
      this.events.TransferApproved.returnValues.should.have.property('to', address1);
      this.events.TransferApproved.returnValues.should.have.property('amount', '1');
    });

    it('emits a TransferRejected event', function () {
      this.events.should.have.property('TransferRejected');
      this.events.TransferRejected.returnValues.should.have.property('validator', validator);
      this.events.TransferRejected.returnValues.should.have.property('to', address3);
      this.events.TransferRejected.returnValues.should.have.property('amount', '3');
    });

    it('should be able to approve/reject transfers without updating minBoundary', async function () {
      (await this.contract.methods.getPendingTransfers().call())['length'].should.equal('3');
      (await this.contract.methods.pendingMinBoundary().call()).should.equal('0');
      ({events: this.events} = await this.contract.methods.processPendingTransfers([0, 2], [1, 2], true).send({from: validator, gas: 200000}));
      (await this.contract.methods.pendingMinBoundary().call()).should.equal('0');
      const ret = await this.contract.methods.getPendingTransfers().call();
      ret['length'].should.equal('1');
      ret['id'][0].should.equal('1');
      ret['to'][0].should.equal(address2);
      ret['amount'][0].should.equal('2');
      (await this.contract.methods.pendingMinBoundary().call()).should.equal('0');
    });

    it('should be able to update minBoundary when having out of gas exceptions', async function () {
      (await this.contract.methods.getPendingTransfers().call())['length'].should.equal('3');
      (await this.contract.methods.pendingMinBoundary().call()).should.equal('0');
      ({events: this.events} = await this.contract.methods.processPendingTransfers([0, 2], [1, 2], true).send({from: validator, gas: 200000}));
      (await this.contract.methods.pendingMinBoundary().call()).should.equal('0');
      const ret = await this.contract.methods.getPendingTransfers().call();
      ret['length'].should.equal('1');
      ret['id'][0].should.equal('1');
      ret['to'][0].should.equal(address2);
      ret['amount'][0].should.equal('2');
      (await this.contract.methods.pendingMinBoundary().call()).should.equal('0');
      await this.contract.methods.updatePendingMinBoundary(10).send({from: validator, gas: 200000});
      (await this.contract.methods.pendingMinBoundary().call()).should.equal('1');
    });

    context('When transfer have already been processed', function () {
      beforeEach(async function () {
        await this.contract.methods.processPendingTransfers([0, 2], [1, 2], true).send({from: validator, gas: 200000});
      });

      it('should not approve/reject transfers if not in pending status (ignoring status change)', async function () {
        (await this.contract.methods.getPendingTransfers().call())['length'].should.equal('1');
        ({events: this.events} = await this.contract.methods.processPendingTransfers([0, 2], [1, 2], true).send({from: validator, gas: 200000}));
        (await this.contract.methods.getPendingTransfers().call())['length'].should.equal('1');
        this.events.should.not.have.property('TransferRejected');
        this.events.should.not.have.property('TransferApproved');
      });
    });
  });
});