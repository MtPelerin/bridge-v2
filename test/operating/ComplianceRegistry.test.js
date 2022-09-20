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
const { shouldFail } = require('openzeppelin-test-helpers');

ZWeb3.initialize(web3.currentProvider);

const Contract = Contracts.getFromLocal('ComplianceRegistry');
const realm1 = '0xee5934b535f675FE27daa5f6A4a853A3f3D06683';
const realm2 = '0x8287181a054E72a9E304001e09862dF0235D1af3';

contract('ComplianceRegistry', function ([_, owner, operator, trustedIntermediary1, trustedIntermediary2, address1, address2, address3, address4, address5, address6, address7]) {
  beforeEach(async function () {
    this.project = await TestHelper();
    this.contract = await this.project.createProxy(Contract, {initArgs: [owner], gas: 100000});
  });

  it('can get the contract version', async function () {
    (await this.contract.methods.VERSION().call()).should.equal('2');
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
    context('Transfer on realm 1', function () {
      context('Transfer registers update for single address', function () {
        it('can update transfer registers', async function () {
          (await this.contract.methods.monthlyTransfers(realm1, [trustedIntermediary1, trustedIntermediary2], address1).call()).should.equal('0');
          (await this.contract.methods.monthlyTransfers(realm1, [trustedIntermediary1, trustedIntermediary2], address2).call()).should.equal('0');
          (await this.contract.methods.yearlyTransfers(realm1, [trustedIntermediary1, trustedIntermediary2], address1).call()).should.equal('0');
          (await this.contract.methods.yearlyTransfers(realm1, [trustedIntermediary1, trustedIntermediary2], address2).call()).should.equal('0');
          await this.contract.methods.updateTransfers(realm1, address1, address2, 10000).send({from: operator, gas: 100000});
          (await this.contract.methods.monthlyTransfers(realm1, [trustedIntermediary1, trustedIntermediary2], address1).call()).should.equal('10000');
          (await this.contract.methods.monthlyTransfers(realm1, [trustedIntermediary1, trustedIntermediary2], address2).call()).should.equal('10000');
          (await this.contract.methods.monthlyInTransfers(realm1, [trustedIntermediary1, trustedIntermediary2], address2).call()).should.equal('10000');
          (await this.contract.methods.monthlyOutTransfers(realm1, [trustedIntermediary1, trustedIntermediary2], address1).call()).should.equal('10000');
          (await this.contract.methods.yearlyTransfers(realm1, [trustedIntermediary1, trustedIntermediary2], address1).call()).should.equal('10000');
          (await this.contract.methods.yearlyTransfers(realm1, [trustedIntermediary1, trustedIntermediary2], address2).call()).should.equal('10000');
          (await this.contract.methods.yearlyOutTransfers(realm1, [trustedIntermediary1, trustedIntermediary2], address1).call()).should.equal('10000');
          (await this.contract.methods.yearlyInTransfers(realm1, [trustedIntermediary1, trustedIntermediary2], address2).call()).should.equal('10000');
          await this.contract.methods.updateTransfers(realm1, address3, address2, 11000).send({from: operator, gas: 100000});
          await this.contract.methods.updateTransfers(realm1, address2, address4, 12000).send({from: operator, gas: 100000});
          (await this.contract.methods.yearlyTransfers(realm1, [trustedIntermediary1, trustedIntermediary2], address1).call()).should.equal('10000');
          (await this.contract.methods.yearlyTransfers(realm1, [trustedIntermediary1, trustedIntermediary2], address2).call()).should.equal('33000');  
          (await this.contract.methods.yearlyTransfers(realm1, [trustedIntermediary1, trustedIntermediary2], address3).call()).should.equal('11000');  
          (await this.contract.methods.yearlyTransfers(realm1, [trustedIntermediary1, trustedIntermediary2], address4).call()).should.equal('12000');       
        });  
      });
      context('Transfer registers update for registered users', function () {
        beforeEach(async function () {
          await this.contract.methods.registerUsers([address1, address2, address5], [0, 100, 110, 111, 112], [1874872800, 1, 10000, 15000, 180000]).send({from: trustedIntermediary1, gas: 900000});
          await this.contract.methods.attachAddresses([1, 2], [address3, address4]).send({from: trustedIntermediary1, gas: 900000});
        });
        it('can update transfer registers', async function () {
          (await this.contract.methods.monthlyTransfers(realm1, [trustedIntermediary1, trustedIntermediary2], address1).call()).should.equal('0');
          (await this.contract.methods.monthlyTransfers(realm1, [trustedIntermediary1, trustedIntermediary2], address2).call()).should.equal('0');
          (await this.contract.methods.yearlyTransfers(realm1, [trustedIntermediary1, trustedIntermediary2], address1).call()).should.equal('0');
          (await this.contract.methods.yearlyTransfers(realm1, [trustedIntermediary1, trustedIntermediary2], address2).call()).should.equal('0');
          await this.contract.methods.updateTransfers(realm1, address1, address2, 10000).send({from: operator, gas: 100000});
          (await this.contract.methods.monthlyTransfers(realm1, [trustedIntermediary1, trustedIntermediary2], address1).call()).should.equal('10000');
          (await this.contract.methods.monthlyTransfers(realm1, [trustedIntermediary1, trustedIntermediary2], address2).call()).should.equal('10000');
          (await this.contract.methods.monthlyInTransfers(realm1, [trustedIntermediary1, trustedIntermediary2], address2).call()).should.equal('10000');
          (await this.contract.methods.monthlyOutTransfers(realm1, [trustedIntermediary1, trustedIntermediary2], address1).call()).should.equal('10000');
          (await this.contract.methods.yearlyTransfers(realm1, [trustedIntermediary1, trustedIntermediary2], address1).call()).should.equal('10000');
          (await this.contract.methods.yearlyTransfers(realm1, [trustedIntermediary1, trustedIntermediary2], address2).call()).should.equal('10000');
          (await this.contract.methods.yearlyOutTransfers(realm1, [trustedIntermediary1, trustedIntermediary2], address1).call()).should.equal('10000');
          (await this.contract.methods.yearlyInTransfers(realm1, [trustedIntermediary1, trustedIntermediary2], address2).call()).should.equal('10000');
          await this.contract.methods.updateTransfers(realm1, address3, address2, 11000).send({from: operator, gas: 100000});
          await this.contract.methods.updateTransfers(realm1, address2, address4, 12000).send({from: operator, gas: 100000});
          (await this.contract.methods.yearlyTransfers(realm1, [trustedIntermediary1, trustedIntermediary2], address1).call()).should.equal('21000');
          (await this.contract.methods.yearlyTransfers(realm1, [trustedIntermediary1, trustedIntermediary2], address2).call()).should.equal('45000');  
          (await this.contract.methods.yearlyTransfers(realm1, [trustedIntermediary1, trustedIntermediary2], address3).call()).should.equal('21000');  
          (await this.contract.methods.yearlyTransfers(realm1, [trustedIntermediary1, trustedIntermediary2], address4).call()).should.equal('45000');       
        });  
      });
    });
    context('Transfer on realm 2', function () {
      context('Transfer registers update for single address without updating realm 1 values', function () {
        it('can update transfer registers', async function () {
          await this.contract.methods.updateTransfers(realm1, address1, address2, 10000).send({from: operator, gas: 100000});
          await this.contract.methods.updateTransfers(realm1, address3, address2, 11000).send({from: operator, gas: 100000});
          await this.contract.methods.updateTransfers(realm1, address2, address4, 12000).send({from: operator, gas: 100000});
          (await this.contract.methods.yearlyTransfers(realm1, [trustedIntermediary1, trustedIntermediary2], address1).call()).should.equal('10000');
          (await this.contract.methods.yearlyTransfers(realm1, [trustedIntermediary1, trustedIntermediary2], address2).call()).should.equal('33000');  
          (await this.contract.methods.yearlyTransfers(realm1, [trustedIntermediary1, trustedIntermediary2], address3).call()).should.equal('11000');  
          (await this.contract.methods.yearlyTransfers(realm1, [trustedIntermediary1, trustedIntermediary2], address4).call()).should.equal('12000');     
          (await this.contract.methods.yearlyTransfers(realm2, [trustedIntermediary1, trustedIntermediary2], address1).call()).should.equal('0');
          (await this.contract.methods.yearlyTransfers(realm2, [trustedIntermediary1, trustedIntermediary2], address2).call()).should.equal('0');  
          (await this.contract.methods.yearlyTransfers(realm2, [trustedIntermediary1, trustedIntermediary2], address3).call()).should.equal('0');  
          (await this.contract.methods.yearlyTransfers(realm2, [trustedIntermediary1, trustedIntermediary2], address4).call()).should.equal('0');   
          await this.contract.methods.updateTransfers(realm2, address1, address2, 20000).send({from: operator, gas: 100000});
          await this.contract.methods.updateTransfers(realm2, address3, address2, 21000).send({from: operator, gas: 100000});
          await this.contract.methods.updateTransfers(realm2, address2, address4, 22000).send({from: operator, gas: 100000});
          (await this.contract.methods.yearlyTransfers(realm1, [trustedIntermediary1, trustedIntermediary2], address1).call()).should.equal('10000');
          (await this.contract.methods.yearlyTransfers(realm1, [trustedIntermediary1, trustedIntermediary2], address2).call()).should.equal('33000');  
          (await this.contract.methods.yearlyTransfers(realm1, [trustedIntermediary1, trustedIntermediary2], address3).call()).should.equal('11000');  
          (await this.contract.methods.yearlyTransfers(realm1, [trustedIntermediary1, trustedIntermediary2], address4).call()).should.equal('12000');     
          (await this.contract.methods.yearlyTransfers(realm2, [trustedIntermediary1, trustedIntermediary2], address1).call()).should.equal('20000');
          (await this.contract.methods.yearlyTransfers(realm2, [trustedIntermediary1, trustedIntermediary2], address2).call()).should.equal('63000');  
          (await this.contract.methods.yearlyTransfers(realm2, [trustedIntermediary1, trustedIntermediary2], address3).call()).should.equal('21000');  
          (await this.contract.methods.yearlyTransfers(realm2, [trustedIntermediary1, trustedIntermediary2], address4).call()).should.equal('22000');   
        });  
      });
      context('Transfer registers update for registered users', function () {
        beforeEach(async function () {
          await this.contract.methods.registerUsers([address1, address2, address5], [0, 100, 110, 111, 112], [1874872800, 1, 10000, 15000, 180000]).send({from: trustedIntermediary1, gas: 900000});
          await this.contract.methods.attachAddresses([1, 2], [address3, address4]).send({from: trustedIntermediary1, gas: 900000});
        });
        it('can update transfer registers', async function () {
          await this.contract.methods.updateTransfers(realm1, address1, address2, 10000).send({from: operator, gas: 100000});
          await this.contract.methods.updateTransfers(realm1, address3, address2, 11000).send({from: operator, gas: 100000});
          await this.contract.methods.updateTransfers(realm1, address2, address4, 12000).send({from: operator, gas: 100000});
          (await this.contract.methods.yearlyTransfers(realm1, [trustedIntermediary1, trustedIntermediary2], address1).call()).should.equal('21000');
          (await this.contract.methods.yearlyTransfers(realm1, [trustedIntermediary1, trustedIntermediary2], address2).call()).should.equal('45000');  
          (await this.contract.methods.yearlyTransfers(realm1, [trustedIntermediary1, trustedIntermediary2], address3).call()).should.equal('21000');  
          (await this.contract.methods.yearlyTransfers(realm1, [trustedIntermediary1, trustedIntermediary2], address4).call()).should.equal('45000');       
          (await this.contract.methods.yearlyTransfers(realm2, [trustedIntermediary1, trustedIntermediary2], address1).call()).should.equal('0');
          (await this.contract.methods.yearlyTransfers(realm2, [trustedIntermediary1, trustedIntermediary2], address2).call()).should.equal('0');  
          (await this.contract.methods.yearlyTransfers(realm2, [trustedIntermediary1, trustedIntermediary2], address3).call()).should.equal('0');  
          (await this.contract.methods.yearlyTransfers(realm2, [trustedIntermediary1, trustedIntermediary2], address4).call()).should.equal('0');   
          await this.contract.methods.updateTransfers(realm2, address1, address2, 20000).send({from: operator, gas: 100000});
          await this.contract.methods.updateTransfers(realm2, address3, address2, 21000).send({from: operator, gas: 100000});
          await this.contract.methods.updateTransfers(realm2, address2, address4, 22000).send({from: operator, gas: 100000});
          (await this.contract.methods.yearlyTransfers(realm1, [trustedIntermediary1, trustedIntermediary2], address1).call()).should.equal('21000');
          (await this.contract.methods.yearlyTransfers(realm1, [trustedIntermediary1, trustedIntermediary2], address2).call()).should.equal('45000');  
          (await this.contract.methods.yearlyTransfers(realm1, [trustedIntermediary1, trustedIntermediary2], address3).call()).should.equal('21000');  
          (await this.contract.methods.yearlyTransfers(realm1, [trustedIntermediary1, trustedIntermediary2], address4).call()).should.equal('45000');       
          (await this.contract.methods.yearlyTransfers(realm2, [trustedIntermediary1, trustedIntermediary2], address1).call()).should.equal('41000');
          (await this.contract.methods.yearlyTransfers(realm2, [trustedIntermediary1, trustedIntermediary2], address2).call()).should.equal('85000');  
          (await this.contract.methods.yearlyTransfers(realm2, [trustedIntermediary1, trustedIntermediary2], address3).call()).should.equal('41000');  
          (await this.contract.methods.yearlyTransfers(realm2, [trustedIntermediary1, trustedIntermediary2], address4).call()).should.equal('85000');       
        });  
      });
    });
  });

  context('When trusted intermediary', function () {
    context('User registration', function () {
      it('can register new user', async function () {
        (await this.contract.methods.userCount(trustedIntermediary1).call()).should.equal('0');
        ({events: this.events} = await this.contract.methods.registerUser(address1, [0, 100, 110, 111, 112], [1874872800, 1, 10000, 15000, 180000]).send({from: trustedIntermediary1, gas: 400000}));
        (await this.contract.methods.userCount(trustedIntermediary1).call()).should.equal('1');
        const userId = await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address1).call();
        userId['0'].should.equal('1');
        userId['1'].should.equal(trustedIntermediary1);
        (await this.contract.methods.attribute(trustedIntermediary1, 1, 0).call()).should.equal('1874872800');
        (await this.contract.methods.attribute(trustedIntermediary1, 1, 100).call()).should.equal('1');
        (await this.contract.methods.attribute(trustedIntermediary1, 1, 110).call()).should.equal('10000');
        (await this.contract.methods.attribute(trustedIntermediary1, 1, 111).call()).should.equal('15000');
        (await this.contract.methods.attribute(trustedIntermediary1, 1, 112).call()).should.equal('180000');
      });

      it('emits a AddressAttached event', function () {
        this.events.should.have.property('AddressAttached');
        this.events.AddressAttached.returnValues.should.have.property('trustedIntermediary', trustedIntermediary1);
        this.events.AddressAttached.returnValues.should.have.property('userId', '1');
        this.events.AddressAttached.returnValues.should.have.property('address_', address1);
      });
  
      it('reverts if trying to register user where attribute keys is not the same length as attribute values', async function () {
        (await this.contract.methods.userCount(trustedIntermediary1).call()).should.equal('0');
        await shouldFail.reverting.withMessage(this.contract.methods.registerUser(address1, [0, 100, 110, 111], [1874872800, 1, 10000, 15000, 180000]).send({from: trustedIntermediary1}), "UR05");
      });

      it('reverts if trying to register user and address already exists', async function () {
        (await this.contract.methods.userCount(trustedIntermediary1).call()).should.equal('0');
        await this.contract.methods.registerUser(address1, [0, 100, 110, 111, 112], [1874872800, 1, 10000, 15000, 180000]).send({from: trustedIntermediary1, gas: 300000});
        await shouldFail.reverting.withMessage(this.contract.methods.registerUser(address1, [0, 100, 110, 111, 112], [1874872800, 1, 10000, 15000, 180000]).send({from: trustedIntermediary1}), "UR02");
      });
  
      it('can register new users', async function () {
        (await this.contract.methods.userCount(trustedIntermediary1).call()).should.equal('0');
        ({ events: this.events } = await this.contract.methods.registerUsers([address1, address2], [0, 100, 110, 111, 112], [1874872800, 1, 10000, 15000, 180000]).send({from: trustedIntermediary1, gas: 900000}));
        (await this.contract.methods.userCount(trustedIntermediary1).call()).should.equal('2');
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address1).call())['0'].should.equal('1');
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address2).call())['0'].should.equal('2');
        (await this.contract.methods.attribute(trustedIntermediary1, 1, 0).call()).should.equal('1874872800');
        (await this.contract.methods.attribute(trustedIntermediary1, 1, 100).call()).should.equal('1');
        (await this.contract.methods.attribute(trustedIntermediary1, 1, 110).call()).should.equal('10000');
        (await this.contract.methods.attribute(trustedIntermediary1, 1, 111).call()).should.equal('15000');
        (await this.contract.methods.attribute(trustedIntermediary1, 1, 112).call()).should.equal('180000');
        (await this.contract.methods.attribute(trustedIntermediary1, 2, 0).call()).should.equal('1874872800');
        (await this.contract.methods.attribute(trustedIntermediary1, 2, 100).call()).should.equal('1');
        (await this.contract.methods.attribute(trustedIntermediary1, 2, 110).call()).should.equal('10000');
        (await this.contract.methods.attribute(trustedIntermediary1, 2, 111).call()).should.equal('15000');
        (await this.contract.methods.attribute(trustedIntermediary1, 2, 112).call()).should.equal('180000');
      });

      it('emits 2 AddressAttached event', function () {
        this.events.should.have.property('AddressAttached');
        this.events.AddressAttached.should.have.length(2);
        this.events.AddressAttached[0].returnValues.should.have.property('trustedIntermediary', trustedIntermediary1);
        this.events.AddressAttached[1].returnValues.should.have.property('trustedIntermediary', trustedIntermediary1);
        this.events.AddressAttached[0].returnValues.should.have.property('userId', '1');
        this.events.AddressAttached[1].returnValues.should.have.property('userId', '2');
        this.events.AddressAttached[0].returnValues.should.have.property('address_', address1);
        this.events.AddressAttached[1].returnValues.should.have.property('address_', address2);
      });

      it('reverts if trying to register users where attribute keys is not the same length as attribute values', async function () {
        (await this.contract.methods.userCount(trustedIntermediary1).call()).should.equal('0');
        await shouldFail.reverting.withMessage(this.contract.methods.registerUsers([address1, address2], [0, 100, 110, 111], [1874872800, 1, 10000, 15000, 180000]).send({from: trustedIntermediary1}), "UR05");
      });
    });

    context('User address attachment', function () {
      beforeEach(async function () {
        await this.contract.methods.registerUsers([address1, address2], [0, 100, 110, 111, 112], [1874872800, 1, 10000, 15000, 180000]).send({from: trustedIntermediary1, gas: 900000});
      });

      it('can attach an address to an existing user', async function () {
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address1).call())['0'].should.equal('1');
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address3).call())['0'].should.equal('0');
        ({ events: this.events } = await this.contract.methods.attachAddress(1, address3).send({from: trustedIntermediary1}));
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address1).call())['0'].should.equal('1');
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address3).call())['0'].should.equal('1');
      });

      it('emits a AddressAttached event', function () {
        this.events.should.have.property('AddressAttached');
        this.events.AddressAttached.returnValues.should.have.property('trustedIntermediary', trustedIntermediary1);
        this.events.AddressAttached.returnValues.should.have.property('userId', '1');
        this.events.AddressAttached.returnValues.should.have.property('address_', address3);
      });

      it('reverts if trying to attach an address to a user that does not exist', async function () {
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address1).call())['0'].should.equal('1');
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address3).call())['0'].should.equal('0');
        await shouldFail.reverting.withMessage(this.contract.methods.attachAddress(0, address3).send({from: trustedIntermediary1}), "UR01");
        await shouldFail.reverting.withMessage(this.contract.methods.attachAddress(3, address3).send({from: trustedIntermediary1}), "UR01");
      });

      it('reverts if trying to attach an address that is already attached', async function () {
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address1).call())['0'].should.equal('1');
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address3).call())['0'].should.equal('0');
        await shouldFail.reverting.withMessage(this.contract.methods.attachAddress(2, address1).send({from: trustedIntermediary1}), "UR02");
      });

      it('can attach addresses to users', async function () {
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address1).call())['0'].should.equal('1');
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address2).call())['0'].should.equal('2');
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address3).call())['0'].should.equal('0');
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address4).call())['0'].should.equal('0');
        ({ events: this.events } = await this.contract.methods.attachAddresses([1, 2], [address3, address4]).send({from: trustedIntermediary1, gas: 300000}));
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address1).call())['0'].should.equal('1');
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address2).call())['0'].should.equal('2');
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address3).call())['0'].should.equal('1');
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address4).call())['0'].should.equal('2');
      });

      it('emits AddressAttached events', function () {
        this.events.should.have.property('AddressAttached');
        this.events.AddressAttached.should.have.length(2);
        this.events.AddressAttached[0].returnValues.should.have.property('trustedIntermediary', trustedIntermediary1);
        this.events.AddressAttached[1].returnValues.should.have.property('trustedIntermediary', trustedIntermediary1);
        this.events.AddressAttached[0].returnValues.should.have.property('userId', '1');
        this.events.AddressAttached[1].returnValues.should.have.property('userId', '2');
        this.events.AddressAttached[0].returnValues.should.have.property('address_', address3);
        this.events.AddressAttached[1].returnValues.should.have.property('address_', address4);
      }); 
      
      it('reverts if userIds and addresses are not the same length', async function () {
        await shouldFail.reverting.withMessage(this.contract.methods.attachAddresses([1, 2], [address3, address4, address5]).send({from: trustedIntermediary1, gas: 300000}), "UR03");
      });

      it('reverts if trying to attach addresses to users that does not exist', async function () {
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address1).call())['0'].should.equal('1');
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address3).call())['0'].should.equal('0');
        await shouldFail.reverting.withMessage(this.contract.methods.attachAddresses([1, 0], [address3, address4]).send({from: trustedIntermediary1}), "UR01");
        await shouldFail.reverting.withMessage(this.contract.methods.attachAddresses([3, 4], [address3, address4]).send({from: trustedIntermediary1}), "UR01");
      });

      it('reverts if trying to attach addresses to users when already attached', async function () {
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address1).call())['0'].should.equal('1');
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address3).call())['0'].should.equal('0');
        await shouldFail.reverting.withMessage(this.contract.methods.attachAddresses([2, 1], [address1, address2]).send({from: trustedIntermediary1}), "UR02");
      });
    });

    context('User address detachment', function () {
      beforeEach(async function () {
        await this.contract.methods.registerUsers([address1, address2], [0, 100, 110, 111, 112], [1874872800, 1, 10000, 15000, 180000]).send({from: trustedIntermediary1, gas: 900000});
        await this.contract.methods.attachAddresses([1, 2], [address3, address4]).send({from: trustedIntermediary1, gas: 300000});
      });

      it('can detach an address from an existing user', async function () {
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address1).call())['0'].should.equal('1');
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address3).call())['0'].should.equal('1');
        ({ events: this.events } = await this.contract.methods.detachAddress(address1).send({from: trustedIntermediary1, gas: 300000}));
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address1).call())['0'].should.equal('0');
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address3).call())['0'].should.equal('1');
      });

      it('emits a AddressDetached event', function () {
        this.events.should.have.property('AddressDetached');
        this.events.AddressDetached.returnValues.should.have.property('trustedIntermediary', trustedIntermediary1);
        this.events.AddressDetached.returnValues.should.have.property('userId', '1');
        this.events.AddressDetached.returnValues.should.have.property('address_', address1);
      });

      it('reverts if trying to detach an address that is not attached', async function () {
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address1).call())['0'].should.equal('1');
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address3).call())['0'].should.equal('1');
        await shouldFail.reverting.withMessage(this.contract.methods.detachAddress(address5).send({from: trustedIntermediary1}), "UR04");
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address1).call())['0'].should.equal('1');
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address3).call())['0'].should.equal('1');
      });

      it('can detach addresses to users', async function () {
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address1).call())['0'].should.equal('1');
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address2).call())['0'].should.equal('2');
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address3).call())['0'].should.equal('1');
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address4).call())['0'].should.equal('2');
        ({ events: this.events } = await this.contract.methods.detachAddresses([address2, address1]).send({from: trustedIntermediary1, gas: 600000}));
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address1).call())['0'].should.equal('0');
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address2).call())['0'].should.equal('0');
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address3).call())['0'].should.equal('1');
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address4).call())['0'].should.equal('2');
      });

      it('emits AddressDetached events', function () {
        this.events.should.have.property('AddressDetached');
        this.events.AddressDetached.should.have.length(2);
        this.events.AddressDetached[0].returnValues.should.have.property('trustedIntermediary', trustedIntermediary1);
        this.events.AddressDetached[1].returnValues.should.have.property('trustedIntermediary', trustedIntermediary1);
        this.events.AddressDetached[0].returnValues.should.have.property('userId', '2');
        this.events.AddressDetached[1].returnValues.should.have.property('userId', '1');
        this.events.AddressDetached[0].returnValues.should.have.property('address_', address2);
        this.events.AddressDetached[1].returnValues.should.have.property('address_', address1);
      }); 

      it('reverts if trying to detach addresses that were not attached', async function () {
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address1).call())['0'].should.equal('1');
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address3).call())['0'].should.equal('1');
        await shouldFail.reverting.withMessage(this.contract.methods.detachAddresses([address5, address6]).send({from: trustedIntermediary1}), "UR04");
      });
    });

    context('User attributes update', function () {
      beforeEach(async function () {
        await this.contract.methods.registerUsers([address1, address2], [0, 100, 110, 111, 112], [1874872800, 1, 10000, 15000, 180000]).send({from: trustedIntermediary1, gas: 900000});
        await this.contract.methods.attachAddresses([1, 2], [address3, address4]).send({from: trustedIntermediary1, gas: 900000});
      });

      it('can update attributes for an existing user', async function () {
        (await this.contract.methods.attribute(trustedIntermediary1, 1, 0).call()).should.equal('1874872800');
        (await this.contract.methods.attribute(trustedIntermediary1, 1, 100).call()).should.equal('1');
        (await this.contract.methods.attribute(trustedIntermediary1, 1, 110).call()).should.equal('10000');
        (await this.contract.methods.attribute(trustedIntermediary1, 1, 111).call()).should.equal('15000');
        (await this.contract.methods.attribute(trustedIntermediary1, 1, 112).call()).should.equal('180000');
        (await this.contract.methods.attribute(trustedIntermediary1, 1, 113).call()).should.equal('0');
        await this.contract.methods.updateUserAttributes(1, [0, 100, 110, 111, 112, 113], [1874872900, 0, 11000, 16000, 300000, 567]).send({from: trustedIntermediary1, gas: 300000});
        (await this.contract.methods.attribute(trustedIntermediary1, 1, 0).call()).should.equal('1874872900');
        (await this.contract.methods.attribute(trustedIntermediary1, 1, 100).call()).should.equal('0');
        (await this.contract.methods.attribute(trustedIntermediary1, 1, 110).call()).should.equal('11000');
        (await this.contract.methods.attribute(trustedIntermediary1, 1, 111).call()).should.equal('16000');
        (await this.contract.methods.attribute(trustedIntermediary1, 1, 112).call()).should.equal('300000');
        (await this.contract.methods.attribute(trustedIntermediary1, 1, 113).call()).should.equal('567');
      });

      it('reverts if trying to update attributes for a user that does not exist', async function () {
        await shouldFail.reverting.withMessage(this.contract.methods.updateUserAttributes(0, [0, 100, 110, 111, 112, 113], [1874872900, 0, 11000, 16000, 300000, 567]).send({from: trustedIntermediary1}), "UR01");
        await shouldFail.reverting.withMessage(this.contract.methods.updateUserAttributes(3, [0, 100, 110, 111, 112, 113], [1874872900, 0, 11000, 16000, 300000, 567]).send({from: trustedIntermediary1}), "UR01");
      });

      it('reverts if trying to update attributes for a user when attribute keys is not the same length as attribute values', async function () {
        await shouldFail.reverting.withMessage(this.contract.methods.updateUserAttributes(1, [0, 100, 110, 111, 112], [1874872900, 0, 11000, 16000, 300000, 567]).send({from: trustedIntermediary1}), "UR05");
      });

      it('can update attributes for multiple existing users', async function () {
        (await this.contract.methods.attribute(trustedIntermediary1, 1, 0).call()).should.equal('1874872800');
        (await this.contract.methods.attribute(trustedIntermediary1, 1, 100).call()).should.equal('1');
        (await this.contract.methods.attribute(trustedIntermediary1, 1, 110).call()).should.equal('10000');
        (await this.contract.methods.attribute(trustedIntermediary1, 1, 111).call()).should.equal('15000');
        (await this.contract.methods.attribute(trustedIntermediary1, 1, 112).call()).should.equal('180000');
        (await this.contract.methods.attribute(trustedIntermediary1, 1, 113).call()).should.equal('0');
        (await this.contract.methods.attribute(trustedIntermediary1, 2, 0).call()).should.equal('1874872800');
        (await this.contract.methods.attribute(trustedIntermediary1, 2, 100).call()).should.equal('1');
        (await this.contract.methods.attribute(trustedIntermediary1, 2, 110).call()).should.equal('10000');
        (await this.contract.methods.attribute(trustedIntermediary1, 2, 111).call()).should.equal('15000');
        (await this.contract.methods.attribute(trustedIntermediary1, 2, 112).call()).should.equal('180000');
        (await this.contract.methods.attribute(trustedIntermediary1, 2, 113).call()).should.equal('0');
        await this.contract.methods.updateUsersAttributes([1, 2], [0, 100, 110, 111, 112, 113], [1874872900, 0, 11000, 16000, 300000, 567]).send({from: trustedIntermediary1, gas: 900000});
        (await this.contract.methods.attribute(trustedIntermediary1, 1, 0).call()).should.equal('1874872900');
        (await this.contract.methods.attribute(trustedIntermediary1, 1, 100).call()).should.equal('0');
        (await this.contract.methods.attribute(trustedIntermediary1, 1, 110).call()).should.equal('11000');
        (await this.contract.methods.attribute(trustedIntermediary1, 1, 111).call()).should.equal('16000');
        (await this.contract.methods.attribute(trustedIntermediary1, 1, 112).call()).should.equal('300000');
        (await this.contract.methods.attribute(trustedIntermediary1, 1, 113).call()).should.equal('567');
        (await this.contract.methods.attribute(trustedIntermediary1, 2, 0).call()).should.equal('1874872900');
        (await this.contract.methods.attribute(trustedIntermediary1, 2, 100).call()).should.equal('0');
        (await this.contract.methods.attribute(trustedIntermediary1, 2, 110).call()).should.equal('11000');
        (await this.contract.methods.attribute(trustedIntermediary1, 2, 111).call()).should.equal('16000');
        (await this.contract.methods.attribute(trustedIntermediary1, 2, 112).call()).should.equal('300000');
        (await this.contract.methods.attribute(trustedIntermediary1, 2, 113).call()).should.equal('567');
      });

      it('reverts if trying to update attributes for multiple users when attribute keys is not the same length as attribute values', async function () {
        await shouldFail.reverting.withMessage(this.contract.methods.updateUsersAttributes([1, 2], [0, 100, 110, 111, 112], [1874872900, 0, 11000, 16000, 300000, 567]).send({from: trustedIntermediary1}), "UR05");
      });
    });
  });

  context('When trusted intermediary 2', function () {
    beforeEach(async function () {
      await this.contract.methods.registerUsers([address1, address2, address5], [0, 100, 110, 111, 112], [1874872800, 1, 10000, 15000, 180000]).send({from: trustedIntermediary1, gas: 900000});
      await this.contract.methods.updateUserAttributes(1, [0, 100, 110, 111, 112, 113], [1874872900, 0, 11000, 16000, 300000, 567]).send({from: trustedIntermediary1, gas: 900000});
      await this.contract.methods.attachAddresses([1, 2], [address3, address4]).send({from: trustedIntermediary1, gas: 900000});
    });

    context('User registration', function () {
      it('can register new user', async function () {
        (await this.contract.methods.userCount(trustedIntermediary2).call()).should.equal('0');
        (await this.contract.methods.userCount(trustedIntermediary1).call()).should.equal('3');
        ({events: this.events} = await this.contract.methods.registerUser(address6, [0, 100, 110, 111, 112], [1874872800, 1, 10000, 15000, 180000]).send({from: trustedIntermediary2, gas: 400000}));
        (await this.contract.methods.userCount(trustedIntermediary2).call()).should.equal('1');
        (await this.contract.methods.userCount(trustedIntermediary1).call()).should.equal('3');
        const userId = await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address6).call();
        userId['0'].should.equal('1');
        userId['1'].should.equal(trustedIntermediary2);
        (await this.contract.methods.attribute(trustedIntermediary2, 1, 0).call()).should.equal('1874872800');
        (await this.contract.methods.attribute(trustedIntermediary2, 1, 100).call()).should.equal('1');
        (await this.contract.methods.attribute(trustedIntermediary2, 1, 110).call()).should.equal('10000');
        (await this.contract.methods.attribute(trustedIntermediary2, 1, 111).call()).should.equal('15000');
        (await this.contract.methods.attribute(trustedIntermediary2, 1, 112).call()).should.equal('180000');
      });

      it('emits a AddressAttached event', function () {
        this.events.should.have.property('AddressAttached');
        this.events.AddressAttached.returnValues.should.have.property('trustedIntermediary', trustedIntermediary2);
        this.events.AddressAttached.returnValues.should.have.property('userId', '1');
        this.events.AddressAttached.returnValues.should.have.property('address_', address6);
      });
  
      it('can register new users', async function () {
        (await this.contract.methods.userCount(trustedIntermediary2).call()).should.equal('0');
        (await this.contract.methods.userCount(trustedIntermediary1).call()).should.equal('3');
        ({ events: this.events } = await this.contract.methods.registerUsers([address2, address7], [0, 100, 110, 111, 112], [1874872800, 1, 10000, 15000, 180000]).send({from: trustedIntermediary2, gas: 900000}));
        (await this.contract.methods.userCount(trustedIntermediary2).call()).should.equal('2');
        (await this.contract.methods.userCount(trustedIntermediary1).call()).should.equal('3');
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address2).call())['0'].should.equal('2');
        (await this.contract.methods.userId([trustedIntermediary2, trustedIntermediary1], address2).call())['0'].should.equal('1');
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address7).call())['0'].should.equal('2');
        (await this.contract.methods.attribute(trustedIntermediary2, 1, 0).call()).should.equal('1874872800');
        (await this.contract.methods.attribute(trustedIntermediary2, 1, 100).call()).should.equal('1');
        (await this.contract.methods.attribute(trustedIntermediary2, 1, 110).call()).should.equal('10000');
        (await this.contract.methods.attribute(trustedIntermediary2, 1, 111).call()).should.equal('15000');
        (await this.contract.methods.attribute(trustedIntermediary2, 1, 112).call()).should.equal('180000');
        (await this.contract.methods.attribute(trustedIntermediary2, 2, 0).call()).should.equal('1874872800');
        (await this.contract.methods.attribute(trustedIntermediary2, 2, 100).call()).should.equal('1');
        (await this.contract.methods.attribute(trustedIntermediary2, 2, 110).call()).should.equal('10000');
        (await this.contract.methods.attribute(trustedIntermediary2, 2, 111).call()).should.equal('15000');
        (await this.contract.methods.attribute(trustedIntermediary2, 2, 112).call()).should.equal('180000');
      });

      it('emits 2 AddressAttached event', function () {
        this.events.should.have.property('AddressAttached');
        this.events.AddressAttached.should.have.length(2);
        this.events.AddressAttached[0].returnValues.should.have.property('trustedIntermediary', trustedIntermediary2);
        this.events.AddressAttached[1].returnValues.should.have.property('trustedIntermediary', trustedIntermediary2);
        this.events.AddressAttached[0].returnValues.should.have.property('userId', '1');
        this.events.AddressAttached[1].returnValues.should.have.property('userId', '2');
        this.events.AddressAttached[0].returnValues.should.have.property('address_', address2);
        this.events.AddressAttached[1].returnValues.should.have.property('address_', address7);
      });
    });

    context('User address attachment', function () {
      beforeEach(async function () {
        await this.contract.methods.registerUsers([address2, address1], [0, 100, 110, 111, 112], [1874872800, 1, 10000, 15000, 180000]).send({from: trustedIntermediary2, gas: 900000});
      });

      it('can attach an address to an existing user', async function () {
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address1).call())['0'].should.equal('1');
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address3).call())['0'].should.equal('1');
        (await this.contract.methods.userId([trustedIntermediary2, trustedIntermediary1], address1).call())['0'].should.equal('2');
        (await this.contract.methods.userId([trustedIntermediary2, trustedIntermediary1], address3).call())['0'].should.equal('1');
        ({ events: this.events } = await this.contract.methods.attachAddress(2, address3).send({from: trustedIntermediary2}));
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address1).call())['0'].should.equal('1');
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address3).call())['0'].should.equal('1');
        (await this.contract.methods.userId([trustedIntermediary2, trustedIntermediary1], address1).call())['0'].should.equal('2');
        (await this.contract.methods.userId([trustedIntermediary2, trustedIntermediary1], address3).call())['0'].should.equal('2');
      });

      it('emits a AddressAttached event', function () {
        this.events.should.have.property('AddressAttached');
        this.events.AddressAttached.returnValues.should.have.property('trustedIntermediary', trustedIntermediary2);
        this.events.AddressAttached.returnValues.should.have.property('userId', '2');
        this.events.AddressAttached.returnValues.should.have.property('address_', address3);
      });

      it('can attach addresses to users', async function () {
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address1).call())['0'].should.equal('1');
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address2).call())['0'].should.equal('2');
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address3).call())['0'].should.equal('1');
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address4).call())['0'].should.equal('2');
        (await this.contract.methods.userId([trustedIntermediary2, trustedIntermediary1], address1).call())['0'].should.equal('2');
        (await this.contract.methods.userId([trustedIntermediary2, trustedIntermediary1], address2).call())['0'].should.equal('1');
        (await this.contract.methods.userId([trustedIntermediary2, trustedIntermediary1], address3).call())['0'].should.equal('1');
        (await this.contract.methods.userId([trustedIntermediary2, trustedIntermediary1], address4).call())['0'].should.equal('2');
        ({ events: this.events } = await this.contract.methods.attachAddresses([1, 2], [address4, address3]).send({from: trustedIntermediary2, gas: 300000}));
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address1).call())['0'].should.equal('1');
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address2).call())['0'].should.equal('2');
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address3).call())['0'].should.equal('1');
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address4).call())['0'].should.equal('2');
        (await this.contract.methods.userId([trustedIntermediary2, trustedIntermediary1], address1).call())['0'].should.equal('2');
        (await this.contract.methods.userId([trustedIntermediary2, trustedIntermediary1], address2).call())['0'].should.equal('1');
        (await this.contract.methods.userId([trustedIntermediary2, trustedIntermediary1], address3).call())['0'].should.equal('2');
        (await this.contract.methods.userId([trustedIntermediary2, trustedIntermediary1], address4).call())['0'].should.equal('1');
      });

      it('emits AddressAttached events', function () {
        this.events.should.have.property('AddressAttached');
        this.events.AddressAttached.should.have.length(2);
        this.events.AddressAttached[0].returnValues.should.have.property('trustedIntermediary', trustedIntermediary2);
        this.events.AddressAttached[1].returnValues.should.have.property('trustedIntermediary', trustedIntermediary2);
        this.events.AddressAttached[0].returnValues.should.have.property('userId', '1');
        this.events.AddressAttached[1].returnValues.should.have.property('userId', '2');
        this.events.AddressAttached[0].returnValues.should.have.property('address_', address4);
        this.events.AddressAttached[1].returnValues.should.have.property('address_', address3);
      }); 
    });

    context('User address detachment', function () {
      beforeEach(async function () {
        await this.contract.methods.registerUsers([address2, address1], [0, 100, 110, 111, 112], [1874872800, 1, 10000, 15000, 180000]).send({from: trustedIntermediary2, gas: 900000});
        await this.contract.methods.attachAddresses([1, 2], [address4, address3]).send({from: trustedIntermediary2, gas: 300000});
      });

      it('can detach an address from an existing user', async function () {
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address1).call())['0'].should.equal('1');
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address3).call())['0'].should.equal('1');
        (await this.contract.methods.userId([trustedIntermediary2, trustedIntermediary1], address1).call())['0'].should.equal('2');
        (await this.contract.methods.userId([trustedIntermediary2, trustedIntermediary1], address3).call())['0'].should.equal('2');
        ({ events: this.events } = await this.contract.methods.detachAddress(address1).send({from: trustedIntermediary2, gas: 300000}));
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address1).call())['0'].should.equal('1');
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address3).call())['0'].should.equal('1');
        (await this.contract.methods.userId([trustedIntermediary2, trustedIntermediary1], address1).call())['0'].should.equal('1');
        (await this.contract.methods.userId([trustedIntermediary2, trustedIntermediary1], address3).call())['0'].should.equal('2');
      });

      it('emits a AddressDetached event', function () {
        this.events.should.have.property('AddressDetached');
        this.events.AddressDetached.returnValues.should.have.property('trustedIntermediary', trustedIntermediary2);
        this.events.AddressDetached.returnValues.should.have.property('userId', '2');
        this.events.AddressDetached.returnValues.should.have.property('address_', address1);
      });

      it('can detach addresses to users', async function () {
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address1).call())['0'].should.equal('1');
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address2).call())['0'].should.equal('2');
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address3).call())['0'].should.equal('1');
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address4).call())['0'].should.equal('2');
        (await this.contract.methods.userId([trustedIntermediary2, trustedIntermediary1], address1).call())['0'].should.equal('2');
        (await this.contract.methods.userId([trustedIntermediary2, trustedIntermediary1], address2).call())['0'].should.equal('1');
        (await this.contract.methods.userId([trustedIntermediary2, trustedIntermediary1], address3).call())['0'].should.equal('2');
        (await this.contract.methods.userId([trustedIntermediary2, trustedIntermediary1], address4).call())['0'].should.equal('1');
        ({ events: this.events } = await this.contract.methods.detachAddresses([address2, address1]).send({from: trustedIntermediary2, gas: 600000}));
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address1).call())['0'].should.equal('1');
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address2).call())['0'].should.equal('2');
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address3).call())['0'].should.equal('1');
        (await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address4).call())['0'].should.equal('2');
        (await this.contract.methods.userId([trustedIntermediary2, trustedIntermediary1], address1).call())['0'].should.equal('1');
        (await this.contract.methods.userId([trustedIntermediary2, trustedIntermediary1], address2).call())['0'].should.equal('2');
        (await this.contract.methods.userId([trustedIntermediary2, trustedIntermediary1], address3).call())['0'].should.equal('2');
        (await this.contract.methods.userId([trustedIntermediary2, trustedIntermediary1], address4).call())['0'].should.equal('1');
      });

      it('emits AddressDetached events', function () {
        this.events.should.have.property('AddressDetached');
        this.events.AddressDetached.should.have.length(2);
        this.events.AddressDetached[0].returnValues.should.have.property('trustedIntermediary', trustedIntermediary2);
        this.events.AddressDetached[1].returnValues.should.have.property('trustedIntermediary', trustedIntermediary2);
        this.events.AddressDetached[0].returnValues.should.have.property('userId', '1');
        this.events.AddressDetached[1].returnValues.should.have.property('userId', '2');
        this.events.AddressDetached[0].returnValues.should.have.property('address_', address2);
        this.events.AddressDetached[1].returnValues.should.have.property('address_', address1);
      }); 
    });

    context('User attributes update', function () {
      beforeEach(async function () {
        await this.contract.methods.registerUsers([address1, address2], [0, 100, 110, 111, 112], [1874872800, 1, 10000, 15000, 180000]).send({from: trustedIntermediary2, gas: 900000});
        await this.contract.methods.attachAddresses([1, 2], [address3, address4]).send({from: trustedIntermediary2, gas: 900000});
      });

      it('can update attributes for an existing user', async function () {
        (await this.contract.methods.attribute(trustedIntermediary1, 1, 0).call()).should.equal('1874872900');
        (await this.contract.methods.attribute(trustedIntermediary1, 1, 100).call()).should.equal('0');
        (await this.contract.methods.attribute(trustedIntermediary1, 1, 110).call()).should.equal('11000');
        (await this.contract.methods.attribute(trustedIntermediary1, 1, 111).call()).should.equal('16000');
        (await this.contract.methods.attribute(trustedIntermediary1, 1, 112).call()).should.equal('300000');
        (await this.contract.methods.attribute(trustedIntermediary1, 1, 113).call()).should.equal('567');
        (await this.contract.methods.attribute(trustedIntermediary2, 1, 0).call()).should.equal('1874872800');
        (await this.contract.methods.attribute(trustedIntermediary2, 1, 100).call()).should.equal('1');
        (await this.contract.methods.attribute(trustedIntermediary2, 1, 110).call()).should.equal('10000');
        (await this.contract.methods.attribute(trustedIntermediary2, 1, 111).call()).should.equal('15000');
        (await this.contract.methods.attribute(trustedIntermediary2, 1, 112).call()).should.equal('180000');
        (await this.contract.methods.attribute(trustedIntermediary2, 1, 113).call()).should.equal('0');
        await this.contract.methods.updateUserAttributes(1, [0, 100, 110, 111, 112, 113], [1874872700, 4, 12000, 17000, 200000, 930]).send({from: trustedIntermediary2, gas: 300000});
        (await this.contract.methods.attribute(trustedIntermediary1, 1, 0).call()).should.equal('1874872900');
        (await this.contract.methods.attribute(trustedIntermediary1, 1, 100).call()).should.equal('0');
        (await this.contract.methods.attribute(trustedIntermediary1, 1, 110).call()).should.equal('11000');
        (await this.contract.methods.attribute(trustedIntermediary1, 1, 111).call()).should.equal('16000');
        (await this.contract.methods.attribute(trustedIntermediary1, 1, 112).call()).should.equal('300000');
        (await this.contract.methods.attribute(trustedIntermediary1, 1, 113).call()).should.equal('567');
        (await this.contract.methods.attribute(trustedIntermediary2, 1, 0).call()).should.equal('1874872700');
        (await this.contract.methods.attribute(trustedIntermediary2, 1, 100).call()).should.equal('4');
        (await this.contract.methods.attribute(trustedIntermediary2, 1, 110).call()).should.equal('12000');
        (await this.contract.methods.attribute(trustedIntermediary2, 1, 111).call()).should.equal('17000');
        (await this.contract.methods.attribute(trustedIntermediary2, 1, 112).call()).should.equal('200000');
        (await this.contract.methods.attribute(trustedIntermediary2, 1, 113).call()).should.equal('930');
      });

      it('can update attributes for multiple existing users', async function () {
        (await this.contract.methods.attribute(trustedIntermediary1, 1, 0).call()).should.equal('1874872900');
        (await this.contract.methods.attribute(trustedIntermediary1, 1, 100).call()).should.equal('0');
        (await this.contract.methods.attribute(trustedIntermediary1, 1, 110).call()).should.equal('11000');
        (await this.contract.methods.attribute(trustedIntermediary1, 1, 111).call()).should.equal('16000');
        (await this.contract.methods.attribute(trustedIntermediary1, 1, 112).call()).should.equal('300000');
        (await this.contract.methods.attribute(trustedIntermediary1, 1, 113).call()).should.equal('567');
        (await this.contract.methods.attribute(trustedIntermediary1, 2, 0).call()).should.equal('1874872800');
        (await this.contract.methods.attribute(trustedIntermediary1, 2, 100).call()).should.equal('1');
        (await this.contract.methods.attribute(trustedIntermediary1, 2, 110).call()).should.equal('10000');
        (await this.contract.methods.attribute(trustedIntermediary1, 2, 111).call()).should.equal('15000');
        (await this.contract.methods.attribute(trustedIntermediary1, 2, 112).call()).should.equal('180000');
        (await this.contract.methods.attribute(trustedIntermediary1, 2, 113).call()).should.equal('0');
        (await this.contract.methods.attribute(trustedIntermediary2, 1, 0).call()).should.equal('1874872800');
        (await this.contract.methods.attribute(trustedIntermediary2, 1, 100).call()).should.equal('1');
        (await this.contract.methods.attribute(trustedIntermediary2, 1, 110).call()).should.equal('10000');
        (await this.contract.methods.attribute(trustedIntermediary2, 1, 111).call()).should.equal('15000');
        (await this.contract.methods.attribute(trustedIntermediary2, 1, 112).call()).should.equal('180000');
        (await this.contract.methods.attribute(trustedIntermediary2, 1, 113).call()).should.equal('0');
        (await this.contract.methods.attribute(trustedIntermediary2, 2, 0).call()).should.equal('1874872800');
        (await this.contract.methods.attribute(trustedIntermediary2, 2, 100).call()).should.equal('1');
        (await this.contract.methods.attribute(trustedIntermediary2, 2, 110).call()).should.equal('10000');
        (await this.contract.methods.attribute(trustedIntermediary2, 2, 111).call()).should.equal('15000');
        (await this.contract.methods.attribute(trustedIntermediary2, 2, 112).call()).should.equal('180000');
        (await this.contract.methods.attribute(trustedIntermediary2, 2, 113).call()).should.equal('0');
        await this.contract.methods.updateUsersAttributes([1, 2], [0, 100, 110, 111, 112, 113], [1874872700, 4, 12000, 17000, 200000, 930]).send({from: trustedIntermediary2, gas: 900000});
        (await this.contract.methods.attribute(trustedIntermediary1, 1, 0).call()).should.equal('1874872900');
        (await this.contract.methods.attribute(trustedIntermediary1, 1, 100).call()).should.equal('0');
        (await this.contract.methods.attribute(trustedIntermediary1, 1, 110).call()).should.equal('11000');
        (await this.contract.methods.attribute(trustedIntermediary1, 1, 111).call()).should.equal('16000');
        (await this.contract.methods.attribute(trustedIntermediary1, 1, 112).call()).should.equal('300000');
        (await this.contract.methods.attribute(trustedIntermediary1, 1, 113).call()).should.equal('567');
        (await this.contract.methods.attribute(trustedIntermediary1, 2, 0).call()).should.equal('1874872800');
        (await this.contract.methods.attribute(trustedIntermediary1, 2, 100).call()).should.equal('1');
        (await this.contract.methods.attribute(trustedIntermediary1, 2, 110).call()).should.equal('10000');
        (await this.contract.methods.attribute(trustedIntermediary1, 2, 111).call()).should.equal('15000');
        (await this.contract.methods.attribute(trustedIntermediary1, 2, 112).call()).should.equal('180000');
        (await this.contract.methods.attribute(trustedIntermediary1, 2, 113).call()).should.equal('0');
        (await this.contract.methods.attribute(trustedIntermediary2, 1, 0).call()).should.equal('1874872700');
        (await this.contract.methods.attribute(trustedIntermediary2, 1, 100).call()).should.equal('4');
        (await this.contract.methods.attribute(trustedIntermediary2, 1, 110).call()).should.equal('12000');
        (await this.contract.methods.attribute(trustedIntermediary2, 1, 111).call()).should.equal('17000');
        (await this.contract.methods.attribute(trustedIntermediary2, 1, 112).call()).should.equal('200000');
        (await this.contract.methods.attribute(trustedIntermediary2, 1, 113).call()).should.equal('930');
        (await this.contract.methods.attribute(trustedIntermediary2, 2, 0).call()).should.equal('1874872700');
        (await this.contract.methods.attribute(trustedIntermediary2, 2, 100).call()).should.equal('4');
        (await this.contract.methods.attribute(trustedIntermediary2, 2, 110).call()).should.equal('12000');
        (await this.contract.methods.attribute(trustedIntermediary2, 2, 111).call()).should.equal('17000');
        (await this.contract.methods.attribute(trustedIntermediary2, 2, 112).call()).should.equal('200000');
        (await this.contract.methods.attribute(trustedIntermediary2, 2, 113).call()).should.equal('930');
      });
    });
  });

  context('When standard role', function () {
    beforeEach(async function () {
      await this.contract.methods.registerUsers([address1, address2, address5], [0, 100, 110, 111, 112], [1874872800, 1, 10000, 15000, 180000]).send({from: trustedIntermediary1, gas: 900000});
      await this.contract.methods.updateUserAttributes(1, [0, 100, 110, 111, 112, 113], [1874872900, 0, 11000, 16000, 300000, 567]).send({from: trustedIntermediary1, gas: 900000});
      await this.contract.methods.attachAddresses([1, 2], [address3, address4]).send({from: trustedIntermediary1, gas: 900000});
    });

    context('Cannot call restricted functions', async function () {
      it('reverts when trying to register a new user', async function () {
        await shouldFail.reverting.withMessage(this.contract.methods.updateTransfers(realm1, address1, address2, 10000).send({from: address3, gas: 300000}), "OP01");
      });
    });

    context('can get user information', function () {
      it('can get the userId for a specific address', async function () {
        const userId = await this.contract.methods.userId([trustedIntermediary1, trustedIntermediary2], address1).call();
        userId['0'].should.equal('1');
        userId['1'].should.equal(trustedIntermediary1);
      });

      it('can get the userId for a specific address for first found trusted intermediary', async function () {
        const userId = await this.contract.methods.userId([trustedIntermediary2, trustedIntermediary1], address1).call();
        userId['0'].should.equal('1');
        userId['1'].should.equal(trustedIntermediary1);
      });

      it('can get the user validity expiration date', async function () {
        (await this.contract.methods.validUntil(trustedIntermediary1, 1).call()).should.equal('1874872900');
      });

      it('can read a specific user attribute', async function () {
        (await this.contract.methods.attribute(trustedIntermediary1, 1, 110).call()).should.equal('11000');
      });

      it('can read multiple user attributes', async function () {
        const ret = await this.contract.methods.attributes(trustedIntermediary1, 1, [0, 100, 110]).call();
        ret[0].should.equal('1874872900');
        ret[1].should.equal('0');
        ret[2].should.equal('11000');
      });

      it('can check if an address is valid (associated to a user and not expired)', async function () {
        (await this.contract.methods.isAddressValid([trustedIntermediary1, trustedIntermediary2], address1).call()).should.equal(true);
        (await this.contract.methods.isAddressValid([trustedIntermediary1, trustedIntermediary2], address6).call()).should.equal(false);
        await this.contract.methods.updateUserAttributes(1, [0, 100, 110, 111, 112, 113], [0, 0, 11000, 16000, 300000, 567]).send({from: trustedIntermediary1, gas: 300000});
        (await this.contract.methods.isAddressValid([trustedIntermediary1, trustedIntermediary2], address1).call()).should.equal(false);
        (await this.contract.methods.isAddressValid([trustedIntermediary1, trustedIntermediary2], address6).call()).should.equal(false);
      });

      it('can check if a user is valid (existing and not expired)', async function () {
        (await this.contract.methods.isValid(trustedIntermediary1, 1).call()).should.equal(true);
        (await this.contract.methods.isValid(trustedIntermediary1, 4).call()).should.equal(false);
        await this.contract.methods.updateUserAttributes(1, [0, 100, 110, 111, 112, 113], [1527717600, 0, 11000, 16000, 300000, 567]).send({from: trustedIntermediary1, gas: 300000});
        (await this.contract.methods.isValid(trustedIntermediary1, 1).call()).should.equal(false);
        (await this.contract.methods.isValid(trustedIntermediary1, 4).call()).should.equal(false);
      });
    });
  });
});