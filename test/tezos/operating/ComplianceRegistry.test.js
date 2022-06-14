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

const chai = require('chai');
chai.use(require('chai-bignumber')());
require('chai/register-should');
const contract = require('../helpers/contract');
const { InMemorySigner } = require('@taquito/signer');
const { MichelsonMap } = require('@taquito/michelson-encoder');
const { packDataBytes } = require('@taquito/michel-codec');
global.TextEncoder = require('util').TextEncoder;
const { runOperation, tezosToolkit } = require('../helpers/toolkit');
const { shouldFail } = require('../helpers/shouldFail');
const { BURN_ADDRESS } = require('../helpers/constants');
const ContractBuilder = contract.ContractBuilder;

let tezos = tezosToolkit();
const realm1 = 'tz1hNCgcjbCFY5yDuLjzxspuiZEHAkHbPQM2';
const realm2 = 'tz1gy3BPDvZQB5vkp5hypuQhZA2qrKjwQxL4';

const address7 = {pkh: 'tz1Y7DD3rKTBahZxKztKU5TiDn2Ytd2SuoKt'};

contract('ComplianceRegistry', function ([owner, operator, address1, address2, address3, address4, address5, address6, trustedIntermediary1, trustedIntermediary2]) {
  beforeEach(async function () {
    tezos.setSignerProvider(new InMemorySigner(owner.sk));
    this.contract = await ContractBuilder.new(tezos, 'ligo/operating/ComplianceRegistry.ligo', {}, { 
      owner: owner.pkh,
      roles: new MichelsonMap(),
      addressTransfers: new MichelsonMap(),
      addressUsers: new MichelsonMap(),
      trustedIntermediaries: new MichelsonMap(),
      userAttributes: new MichelsonMap(),
      userAddresses: new MichelsonMap(),
      onHoldTransfers: new MichelsonMap(),
    });
  });

  context('When owner', function () {
    it('has proper owner', async function () {
      (await this.contract.storage()).owner.should.equal(owner.pkh);
    });

    it('can change owner', async function () {
      (await this.contract.storage()).owner.should.equal(owner.pkh);
      await runOperation(tezos, owner, () => this.contract.methods.transferOwnership(address1.pkh).send());
      (await this.contract.storage()).owner.should.equal(address1.pkh);
    });

    it('cannot change owner from non-owner', async function () {
      (await this.contract.storage()).owner.should.equal(owner.pkh);
      await shouldFail(runOperation(tezos, address1, () => this.contract.methods.transferOwnership(address1.pkh).send()), 'AD01');
      (await this.contract.storage()).owner.should.equal(owner.pkh);
    });

    it('can revoke ownership', async function () {
      (await this.contract.storage()).owner.should.equal(owner.pkh);
      await runOperation(tezos, owner, () => this.contract.methods.revokeOwnership(null).send());
      (await this.contract.storage()).owner.should.equal(BURN_ADDRESS);
    });

    it('cannot revoke ownership from non-owner', async function () {
      (await this.contract.storage()).owner.should.equal(owner.pkh);
      await shouldFail(runOperation(tezos, address1, () => this.contract.methods.revokeOwnership(null).send()), 'AD01');
      (await this.contract.storage()).owner.should.equal(owner.pkh);
    });

    it('can add operator', async function () {
      await runOperation(tezos, owner, () => this.contract.methods.addOperator(operator.pkh).send());
      const packed = packDataBytes([{string: "operator"},{string: operator.pkh}], [{prim: 'string'}, {prim: 'address'}]);
      (await (await this.contract.storage()).roles.get(packed.bytes)).should.equal(true);
    });

    it('reverts trying to add operator from non owner', async function () {
      await shouldFail(runOperation(tezos, address1, () => this.contract.methods.addOperator(operator.pkh).send()), 'AD01');
      const packed = packDataBytes([{string: "operator"},{string: operator.pkh}], [{prim: 'string'}, {prim: 'address'}]);
      (!!(await (await this.contract.storage()).roles.get(packed.bytes))).should.equal(false);
    });

    it('can remove operator', async function () {
      await runOperation(tezos, owner, () => this.contract.methods.addOperator(operator.pkh).send());
      const packed = packDataBytes([{string: "operator"},{string: operator.pkh}], [{prim: 'string'}, {prim: 'address'}]);
      (await (await this.contract.storage()).roles.get(packed.bytes)).should.equal(true);
      await runOperation(tezos, owner, () => this.contract.methods.removeOperator(operator.pkh).send());
      (await (await this.contract.storage()).roles.get(packed.bytes)).should.equal(false);
    });

    it('reverts trying to remove operator from non owner', async function () {
      await runOperation(tezos, owner, () => this.contract.methods.addOperator(operator.pkh).send());
      const packed = packDataBytes([{string: "operator"},{string: operator.pkh}], [{prim: 'string'}, {prim: 'address'}]);
      (await (await this.contract.storage()).roles.get(packed.bytes)).should.equal(true);
      await shouldFail(runOperation(tezos, address1, () => this.contract.methods.removeOperator(operator.pkh).send()), 'AD01');
      (await (await this.contract.storage()).roles.get(packed.bytes)).should.equal(true);
    });
  });

  context('When operator', function () {
    beforeEach(async function () {
      await runOperation(tezos, owner, () => this.contract.methods.addOperator(operator.pkh).send());
      this.natCallback = await ContractBuilder.new(tezos, 'ligo/mocks/NatCallback.ligo', {}, '0');
    });
    context('Transfer on realm 1', function () {
      context('Transfer registers update for single address', function () {
        it('can update transfer registers', async function () {
          await runOperation(tezos, owner, () => this.contract.methods.monthlyTransfers(address1.pkh, this.natCallback.address, realm1, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
          (await this.natCallback.storage()).should.be.bignumber.equal(0);
          await runOperation(tezos, owner, () => this.contract.methods.monthlyTransfers(address2.pkh, this.natCallback.address, realm1, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
          (await this.natCallback.storage()).should.be.bignumber.equal(0);
          await runOperation(tezos, owner, () => this.contract.methods.yearlyTransfers(address1.pkh, this.natCallback.address, realm1, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
          (await this.natCallback.storage()).should.be.bignumber.equal(0);
          await runOperation(tezos, owner, () => this.contract.methods.yearlyTransfers(address2.pkh, this.natCallback.address, realm1, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
          (await this.natCallback.storage()).should.be.bignumber.equal(0);
          await runOperation(tezos, operator, () => this.contract.methods.updateTransfers(address1.pkh, realm1, address2.pkh, 10000).send());
          await runOperation(tezos, owner, () => this.contract.methods.monthlyTransfers(address1.pkh, this.natCallback.address, realm1, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
          (await this.natCallback.storage()).should.be.bignumber.equal(10000);
          await runOperation(tezos, owner, () => this.contract.methods.monthlyTransfers(address2.pkh, this.natCallback.address, realm1, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
          (await this.natCallback.storage()).should.be.bignumber.equal(10000);
          await runOperation(tezos, owner, () => this.contract.methods.monthlyInTransfers(address2.pkh, this.natCallback.address, realm1, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
          (await this.natCallback.storage()).should.be.bignumber.equal(10000);
          await runOperation(tezos, owner, () => this.contract.methods.monthlyOutTransfers(address1.pkh, this.natCallback.address, realm1, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
          (await this.natCallback.storage()).should.be.bignumber.equal(10000);
          await runOperation(tezos, owner, () => this.contract.methods.yearlyTransfers(address1.pkh, this.natCallback.address, realm1, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
          (await this.natCallback.storage()).should.be.bignumber.equal(10000);
          await runOperation(tezos, owner, () => this.contract.methods.yearlyTransfers(address2.pkh, this.natCallback.address, realm1, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
          (await this.natCallback.storage()).should.be.bignumber.equal(10000);
          await runOperation(tezos, owner, () => this.contract.methods.yearlyInTransfers(address2.pkh, this.natCallback.address, realm1, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
          (await this.natCallback.storage()).should.be.bignumber.equal(10000);
          await runOperation(tezos, owner, () => this.contract.methods.yearlyOutTransfers(address1.pkh, this.natCallback.address, realm1, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
          (await this.natCallback.storage()).should.be.bignumber.equal(10000);
          await runOperation(tezos, operator, () => this.contract.methods.updateTransfers(address3.pkh, realm1, address2.pkh, 11000).send());
          await runOperation(tezos, operator, () => this.contract.methods.updateTransfers(address2.pkh, realm1, address4.pkh, 12000).send());
          await runOperation(tezos, owner, () => this.contract.methods.yearlyTransfers(address1.pkh, this.natCallback.address, realm1, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
          (await this.natCallback.storage()).should.be.bignumber.equal(10000);
          await runOperation(tezos, owner, () => this.contract.methods.yearlyTransfers(address2.pkh, this.natCallback.address, realm1, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
          (await this.natCallback.storage()).should.be.bignumber.equal(33000);
          await runOperation(tezos, owner, () => this.contract.methods.yearlyTransfers(address3.pkh, this.natCallback.address, realm1, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
          (await this.natCallback.storage()).should.be.bignumber.equal(11000);
          await runOperation(tezos, owner, () => this.contract.methods.yearlyTransfers(address4.pkh, this.natCallback.address, realm1, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
          (await this.natCallback.storage()).should.be.bignumber.equal(12000);
        });  
      });
      context('Transfer registers update for registered users', function () {
        beforeEach(async function () {
          await runOperation(tezos, trustedIntermediary1, () => this.contract.methods.registerUsers([address1.pkh, address2.pkh, address5.pkh], [0, 100, 110, 111, 112], [1874872800, 1, 10000, 15000, 180000]).send());
          await runOperation(tezos, trustedIntermediary1, () => this.contract.methods.attachAddresses([address3.pkh, address4.pkh], [1, 2]).send());
        });
        it('can update transfer registers', async function () {
          await runOperation(tezos, owner, () => this.contract.methods.monthlyTransfers(address1.pkh, this.natCallback.address, realm1, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
          (await this.natCallback.storage()).should.be.bignumber.equal(0);
          await runOperation(tezos, owner, () => this.contract.methods.monthlyTransfers(address2.pkh, this.natCallback.address, realm1, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
          (await this.natCallback.storage()).should.be.bignumber.equal(0);
          await runOperation(tezos, owner, () => this.contract.methods.yearlyTransfers(address1.pkh, this.natCallback.address, realm1, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
          (await this.natCallback.storage()).should.be.bignumber.equal(0);
          await runOperation(tezos, owner, () => this.contract.methods.yearlyTransfers(address2.pkh, this.natCallback.address, realm1, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
          (await this.natCallback.storage()).should.be.bignumber.equal(0);
          await runOperation(tezos, operator, () => this.contract.methods.updateTransfers(address1.pkh, realm1, address2.pkh, 10000).send());
          await runOperation(tezos, owner, () => this.contract.methods.monthlyTransfers(address1.pkh, this.natCallback.address, realm1, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
          (await this.natCallback.storage()).should.be.bignumber.equal(10000);
          await runOperation(tezos, owner, () => this.contract.methods.monthlyTransfers(address2.pkh, this.natCallback.address, realm1, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
          (await this.natCallback.storage()).should.be.bignumber.equal(10000);
          await runOperation(tezos, owner, () => this.contract.methods.monthlyInTransfers(address2.pkh, this.natCallback.address, realm1, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
          (await this.natCallback.storage()).should.be.bignumber.equal(10000);
          await runOperation(tezos, owner, () => this.contract.methods.monthlyOutTransfers(address1.pkh, this.natCallback.address, realm1, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
          (await this.natCallback.storage()).should.be.bignumber.equal(10000);
          await runOperation(tezos, owner, () => this.contract.methods.yearlyTransfers(address1.pkh, this.natCallback.address, realm1, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
          (await this.natCallback.storage()).should.be.bignumber.equal(10000);
          await runOperation(tezos, owner, () => this.contract.methods.yearlyTransfers(address2.pkh, this.natCallback.address, realm1, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
          (await this.natCallback.storage()).should.be.bignumber.equal(10000);
          await runOperation(tezos, owner, () => this.contract.methods.yearlyInTransfers(address2.pkh, this.natCallback.address, realm1, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
          (await this.natCallback.storage()).should.be.bignumber.equal(10000);
          await runOperation(tezos, owner, () => this.contract.methods.yearlyOutTransfers(address1.pkh, this.natCallback.address, realm1, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
          (await this.natCallback.storage()).should.be.bignumber.equal(10000);
          await runOperation(tezos, operator, () => this.contract.methods.updateTransfers(address3.pkh, realm1, address2.pkh, 11000).send());
          await runOperation(tezos, operator, () => this.contract.methods.updateTransfers(address2.pkh, realm1, address4.pkh, 12000).send());
          await runOperation(tezos, owner, () => this.contract.methods.yearlyTransfers(address1.pkh, this.natCallback.address, realm1, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
          (await this.natCallback.storage()).should.be.bignumber.equal(21000);
          await runOperation(tezos, owner, () => this.contract.methods.yearlyTransfers(address2.pkh, this.natCallback.address, realm1, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
          (await this.natCallback.storage()).should.be.bignumber.equal(45000);
          await runOperation(tezos, owner, () => this.contract.methods.yearlyTransfers(address3.pkh, this.natCallback.address, realm1, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
          (await this.natCallback.storage()).should.be.bignumber.equal(21000);
          await runOperation(tezos, owner, () => this.contract.methods.yearlyTransfers(address4.pkh, this.natCallback.address, realm1, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
          (await this.natCallback.storage()).should.be.bignumber.equal(45000);       
        });  
      });
    });
    context('Transfer on realm 2', function () {
      context('Transfer registers update for single address without updating realm 1 values', function () {
        it('can update transfer registers', async function () {
          await runOperation(tezos, operator, () => this.contract.methods.updateTransfers(address1.pkh, realm1, address2.pkh, 10000).send());
          await runOperation(tezos, operator, () => this.contract.methods.updateTransfers(address3.pkh, realm1, address2.pkh, 11000).send());
          await runOperation(tezos, operator, () => this.contract.methods.updateTransfers(address2.pkh, realm1, address4.pkh, 12000).send());
          await runOperation(tezos, owner, () => this.contract.methods.yearlyTransfers(address1.pkh, this.natCallback.address, realm1, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
          (await this.natCallback.storage()).should.be.bignumber.equal(10000);
          await runOperation(tezos, owner, () => this.contract.methods.yearlyTransfers(address2.pkh, this.natCallback.address, realm1, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
          (await this.natCallback.storage()).should.be.bignumber.equal(33000);
          await runOperation(tezos, owner, () => this.contract.methods.yearlyTransfers(address3.pkh, this.natCallback.address, realm1, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
          (await this.natCallback.storage()).should.be.bignumber.equal(11000);
          await runOperation(tezos, owner, () => this.contract.methods.yearlyTransfers(address4.pkh, this.natCallback.address, realm1, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
          (await this.natCallback.storage()).should.be.bignumber.equal(12000);
          await runOperation(tezos, owner, () => this.contract.methods.yearlyTransfers(address1.pkh, this.natCallback.address, realm2, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
          (await this.natCallback.storage()).should.be.bignumber.equal(0);
          await runOperation(tezos, owner, () => this.contract.methods.yearlyTransfers(address2.pkh, this.natCallback.address, realm2, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
          (await this.natCallback.storage()).should.be.bignumber.equal(0);
          await runOperation(tezos, owner, () => this.contract.methods.yearlyTransfers(address3.pkh, this.natCallback.address, realm2, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
          (await this.natCallback.storage()).should.be.bignumber.equal(0);
          await runOperation(tezos, owner, () => this.contract.methods.yearlyTransfers(address4.pkh, this.natCallback.address, realm2, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
          (await this.natCallback.storage()).should.be.bignumber.equal(0);
          await runOperation(tezos, operator, () => this.contract.methods.updateTransfers(address1.pkh, realm2, address2.pkh, 20000).send());
          await runOperation(tezos, operator, () => this.contract.methods.updateTransfers(address3.pkh, realm2, address2.pkh, 21000).send());
          await runOperation(tezos, operator, () => this.contract.methods.updateTransfers(address2.pkh, realm2, address4.pkh, 22000).send());
          await runOperation(tezos, owner, () => this.contract.methods.yearlyTransfers(address1.pkh, this.natCallback.address, realm1, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
          (await this.natCallback.storage()).should.be.bignumber.equal(10000);
          await runOperation(tezos, owner, () => this.contract.methods.yearlyTransfers(address2.pkh, this.natCallback.address, realm1, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
          (await this.natCallback.storage()).should.be.bignumber.equal(33000);
          await runOperation(tezos, owner, () => this.contract.methods.yearlyTransfers(address3.pkh, this.natCallback.address, realm1, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
          (await this.natCallback.storage()).should.be.bignumber.equal(11000);
          await runOperation(tezos, owner, () => this.contract.methods.yearlyTransfers(address4.pkh, this.natCallback.address, realm1, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
          (await this.natCallback.storage()).should.be.bignumber.equal(12000);
          await runOperation(tezos, owner, () => this.contract.methods.yearlyTransfers(address1.pkh, this.natCallback.address, realm2, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
          (await this.natCallback.storage()).should.be.bignumber.equal(20000);
          await runOperation(tezos, owner, () => this.contract.methods.yearlyTransfers(address2.pkh, this.natCallback.address, realm2, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
          (await this.natCallback.storage()).should.be.bignumber.equal(63000);
          await runOperation(tezos, owner, () => this.contract.methods.yearlyTransfers(address3.pkh, this.natCallback.address, realm2, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
          (await this.natCallback.storage()).should.be.bignumber.equal(21000);
          await runOperation(tezos, owner, () => this.contract.methods.yearlyTransfers(address4.pkh, this.natCallback.address, realm2, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
          (await this.natCallback.storage()).should.be.bignumber.equal(22000);
        });  
      });
      context('Transfer registers update for registered users', function () {
        beforeEach(async function () {
          await runOperation(tezos, trustedIntermediary1, () => this.contract.methods.registerUsers([address1.pkh, address2.pkh, address5.pkh], [0, 100, 110, 111, 112], [1874872800, 1, 10000, 15000, 180000]).send());
          await runOperation(tezos, trustedIntermediary1, () => this.contract.methods.attachAddresses([address3.pkh, address4.pkh], [1, 2]).send());
        });
        it('can update transfer registers', async function () {
          await runOperation(tezos, operator, () => this.contract.methods.updateTransfers(address1.pkh, realm1, address2.pkh, 10000).send());
          await runOperation(tezos, operator, () => this.contract.methods.updateTransfers(address3.pkh, realm1, address2.pkh, 11000).send());
          await runOperation(tezos, operator, () => this.contract.methods.updateTransfers(address2.pkh, realm1, address4.pkh, 12000).send());
          await runOperation(tezos, owner, () => this.contract.methods.yearlyTransfers(address1.pkh, this.natCallback.address, realm1, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
          (await this.natCallback.storage()).should.be.bignumber.equal(21000);
          await runOperation(tezos, owner, () => this.contract.methods.yearlyTransfers(address2.pkh, this.natCallback.address, realm1, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
          (await this.natCallback.storage()).should.be.bignumber.equal(45000);
          await runOperation(tezos, owner, () => this.contract.methods.yearlyTransfers(address3.pkh, this.natCallback.address, realm1, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
          (await this.natCallback.storage()).should.be.bignumber.equal(21000);
          await runOperation(tezos, owner, () => this.contract.methods.yearlyTransfers(address4.pkh, this.natCallback.address, realm1, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
          (await this.natCallback.storage()).should.be.bignumber.equal(45000);
          await runOperation(tezos, owner, () => this.contract.methods.yearlyTransfers(address1.pkh, this.natCallback.address, realm2, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
          (await this.natCallback.storage()).should.be.bignumber.equal(0);
          await runOperation(tezos, owner, () => this.contract.methods.yearlyTransfers(address2.pkh, this.natCallback.address, realm2, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
          (await this.natCallback.storage()).should.be.bignumber.equal(0);
          await runOperation(tezos, owner, () => this.contract.methods.yearlyTransfers(address3.pkh, this.natCallback.address, realm2, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
          (await this.natCallback.storage()).should.be.bignumber.equal(0);
          await runOperation(tezos, owner, () => this.contract.methods.yearlyTransfers(address4.pkh, this.natCallback.address, realm2, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
          (await this.natCallback.storage()).should.be.bignumber.equal(0);
          await runOperation(tezos, operator, () => this.contract.methods.updateTransfers(address1.pkh, realm2, address2.pkh, 20000).send());
          await runOperation(tezos, operator, () => this.contract.methods.updateTransfers(address3.pkh, realm2, address2.pkh, 21000).send());
          await runOperation(tezos, operator, () => this.contract.methods.updateTransfers(address2.pkh, realm2, address4.pkh, 22000).send());
          await runOperation(tezos, owner, () => this.contract.methods.yearlyTransfers(address1.pkh, this.natCallback.address, realm1, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
          (await this.natCallback.storage()).should.be.bignumber.equal(21000);
          await runOperation(tezos, owner, () => this.contract.methods.yearlyTransfers(address2.pkh, this.natCallback.address, realm1, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
          (await this.natCallback.storage()).should.be.bignumber.equal(45000);
          await runOperation(tezos, owner, () => this.contract.methods.yearlyTransfers(address3.pkh, this.natCallback.address, realm1, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
          (await this.natCallback.storage()).should.be.bignumber.equal(21000);
          await runOperation(tezos, owner, () => this.contract.methods.yearlyTransfers(address4.pkh, this.natCallback.address, realm1, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
          (await this.natCallback.storage()).should.be.bignumber.equal(45000);
          await runOperation(tezos, owner, () => this.contract.methods.yearlyTransfers(address1.pkh, this.natCallback.address, realm2, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
          (await this.natCallback.storage()).should.be.bignumber.equal(41000);
          await runOperation(tezos, owner, () => this.contract.methods.yearlyTransfers(address2.pkh, this.natCallback.address, realm2, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
          (await this.natCallback.storage()).should.be.bignumber.equal(85000);
          await runOperation(tezos, owner, () => this.contract.methods.yearlyTransfers(address3.pkh, this.natCallback.address, realm2, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
          (await this.natCallback.storage()).should.be.bignumber.equal(41000);
          await runOperation(tezos, owner, () => this.contract.methods.yearlyTransfers(address4.pkh, this.natCallback.address, realm2, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
          (await this.natCallback.storage()).should.be.bignumber.equal(85000);    
        });  
      });
    });
  });

  context('When trusted intermediary', function () {
    beforeEach(async function () {
      this.intCallback = await ContractBuilder.new(tezos, 'ligo/mocks/IntCallback.ligo', {}, '0');
      this.natCallback = await ContractBuilder.new(tezos, 'ligo/mocks/NatCallback.ligo', {}, '0');
    });
    context('User registration', function () {
      beforeEach(async function () {
        this.userIdCallback = await ContractBuilder.new(tezos, 'ligo/mocks/UserIdCallback.ligo', {}, { trustedIntermediary : BURN_ADDRESS, userId : '0'});
      })
      it('can register new user', async function () {
        await runOperation(tezos, owner, () => this.contract.methods.userCount(this.intCallback.address, trustedIntermediary1.pkh).send());
        (await this.intCallback.storage()).should.be.bignumber.equal(0);
        await runOperation(tezos, trustedIntermediary1, () => this.contract.methods.registerUser(address1.pkh, [0, 100, 110, 111, 112], ['1874872800', '1', '10000', '15000', '180000']).send());
        await runOperation(tezos, owner, () => this.contract.methods.userCount(this.intCallback.address, trustedIntermediary1.pkh).send());
        (await this.intCallback.storage()).should.be.bignumber.equal(1);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address1.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        const userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('1');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary1.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 0, trustedIntermediary1.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('1874872800');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 100, trustedIntermediary1.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('1');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 110, trustedIntermediary1.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('10000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 111, trustedIntermediary1.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('15000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 112, trustedIntermediary1.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('180000');
      });
  
      it('reverts if trying to register user where attribute keys is not the same length as attribute values', async function () {
        await runOperation(tezos, owner, () => this.contract.methods.userCount(this.intCallback.address, trustedIntermediary1.pkh).send());
        (await this.intCallback.storage()).should.be.bignumber.equal(0);
        await shouldFail(runOperation(tezos, trustedIntermediary1, () => this.contract.methods.registerUser(address1.pkh, [0, 100, 110, 111], [1874872800, 1, 10000, 15000, 180000]).send()), "UR05");
        await runOperation(tezos, owner, () => this.contract.methods.userCount(this.intCallback.address, trustedIntermediary1.pkh).send());
        (await this.intCallback.storage()).should.be.bignumber.equal(0);
      });

      it('reverts if trying to register user and address already exists', async function () {
        await runOperation(tezos, owner, () => this.contract.methods.userCount(this.intCallback.address, trustedIntermediary1.pkh).send());
        (await this.intCallback.storage()).should.be.bignumber.equal(0);
        await runOperation(tezos, trustedIntermediary1, () => this.contract.methods.registerUser(address1.pkh, [0, 100, 110, 111, 112], ['1874872800', '1', '10000', '15000', '180000']).send());
        await shouldFail(runOperation(tezos, trustedIntermediary1, () => this.contract.methods.registerUser(address1.pkh, [0, 100, 110, 111, 112], ['1874872800', '1', '10000', '15000', '180000']).send()), "UR02");
        await runOperation(tezos, owner, () => this.contract.methods.userCount(this.intCallback.address, trustedIntermediary1.pkh).send());
        (await this.intCallback.storage()).should.be.bignumber.equal(1);
      });
  
      it('can register new users', async function () {
        await runOperation(tezos, owner, () => this.contract.methods.userCount(this.intCallback.address, trustedIntermediary1.pkh).send());
        (await this.intCallback.storage()).should.be.bignumber.equal(0);
        await runOperation(tezos, trustedIntermediary1, () => this.contract.methods.registerUsers([address1.pkh, address2.pkh], [0, 100, 110, 111, 112], [1874872800, 1, 10000, 15000, 180000]).send());
        await runOperation(tezos, owner, () => this.contract.methods.userCount(this.intCallback.address, trustedIntermediary1.pkh).send());
        (await this.intCallback.storage()).should.be.bignumber.equal(2);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address1.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        let userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('1');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary1.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address2.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('2');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary1.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 0, trustedIntermediary1.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('1874872800');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 100, trustedIntermediary1.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('1');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 110, trustedIntermediary1.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('10000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 111, trustedIntermediary1.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('15000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 112, trustedIntermediary1.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('180000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 0, trustedIntermediary1.pkh, 2).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('1874872800');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 100, trustedIntermediary1.pkh, 2).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('1');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 110, trustedIntermediary1.pkh, 2).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('10000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 111, trustedIntermediary1.pkh, 2).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('15000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 112, trustedIntermediary1.pkh, 2).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('180000');
      });

      it('reverts if trying to register users where attribute keys is not the same length as attribute values', async function () {
        await runOperation(tezos, owner, () => this.contract.methods.userCount(this.intCallback.address, trustedIntermediary1.pkh).send());
        (await this.intCallback.storage()).should.be.bignumber.equal(0);
        await shouldFail(runOperation(tezos, trustedIntermediary1, () => this.contract.methods.registerUsers([address1.pkh, address2.pkh], [0, 100, 110, 111], [1874872800, 1, 10000, 15000, 180000]).send()), "UR05");
        await runOperation(tezos, owner, () => this.contract.methods.userCount(this.intCallback.address, trustedIntermediary1.pkh).send());
        (await this.intCallback.storage()).should.be.bignumber.equal(0);
      });
    });

    context('User address attachment', function () {
      beforeEach(async function () {
        await runOperation(tezos, trustedIntermediary1, () => this.contract.methods.registerUsers([address1.pkh, address2.pkh], [0, 100, 110, 111, 112], [1874872800, 1, 10000, 15000, 180000]).send());
        this.userIdCallback = await ContractBuilder.new(tezos, 'ligo/mocks/UserIdCallback.ligo', {}, { trustedIntermediary : BURN_ADDRESS, userId : '0'});
      });

      it('can attach an address to an existing user', async function () {
        await runOperation(tezos, owner, () => this.contract.methods.userId(address1.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        let userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('1');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary1.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address3.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('0');
        userIdResult.trustedIntermediary.should.equal(BURN_ADDRESS);
        await runOperation(tezos, trustedIntermediary1, () => this.contract.methods.attachAddress(address3.pkh, 1).send());
        await runOperation(tezos, owner, () => this.contract.methods.userId(address1.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('1');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary1.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address3.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('1');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary1.pkh);
      });

      it('reverts if trying to attach an address to a user that does not exist', async function () {
        await runOperation(tezos, owner, () => this.contract.methods.userId(address1.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        let userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('1');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary1.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address3.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('0');
        userIdResult.trustedIntermediary.should.equal(BURN_ADDRESS);
        await shouldFail(runOperation(tezos, trustedIntermediary1, () => this.contract.methods.attachAddress(address3.pkh, 0).send()), "UR01");
        await shouldFail(runOperation(tezos, trustedIntermediary1, () => this.contract.methods.attachAddress(address3.pkh, 3).send()), "UR01");
        await runOperation(tezos, owner, () => this.contract.methods.userId(address1.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('1');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary1.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address3.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('0');
        userIdResult.trustedIntermediary.should.equal(BURN_ADDRESS);
      });

      it('reverts if trying to attach an address that is already attached', async function () {
        await runOperation(tezos, owner, () => this.contract.methods.userId(address1.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        let userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('1');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary1.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address3.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('0');
        userIdResult.trustedIntermediary.should.equal(BURN_ADDRESS);
        await shouldFail(runOperation(tezos, trustedIntermediary1, () => this.contract.methods.attachAddress(address1.pkh, 2).send()), "UR02");
        await runOperation(tezos, owner, () => this.contract.methods.userId(address1.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('1');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary1.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address3.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('0');
        userIdResult.trustedIntermediary.should.equal(BURN_ADDRESS);
      });

      it('can attach addresses to users', async function () {
        await runOperation(tezos, owner, () => this.contract.methods.userId(address1.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        let userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('1');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary1.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address2.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('2');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary1.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address3.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('0');
        userIdResult.trustedIntermediary.should.equal(BURN_ADDRESS);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address4.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('0');
        userIdResult.trustedIntermediary.should.equal(BURN_ADDRESS);
        await runOperation(tezos, trustedIntermediary1, () => this.contract.methods.attachAddresses([address3.pkh, address4.pkh], [1, 2]).send());
        await runOperation(tezos, owner, () => this.contract.methods.userId(address1.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('1');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary1.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address2.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('2');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary1.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address3.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('1');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary1.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address4.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('2');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary1.pkh);
      });
      
      it('reverts if userIds and addresses are not the same length', async function () {
        await shouldFail(runOperation(tezos, trustedIntermediary1, () => this.contract.methods.attachAddresses([address3.pkh, address4.pkh, address5.pkh], [1, 2]).send()), "UR03");
      });

      it('reverts if trying to attach addresses to users that does not exist', async function () {
        await shouldFail(runOperation(tezos, trustedIntermediary1, () => this.contract.methods.attachAddresses([address3.pkh, address4.pkh], [1, 0]).send()), "UR01");
        await shouldFail(runOperation(tezos, trustedIntermediary1, () => this.contract.methods.attachAddresses([address3.pkh, address4.pkh], [3, 4]).send()), "UR01");
      });

      it('reverts if trying to attach addresses to users when already attached', async function () {
        await shouldFail(runOperation(tezos, trustedIntermediary1, () => this.contract.methods.attachAddresses([address1.pkh, address2.pkh], [2, 1]).send()), "UR02");
      });
    });

    context('User address detachment', function () {
      beforeEach(async function () {
        await runOperation(tezos, trustedIntermediary1, () => this.contract.methods.registerUsers([address1.pkh, address2.pkh], [0, 100, 110, 111, 112], [1874872800, 1, 10000, 15000, 180000]).send());
        await runOperation(tezos, trustedIntermediary1, () => this.contract.methods.attachAddresses([address3.pkh, address4.pkh], [1, 2]).send());
        this.userIdCallback = await ContractBuilder.new(tezos, 'ligo/mocks/UserIdCallback.ligo', {}, { trustedIntermediary : BURN_ADDRESS, userId : '0'});
      });

      it('can detach an address from an existing user', async function () {
        await runOperation(tezos, owner, () => this.contract.methods.userId(address1.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        let userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('1');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary1.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address3.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('1');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary1.pkh);
        await runOperation(tezos, trustedIntermediary1, () => this.contract.methods.detachAddress(address1.pkh).send());
        await runOperation(tezos, owner, () => this.contract.methods.userId(address1.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('0');
        userIdResult.trustedIntermediary.should.equal(BURN_ADDRESS);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address3.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('1');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary1.pkh);
      });

      it('reverts if trying to detach an address that is not attached', async function () {
        await runOperation(tezos, owner, () => this.contract.methods.userId(address1.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        let userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('1');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary1.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address3.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('1');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary1.pkh);
        await shouldFail(runOperation(tezos, trustedIntermediary1, () => this.contract.methods.detachAddress(address5.pkh).send()), "UR04");
        await runOperation(tezos, owner, () => this.contract.methods.userId(address1.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('1');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary1.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address3.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('1');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary1.pkh);
      });

      it('can detach addresses to users', async function () {
        await runOperation(tezos, owner, () => this.contract.methods.userId(address1.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        let userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('1');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary1.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address2.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('2');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary1.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address3.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('1');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary1.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address4.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('2');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary1.pkh);
        await runOperation(tezos, trustedIntermediary1, () => this.contract.methods.detachAddresses([address1.pkh, address2.pkh]).send());
        await runOperation(tezos, owner, () => this.contract.methods.userId(address1.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('0');
        userIdResult.trustedIntermediary.should.equal(BURN_ADDRESS);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address2.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('0');
        userIdResult.trustedIntermediary.should.equal(BURN_ADDRESS);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address3.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('1');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary1.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address4.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('2');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary1.pkh);
      });

      it('reverts if trying to detach addresses that were not attached', async function () {
        await shouldFail(runOperation(tezos, trustedIntermediary1, () => this.contract.methods.detachAddresses([address5.pkh, address6.pkh]).send()), "UR04");
      });
    });

    context('User attributes update', function () {
      beforeEach(async function () {
        await runOperation(tezos, trustedIntermediary1, () => this.contract.methods.registerUsers([address1.pkh, address2.pkh], [0, 100, 110, 111, 112], [1874872800, 1, 10000, 15000, 180000]).send());
        await runOperation(tezos, trustedIntermediary1, () => this.contract.methods.attachAddresses([address3.pkh, address4.pkh], [1, 2]).send());
      });

      it('can update attributes for an existing user', async function () {
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 0, trustedIntermediary1.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('1874872800');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 100, trustedIntermediary1.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('1');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 110, trustedIntermediary1.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('10000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 111, trustedIntermediary1.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('15000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 112, trustedIntermediary1.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('180000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 113, trustedIntermediary1.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('0');
        await runOperation(tezos, trustedIntermediary1, () => this.contract.methods.updateUserAttributes([0, 100, 110, 111, 112, 113], [1874872900, 0, 11000, 16000, 300000, 567], 1).send());
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 0, trustedIntermediary1.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('1874872900');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 100, trustedIntermediary1.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('0');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 110, trustedIntermediary1.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('11000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 111, trustedIntermediary1.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('16000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 112, trustedIntermediary1.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('300000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 113, trustedIntermediary1.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('567');
      });

      it('reverts if trying to update attributes for a user that does not exist', async function () {
        await shouldFail(runOperation(tezos, trustedIntermediary1, () => this.contract.methods.updateUserAttributes([0, 100, 110, 111, 112, 113], [1874872900, 0, 11000, 16000, 300000, 567], 0).send()), "UR01");
        await shouldFail(runOperation(tezos, trustedIntermediary1, () => this.contract.methods.updateUserAttributes([0, 100, 110, 111, 112, 113], [1874872900, 0, 11000, 16000, 300000, 567], 3).send()), "UR01");
      });

      it('reverts if trying to update attributes for a user when attribute keys is not the same length as attribute values', async function () {
        await shouldFail(runOperation(tezos, trustedIntermediary1, () => this.contract.methods.updateUserAttributes([0, 100, 110, 111, 112], [1874872900, 0, 11000, 16000, 300000, 567], 1).send()), "UR05");
      });

      it('can update attributes for multiple existing users', async function () {
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 0, trustedIntermediary1.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('1874872800');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 100, trustedIntermediary1.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('1');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 110, trustedIntermediary1.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('10000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 111, trustedIntermediary1.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('15000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 112, trustedIntermediary1.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('180000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 113, trustedIntermediary1.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('0');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 0, trustedIntermediary1.pkh, 2).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('1874872800');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 100, trustedIntermediary1.pkh, 2).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('1');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 110, trustedIntermediary1.pkh, 2).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('10000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 111, trustedIntermediary1.pkh, 2).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('15000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 112, trustedIntermediary1.pkh, 2).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('180000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 113, trustedIntermediary1.pkh, 2).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('0');
        await runOperation(tezos, trustedIntermediary1, () => this.contract.methods.updateUsersAttributes([0, 100, 110, 111, 112, 113], [1874872900, 0, 11000, 16000, 300000, 567], [1, 2]).send());
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 0, trustedIntermediary1.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('1874872900');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 100, trustedIntermediary1.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('0');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 110, trustedIntermediary1.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('11000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 111, trustedIntermediary1.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('16000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 112, trustedIntermediary1.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('300000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 113, trustedIntermediary1.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('567');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 0, trustedIntermediary1.pkh, 2).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('1874872900');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 100, trustedIntermediary1.pkh, 2).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('0');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 110, trustedIntermediary1.pkh, 2).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('11000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 111, trustedIntermediary1.pkh, 2).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('16000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 112, trustedIntermediary1.pkh, 2).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('300000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 113, trustedIntermediary1.pkh, 2).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('567');
      });

      it('reverts if trying to update attributes for multiple users when attribute keys is not the same length as attribute values', async function () {
        await shouldFail(runOperation(tezos, trustedIntermediary1, () => this.contract.methods.updateUsersAttributes([0, 100, 110, 111, 112], [1874872900, 0, 11000, 16000, 300000, 567], [1, 2]).send()), "UR05");
      });
    });
  });

  context('When trusted intermediary 2', function () {
    beforeEach(async function () {
      this.intCallback = await ContractBuilder.new(tezos, 'ligo/mocks/IntCallback.ligo', {}, '0');
      this.natCallback = await ContractBuilder.new(tezos, 'ligo/mocks/NatCallback.ligo', {}, '0');
      await runOperation(tezos, trustedIntermediary1, () => this.contract.methods.registerUsers([address1.pkh, address2.pkh, address5.pkh], [0, 100, 110, 111, 112], [1874872800, 1, 10000, 15000, 180000]).send());
      await runOperation(tezos, trustedIntermediary1, () => this.contract.methods.attachAddresses([address3.pkh, address4.pkh], [1, 2]).send());
      await runOperation(tezos, trustedIntermediary1, () => this.contract.methods.updateUserAttributes([0, 100, 110, 111, 112, 113], [1874872900, 0, 11000, 16000, 300000, 567], 1).send());
      this.userIdCallback = await ContractBuilder.new(tezos, 'ligo/mocks/UserIdCallback.ligo', {}, { trustedIntermediary : BURN_ADDRESS, userId : '0'});
    });

    context('User registration', function () {
      it('can register new user', async function () {
        await runOperation(tezos, owner, () => this.contract.methods.userCount(this.intCallback.address, trustedIntermediary2.pkh).send());
        (await this.intCallback.storage()).should.be.bignumber.equal(0);
        await runOperation(tezos, owner, () => this.contract.methods.userCount(this.intCallback.address, trustedIntermediary1.pkh).send());
        (await this.intCallback.storage()).should.be.bignumber.equal(3);
        await runOperation(tezos, trustedIntermediary2, () => this.contract.methods.registerUser(address6.pkh, [0, 100, 110, 111, 112], ['1874872800', '1', '10000', '15000', '180000']).send());
        await runOperation(tezos, owner, () => this.contract.methods.userCount(this.intCallback.address, trustedIntermediary2.pkh).send());
        (await this.intCallback.storage()).should.be.bignumber.equal(1);
        await runOperation(tezos, owner, () => this.contract.methods.userCount(this.intCallback.address, trustedIntermediary1.pkh).send());
        (await this.intCallback.storage()).should.be.bignumber.equal(3);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address6.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        let userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('1');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary2.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 0, trustedIntermediary2.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('1874872800');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 100, trustedIntermediary2.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('1');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 110, trustedIntermediary2.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('10000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 111, trustedIntermediary2.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('15000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 112, trustedIntermediary2.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('180000');
      });
  
      it('can register new users', async function () {
        await runOperation(tezos, owner, () => this.contract.methods.userCount(this.intCallback.address, trustedIntermediary2.pkh).send());
        (await this.intCallback.storage()).should.be.bignumber.equal(0);
        await runOperation(tezos, owner, () => this.contract.methods.userCount(this.intCallback.address, trustedIntermediary1.pkh).send());
        (await this.intCallback.storage()).should.be.bignumber.equal(3);
        await runOperation(tezos, trustedIntermediary2, () => this.contract.methods.registerUsers([address2.pkh, address7.pkh], [0, 100, 110, 111, 112], ['1874872800', '1', '10000', '15000', '180000']).send());
        await runOperation(tezos, owner, () => this.contract.methods.userCount(this.intCallback.address, trustedIntermediary2.pkh).send());
        (await this.intCallback.storage()).should.be.bignumber.equal(2);
        await runOperation(tezos, owner, () => this.contract.methods.userCount(this.intCallback.address, trustedIntermediary1.pkh).send());
        (await this.intCallback.storage()).should.be.bignumber.equal(3);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address2.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        let userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('2');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary1.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address2.pkh, this.userIdCallback.address, [trustedIntermediary2.pkh, trustedIntermediary1.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('1');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary2.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address7.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('2');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary2.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 0, trustedIntermediary2.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('1874872800');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 100, trustedIntermediary2.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('1');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 110, trustedIntermediary2.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('10000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 111, trustedIntermediary2.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('15000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 112, trustedIntermediary2.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('180000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 0, trustedIntermediary2.pkh, 2).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('1874872800');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 100, trustedIntermediary2.pkh, 2).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('1');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 110, trustedIntermediary2.pkh, 2).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('10000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 111, trustedIntermediary2.pkh, 2).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('15000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 112, trustedIntermediary2.pkh, 2).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('180000');
      });
    });

    context('User address attachment', function () {
      beforeEach(async function () {
        await runOperation(tezos, trustedIntermediary2, () => this.contract.methods.registerUsers([address2.pkh, address1.pkh], [0, 100, 110, 111, 112], [1874872800, 1, 10000, 15000, 180000]).send());
      });

      it('can attach an address to an existing user', async function () {
        await runOperation(tezos, owner, () => this.contract.methods.userId(address1.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        let userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('1');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary1.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address3.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('1');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary1.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address1.pkh, this.userIdCallback.address, [trustedIntermediary2.pkh, trustedIntermediary1.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('2');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary2.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address3.pkh, this.userIdCallback.address, [trustedIntermediary2.pkh, trustedIntermediary1.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('1');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary1.pkh);
        await runOperation(tezos, trustedIntermediary2, () => this.contract.methods.attachAddress(address3.pkh, 2).send());
        await runOperation(tezos, owner, () => this.contract.methods.userId(address1.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('1');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary1.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address3.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('1');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary1.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address1.pkh, this.userIdCallback.address, [trustedIntermediary2.pkh, trustedIntermediary1.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('2');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary2.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address3.pkh, this.userIdCallback.address, [trustedIntermediary2.pkh, trustedIntermediary1.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('2');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary2.pkh);
      });

      it('can attach addresses to users', async function () {
        await runOperation(tezos, owner, () => this.contract.methods.userId(address1.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        let userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('1');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary1.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address2.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('2');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary1.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address3.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('1');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary1.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address4.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('2');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary1.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address1.pkh, this.userIdCallback.address, [trustedIntermediary2.pkh, trustedIntermediary1.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('2');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary2.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address2.pkh, this.userIdCallback.address, [trustedIntermediary2.pkh, trustedIntermediary1.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('1');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary2.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address3.pkh, this.userIdCallback.address, [trustedIntermediary2.pkh, trustedIntermediary1.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('1');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary1.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address4.pkh, this.userIdCallback.address, [trustedIntermediary2.pkh, trustedIntermediary1.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('2');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary1.pkh);
        await runOperation(tezos, trustedIntermediary2, () => this.contract.methods.attachAddresses([address4.pkh, address3.pkh], [1, 2]).send());
        await runOperation(tezos, owner, () => this.contract.methods.userId(address1.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('1');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary1.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address2.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('2');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary1.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address3.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('1');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary1.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address4.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('2');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary1.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address1.pkh, this.userIdCallback.address, [trustedIntermediary2.pkh, trustedIntermediary1.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('2');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary2.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address2.pkh, this.userIdCallback.address, [trustedIntermediary2.pkh, trustedIntermediary1.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('1');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary2.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address3.pkh, this.userIdCallback.address, [trustedIntermediary2.pkh, trustedIntermediary1.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('2');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary2.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address4.pkh, this.userIdCallback.address, [trustedIntermediary2.pkh, trustedIntermediary1.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('1');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary2.pkh);
      });
    });

    context('User address detachment', function () {
      beforeEach(async function () {
        await runOperation(tezos, trustedIntermediary2, () => this.contract.methods.registerUsers([address2.pkh, address1.pkh], [0, 100, 110, 111, 112], [1874872800, 1, 10000, 15000, 180000]).send());
        await runOperation(tezos, trustedIntermediary2, () => this.contract.methods.attachAddresses([address4.pkh, address3.pkh], [1, 2]).send());
      });

      it('can detach an address from an existing user', async function () {
        await runOperation(tezos, owner, () => this.contract.methods.userId(address1.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        let userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('1');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary1.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address3.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('1');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary1.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address1.pkh, this.userIdCallback.address, [trustedIntermediary2.pkh, trustedIntermediary1.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('2');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary2.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address3.pkh, this.userIdCallback.address, [trustedIntermediary2.pkh, trustedIntermediary1.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('2');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary2.pkh);
        await runOperation(tezos, trustedIntermediary2, () => this.contract.methods.detachAddress(address1.pkh).send());
        await runOperation(tezos, owner, () => this.contract.methods.userId(address1.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('1');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary1.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address3.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('1');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary1.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address1.pkh, this.userIdCallback.address, [trustedIntermediary2.pkh, trustedIntermediary1.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('1');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary1.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address3.pkh, this.userIdCallback.address, [trustedIntermediary2.pkh, trustedIntermediary1.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('2');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary2.pkh);
      });

      it('can detach addresses to users', async function () {
        await runOperation(tezos, owner, () => this.contract.methods.userId(address1.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        let userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('1');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary1.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address2.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('2');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary1.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address3.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('1');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary1.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address4.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('2');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary1.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address1.pkh, this.userIdCallback.address, [trustedIntermediary2.pkh, trustedIntermediary1.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('2');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary2.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address2.pkh, this.userIdCallback.address, [trustedIntermediary2.pkh, trustedIntermediary1.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('1');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary2.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address3.pkh, this.userIdCallback.address, [trustedIntermediary2.pkh, trustedIntermediary1.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('2');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary2.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address4.pkh, this.userIdCallback.address, [trustedIntermediary2.pkh, trustedIntermediary1.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('1');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary2.pkh);
        await runOperation(tezos, trustedIntermediary2, () => this.contract.methods.detachAddresses([address2.pkh, address1.pkh]).send());
        await runOperation(tezos, owner, () => this.contract.methods.userId(address1.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('1');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary1.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address2.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('2');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary1.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address3.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('1');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary1.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address4.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('2');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary1.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address1.pkh, this.userIdCallback.address, [trustedIntermediary2.pkh, trustedIntermediary1.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('1');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary1.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address2.pkh, this.userIdCallback.address, [trustedIntermediary2.pkh, trustedIntermediary1.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('2');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary1.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address3.pkh, this.userIdCallback.address, [trustedIntermediary2.pkh, trustedIntermediary1.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('2');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary2.pkh);
        await runOperation(tezos, owner, () => this.contract.methods.userId(address4.pkh, this.userIdCallback.address, [trustedIntermediary2.pkh, trustedIntermediary1.pkh]).send());
        userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('1');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary2.pkh);
      });
    });

    context('User attributes update', function () {
      beforeEach(async function () {
        await runOperation(tezos, trustedIntermediary2, () => this.contract.methods.registerUsers([address2.pkh, address1.pkh], [0, 100, 110, 111, 112], [1874872800, 1, 10000, 15000, 180000]).send());
        await runOperation(tezos, trustedIntermediary2, () => this.contract.methods.attachAddresses([address4.pkh, address3.pkh], [1, 2]).send());
      });

      it('can update attributes for an existing user', async function () {
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 0, trustedIntermediary1.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('1874872900');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 100, trustedIntermediary1.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('0');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 110, trustedIntermediary1.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('11000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 111, trustedIntermediary1.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('16000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 112, trustedIntermediary1.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('300000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 113, trustedIntermediary1.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('567');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 0, trustedIntermediary2.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('1874872800');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 100, trustedIntermediary2.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('1');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 110, trustedIntermediary2.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('10000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 111, trustedIntermediary2.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('15000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 112, trustedIntermediary2.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('180000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 113, trustedIntermediary2.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('0');
        await runOperation(tezos, trustedIntermediary2, () => this.contract.methods.updateUserAttributes([0, 100, 110, 111, 112, 113], [1874872700, 4, 12000, 17000, 200000, 930], 1).send());
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 0, trustedIntermediary1.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('1874872900');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 100, trustedIntermediary1.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('0');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 110, trustedIntermediary1.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('11000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 111, trustedIntermediary1.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('16000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 112, trustedIntermediary1.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('300000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 113, trustedIntermediary1.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('567');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 0, trustedIntermediary2.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('1874872700');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 100, trustedIntermediary2.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('4');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 110, trustedIntermediary2.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('12000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 111, trustedIntermediary2.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('17000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 112, trustedIntermediary2.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('200000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 113, trustedIntermediary2.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('930');
      });

      it('can update attributes for multiple existing users', async function () {
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 0, trustedIntermediary1.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('1874872900');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 100, trustedIntermediary1.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('0');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 110, trustedIntermediary1.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('11000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 111, trustedIntermediary1.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('16000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 112, trustedIntermediary1.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('300000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 113, trustedIntermediary1.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('567');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 0, trustedIntermediary1.pkh, 2).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('1874872800');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 100, trustedIntermediary1.pkh, 2).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('1');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 110, trustedIntermediary1.pkh, 2).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('10000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 111, trustedIntermediary1.pkh, 2).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('15000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 112, trustedIntermediary1.pkh, 2).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('180000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 113, trustedIntermediary1.pkh, 2).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('0');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 0, trustedIntermediary2.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('1874872800');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 100, trustedIntermediary2.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('1');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 110, trustedIntermediary2.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('10000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 111, trustedIntermediary2.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('15000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 112, trustedIntermediary2.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('180000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 113, trustedIntermediary2.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('0');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 0, trustedIntermediary2.pkh, 2).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('1874872800');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 100, trustedIntermediary2.pkh, 2).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('1');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 110, trustedIntermediary2.pkh, 2).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('10000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 111, trustedIntermediary2.pkh, 2).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('15000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 112, trustedIntermediary2.pkh, 2).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('180000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 113, trustedIntermediary2.pkh, 2).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('0');
        await runOperation(tezos, trustedIntermediary2, () => this.contract.methods.updateUsersAttributes([0, 100, 110, 111, 112, 113], [1874872700, 4, 12000, 17000, 200000, 930], [1, 2]).send());
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 0, trustedIntermediary1.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('1874872900');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 100, trustedIntermediary1.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('0');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 110, trustedIntermediary1.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('11000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 111, trustedIntermediary1.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('16000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 112, trustedIntermediary1.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('300000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 113, trustedIntermediary1.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('567');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 0, trustedIntermediary1.pkh, 2).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('1874872800');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 100, trustedIntermediary1.pkh, 2).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('1');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 110, trustedIntermediary1.pkh, 2).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('10000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 111, trustedIntermediary1.pkh, 2).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('15000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 112, trustedIntermediary1.pkh, 2).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('180000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 113, trustedIntermediary1.pkh, 2).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('0');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 0, trustedIntermediary2.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('1874872700');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 100, trustedIntermediary2.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('4');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 110, trustedIntermediary2.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('12000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 111, trustedIntermediary2.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('17000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 112, trustedIntermediary2.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('200000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 113, trustedIntermediary2.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('930');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 0, trustedIntermediary2.pkh, 2).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('1874872700');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 100, trustedIntermediary2.pkh, 2).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('4');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 110, trustedIntermediary2.pkh, 2).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('12000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 111, trustedIntermediary2.pkh, 2).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('17000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 112, trustedIntermediary2.pkh, 2).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('200000');
        await runOperation(tezos, owner, () => this.contract.methods.attribute(this.natCallback.address, 113, trustedIntermediary2.pkh, 2).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('930');
      });
    });
  });

  context('When standard role', function () {
    beforeEach(async function () {
      this.intCallback = await ContractBuilder.new(tezos, 'ligo/mocks/IntCallback.ligo', {}, '0');
      this.natCallback = await ContractBuilder.new(tezos, 'ligo/mocks/NatCallback.ligo', {}, '0');
      await runOperation(tezos, trustedIntermediary1, () => this.contract.methods.registerUsers([address1.pkh, address2.pkh, address5.pkh], [0, 100, 110, 111, 112], [1874872800, 1, 10000, 15000, 180000]).send());
      await runOperation(tezos, trustedIntermediary1, () => this.contract.methods.attachAddresses([address3.pkh, address4.pkh], [1, 2]).send());
      await runOperation(tezos, trustedIntermediary1, () => this.contract.methods.updateUserAttributes([0, 100, 110, 111, 112, 113], [1874872900, 0, 11000, 16000, 300000, 567], 1).send());
      this.userIdCallback = await ContractBuilder.new(tezos, 'ligo/mocks/UserIdCallback.ligo', {}, { trustedIntermediary : BURN_ADDRESS, userId : '0'});
    });

    context('Cannot call restricted functions', async function () {
      it('reverts when trying to register a new user', async function () {
        await shouldFail(runOperation(tezos, address3, () => this.contract.methods.updateTransfers(address1.pkh, realm1, address2.pkh, 10000).send()), "OP01");
      });
    });

    context('can get user information', function () {
      it('can get the userId for a specific address', async function () {
        await runOperation(tezos, address3, () => this.contract.methods.userId(address1.pkh, this.userIdCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        let userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('1');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary1.pkh);
      });

      it('can get the userId for a specific address for first found trusted intermediary', async function () {
        await runOperation(tezos, address3, () => this.contract.methods.userId(address1.pkh, this.userIdCallback.address, [trustedIntermediary2.pkh, trustedIntermediary1.pkh]).send());
        let userIdResult = await this.userIdCallback.storage();
        userIdResult.userId.should.be.bignumber.equal('1');
        userIdResult.trustedIntermediary.should.equal(trustedIntermediary1.pkh);
      });

      it('can get the userIds for 2 specific addresses for first found trusted intermediary', async function () {
        this.userIdsCallback = await ContractBuilder.new(tezos, 'ligo/mocks/UserIdsCallback.ligo', {}, []);
        await runOperation(tezos, address3, () => this.contract.methods.userIds([address1.pkh, address5.pkh], this.userIdsCallback.address, [trustedIntermediary2.pkh, trustedIntermediary1.pkh]).send());
        let userIdsResult = await this.userIdsCallback.storage();
        userIdsResult[0].userId.should.be.bignumber.equal('1');
        userIdsResult[0].trustedIntermediary.should.equal(trustedIntermediary1.pkh);
        userIdsResult[1].userId.should.be.bignumber.equal('3');
        userIdsResult[1].trustedIntermediary.should.equal(trustedIntermediary1.pkh);
      });

      it('can get the user validity expiration date', async function () {
        await runOperation(tezos, address3, () => this.contract.methods.validUntil(this.natCallback.address, trustedIntermediary1.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('1874872900')
      });

      it('can read a specific user attribute', async function () {
        await runOperation(tezos, address3, () => this.contract.methods.attribute(this.natCallback.address, 110, trustedIntermediary1.pkh, 1).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('11000');
      });

      it('can read a specific user attribute with address', async function () {
        this.userIdAttributeCallback = await ContractBuilder.new(tezos, 'ligo/mocks/UserIdAttributeCallback.ligo', {}, { userIdResult: { trustedIntermediary : BURN_ADDRESS, userId : '0'}, attribute: 0});
        await runOperation(tezos, address3, () => this.contract.methods.attributeForAddress(address1.pkh, this.userIdAttributeCallback.address, 110, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        (await this.userIdAttributeCallback.storage()).attribute.should.be.bignumber.equal('11000');
      });

      it('can read multiple user attributes', async function () {
        this.natListCallback = await ContractBuilder.new(tezos, 'ligo/mocks/NatListCallback.ligo', {}, []);
        await runOperation(tezos, address3, () => this.contract.methods.attributes(this.natListCallback.address, [0, 100, 110], trustedIntermediary1.pkh, 1).send());
        const ret = await this.natListCallback.storage();
        ret[0].should.be.bignumber.equal('1874872900');
        ret[1].should.be.bignumber.equal('0');
        ret[2].should.be.bignumber.equal('11000');
      });

      it('can read multiple user attributes for address', async function () {
        this.userIdAttributesCallback = await ContractBuilder.new(tezos, 'ligo/mocks/UserIdAttributesCallback.ligo', {}, { userIdResult: { trustedIntermediary : BURN_ADDRESS, userId : '0'}, attributes: []});
        await runOperation(tezos, address3, () => this.contract.methods.attributesForAddress(address1.pkh, this.userIdAttributesCallback.address, [0, 100, 110], [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        const ret = (await this.userIdAttributesCallback.storage()).attributes;
        ret[0].should.be.bignumber.equal('1874872900');
        ret[1].should.be.bignumber.equal('0');
        ret[2].should.be.bignumber.equal('11000');
      });

      it('can check if an address is valid (associated to a user and not expired)', async function () {
        this.boolCallback = await ContractBuilder.new(tezos, 'ligo/mocks/BoolCallback.ligo', {}, false);
        await runOperation(tezos, address3, () => this.contract.methods.isAddressValid(address1.pkh, this.boolCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        (await this.boolCallback.storage()).should.equal(true);
        await runOperation(tezos, address3, () => this.contract.methods.isAddressValid(address6.pkh, this.boolCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        (await this.boolCallback.storage()).should.equal(false);
        await runOperation(tezos, trustedIntermediary1, () => this.contract.methods.updateUserAttributes([0, 100, 110, 111, 112, 113], [0, 0, 11000, 16000, 300000, 567], 1).send());
        await runOperation(tezos, address3, () => this.contract.methods.isAddressValid(address1.pkh, this.boolCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        (await this.boolCallback.storage()).should.equal(false);
        await runOperation(tezos, address3, () => this.contract.methods.isAddressValid(address6.pkh, this.boolCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        (await this.boolCallback.storage()).should.equal(false);
      });

      it('can check if a user is valid (existing and not expired)', async function () {
        this.boolCallback = await ContractBuilder.new(tezos, 'ligo/mocks/BoolCallback.ligo', {}, false);
        await runOperation(tezos, address3, () => this.contract.methods.isValid(this.boolCallback.address, trustedIntermediary1.pkh, 1).send());
        (await this.boolCallback.storage()).should.equal(true);
        await runOperation(tezos, address3, () => this.contract.methods.isValid(this.boolCallback.address, trustedIntermediary1.pkh, 4).send());
        (await this.boolCallback.storage()).should.equal(false);
        await runOperation(tezos, trustedIntermediary1, () => this.contract.methods.updateUserAttributes([0, 100, 110, 111, 112, 113], [1527717600, 0, 11000, 16000, 300000, 567], 1).send());
        await runOperation(tezos, address3, () => this.contract.methods.isValid(this.boolCallback.address, trustedIntermediary1.pkh, 1).send());
        (await this.boolCallback.storage()).should.equal(false);
        await runOperation(tezos, address3, () => this.contract.methods.isValid(this.boolCallback.address, trustedIntermediary1.pkh, 4).send());
        (await this.boolCallback.storage()).should.equal(false);
      });
    });
  });
});