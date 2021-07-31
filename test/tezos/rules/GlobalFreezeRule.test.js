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

const timestamp = function (datetime) {
  if (datetime) return Math.floor(new Date(datetime).getTime()/1000);
  return Math.floor(new Date().getTime()/1000);
};

contract('GlobalFreezeRule', function ([_, owner, operator, token, address1, address2]) {
  beforeEach(async function () {
    tezos.setSignerProvider(new InMemorySigner(owner.sk));
    this.contract = await ContractBuilder.new(tezos, 'ligo/rules/GlobalFreezeRule.ligo', {}, {
      owner: owner.pkh,
      roles: new MichelsonMap(),
      allFrozenUntil: '0',
    });
    this.callback = await ContractBuilder.new(tezos, 'ligo/mocks/RuleCallback.ligo', {}, {
      valid_: 0,
      reason_: 0,
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
    });

    it('can freeze transfers', async function () {
      (await this.contract.storage()).allFrozenUntil.should.equal('1970-01-01T00:00:00.000Z');
      this.timestamp = '' + (timestamp() + 3600);
      await runOperation(tezos, operator, () => this.contract.methods.freezeAll(this.timestamp).send());
      timestamp((await this.contract.storage()).allFrozenUntil).should.equal(Number(this.timestamp));
    });

    it('reverts if trying to freeze with end date in the past', async function () {
      this.timestamp = '' + (timestamp() - 3600);
      await shouldFail(runOperation(tezos, operator, () => this.contract.methods.freezeAll(this.timestamp).send()), "GF01");
    });

    it('can unfreeze transfers', async function () {
      this.timestamp = '' + (timestamp() + 3600);
      (await this.contract.storage()).allFrozenUntil.should.equal('1970-01-01T00:00:00.000Z');
      await runOperation(tezos, operator, () => this.contract.methods.freezeAll(this.timestamp).send());
      timestamp((await this.contract.storage()).allFrozenUntil).should.equal(Number(this.timestamp));
      await runOperation(tezos, operator, () => this.contract.methods.unfreezeAll(null).send());
      (await this.contract.storage()).allFrozenUntil.should.equal('1970-01-01T00:00:00.000Z');
    });
  });

  context('When initial state', function () {
    it('allows transfers', async function () {
      await runOperation(tezos, owner, () => this.contract.methods.isTransferValid(100, 100, this.callback.address, address1.pkh, BURN_ADDRESS, 0, address2.pkh, token.pkh, []).send());
      const result = await this.callback.storage();
      result.reason_.should.be.bignumber.equal('0');
      result.valid_.should.be.bignumber.equal('1');
    });
  });

  context('When frozen', function () {
    beforeEach(async function () {
      await runOperation(tezos, owner, () => this.contract.methods.addOperator(operator.pkh).send());
      this.timestamp = '' + (timestamp() + 3600);
      // Freeze
      await runOperation(tezos, operator, () => this.contract.methods.freezeAll(this.timestamp).send());
    });

    it('rejects transfers', async function () {
      await runOperation(tezos, owner, () => this.contract.methods.isTransferValid(100, 100, this.callback.address, address1.pkh, BURN_ADDRESS, 0, address2.pkh, token.pkh, [],).send());
      const result = await this.callback.storage();
      result.reason_.should.be.bignumber.equal('1');
      result.valid_.should.be.bignumber.equal('0');
    });

    context('When unfrozen', function () {
      beforeEach(async function () {
        // Unfreeze
        await runOperation(tezos, operator, () => this.contract.methods.unfreezeAll(null).send());
      });

      it('allows transfers', async function () {
        await runOperation(tezos, owner, () => this.contract.methods.isTransferValid(100, 100, this.callback.address, address1.pkh, BURN_ADDRESS, 0, address2.pkh, token.pkh, []).send());
        const result = await this.callback.storage();
        result.reason_.should.be.bignumber.equal('0');
        result.valid_.should.be.bignumber.equal('1');
      });
    });
  });

  context('When standard user', function () {
    it('reverts if trying to freeze', async function () {
      this.timestamp = '' + (timestamp() + 3600);
      await shouldFail(runOperation(tezos, address1, () => this.contract.methods.freezeAll(this.timestamp).send()), "OP01");
    });

    it('reverts if trying to unfreeze', async function () {
      await shouldFail(runOperation(tezos, address1, () => this.contract.methods.unfreezeAll(null).send()), "OP01");
    });
  });

  context('Update after transfer', function () {
    it('should revert if trying to update', async function () {
      await shouldFail(runOperation(tezos, owner, () => this.contract.methods.afterTransferHook(10000, this.callback.address, address1.pkh, BURN_ADDRESS, 0, address2.pkh, token.pkh, [],).send()), "RU02");
    });
  });
});