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

const bytes32 = function (val) {
  return web3.utils.fromAscii(val);
};

const realm = '0xee5934b535f675FE27daa5f6A4a853A3f3D06683';
const MPS = bytes32('MPS');
const CHF = bytes32('CHF');
const EUR = bytes32('EUR');
const BVS = bytes32('BVS');

const Contract = Contracts.getFromLocal('HardTransferLimitRule');
const ComplianceRegistry = Contracts.getFromLocal('ComplianceRegistry');
const PriceOracle = Contracts.getFromLocal('PriceOracle');
const BridgeERC20Mock = artifacts.require('BridgeERC20Mock');

contract('HardTransferLimitRule', function ([_, tokenOwner, owner, operator, trustedIntermediary1, trustedIntermediary2, address1, address2, address3, address4, address5]) {
  beforeEach(async function () {
    this.project = await TestHelper();
    this.complianceRegistry = await this.project.createProxy(ComplianceRegistry, {initArgs: [owner]});
    await this.complianceRegistry.methods.registerUsers([address1, address2], [0, 100, 110, 111, 112], [1874872800, 1, 10000, 15000, 180000]).send({from: trustedIntermediary1, gas: 900000});
    this.priceOracle = await this.project.createProxy(PriceOracle, {initArgs: [owner]});
    /* Set rates 
    * 1 MPS = 5 CHF
    * 1 EUR = 1.12079 CHF
    * 1 BVS = 67615.08594138624048749941067 CHF
    */
    await this.priceOracle.methods.setPrices([MPS, EUR, BVS], [CHF, CHF, CHF], ['500', '112079', '6761508594138624048749941067' ], [2, 5, 23]).send({from: owner, gas: 400000});
    this.contract = await this.project.createProxy(Contract, {initArgs: [owner, this.complianceRegistry.address]});
    this.MPS = await BridgeERC20Mock.new(this.priceOracle.address, 'Mt Pelerin Shares', 'MPS', 0, { from: tokenOwner });
    this.BVS = await BridgeERC20Mock.new(this.priceOracle.address, 'Big Value Share Token', 'BVS', 18, { from: tokenOwner });
    this.EUR = await BridgeERC20Mock.new(this.priceOracle.address, 'Euro Token', 'EUR', 2, { from: tokenOwner });
    await this.MPS.setTrustedIntermediaries([trustedIntermediary1, trustedIntermediary2]);
    await this.BVS.setTrustedIntermediaries([trustedIntermediary1, trustedIntermediary2]);
    await this.EUR.setTrustedIntermediaries([trustedIntermediary1, trustedIntermediary2]);
    await this.MPS.setRealm(realm);
    await this.BVS.setRealm(realm);
    await this.EUR.setRealm(realm);
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

    context('When rule address is not operator on ComplianceRegistry', function () {
      it('should revert', async function () {
        await shouldFail.reverting.withMessage(this.contract.methods.afterTransferHook(this.EUR.address, address1, address2, 890133, 0).send({from: operator}), "OP01");
      });
    });

    context('When rule address is operator on ComplianceRegistry', function () {
      beforeEach(async function () {
        await this.complianceRegistry.methods.addOperator(this.contract.address).send({from: owner});
      });
      it('should update transfer registry', async function () {
        (await this.complianceRegistry.methods.yearlyTransfers(realm, [trustedIntermediary1, trustedIntermediary2], address1).call()).should.equal('0');
        (await this.complianceRegistry.methods.yearlyTransfers(realm, [trustedIntermediary1, trustedIntermediary2], address2).call()).should.equal('0');
        (await this.contract.methods.afterTransferHook(this.EUR.address, address1, address2, 890133, 0).send({from: operator, gas: 100000}));
        (await this.complianceRegistry.methods.yearlyTransfers(realm, [trustedIntermediary1, trustedIntermediary2], address1).call()).should.equal('99765216507000000000000000000000000000000000');
        (await this.complianceRegistry.methods.yearlyTransfers(realm, [trustedIntermediary1, trustedIntermediary2], address2).call()).should.equal('99765216507000000000000000000000000000000000');
      });
    });
  });

  context('Check transfer validity', function () {
    context('Check one transfer', function () {
      it('returns that transfer is valid when from address is found and transfer/monthly/yearly amounts are below thresholds', async function () {
        const ret = await this.contract.methods.isTransferValid(this.EUR.address, address1, address2, 890133, 0).call();
        ret['0'].should.equal('3');
        ret['1'].should.equal('0');
      });
      it('returns that transfer is valid when from address is not found and amount is below no check threshold', async function () {
        const ret = await this.contract.methods.isTransferValid(this.EUR.address, address3, address2, 8933, 250).call();
        ret['0'].should.equal('3');
        ret['1'].should.equal('0');
      });
      it('returns that transfer is valid when to address is not found and amount is below no check threshold', async function () {
        const ret = await this.contract.methods.isTransferValid(this.EUR.address, address1, address3, 8933, 250).call();
        ret['0'].should.equal('3');
        ret['1'].should.equal('0');
      });
      it('returns that transfer is invalid when from address is not found and amount is above no check threshold', async function () {
        const ret = await this.contract.methods.isTransferValid(this.EUR.address, address3, address2, 890133, 250).call();
        ret['0'].should.equal('0');
        ret['1'].should.equal('1');
      });
      it('returns that transfer is invalid when to address is not found and amount is above no check threshold', async function () {
        const ret = await this.contract.methods.isTransferValid(this.EUR.address, address1, address3, 890133, 250).call();
        ret['0'].should.equal('0');
        ret['1'].should.equal('5');
      });
      it('returns that transfer is invalid when transfer amount is above single transaction threshold', async function () {
        const ret = await this.contract.methods.isTransferValid(this.EUR.address, address1, address2, 900157, 0).call();
        ret['0'].should.equal('0');
        ret['1'].should.equal('2');
      });
    });

    context('Check multiple transfers when addresses are not found', function () {
      beforeEach(async function () {
        await this.contract.methods.addOperator(operator).send({from: owner});
        await this.complianceRegistry.methods.addOperator(this.contract.address).send({from: owner});
        // Mark 183.45 EUR as already transfered
        (await this.contract.methods.afterTransferHook(this.EUR.address, address3, address2, 18345, 0).send({from: operator, gas: 100000}));
        (await this.contract.methods.afterTransferHook(this.EUR.address, address1, address3, 18345, 0).send({from: operator, gas: 100000}));
      });
      it('returns that transfer is valid when from address is not found and cumulated amount is below no check threshold', async function () {
        const ret = await this.contract.methods.isTransferValid(this.EUR.address, address3, address2, 1033, 250).call();
        ret['0'].should.equal('3');
        ret['1'].should.equal('0');
      });
      it('returns that transfer is valid when to address is not found and cumulated amount is below no check threshold', async function () {
        const ret = await this.contract.methods.isTransferValid(this.EUR.address, address1, address3, 1033, 250).call();
        ret['0'].should.equal('3');
        ret['1'].should.equal('0');
      });
      it('returns that transfer is invalid when from address is not found and cumulated amount is above no check threshold', async function () {
        const ret = await this.contract.methods.isTransferValid(this.EUR.address, address3, address2, 8933, 250).call();
        ret['0'].should.equal('0');
        ret['1'].should.equal('1');
      });
      it('returns that transfer is invalid when to address is not found and cumulated amount is above no check threshold', async function () {
        const ret = await this.contract.methods.isTransferValid(this.EUR.address, address1, address3, 8933, 250).call();
        ret['0'].should.equal('0');
        ret['1'].should.equal('5');
      });
    });

    context('Check multiple transfers for monthly limits', function () {
      beforeEach(async function () {
        await this.contract.methods.addOperator(operator).send({from: owner});
        await this.complianceRegistry.methods.addOperator(this.contract.address).send({from: owner});
        /* Mark 8901.33 EUR as already transfered */
        (await this.contract.methods.afterTransferHook(this.EUR.address, address1, address2, 890133, 0).send({from: operator, gas: 100000}));
      });
      it('returns that transfer is valid when from address is found and transfer/monthly/yearly amounts are below thresholds with same token', async function () {
        (await this.complianceRegistry.methods.monthlyTransfers(realm, [trustedIntermediary1, trustedIntermediary2], address1).call()).should.equal('99765216507000000000000000000000000000000000');
        const ret = await this.contract.methods.isTransferValid(this.EUR.address, address1, address2, 448201, 0).call();
        ret['0'].should.equal('3');
        ret['1'].should.equal('0');
      });
      it('returns that transfer is valid when from address is found and transfer/monthly/yearly amounts are below thresholds with different token', async function () {
        (await this.complianceRegistry.methods.monthlyTransfers(realm, [trustedIntermediary1, trustedIntermediary2], address1).call()).should.equal('99765216507000000000000000000000000000000000');
        const ret = await this.contract.methods.isTransferValid(this.MPS.address, address1, address2, 1000, 0).call();
        ret['0'].should.equal('3');
        ret['1'].should.equal('0');
      });
      it('returns that transfer is invalid when monthly transfer amount is above threshold', async function () {
        (await this.complianceRegistry.methods.monthlyTransfers(realm, [trustedIntermediary1, trustedIntermediary2], address1).call()).should.equal('99765216507000000000000000000000000000000000');
        const ret = await this.contract.methods.isTransferValid(this.EUR.address, address1, address2, 448302, 0).call();
        ret['0'].should.equal('0');
        ret['1'].should.equal('3');
      });
      it('returns that transfer is invalid when monthly transfer amount is above thresholds with different token', async function () {
        (await this.complianceRegistry.methods.monthlyTransfers(realm, [trustedIntermediary1, trustedIntermediary2], address1).call()).should.equal('99765216507000000000000000000000000000000000');
        const ret = await this.contract.methods.isTransferValid(this.MPS.address, address1, address2, 1100, 0).call();
        ret['0'].should.equal('0');
        ret['1'].should.equal('3');
      });
    });  
    
    context('Check multiple transfers for yearly limits', function () {
      beforeEach(async function () {
        await this.contract.methods.addOperator(operator).send({from: owner});
        await this.complianceRegistry.methods.addOperator(this.contract.address).send({from: owner});
        /* Makes monthly limit higher than yearly limit for testing purposes. In real life, it clearly makes no sense */
        await this.complianceRegistry.methods.updateUserAttributes(1, [0, 100, 110, 111, 112, 113], [1874872900, 0, 11000, 320000, 300000, 567]).send({from: trustedIntermediary1, gas: 900000});
        await this.complianceRegistry.methods.updateUserAttributes(2, [0, 100, 110, 111, 112, 113], [1874872900, 0, 11000, 320000, 300000, 567]).send({from: trustedIntermediary1, gas: 900000});
        /* Mark 4.43 BVS as already transfered */
        await this.contract.methods.afterTransferHook(this.BVS.address, address1, address2, '4430000000000000000', 0).send({from: operator, gas: 100000});
      });
      it('returns that transfer is valid when from address is found and transfer/monthly/yearly amounts are below thresholds with different token', async function () {
        (await this.complianceRegistry.methods.yearlyTransfers(realm, [trustedIntermediary1, trustedIntermediary2], address1).call()).should.equal('2995348307203410453596223863000000000000000000');
        const ret = await this.contract.methods.isTransferValid(this.MPS.address, address1, address2, 50, 0).call();
        ret['0'].should.equal('3');
        ret['1'].should.equal('0');
      });
      it('returns that transfer is invalid when monthly transfer amount is above thresholds with different token', async function () {
        (await this.complianceRegistry.methods.yearlyTransfers(realm, [trustedIntermediary1, trustedIntermediary2], address1).call()).should.equal('2995348307203410453596223863000000000000000000');
        const ret = await this.contract.methods.isTransferValid(this.MPS.address, address1, address2, 100, 0).call();
        ret['0'].should.equal('0');
        ret['1'].should.equal('4');
      });
    }); 
  });
});