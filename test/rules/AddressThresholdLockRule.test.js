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

const Contract = Contracts.getFromLocal('AddressThresholdLockRule');
const PriceOracle = Contracts.getFromLocal('PriceOracle');
const BridgeERC20Mock = artifacts.require('BridgeERC20Mock');

contract('AddressThresholdLockRule', function ([_, owner, tokenAdministrator, address1, address2]) {
  beforeEach(async function () {
    this.project = await TestHelper();
    this.priceOracle = await this.project.createProxy(PriceOracle, {initArgs: [owner]});
    this.EUR = await BridgeERC20Mock.new(this.priceOracle.address, 'Euro Token', 'EUR', 2, { from: owner });
    this.contract = await this.project.createProxy(Contract, {initArgs: []});
  });

  it('can get the contract version', async function () {
    (await this.contract.methods.VERSION().call()).should.equal('1');
  });

  context('When not token administrator', function () {
    it('should revert if trying to update address lock threshold', async function () {
      (await this.contract.methods.addressLockThreshold(this.EUR.address, address1).call()).should.equal('0');
      (await this.contract.methods.addressLockThreshold(this.EUR.address, address2).call()).should.equal('0');
      await shouldFail.reverting.withMessage(this.contract.methods.setAddressLockThreshold(this.EUR.address, address1, 10000).send({from: address1}), "AD01");
      (await this.contract.methods.addressLockThreshold(this.EUR.address, address1).call()).should.equal('0');
      (await this.contract.methods.addressLockThreshold(this.EUR.address, address2).call()).should.equal('0');
    });
  });

  context('When token administrator', function () {
    beforeEach(async function () {
      await this.EUR.addAdministrator(tokenAdministrator);
    });

    it('be able to update address lock threshold', async function () {
      (await this.contract.methods.addressLockThreshold(this.EUR.address, address1).call()).should.equal('0');
      (await this.contract.methods.addressLockThreshold(this.EUR.address, address2).call()).should.equal('0');
      await this.contract.methods.setAddressLockThreshold(this.EUR.address, address1, 10000).send({from: tokenAdministrator});
      (await this.contract.methods.addressLockThreshold(this.EUR.address, address1).call()).should.equal('10000');
      (await this.contract.methods.addressLockThreshold(this.EUR.address, address2).call()).should.equal('0');
    });
  });

  context('Check lock threshold', function () {
    beforeEach(async function () {
      await this.EUR.addAdministrator(tokenAdministrator);
      await this.contract.methods.setAddressLockThreshold(this.EUR.address, address1, 10000).send({from: tokenAdministrator});
    });

    context('When address has no tokens', function () {
      it('allows transfers if amount is zero', async function () {
        const ret = await this.contract.methods.isTransferValid(this.EUR.address, address1, address2, 0, 0).call();
        ret['0'].should.equal('1');
        ret['1'].should.equal('0');
      });

      it('allows transfers if amount is not zero', async function () {
        const ret = await this.contract.methods.isTransferValid(this.EUR.address, address1, address2, 100, 0).call();
        ret['0'].should.equal('1');
        ret['1'].should.equal('0');
      });
    });

    context('When address has tokens', function () {
      beforeEach(async function () {
        await this.EUR.mint(address1, 15000);
      });

      it('allows transfers if amount is zero', async function () {
        const ret = await this.contract.methods.isTransferValid(this.EUR.address, address1, address2, 0, 0).call();
        ret['0'].should.equal('1');
        ret['1'].should.equal('0');
      });

      it('allows transfers if amount is more than balance (will fail later)', async function () {
        const ret = await this.contract.methods.isTransferValid(this.EUR.address, address1, address2, 16000, 0).call();
        ret['0'].should.equal('1');
        ret['1'].should.equal('0');
      });

      it('rejects transfers if balance after transfer is less than threshold', async function () {
        const ret = await this.contract.methods.isTransferValid(this.EUR.address, address1, address2, 6000, 0).call();
        ret['0'].should.equal('0');
        ret['1'].should.equal('1');
      });
    });
  });
});