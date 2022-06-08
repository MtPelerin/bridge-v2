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

const Contract = Contracts.getFromLocal('PriceOracle');

const bytes32 = function (val) {
  return web3.utils.fromAscii(val);
};

const ETH = bytes32('ETH');
const MPS = bytes32('MPS');
const SHR = bytes32('SHR');

contract('PriceOracle', function ([_, owner, operator, address1]) {
  beforeEach(async function () {
    this.project = await TestHelper();
    this.contract = await this.project.createProxy(Contract, {initArgs: [owner]});
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

    it('can set price', async function () {
      (await this.contract.methods['getPrice(bytes32,bytes32)'](ETH, MPS).call())['0'].should.equal('0');
      ({events: this.events} = await this.contract.methods.setPrice(ETH, MPS, '49024460000000000000', 18).send({from: operator, gas: 100000}));
      const ret = await this.contract.methods['getPrice(bytes32,bytes32)'](ETH, MPS).call();
      ret['0'].should.equal('49024460000000000000');
      ret['1'].should.equal('18');
      (await this.contract.methods.getDecimals(ETH, MPS).call()).should.equal('18');      
    });

    it('emits a PriceSet event', function () {
      this.events.should.have.property('PriceSet');
      this.events.PriceSet.returnValues.should.have.property('currency1', web3.eth.abi.encodeParameter('bytes32', ETH));
      this.events.PriceSet.returnValues.should.have.property('currency2', web3.eth.abi.encodeParameter('bytes32', MPS));
      this.events.PriceSet.returnValues.should.have.property('price', '49024460000000000000');
      this.events.PriceSet.returnValues.should.have.property('decimals', '18');
      this.events.PriceSet.returnValues.should.have.property('updateDate');
    });

    it('can set multiple prices', async function () {
      (await this.contract.methods['getPrice(bytes32,bytes32)'](ETH, MPS).call())['0'].should.equal('0');
      (await this.contract.methods['getPrice(bytes32,bytes32)'](ETH, SHR).call())['0'].should.equal('0');
      (await this.contract.methods['getPrice(bytes32,bytes32)'](SHR, MPS).call())['0'].should.equal('0');
      (await this.contract.methods['getPrice(bytes32,bytes32)'](MPS, ETH).call())['0'].should.equal('0');
      (await this.contract.methods['getPrice(bytes32,bytes32)'](MPS, SHR).call())['0'].should.equal('0');
      (await this.contract.methods['getPrice(bytes32,bytes32)'](SHR, ETH).call())['0'].should.equal('0');
      ({events: this.events} = await this.contract.methods.setPrices([ETH, ETH, SHR, MPS, MPS, SHR], [MPS, SHR, MPS, ETH, SHR, ETH], ['4167781430693052713', '4325877590113664316929', '5', '239935806766553900', '1', '231166966509962'], [18, 18, 0, 18, 0, 18]).send({from: operator, gas: 400000}));
      (await this.contract.methods['getPrice(bytes32,bytes32)'](ETH, MPS).call())['0'].should.equal('4167781430693052713');
      (await this.contract.methods['getPrice(bytes32,bytes32)'](ETH, SHR).call())['0'].should.equal('4325877590113664316929');
      (await this.contract.methods['getPrice(bytes32,bytes32)'](SHR, MPS).call())['0'].should.equal('5');
      (await this.contract.methods['getPrice(bytes32,bytes32)'](MPS, ETH).call())['0'].should.equal('239935806766553900');
      (await this.contract.methods['getPrice(bytes32,bytes32)'](MPS, SHR).call())['0'].should.equal('1');
      (await this.contract.methods['getPrice(bytes32,bytes32)'](SHR, ETH).call())['0'].should.equal('231166966509962');
      (await this.contract.methods.getDecimals(ETH, MPS).call()).should.equal('18');
      (await this.contract.methods.getDecimals(ETH, SHR).call()).should.equal('18');
      (await this.contract.methods.getDecimals(SHR, MPS).call()).should.equal('0');
      (await this.contract.methods.getDecimals(MPS, ETH).call()).should.equal('18');
      (await this.contract.methods.getDecimals(MPS, SHR).call()).should.equal('0');
      (await this.contract.methods.getDecimals(SHR, ETH).call()).should.equal('18');      
    });  
    
    it('emits 6 PriceSet events', function () {
      this.events.should.have.property('PriceSet');
      this.events.PriceSet.should.have.length(6);
      this.events.PriceSet[0].returnValues.should.have.property('currency1', web3.eth.abi.encodeParameter('bytes32', ETH));
      this.events.PriceSet[0].returnValues.should.have.property('currency2', web3.eth.abi.encodeParameter('bytes32', MPS));
      this.events.PriceSet[0].returnValues.should.have.property('price', '4167781430693052713');
      this.events.PriceSet[0].returnValues.should.have.property('decimals', '18');
      this.events.PriceSet[0].returnValues.should.have.property('updateDate');
      this.events.PriceSet[1].returnValues.should.have.property('currency1', web3.eth.abi.encodeParameter('bytes32', ETH));
      this.events.PriceSet[1].returnValues.should.have.property('currency2', web3.eth.abi.encodeParameter('bytes32', SHR));
      this.events.PriceSet[1].returnValues.should.have.property('price', '4325877590113664316929');
      this.events.PriceSet[1].returnValues.should.have.property('decimals', '18');
      this.events.PriceSet[1].returnValues.should.have.property('updateDate');
      this.events.PriceSet[2].returnValues.should.have.property('currency1', web3.eth.abi.encodeParameter('bytes32', SHR));
      this.events.PriceSet[2].returnValues.should.have.property('currency2', web3.eth.abi.encodeParameter('bytes32', MPS));
      this.events.PriceSet[2].returnValues.should.have.property('price', '5');
      this.events.PriceSet[2].returnValues.should.have.property('decimals', '0');
      this.events.PriceSet[2].returnValues.should.have.property('updateDate');
      this.events.PriceSet[3].returnValues.should.have.property('currency1', web3.eth.abi.encodeParameter('bytes32', MPS));
      this.events.PriceSet[3].returnValues.should.have.property('currency2', web3.eth.abi.encodeParameter('bytes32', ETH));
      this.events.PriceSet[3].returnValues.should.have.property('price', '239935806766553900');
      this.events.PriceSet[3].returnValues.should.have.property('decimals', '18');
      this.events.PriceSet[3].returnValues.should.have.property('updateDate');
      this.events.PriceSet[4].returnValues.should.have.property('currency1', web3.eth.abi.encodeParameter('bytes32', MPS));
      this.events.PriceSet[4].returnValues.should.have.property('currency2', web3.eth.abi.encodeParameter('bytes32', SHR));
      this.events.PriceSet[4].returnValues.should.have.property('price', '1');
      this.events.PriceSet[4].returnValues.should.have.property('decimals', '0');
      this.events.PriceSet[4].returnValues.should.have.property('updateDate');
      this.events.PriceSet[5].returnValues.should.have.property('currency1', web3.eth.abi.encodeParameter('bytes32', SHR));
      this.events.PriceSet[5].returnValues.should.have.property('currency2', web3.eth.abi.encodeParameter('bytes32', ETH));
      this.events.PriceSet[5].returnValues.should.have.property('price', '231166966509962');
      this.events.PriceSet[5].returnValues.should.have.property('decimals', '18');
      this.events.PriceSet[5].returnValues.should.have.property('updateDate');
    });

    it('reverts if currencies1 is not the same length as prices', async function () {
      await shouldFail.reverting.withMessage(this.contract.methods.setPrices([ETH, ETH, SHR, MPS, MPS, SHR], [MPS, SHR, MPS, ETH, SHR, ETH], ['4167781430693052713', '4325877590113664316929', '5', '239935806766553900', '1'], [18, 18, 0, 18, 0, 18]).send({from: operator}), 'PO01');
    });

    it('reverts if currencies1 is not the same length as decimals', async function () {
      await shouldFail.reverting.withMessage(this.contract.methods.setPrices([ETH, ETH, SHR, MPS, MPS, SHR], [MPS, SHR, MPS, ETH, SHR, ETH], ['4167781430693052713', '4325877590113664316929', '5', '239935806766553900', '1', '1'], [18, 18, 0, 18, 0]).send({from: operator}), 'PO02');
    });

    it('reverts if currencies1 is not the same length as currencies2', async function () {
      await shouldFail.reverting.withMessage(this.contract.methods.setPrices([ETH, ETH, SHR, MPS, MPS, SHR], [MPS, SHR, MPS, ETH, SHR], ['4167781430693052713', '4325877590113664316929', '5', '239935806766553900', '1', '1'], [18, 18, 0, 18, 0, 18]).send({from: operator}), 'PO03');
    });
  });

  context('When standard user', function () {
    beforeEach(async function () {
      this.updateDate = Math.floor(new Date().getTime() / 1000);
      await this.contract.methods.addOperator(operator).send({from: owner});
      await this.contract.methods.setPrices([ETH, ETH, SHR, MPS, MPS, SHR], [MPS, SHR, MPS, ETH, SHR, ETH], ['4167781430693052713', '4325877590113664316929', '5', '239935806766553900', '1', '231166966509962'], [18, 18, 0, 18, 0, 18]).send({from: operator, gas: 400000});
    });

    it('reverts if trying to update a single price', async function () {
      await shouldFail.reverting.withMessage(this.contract.methods.setPrice(ETH, MPS, '4167781430693052713', 18).send({from: address1}), 'OP01');
    });

    it('reverts if trying to update multiple prices', async function () {
      await shouldFail.reverting.withMessage(this.contract.methods.setPrices([ETH, ETH, SHR, MPS, MPS, SHR], [MPS, SHR, MPS, ETH, SHR, ETH], ['4167781430693052713', '4325877590113664316929', '5', '239935806766553900', 1], [18, 18, 0, 18, 0]).send({from: address1}), 'OP01');
    });

    it('can read a price by bytes32 pair', async function () {
      const ret = await this.contract.methods['getPrice(bytes32,bytes32)'](ETH, MPS).call();
      ret['0'].should.equal('4167781430693052713');
      ret['1'].should.equal('18');
    });

    it('can read a price by providing 2 separate symbols as string', async function () {
      const ret = await this.contract.methods.getPrice('ETH', 'MPS').call();
      ret['0'].should.equal('4167781430693052713');
      ret['1'].should.equal('18');
    });

    it('can read decimals by bytes32 pair', async function () {
      (await this.contract.methods.getDecimals(ETH, MPS).call()).should.equal('18');
    });

    it('can read last update date by bytes32 pair', async function () {
      Number(await this.contract.methods.getLastUpdated(ETH, MPS).call()).should.be.at.least(this.updateDate);
    });
  });
});