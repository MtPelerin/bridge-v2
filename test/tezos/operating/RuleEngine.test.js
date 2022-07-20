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

const DEFAULT_IS_TRANSFER_VALID_PARAM = {
  amount_: 0,
  amountInRefCurrency_: 0,
  from_: BURN_ADDRESS,
  realm_: BURN_ADDRESS, 
  rules_: [],
  to_: BURN_ADDRESS,
  token_: BURN_ADDRESS,
  trustedIntermediaries_: [],
  canTransferCallbackAddress_: BURN_ADDRESS
};

const DEFAULT_IS_TRANSFER_VALID_RESPONSE = {
  amount_: 0,
  ruleResponses_: new MichelsonMap(),
  rules_: [],
  from_: BURN_ADDRESS,
  to_: BURN_ADDRESS,
  canTransferCallbackAddress_: BURN_ADDRESS
};

const DEFAULT_BEFORE_TRANSFER_HOOK_PARAM = {
  amount_: 0,
  amountInRefCurrency_: 0,
  from_: BURN_ADDRESS,
  realm_: BURN_ADDRESS,
  ruleResponses_: new MichelsonMap(),
  rules_: [],
  to_: BURN_ADDRESS,
  token_: BURN_ADDRESS,
  trustedIntermediaries_: [],
  canTransferCallbackAddress_: BURN_ADDRESS
};

contract('RuleEngine', function ([owner, operator, address1, address2, canTransferCallbackAddress, trustedIntermediary1, trustedIntermediary2]) {
  beforeEach(async function () {
    tezos.setSignerProvider(new InMemorySigner(owner.sk));
    this.contract = await ContractBuilder.new(tezos, 'ligo/operating/RuleEngine.ligo', {}, { 
      owner: owner.pkh,
      roles: new MichelsonMap(),
      rules: new MichelsonMap(),
      internalState: {
        isTransferValidParam_: DEFAULT_IS_TRANSFER_VALID_PARAM,
        ruleResponses_: new MichelsonMap(),
        beforeTransferHookParam_: DEFAULT_BEFORE_TRANSFER_HOOK_PARAM,
      }
    });
    this.yesNo = await ContractBuilder.new(tezos, 'ligo/rules/YesNoRule.ligo', {}, {});
    this.yesNoUpdate = await ContractBuilder.new(tezos, 'ligo/rules/YesNoUpdateRule.ligo', {}, '0');
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

    it('can set rules', async function () {
      (await this.contract.storage()).rules.size.should.equal(0);
      const rules = new MichelsonMap();
      rules.set(0, this.yesNo.address);
      rules.set(1, this.yesNoUpdate.address);
      await runOperation(tezos, operator, () => this.contract.methods.setRules(rules).send());
      (await this.contract.storage()).rules.size.should.equal(2);
      (await this.contract.storage()).rules.get('0').should.equal(this.yesNo.address);
      (await this.contract.storage()).rules.get('1').should.equal(this.yesNoUpdate.address);
    });

    it('reverts if trying to set rules from standard user', async function () {
      const rules = new MichelsonMap();
      rules.set(0, this.yesNo.address);
      rules.set(1, this.yesNoUpdate.address);
      await shouldFail(runOperation(tezos, address1, () => this.contract.methods.setRules(rules).send()), "OP01");
    });
  });

  context('When normal user', function () {
    beforeEach(async function () {
      await runOperation(tezos, owner, () => this.contract.methods.addOperator(operator.pkh).send());
      const rules = new MichelsonMap();
      rules.set(0, this.yesNo.address);
      rules.set(1, this.yesNoUpdate.address);
      await runOperation(tezos, operator, () => this.contract.methods.setRules(rules).send());
      this.isTransferValidCallback = await ContractBuilder.new(tezos, 'ligo/mocks/IsTransferValidCallback.ligo', {}, DEFAULT_IS_TRANSFER_VALID_RESPONSE);
    });

    it('can find the id for a rule address', async function () {
      this.intCallback = await ContractBuilder.new(tezos, 'ligo/mocks/IntCallback.ligo', {}, '0');
      await runOperation(tezos, address1, () => this.contract.methods.findRuleId(this.intCallback.address, address2.pkh).send());
      (await this.intCallback.storage()).should.be.bignumber.equal(-1);
      await runOperation(tezos, address1, () => this.contract.methods.findRuleId(this.intCallback.address, this.yesNo.address).send());
      (await this.intCallback.storage()).should.be.bignumber.equal(0);
      await runOperation(tezos, address1, () => this.contract.methods.findRuleId(this.intCallback.address, this.yesNoUpdate.address).send());
      (await this.intCallback.storage()).should.be.bignumber.equal(1);
    });

    it('can get a single rule', async function () {
      this.addressCallback = await ContractBuilder.new(tezos, 'ligo/mocks/AddressCallback.ligo', {}, address1.pkh);
      await runOperation(tezos, address1, () => this.contract.methods.rule(this.addressCallback.address, 0).send());
      (await this.addressCallback.storage()).should.equal(this.yesNo.address);
      await runOperation(tezos, address1, () => this.contract.methods.rule(this.addressCallback.address, 1).send());
      (await this.addressCallback.storage()).should.equal(this.yesNoUpdate.address);
    });

    it('reverts if trying to get a rule that is not in the rule registry', async function () {
      this.addressCallback = await ContractBuilder.new(tezos, 'ligo/mocks/AddressCallback.ligo', {}, address1.pkh);
      await shouldFail(runOperation(tezos, address1, () => this.contract.methods.rule(this.addressCallback.address, 6).send()), "RE01");
      await shouldFail(runOperation(tezos, address1, () => this.contract.methods.rule(this.addressCallback.address, -1).send()), "RE01");
    });

    context('isTransferValid', function () {
      it('can validate transfer', async function () {
        await runOperation(tezos, address1, () => this.contract.methods.isTransferValid(10000, 10000, canTransferCallbackAddress.pkh, address1.pkh, BURN_ADDRESS, [], address2.pkh, this.isTransferValidCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        let storage = (await this.isTransferValidCallback.storage());
        storage.amount_.should.be.bignumber.equal('10000');
        storage.canTransferCallbackAddress_.should.equal(canTransferCallbackAddress.pkh);
        storage.from_.should.equal(address1.pkh);
        storage.ruleResponses_.size.should.equal(0);
        storage.to_.should.equal(address2.pkh);
        await runOperation(tezos, address1, () => this.contract.methods.isTransferValid(10000, 10000, canTransferCallbackAddress.pkh, address1.pkh, BURN_ADDRESS, [{ruleId: 0, ruleParam: 1}, {ruleId: 1, ruleParam: 1}], address2.pkh, this.isTransferValidCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        storage = (await this.isTransferValidCallback.storage());
        storage.amount_.should.be.bignumber.equal('10000');
        storage.canTransferCallbackAddress_.should.equal(canTransferCallbackAddress.pkh);
        storage.from_.should.equal(address1.pkh);
        storage.ruleResponses_.size.should.equal(2);
        storage.ruleResponses_.get('0').valid_.should.be.bignumber.equal(1);
        storage.ruleResponses_.get('0').reason_.should.be.bignumber.equal(0);
        storage.ruleResponses_.get('0').ruleId_.should.be.bignumber.equal(0);
        storage.ruleResponses_.get('1').valid_.should.be.bignumber.equal(2);
        storage.ruleResponses_.get('1').reason_.should.be.bignumber.equal(0);
        storage.ruleResponses_.get('1').ruleId_.should.be.bignumber.equal(1);
        storage.to_.should.equal(address2.pkh);
      });
  
      it('should return that transfer is not valid if rule is not valid', async function () {
        await runOperation(tezos, address1, () => this.contract.methods.isTransferValid(10000, 10000, canTransferCallbackAddress.pkh, address1.pkh, BURN_ADDRESS, [{ruleId: 0, ruleParam: 1}, {ruleId: 1, ruleParam: 0}], address2.pkh, this.isTransferValidCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        const storage = (await this.isTransferValidCallback.storage());
        storage.amount_.should.be.bignumber.equal('10000');
        storage.canTransferCallbackAddress_.should.equal(canTransferCallbackAddress.pkh);
        storage.from_.should.equal(address1.pkh);
        storage.ruleResponses_.size.should.equal(2);
        storage.ruleResponses_.get('0').valid_.should.be.bignumber.equal(1);
        storage.ruleResponses_.get('0').reason_.should.be.bignumber.equal(0);
        storage.ruleResponses_.get('0').ruleId_.should.be.bignumber.equal(0);
        storage.ruleResponses_.get('1').valid_.should.be.bignumber.equal(0);
        storage.ruleResponses_.get('1').reason_.should.be.bignumber.equal(1);
        storage.ruleResponses_.get('1').ruleId_.should.be.bignumber.equal(1);
        storage.to_.should.equal(address2.pkh);
      });
    })

    context('beforeTransferHook', function () {
      it('can call before transfer hook with 0 rules', async function () {
        await runOperation(tezos, address1, () => this.contract.methods.beforeTransferHook(10000, 10000, address1.pkh, BURN_ADDRESS, new MichelsonMap(), [], address2.pkh, this.isTransferValidCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        let storage = (await this.isTransferValidCallback.storage());
        storage.amount_.should.be.bignumber.equal('10000');
        storage.from_.should.equal(address1.pkh);
        storage.ruleResponses_.size.should.equal(0);
        storage.to_.should.equal(address2.pkh);
      });
  
      it('can call before transfer hook with non matching rules', async function () {
        await runOperation(tezos, address1, () => this.contract.methods.isTransferValid(10000, 10000, canTransferCallbackAddress.pkh, address1.pkh, BURN_ADDRESS, [{ruleId: 0, ruleParam: 1}], address2.pkh, this.isTransferValidCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        let storage = (await this.isTransferValidCallback.storage());
        await runOperation(tezos, address1, () => this.contract.methods.beforeTransferHook(10000, 10000, address1.pkh, BURN_ADDRESS, storage.ruleResponses_, [{ruleId: 0, ruleParam: 1}], address2.pkh, this.isTransferValidCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        storage = (await this.isTransferValidCallback.storage());
        storage.amount_.should.be.bignumber.equal('10000');
        storage.from_.should.equal(address1.pkh);
        storage.ruleResponses_.size.should.equal(1);
        storage.ruleResponses_.get('0').valid_.should.be.bignumber.equal(1);
        storage.ruleResponses_.get('0').reason_.should.be.bignumber.equal(0);
        storage.ruleResponses_.get('0').ruleId_.should.be.bignumber.equal(0);
        storage.to_.should.equal(address2.pkh);
      });
  
      it('can call before transfer hook with matching rules', async function () {
        await runOperation(tezos, address1, () => this.contract.methods.isTransferValid(10000, 10000, canTransferCallbackAddress.pkh, address1.pkh, BURN_ADDRESS, [{ruleId: 0, ruleParam: 1}, {ruleId: 1, ruleParam: 1}], address2.pkh, this.isTransferValidCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        let storage = (await this.isTransferValidCallback.storage());
        await runOperation(tezos, address1, () => this.contract.methods.beforeTransferHook(10000, 10000, address1.pkh, BURN_ADDRESS, storage.ruleResponses_, [{ruleId: 0, ruleParam: 1}, {ruleId: 1, ruleParam: 1}], address2.pkh, this.isTransferValidCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        storage = (await this.isTransferValidCallback.storage());
        storage.amount_.should.be.bignumber.equal('10001');
        storage.from_.should.equal(address1.pkh);
        storage.ruleResponses_.size.should.equal(2);
        storage.ruleResponses_.get('0').valid_.should.be.bignumber.equal(1);
        storage.ruleResponses_.get('0').reason_.should.be.bignumber.equal(0);
        storage.ruleResponses_.get('0').ruleId_.should.be.bignumber.equal(0);
        storage.ruleResponses_.get('1').valid_.should.be.bignumber.equal(3);
        storage.ruleResponses_.get('1').reason_.should.be.bignumber.equal(0);
        storage.ruleResponses_.get('1').ruleId_.should.be.bignumber.equal(1);
        storage.to_.should.equal(address2.pkh);
      });
    });

    context('afterTransferHook', function () {
      it('can call after transfer hook with 0 rules', async function () {
        await runOperation(tezos, address1, () => this.contract.methods.afterTransferHook(10000, 10000, address1.pkh, BURN_ADDRESS, new MichelsonMap(), [], address2.pkh, this.isTransferValidCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
      });
  
      it('can call after transfer hook with non matching rules', async function () {
        await runOperation(tezos, address1, () => this.contract.methods.isTransferValid(10000, 10000, canTransferCallbackAddress.pkh, address1.pkh, BURN_ADDRESS, [{ruleId: 0, ruleParam: 1}], address2.pkh, this.isTransferValidCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        let storage = (await this.isTransferValidCallback.storage());
        await runOperation(tezos, address1, () => this.contract.methods.beforeTransferHook(10000, 10000, address1.pkh, BURN_ADDRESS, storage.ruleResponses_, [{ruleId: 0, ruleParam: 1}], address2.pkh, this.isTransferValidCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        storage = (await this.isTransferValidCallback.storage());
        await runOperation(tezos, address1, () => this.contract.methods.afterTransferHook(10000, 10000, address1.pkh, BURN_ADDRESS, storage.ruleResponses_, [{ruleId: 0, ruleParam: 1}], address2.pkh, this.isTransferValidCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        (await this.yesNoUpdate.storage()).should.be.bignumber.equal('0');
      });
  
      it('can call after transfer hook with matching rules', async function () {
        await runOperation(tezos, address1, () => this.contract.methods.isTransferValid(10000, 10000, canTransferCallbackAddress.pkh, address1.pkh, BURN_ADDRESS, [{ruleId: 0, ruleParam: 1}, {ruleId: 1, ruleParam: 1}], address2.pkh, this.isTransferValidCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        let storage = (await this.isTransferValidCallback.storage());
        await runOperation(tezos, address1, () => this.contract.methods.beforeTransferHook(10000, 10000, address1.pkh, BURN_ADDRESS, storage.ruleResponses_, [{ruleId: 0, ruleParam: 1}, {ruleId: 1, ruleParam: 1}], address2.pkh, this.isTransferValidCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        storage = (await this.isTransferValidCallback.storage());
        await runOperation(tezos, address1, () => this.contract.methods.afterTransferHook(10000, 10000, address1.pkh, BURN_ADDRESS, storage.ruleResponses_, [{ruleId: 0, ruleParam: 1}, {ruleId: 1, ruleParam: 1}], address2.pkh, this.isTransferValidCallback.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        (await this.yesNoUpdate.storage()).should.be.bignumber.equal('1');
      });
    });
  });
});