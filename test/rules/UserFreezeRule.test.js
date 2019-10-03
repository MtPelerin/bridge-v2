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

const Contract = Contracts.getFromLocal('UserFreezeRule');
const ComplianceRegistry = Contracts.getFromLocal('ComplianceRegistry');
const PriceOracle = Contracts.getFromLocal('PriceOracle');
const BridgeERC20Mock = artifacts.require('BridgeERC20Mock');

const timestamp = function () {
  return Math.floor(new Date().getTime()/1000);
};

contract('UserFreezeRule', function ([_, owner, tokenOwner,  trustedIntermediary, token, address1, address2]) {
  beforeEach(async function () {
    this.project = await TestHelper();
    this.complianceRegistry = await this.project.createProxy(ComplianceRegistry, {initArgs: [owner]});
    this.priceOracle = await this.project.createProxy(PriceOracle, {initArgs: [owner]});
    this.EUR = await BridgeERC20Mock.new(this.priceOracle.address, 'Euro Token', 'EUR', 2, { from: tokenOwner });
    this.contract = await this.project.createProxy(Contract, {initArgs: [this.complianceRegistry.address]});
    await this.EUR.setTrustedIntermediaries([trustedIntermediary]);
  });

  context('When no addresses are registered', function () {
    it('allows transfers if addresses are not found but allow not found is set', async function () {
      const ret = await this.contract.methods.isTransferValid(this.EUR.address, address1, address2, 100, 1).call();
      ret['0'].should.equal('1');
      ret['1'].should.equal('0');
    });

    it('rejects transfers if addresses are not found and allow not found is not set', async function () {
      const ret = await this.contract.methods.isTransferValid(this.EUR.address, address1, address2, 100, 0).call();
      ret['0'].should.equal('0');
      ret['1'].should.equal('2');
    });
  });

  context('When sender address is registered', function () {
    beforeEach(async function () {
      await this.complianceRegistry.methods.registerUser(address1, [0, 100, 110, 111, 112], [1874872800, 1, 10000, 15000, 180000]).send({from: trustedIntermediary, gas: 400000});
    });

    it('allows transfers if receiver address is not found but allow not found is set', async function () {
      const ret = await this.contract.methods.isTransferValid(this.EUR.address, address1, address2, 100, 1).call();
      ret['0'].should.equal('1');
      ret['1'].should.equal('0');
    });

    it('rejects transfers if receiver address is not found and allow not found is not set', async function () {
      const ret = await this.contract.methods.isTransferValid(this.EUR.address, address1, address2, 100, 0).call();
      ret['0'].should.equal('0');
      ret['1'].should.equal('3');
    });

    context('Sender freezing', function () {
      it('approves transfers if sender is frozen for receive with standard time frame', async function () {
        const start = '' + (timestamp() - 3600);
        const end = '' + (timestamp() + 3600);
        await this.complianceRegistry.methods.updateUserAttributes(1, [120, 121, 122, 123], [1, start, end, 0]).send({from: trustedIntermediary, gas: 900000});
        const ret = await this.contract.methods.isTransferValid(this.EUR.address, address1, address2, 100, 1).call();
        ret['0'].should.equal('1');
        ret['1'].should.equal('0');
      });

      it('rejects transfers if sender is frozen for send with standard time frame', async function () {
        const start = '' + (timestamp() - 3600);
        const end = '' + (timestamp() + 3600);
        await this.complianceRegistry.methods.updateUserAttributes(1, [120, 121, 122, 123], [2, start, end, 0]).send({from: trustedIntermediary, gas: 900000});
        const ret = await this.contract.methods.isTransferValid(this.EUR.address, address1, address2, 100, 1).call();
        ret['0'].should.equal('0');
        ret['1'].should.equal('2');
      });

      it('rejects transfers if sender is frozen for both sides with standard time frame', async function () {
        const start = '' + (timestamp() - 3600);
        const end = '' + (timestamp() + 3600);
        await this.complianceRegistry.methods.updateUserAttributes(1, [120, 121, 122, 123], [3, start, end, 0]).send({from: trustedIntermediary, gas: 900000});
        const ret = await this.contract.methods.isTransferValid(this.EUR.address, address1, address2, 100, 1).call();
        ret['0'].should.equal('0');
        ret['1'].should.equal('2');
      });

      it('approves transfers if sender is not frozen for receive with inverted time frame', async function () {
        const start = '' + (timestamp() - 3600);
        const end = '' + (timestamp() + 3600);
        await this.complianceRegistry.methods.updateUserAttributes(1, [120, 121, 122, 123], [1, start, end, 1]).send({from: trustedIntermediary, gas: 900000});
        const ret = await this.contract.methods.isTransferValid(this.EUR.address, address1, address2, 100, 1).call();
        ret['0'].should.equal('1');
        ret['1'].should.equal('0');
      });

      it('approves transfers if sender is not frozen for send with inverted time frame', async function () {
        const start = '' + (timestamp() - 3600);
        const end = '' + (timestamp() + 3600);
        await this.complianceRegistry.methods.updateUserAttributes(1, [120, 121, 122, 123], [2, start, end, 1]).send({from: trustedIntermediary, gas: 900000});
        const ret = await this.contract.methods.isTransferValid(this.EUR.address, address1, address2, 100, 1).call();
        ret['0'].should.equal('1');
        ret['1'].should.equal('0');
      });

      it('approves transfers if sender is not frozen for both sides with inverted time frame', async function () {
        const start = '' + (timestamp() - 3600);
        const end = '' + (timestamp() + 3600);
        await this.complianceRegistry.methods.updateUserAttributes(1, [120, 121, 122, 123], [3, start, end, 1]).send({from: trustedIntermediary, gas: 900000});
        const ret = await this.contract.methods.isTransferValid(this.EUR.address, address1, address2, 100, 1).call();
        ret['0'].should.equal('1');
        ret['1'].should.equal('0');
      });

      it('approves transfers if sender is not frozen anymore with standard time frame', async function () {
        const start = '' + (timestamp() - 7200);
        const end = '' + (timestamp() - 3600);
        await this.complianceRegistry.methods.updateUserAttributes(1, [120, 121, 122, 123], [3, start, end, 0]).send({from: trustedIntermediary, gas: 900000});
        const ret = await this.contract.methods.isTransferValid(this.EUR.address, address1, address2, 100, 1).call();
        ret['0'].should.equal('1');
        ret['1'].should.equal('0');
      });

      it('rejects transfers if sender is frozen with inverted time frame', async function () {
        const start = '' + (timestamp() - 7200);
        const end = '' + (timestamp() - 3600);
        await this.complianceRegistry.methods.updateUserAttributes(1, [120, 121, 122, 123], [3, start, end, 1]).send({from: trustedIntermediary, gas: 900000});
        const ret = await this.contract.methods.isTransferValid(this.EUR.address, address1, address2, 100, 1).call();
        ret['0'].should.equal('0');
        ret['1'].should.equal('2');
      });
    });

    context('Receiver freezing', function () {
      beforeEach(async function () {
        await this.complianceRegistry.methods.registerUser(address2, [0, 100, 110, 111, 112], [1874872800, 1, 10000, 15000, 180000]).send({from: trustedIntermediary, gas: 400000});
      });
      it('rejects transfers if receiver is frozen for receive with standard time frame', async function () {
        const start = '' + (timestamp() - 3600);
        const end = '' + (timestamp() + 3600);
        await this.complianceRegistry.methods.updateUserAttributes(2, [120, 121, 122, 123], [1, start, end, 0]).send({from: trustedIntermediary, gas: 900000});
        const ret = await this.contract.methods.isTransferValid(this.EUR.address, address1, address2, 100, 1).call();
        ret['0'].should.equal('0');
        ret['1'].should.equal('3');
      });

      it('approves transfers if receiver is frozen for send with standard time frame', async function () {
        const start = '' + (timestamp() - 3600);
        const end = '' + (timestamp() + 3600);
        await this.complianceRegistry.methods.updateUserAttributes(2, [120, 121, 122, 123], [2, start, end, 0]).send({from: trustedIntermediary, gas: 900000});
        const ret = await this.contract.methods.isTransferValid(this.EUR.address, address1, address2, 100, 1).call();
        ret['0'].should.equal('1');
        ret['1'].should.equal('0');
      });

      it('rejects transfers if receiver is frozen for both sides with standard time frame', async function () {
        const start = '' + (timestamp() - 3600);
        const end = '' + (timestamp() + 3600);
        await this.complianceRegistry.methods.updateUserAttributes(2, [120, 121, 122, 123], [3, start, end, 0]).send({from: trustedIntermediary, gas: 900000});
        const ret = await this.contract.methods.isTransferValid(this.EUR.address, address1, address2, 100, 1).call();
        ret['0'].should.equal('0');
        ret['1'].should.equal('3');
      });

      it('approves transfers if receiver is not frozen for receive with inverted time frame', async function () {
        const start = '' + (timestamp() - 3600);
        const end = '' + (timestamp() + 3600);
        await this.complianceRegistry.methods.updateUserAttributes(2, [120, 121, 122, 123], [1, start, end, 1]).send({from: trustedIntermediary, gas: 900000});
        const ret = await this.contract.methods.isTransferValid(this.EUR.address, address1, address2, 100, 1).call();
        ret['0'].should.equal('1');
        ret['1'].should.equal('0');
      });

      it('approves transfers if receiver is not frozen for send with inverted time frame', async function () {
        const start = '' + (timestamp() - 3600);
        const end = '' + (timestamp() + 3600);
        await this.complianceRegistry.methods.updateUserAttributes(2, [120, 121, 122, 123], [2, start, end, 1]).send({from: trustedIntermediary, gas: 900000});
        const ret = await this.contract.methods.isTransferValid(this.EUR.address, address1, address2, 100, 1).call();
        ret['0'].should.equal('1');
        ret['1'].should.equal('0');
      });

      it('approves transfers if receiver is not frozen for both sides with inverted time frame', async function () {
        const start = '' + (timestamp() - 3600);
        const end = '' + (timestamp() + 3600);
        await this.complianceRegistry.methods.updateUserAttributes(2, [120, 121, 122, 123], [3, start, end, 1]).send({from: trustedIntermediary, gas: 900000});
        const ret = await this.contract.methods.isTransferValid(this.EUR.address, address1, address2, 100, 1).call();
        ret['0'].should.equal('1');
        ret['1'].should.equal('0');
      });

      it('approves transfers if receiver is not frozen anymore with standard time frame', async function () {
        const start = '' + (timestamp() - 7200);
        const end = '' + (timestamp() - 3600);
        await this.complianceRegistry.methods.updateUserAttributes(2, [120, 121, 122, 123], [3, start, end, 0]).send({from: trustedIntermediary, gas: 900000});
        const ret = await this.contract.methods.isTransferValid(this.EUR.address, address1, address2, 100, 1).call();
        ret['0'].should.equal('1');
        ret['1'].should.equal('0');
      });

      it('rejects transfers if receiver is frozen with inverted time frame', async function () {
        const start = '' + (timestamp() - 7200);
        const end = '' + (timestamp() - 3600);
        await this.complianceRegistry.methods.updateUserAttributes(2, [120, 121, 122, 123], [3, start, end, 1]).send({from: trustedIntermediary, gas: 900000});
        const ret = await this.contract.methods.isTransferValid(this.EUR.address, address1, address2, 100, 1).call();
        ret['0'].should.equal('0');
        ret['1'].should.equal('3');
      });
    });
  });

  context('Update after transfer', function () {
    it('should revert if trying to update', async function () {
      await shouldFail.reverting.withMessage(this.contract.methods.afterTransferHook(token, address1, address2, 10000, 15000).send({from: address1}), "RU02");
    });
  });
});