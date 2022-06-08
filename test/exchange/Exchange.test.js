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

const Contract = Contracts.getFromLocal('Exchange');
const Token = artifacts.require('EtherToken');

const ETHER = 10 ** 18;
const ZERO = '0x0000000000000000000000000000000000000000';

const number = (value) => '' + value;



contract('Exchange', function ([_, tokenOwner, owner, operator, address1, address2, address3, address4, address5, address6, address7]) {
  beforeEach(async function () {
    this.project = await TestHelper();
    this.token1 = await Token.new({ from: tokenOwner });
    this.token2 = await Token.new({ from: tokenOwner });
    this.token3 = await Token.new({ from: tokenOwner });
    this.contract = await this.project.createProxy(Contract, {initArgs: [owner], gas: 100000});
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
  });

  context('When operator', function () {
    beforeEach(async function () {
      await this.contract.methods.addOperator(operator).send({from: owner});
    });

    it('can set min sell amount', async function () {
      (await this.contract.methods.getMinSell(this.token1.address).call()).should.equal('0');
      ({events: this.events} = await this.contract.methods.setMinSell(this.token1.address, 10**9).send({from: operator}));
      this.payToken = this.token1.address;
      (await this.contract.methods.getMinSell(this.token1.address).call()).should.equal('1000000000');
    }); 

    it('emits a MinSellSet event', function () {
      this.events.should.have.property('MinSellSet');
      this.events.MinSellSet.returnValues.should.have.property('payToken', this.payToken);
      this.events.MinSellSet.returnValues.should.have.property('minAmount', '1000000000');
    });
  });

  context('When market maker', function () {
    beforeEach(async function () {
      await this.token1.deposit({from: address1, value: web3.utils.toWei('10', 'ether')});
      await this.token1.approve(this.contract.address, number(100 * ETHER), {from: address1});
    });

    it('can add a new order', async function () {
      ({events: this.events} = await this.contract.methods.offer(number(ETHER), this.token1.address, number(1.21 * ETHER), this.token2.address, 0).send({from: address1, gas: 300000}));
      this.payToken = this.token1.address;
      this.buyToken = this.token2.address;
    });

    it('emits a OrderMade event', function () {
      this.events.should.have.property('OrderMade');
      this.events.OrderMade.returnValues.should.have.property('payToken', this.payToken);
      this.events.OrderMade.returnValues.should.have.property('buyToken', this.buyToken);
      this.events.OrderMade.returnValues.should.have.property('payAmount', number(ETHER));
      this.events.OrderMade.returnValues.should.have.property('buyAmount', number(1.21 * ETHER));
    });

    it('emits a ItemUpdated event', function () {
      this.events.should.have.property('ItemUpdated');
      this.events.ItemUpdated.returnValues.should.have.property('id', '1');
    });

    it('reverts if trying to add order with payAmount = 0', async function () {
      await shouldFail.reverting.withMessage(this.contract.methods.offer(0, this.token1.address, number(1.21 * ETHER), this.token2.address, 0).send({from: address1}), "EX16");
    });

    it('reverts if trying to add order with payToken = 0x0', async function () {
      await shouldFail.reverting.withMessage(this.contract.methods.offer(number(ETHER), ZERO, number(1.21 * ETHER), this.token2.address, 0).send({from: address1}), "EX17");
    });

    it('reverts if trying to add order with buyAmount = 0', async function () {
      await shouldFail.reverting.withMessage(this.contract.methods.offer(number(ETHER), this.token1.address, 0, this.token2.address, 0).send({from: address1}), "EX18");
    });

    it('reverts if trying to add order with buyToken = 0x0', async function () {
      await shouldFail.reverting.withMessage(this.contract.methods.offer(number(ETHER), this.token1.address, number(1.21 * ETHER), ZERO, 0).send({from: address1}), "EX19");
    });

    it('reverts if trying to add order with buyToken = payToken', async function () {
      await shouldFail.reverting.withMessage(this.contract.methods.offer(number(ETHER), this.token1.address, number(1.21 * ETHER), this.token1.address, 0).send({from: address1}), "EX20");
    });
  });

  context('When market taker', function () {
    beforeEach(async function () {
      await this.token1.deposit({from: address1, value: web3.utils.toWei('100', 'ether')});
      await this.token1.approve(this.contract.address, number(100 * ETHER), {from: address1});
      await this.token2.deposit({from: address2, value: web3.utils.toWei('200', 'ether')});
      await this.token2.approve(this.contract.address, number(200 * ETHER), {from: address2});
      await this.contract.methods.offer(number(ETHER), this.token1.address, number(1.21 * ETHER), this.token2.address, 0).send({from: address1, gas: 300000});
    });

    it('can take an order', async function () {
      ({events: this.events} = await this.contract.methods.offer(number(2*ETHER), this.token2.address, number(ETHER), this.token1.address, 0).send({from: address2, gas: 300000}));
      this.payToken = this.token1.address;
      this.buyToken = this.token2.address;
    });

    it('emits a OrderTaken event', function () {
      this.events.should.have.property('OrderTaken');
      this.events.OrderTaken.returnValues.should.have.property('payToken', this.payToken);
      this.events.OrderTaken.returnValues.should.have.property('buyToken', this.buyToken);
      this.events.OrderTaken.returnValues.should.have.property('maker', address1);
      this.events.OrderTaken.returnValues.should.have.property('taker', address2);
      this.events.OrderTaken.returnValues.should.have.property('takeAmount', number(ETHER));
      this.events.OrderTaken.returnValues.should.have.property('giveAmount', number(1.21 * ETHER));
    });

    it('emits a OrderTraded event', function () {
      this.events.should.have.property('OrderTraded');
      this.events.OrderTraded.returnValues.should.have.property('payToken', this.payToken);
      this.events.OrderTraded.returnValues.should.have.property('buyToken', this.buyToken);
      this.events.OrderTraded.returnValues.should.have.property('payAmount', number(ETHER));
      this.events.OrderTraded.returnValues.should.have.property('buyAmount', number(1.21 * ETHER));
    });
  });
});