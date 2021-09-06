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
const { BigNumber } = require('bignumber.js');
global.TextEncoder = require('util').TextEncoder;
const { runOperation, tezosToolkit } = require('../helpers/toolkit');
const { shouldFail } = require('../helpers/shouldFail');
const { BURN_ADDRESS, MAX_DECIMALS } = require('../helpers/constants');
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

const toDecimals = (number) => new BigNumber(number).times(10 ** (2*MAX_DECIMALS)).toFixed();

contract('SoftTransferLimitRule', function ([owner, operator, administrator, token, realm, trustedIntermediary1, trustedIntermediary2, address1, address2, address3]) {
  beforeEach(async function () {
    tezos.setSignerProvider(new InMemorySigner(owner.sk));
    this.complianceRegistry = await ContractBuilder.new(tezos, 'ligo/operating/ComplianceRegistry.ligo', {}, { 
      owner: owner.pkh,
      roles: new MichelsonMap(),
      addressTransfers: new MichelsonMap(),
      addressUsers: new MichelsonMap(),
      trustedIntermediaries: new MichelsonMap(),
      userAttributes: new MichelsonMap(),
      userAddresses: new MichelsonMap(),
      onHoldTransfers: new MichelsonMap(),
    });
    this.callback = await ContractBuilder.new(tezos, 'ligo/mocks/RuleCallback.ligo', {}, {
      valid_: 0,
      reason_: 0,
    });
    this.beforeTransferHookCallback = await ContractBuilder.new(tezos, 'ligo/mocks/BeforeTransferHookCallback.ligo', {}, {
      valid_: 0,
      to_: BURN_ADDRESS,
      amount_: 0,
    });
    this.ruleEngine = await ContractBuilder.new(tezos, 'ligo/mocks/RuleEngineCallback.ligo', {}, {
      valid_: 0,
      reason_: 0,
    });
    this.contract = await ContractBuilder.new(tezos, 'ligo/rules/SoftTransferLimitRule.ligo', {}, {
      owner: owner.pkh,
      roles: new MichelsonMap(),
      complianceRegistry: this.complianceRegistry.address,
      ruleEngine: this.ruleEngine.address,
      noCheckThreshold: 0,
      amountInRefCurrency: 0,
    });
    await runOperation(tezos, trustedIntermediary1, () => this.complianceRegistry.methods.registerUsers([address1.pkh, address2.pkh], [0, 100, 110, 111, 112], [1874872800, 1, 10000, 15000, 180000]).send());
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

    context('When rule address is not operator on ComplianceRegistry', function () {
      it('beforeTransferHook should revert', async function () {
        await shouldFail(runOperation(tezos, owner, () => this.contract.methods.beforeTransferHook(10000, 10000, this.beforeTransferHookCallback.address, address1.pkh, realm.pkh, 0, address2.pkh, token.pkh, []).send()), "OP01");
      });
      it('afterTransferHook should revert', async function () {
        await shouldFail(runOperation(tezos, owner, () => this.contract.methods.afterTransferHook(10000, 10000, address1.pkh, realm.pkh, 0, address2.pkh, token.pkh, []).send()), "OP01");
      });
    });

    context('When rule address is operator on ComplianceRegistry', function () {
      beforeEach(async function () {
        await runOperation(tezos, owner, () => this.complianceRegistry.methods.addOperator(this.contract.address).send());
      });
      it('should update onHold transfer registry', async function () {
        this.onHoldTransferListCallback = await ContractBuilder.new(tezos, 'ligo/mocks/OnHoldTransferListCallback.ligo', {}, []);
        await runOperation(tezos, owner, () => this.complianceRegistry.methods.getOnHoldTransfers(this.onHoldTransferListCallback.address, trustedIntermediary1.pkh).send());
        (await this.onHoldTransferListCallback.storage()).length.should.equal(0);
        await runOperation(tezos, owner, () => this.contract.methods.beforeTransferHook(890133, 10000, this.beforeTransferHookCallback.address, address1.pkh, realm.pkh, 0, address2.pkh, token.pkh, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        await runOperation(tezos, owner, () => this.complianceRegistry.methods.getOnHoldTransfers(this.onHoldTransferListCallback.address, trustedIntermediary1.pkh).send());
        const ret = (await this.onHoldTransferListCallback.storage());
        ret[0]['id_'].should.be.bignumber.equal('0');
        ret[0]['token_'].should.equal(token.pkh);
        ret[0]['from_'].should.equal(address1.pkh);
        ret[0]['to_'].should.equal(address2.pkh);
        ret[0]['amount_'].should.be.bignumber.equal('10000');
      });

      it('should revert if from address is not known in compliance registry', async function () {
        await shouldFail(runOperation(tezos, owner, () => this.contract.methods.beforeTransferHook(10000, 10000, this.beforeTransferHookCallback.address, address3.pkh, realm.pkh, 0, address2.pkh, token.pkh, []).send({from: operator})), "SR01");
      });

      it('should update transfer registry', async function () {
        this.natCallback = await ContractBuilder.new(tezos, 'ligo/mocks/NatCallback.ligo', {}, '0');
        await runOperation(tezos, owner, () => this.complianceRegistry.methods.yearlyTransfers(address1.pkh, this.natCallback.address, realm.pkh, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        (await this.natCallback.storage()).should.be.bignumber.equal(0);
        await runOperation(tezos, owner, () => this.complianceRegistry.methods.yearlyTransfers(address2.pkh, this.natCallback.address, realm.pkh, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        (await this.natCallback.storage()).should.be.bignumber.equal(0);
        await runOperation(tezos, owner, () => this.contract.methods.afterTransferHook(890133, 10000, address1.pkh, realm.pkh, 0, address2.pkh, token.pkh, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        await runOperation(tezos, owner, () => this.complianceRegistry.methods.yearlyTransfers(address1.pkh, this.natCallback.address, realm.pkh, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        (await this.natCallback.storage()).should.be.bignumber.equal(890133);
        await runOperation(tezos, owner, () => this.complianceRegistry.methods.yearlyTransfers(address2.pkh, this.natCallback.address, realm.pkh, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        (await this.natCallback.storage()).should.be.bignumber.equal(890133);
      });
    });
  });

  context('When trusted intermediary', function () {
    beforeEach(async function () {
      await runOperation(tezos, owner, () => this.contract.methods.addOperator(operator.pkh).send());
      await runOperation(tezos, owner, () => this.complianceRegistry.methods.addOperator(this.contract.address).send());
      this.yesNo = await ContractBuilder.new(tezos, 'ligo/rules/YesNoRule.ligo', {}, {});
      this.yesNoUpdate = await ContractBuilder.new(tezos, 'ligo/rules/YesNoUpdateRule.ligo', {}, '0');
      const rules = new MichelsonMap();
      rules.set(0, this.yesNo.address);
      rules.set(1, this.yesNoUpdate.address);
      this.ruleEngineMock = await ContractBuilder.new(tezos, 'ligo/operating/RuleEngine.ligo', {}, { 
        owner: owner.pkh,
        roles: new MichelsonMap(),
        rules,
        internalState: {
          isTransferValidParam_: DEFAULT_IS_TRANSFER_VALID_PARAM,
          ruleResponses_: new MichelsonMap(),
          beforeTransferHookParam_: DEFAULT_BEFORE_TRANSFER_HOOK_PARAM,
        }
      });
      this.token = await ContractBuilder.new(tezos, 'ligo/token/ShareBridgeToken.ligo', {}, { 
        owner: owner.pkh,
        roles: new MichelsonMap(),
        name: 'Test token',
        symbol: 'TST',
        decimals: 3,
        totalSupply: 0,
        ledger: new MichelsonMap(),
        metadata: new MichelsonMap(),
        rules: [],
        trustedIntermediaries: [trustedIntermediary1.pkh, trustedIntermediary2.pkh],
        realm: realm.pkh,
        prices: new MichelsonMap(),
        ruleEngine: this.ruleEngineMock.address,
        contact: "",
        tokenizedSharePercentage: 100,
        boardResolutionDocumentHash: '',
        boardResolutionDocumentUrl: '',
        tempRealm: BURN_ADDRESS
      });
      await runOperation(tezos, owner, () => this.token.methods.addAdministrator(administrator.pkh).send());
      await runOperation(tezos, administrator, () => this.token.methods.addSupplier(administrator.pkh).send());
      await runOperation(tezos, administrator, () => this.token.methods.mint(3000000, this.complianceRegistry.address).send());
      await runOperation(tezos, owner, () => this.contract.methods.beforeTransferHook(89013100, 890131, this.beforeTransferHookCallback.address, address1.pkh, realm.pkh, 0, address2.pkh, this.token.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
      await runOperation(tezos, owner, () => this.contract.methods.beforeTransferHook(89013200, 890132, this.beforeTransferHookCallback.address, address1.pkh, realm.pkh, 0, address2.pkh, this.token.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
      await runOperation(tezos, owner, () => this.contract.methods.beforeTransferHook(89013300, 890133, this.beforeTransferHookCallback.address, address1.pkh, realm.pkh, 0, address2.pkh, this.token.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
      await runOperation(tezos, owner, () => this.contract.methods.beforeTransferHook(89013400, 890134, this.beforeTransferHookCallback.address, address1.pkh, realm.pkh, 0, address2.pkh, this.token.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
    });

    it('should be able to approve/reject transfers from onHold transfer registry updating minBoundary', async function () {
      this.onHoldTransferListCallback = await ContractBuilder.new(tezos, 'ligo/mocks/OnHoldTransferListCallback.ligo', {}, []);
      await runOperation(tezos, owner, () => this.complianceRegistry.methods.getOnHoldTransfers(this.onHoldTransferListCallback.address, trustedIntermediary1.pkh).send());
      (await this.onHoldTransferListCallback.storage()).length.should.equal(4);
      (await (await this.complianceRegistry.storage()).trustedIntermediaries.get(trustedIntermediary1.pkh)).onHoldMinBoundary.should.be.bignumber.equal('0');
      await runOperation(tezos, trustedIntermediary1, () => this.complianceRegistry.methods.processOnHoldTransfer(89013100, realm.pkh, false, 3, 0).send());
      await runOperation(tezos, trustedIntermediary1, () => this.complianceRegistry.methods.processOnHoldTransfer(89013100, realm.pkh, false, 2, 3).send());
      await runOperation(tezos, owner, () => this.complianceRegistry.methods.getOnHoldTransfers(this.onHoldTransferListCallback.address, trustedIntermediary1.pkh).send());
      const ret = await this.onHoldTransferListCallback.storage();
      ret.length.should.equal(2);
      ret[0]['id_'].should.be.bignumber.equal('2');
      ret[0]['token_'].should.equal(this.token.address);
      ret[0]['from_'].should.equal(address1.pkh);
      ret[0]['to_'].should.equal(address2.pkh);
      ret[0]['amount_'].should.be.bignumber.equal('890133');
      ret[1]['id_'].should.be.bignumber.equal('1');
      ret[1]['token_'].should.equal(this.token.address);
      ret[1]['from_'].should.equal(address1.pkh);
      ret[1]['to_'].should.equal(address2.pkh);
      ret[1]['amount_'].should.be.bignumber.equal('890132');
      (await (await this.complianceRegistry.storage()).trustedIntermediaries.get(trustedIntermediary1.pkh)).onHoldMinBoundary.should.be.bignumber.equal('1');
    });

    it('should be able to approve/reject transfers from onHold transfer registry without updating minBoundary', async function () {
      await runOperation(tezos, owner, () => this.complianceRegistry.methods.getOnHoldTransfers(this.onHoldTransferListCallback.address, trustedIntermediary1.pkh).send());
      (await this.onHoldTransferListCallback.storage()).length.should.equal(4);
      (await (await this.complianceRegistry.storage()).trustedIntermediaries.get(trustedIntermediary1.pkh)).onHoldMinBoundary.should.be.bignumber.equal('0');
      await runOperation(tezos, trustedIntermediary1, () => this.complianceRegistry.methods.processOnHoldTransfer(89013100, realm.pkh, true, 3, 0).send());
      await runOperation(tezos, trustedIntermediary1, () => this.complianceRegistry.methods.processOnHoldTransfer(89013100, realm.pkh, true, 2, 3).send());
      (await (await this.complianceRegistry.storage()).trustedIntermediaries.get(trustedIntermediary1.pkh)).onHoldMinBoundary.should.be.bignumber.equal('0');
      await runOperation(tezos, owner, () => this.complianceRegistry.methods.getOnHoldTransfers(this.onHoldTransferListCallback.address, trustedIntermediary1.pkh).send());
      const ret = await this.onHoldTransferListCallback.storage();
      ret.length.should.equal(2);
      ret[0]['id_'].should.be.bignumber.equal('2');
      ret[0]['token_'].should.equal(this.token.address);
      ret[0]['from_'].should.equal(address1.pkh);
      ret[0]['to_'].should.equal(address2.pkh);
      ret[0]['amount_'].should.be.bignumber.equal('890133');
      ret[1]['id_'].should.be.bignumber.equal('1');
      ret[1]['token_'].should.equal(this.token.address);
      ret[1]['from_'].should.equal(address1.pkh);
      ret[1]['to_'].should.equal(address2.pkh);
      ret[1]['amount_'].should.be.bignumber.equal('890132');
    });

    it('should be able to update minBoundary when having out of gas exceptions', async function () {
      await runOperation(tezos, owner, () => this.complianceRegistry.methods.getOnHoldTransfers(this.onHoldTransferListCallback.address, trustedIntermediary1.pkh).send());
      (await this.onHoldTransferListCallback.storage()).length.should.equal(4);
      (await (await this.complianceRegistry.storage()).trustedIntermediaries.get(trustedIntermediary1.pkh)).onHoldMinBoundary.should.be.bignumber.equal('0');
      await runOperation(tezos, trustedIntermediary1, () => this.complianceRegistry.methods.processOnHoldTransfer(89013100, realm.pkh, true, 3, 0).send());
      await runOperation(tezos, trustedIntermediary1, () => this.complianceRegistry.methods.processOnHoldTransfer(89013100, realm.pkh, true, 2, 3).send());
      (await (await this.complianceRegistry.storage()).trustedIntermediaries.get(trustedIntermediary1.pkh)).onHoldMinBoundary.should.be.bignumber.equal('0');
      await runOperation(tezos, owner, () => this.complianceRegistry.methods.getOnHoldTransfers(this.onHoldTransferListCallback.address, trustedIntermediary1.pkh).send());
      const ret = await this.onHoldTransferListCallback.storage();
      ret.length.should.equal(2);
      ret[0]['id_'].should.be.bignumber.equal('2');
      ret[0]['token_'].should.equal(this.token.address);
      ret[0]['from_'].should.equal(address1.pkh);
      ret[0]['to_'].should.equal(address2.pkh);
      ret[0]['amount_'].should.be.bignumber.equal('890133');
      ret[1]['id_'].should.be.bignumber.equal('1');
      ret[1]['token_'].should.equal(this.token.address);
      ret[1]['from_'].should.equal(address1.pkh);
      ret[1]['to_'].should.equal(address2.pkh);
      ret[1]['amount_'].should.be.bignumber.equal('890132');
      await runOperation(tezos, trustedIntermediary1, () => this.complianceRegistry.methods.updateOnHoldMinBoundary(10).send());
      (await (await this.complianceRegistry.storage()).trustedIntermediaries.get(trustedIntermediary1.pkh)).onHoldMinBoundary.should.be.bignumber.equal('1');
    });

    context('When transfer have already been processed', function () {
      beforeEach(async function () {
        await runOperation(tezos, trustedIntermediary1, () => this.complianceRegistry.methods.processOnHoldTransfer(89013100, realm.pkh, true, 1, 1).send());
        await runOperation(tezos, trustedIntermediary1, () => this.complianceRegistry.methods.processOnHoldTransfer(89013100, realm.pkh, true, 2, 3).send());
      });

      it('should not approve/reject transfers from onHold transfer registry if not in on-hold status (ignoring status change)', async function () {
        await runOperation(tezos, owner, () => this.complianceRegistry.methods.getOnHoldTransfers(this.onHoldTransferListCallback.address, trustedIntermediary1.pkh).send());
        (await this.onHoldTransferListCallback.storage()).length.should.equal(2);
        await runOperation(tezos, trustedIntermediary1, () => this.complianceRegistry.methods.processOnHoldTransfer(89013100, realm.pkh, true, 1, 1).send());
        await runOperation(tezos, trustedIntermediary1, () => this.complianceRegistry.methods.processOnHoldTransfer(89013100, realm.pkh, true, 2, 3).send());
        await runOperation(tezos, owner, () => this.complianceRegistry.methods.getOnHoldTransfers(this.onHoldTransferListCallback.address, trustedIntermediary1.pkh).send());
        (await this.onHoldTransferListCallback.storage()).length.should.equal(2);
      });
    });
  });

  context('Check transfer validity', function () {
    context('Check one transfer', function () {
      it('returns that transfer is valid when from address is found and transfer/monthly/yearly amounts are below thresholds', async function () {
        await runOperation(tezos, owner, () => this.contract.methods.isTransferValid(toDecimals(9000), toDecimals(9000), this.callback.address, address1.pkh, realm.pkh, 0, address2.pkh, token.pkh, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        const result = await this.ruleEngine.storage();
        result.reason_.should.be.bignumber.equal('0');
        result.valid_.should.be.bignumber.equal('3');
      });
      it('returns that transfer is valid when from address is not found and amount is below no check threshold', async function () {
        await runOperation(tezos, owner, () => this.contract.methods.isTransferValid(toDecimals(150), toDecimals(150), this.callback.address, address3.pkh, realm.pkh, 250, address2.pkh, token.pkh, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        const result = await this.ruleEngine.storage();
        result.reason_.should.be.bignumber.equal('0');
        result.valid_.should.be.bignumber.equal('3');
      });
      it('returns that transfer is valid when to address is not found and amount is below no check threshold', async function () {
        await runOperation(tezos, owner, () => this.contract.methods.isTransferValid(toDecimals(150), toDecimals(150), this.callback.address, address1.pkh, realm.pkh, 250, address3.pkh, token.pkh, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        const result = await this.ruleEngine.storage();
        result.reason_.should.be.bignumber.equal('0');
        result.valid_.should.be.bignumber.equal('3');
      });
      it('returns that transfer is invalid when from address is not found and amount is above no check threshold', async function () {
        await runOperation(tezos, owner, () => this.contract.methods.isTransferValid(toDecimals(350), toDecimals(350), this.callback.address, address3.pkh, realm.pkh, 250, address2.pkh, token.pkh, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        const result = await this.ruleEngine.storage();
        result.reason_.should.be.bignumber.equal('1');
        result.valid_.should.be.bignumber.equal('0');
      });
      it('returns that transfer is invalid when to address is not found and amount is above no check threshold', async function () {
        await runOperation(tezos, owner, () => this.contract.methods.isTransferValid(toDecimals(350), toDecimals(350), this.callback.address, address1.pkh, realm.pkh, 250, address3.pkh, token.pkh, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        const result = await this.ruleEngine.storage();
        result.reason_.should.be.bignumber.equal('5');
        result.valid_.should.be.bignumber.equal('0');
      });
      it('returns that transfer is invalid when transfer amount is above single transaction threshold', async function () {
        await runOperation(tezos, owner, () => this.contract.methods.isTransferValid(toDecimals(11000), toDecimals(11000), this.callback.address, address1.pkh, realm.pkh, 0, address2.pkh, token.pkh, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        const result = await this.ruleEngine.storage();
        result.reason_.should.be.bignumber.equal('2');
        result.valid_.should.be.bignumber.equal('2');
      });
    });

    context('Check multiple transfers when addresses are not found', function () {
      beforeEach(async function () {
        await runOperation(tezos, owner, () => this.contract.methods.addOperator(operator.pkh).send());
        await runOperation(tezos, owner, () => this.complianceRegistry.methods.addOperator(this.contract.address).send());
        // Mark 183.45 as already transfered
        await runOperation(tezos, owner, () => this.contract.methods.afterTransferHook(toDecimals(183.45), toDecimals(183.45), address3.pkh, realm.pkh, 0, address2.pkh, token.pkh, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        await runOperation(tezos, owner, () => this.contract.methods.afterTransferHook(toDecimals(183.45), toDecimals(183.45), address1.pkh, realm.pkh, 0, address3.pkh, token.pkh, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
      });
      it('returns that transfer is valid when from address is not found and cumulated amount is below no check threshold', async function () {
        await runOperation(tezos, owner, () => this.contract.methods.isTransferValid(toDecimals(30), toDecimals(30), this.callback.address, address3.pkh, realm.pkh, 250, address2.pkh, token.pkh, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        const result = await this.ruleEngine.storage();
        result.reason_.should.be.bignumber.equal('0');
        result.valid_.should.be.bignumber.equal('3');
      });
      it('returns that transfer is valid when to address is not found and cumulated amount is below no check threshold', async function () {
        await runOperation(tezos, owner, () => this.contract.methods.isTransferValid(toDecimals(30), toDecimals(30), this.callback.address, address1.pkh, realm.pkh, 250, address3.pkh, token.pkh, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        const result = await this.ruleEngine.storage();
        result.reason_.should.be.bignumber.equal('0');
        result.valid_.should.be.bignumber.equal('3');
      });
      it('returns that transfer is invalid when from address is not found and cumulated amount is above no check threshold', async function () {
        await runOperation(tezos, owner, () => this.contract.methods.isTransferValid(toDecimals(100), toDecimals(100), this.callback.address, address3.pkh, realm.pkh, 250, address2.pkh, token.pkh, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        const result = await this.ruleEngine.storage();
        result.reason_.should.be.bignumber.equal('1');
        result.valid_.should.be.bignumber.equal('0');
      });
      it('returns that transfer is invalid when to address is not found and cumulated amount is above no check threshold', async function () {
        await runOperation(tezos, owner, () => this.contract.methods.isTransferValid(toDecimals(100), toDecimals(100), this.callback.address, address1.pkh, realm.pkh, 250, address3.pkh, token.pkh, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        const result = await this.ruleEngine.storage();
        result.reason_.should.be.bignumber.equal('5');
        result.valid_.should.be.bignumber.equal('0');
      });
    });

    context('Check multiple transfers for monthly limits', function () {
      beforeEach(async function () {
        await runOperation(tezos, owner, () => this.contract.methods.addOperator(operator.pkh).send());
        await runOperation(tezos, owner, () => this.complianceRegistry.methods.addOperator(this.contract.address).send());
        // Mark 8901.33 as already transfered
        await runOperation(tezos, owner, () => this.contract.methods.afterTransferHook(toDecimals(8901.33), toDecimals(8901.33), address1.pkh, realm.pkh, 0, address2.pkh, token.pkh, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
      });
      it('returns that transfer is valid when from address is found and transfer/monthly/yearly amounts are below thresholds with same token', async function () {
        await runOperation(tezos, owner, () => this.contract.methods.isTransferValid(toDecimals(1000), toDecimals(1000), this.callback.address, address1.pkh, realm.pkh, 0, address2.pkh, token.pkh, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        const result = await this.ruleEngine.storage();
        result.reason_.should.be.bignumber.equal('0');
        result.valid_.should.be.bignumber.equal('3');
      });
      it('returns that transfer is invalid when monthly transfer amount is above threshold', async function () {
        await runOperation(tezos, owner, () => this.contract.methods.isTransferValid(toDecimals(8000), toDecimals(8000), this.callback.address, address1.pkh, realm.pkh, 0, address2.pkh, token.pkh, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        const result = await this.ruleEngine.storage();
        result.reason_.should.be.bignumber.equal('3');
        result.valid_.should.be.bignumber.equal('2');
      });
    });  
    
    context('Check multiple transfers for yearly limits', function () {
      beforeEach(async function () {
        await runOperation(tezos, owner, () => this.contract.methods.addOperator(operator.pkh).send());
        await runOperation(tezos, owner, () => this.complianceRegistry.methods.addOperator(this.contract.address).send());
        // Makes monthly limit higher than yearly limit for testing purposes. In real life, it clearly makes no sense
        await runOperation(tezos, trustedIntermediary1, () => this.complianceRegistry.methods.updateUserAttributes([0, 100, 110, 111, 112, 113], [1874872900, 0, 11000, 320000, 300000, 567], 1).send());
        await runOperation(tezos, trustedIntermediary1, () => this.complianceRegistry.methods.updateUserAttributes([0, 100, 110, 111, 112, 113], [1874872900, 0, 11000, 320000, 300000, 567], 2).send());
        // Mark 299001.33 as already transfered
        await runOperation(tezos, owner, () => this.contract.methods.afterTransferHook(toDecimals(299001.33), toDecimals(299001.33), address1.pkh, realm.pkh, 0, address2.pkh, token.pkh, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
      });
      it('returns that transfer is valid when from address is found and transfer/monthly/yearly amounts are below thresholds with same token', async function () {
        await runOperation(tezos, owner, () => this.contract.methods.isTransferValid(toDecimals(100), toDecimals(100), this.callback.address, address1.pkh, realm.pkh, 0, address2.pkh, token.pkh, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        const result = await this.ruleEngine.storage();
        result.reason_.should.be.bignumber.equal('0');
        result.valid_.should.be.bignumber.equal('3');
      });
      it('returns that transfer is invalid when yearly transfer amount is above threshold', async function () {
        await runOperation(tezos, owner, () => this.contract.methods.isTransferValid(toDecimals(1000), toDecimals(1000), this.callback.address, address1.pkh, realm.pkh, 0, address2.pkh, token.pkh, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        const result = await this.ruleEngine.storage();
        result.reason_.should.be.bignumber.equal('4');
        result.valid_.should.be.bignumber.equal('2');
      });
    });
  });

  context('When standard user', function () {
    beforeEach(async function () {
      await runOperation(tezos, owner, () => this.contract.methods.addOperator(operator.pkh).send());
      await runOperation(tezos, owner, () => this.complianceRegistry.methods.addOperator(this.contract.address).send());
      this.yesNo = await ContractBuilder.new(tezos, 'ligo/rules/YesNoRule.ligo', {}, {});
      this.yesNoUpdate = await ContractBuilder.new(tezos, 'ligo/rules/YesNoUpdateRule.ligo', {}, '0');
      const rules = new MichelsonMap();
      rules.set(0, this.yesNo.address);
      rules.set(1, this.yesNoUpdate.address);
      this.ruleEngineMock = await ContractBuilder.new(tezos, 'ligo/operating/RuleEngine.ligo', {}, { 
        owner: owner.pkh,
        roles: new MichelsonMap(),
        rules,
        internalState: {
          isTransferValidParam_: DEFAULT_IS_TRANSFER_VALID_PARAM,
          ruleResponses_: new MichelsonMap(),
          beforeTransferHookParam_: DEFAULT_BEFORE_TRANSFER_HOOK_PARAM,
        }
      });
      this.token = await ContractBuilder.new(tezos, 'ligo/token/ShareBridgeToken.ligo', {}, { 
        owner: owner.pkh,
        roles: new MichelsonMap(),
        name: 'Test token',
        symbol: 'TST',
        decimals: 3,
        totalSupply: 0,
        ledger: new MichelsonMap(),
        metadata: new MichelsonMap(),
        rules: [],
        trustedIntermediaries: [trustedIntermediary1.pkh, trustedIntermediary2.pkh],
        realm: realm.pkh,
        prices: new MichelsonMap(),
        ruleEngine: this.ruleEngineMock.address,
        contact: "",
        tokenizedSharePercentage: 100,
        boardResolutionDocumentHash: '',
        boardResolutionDocumentUrl: '',
        tempRealm: BURN_ADDRESS
      });
      await runOperation(tezos, owner, () => this.token.methods.addAdministrator(administrator.pkh).send());
      await runOperation(tezos, administrator, () => this.token.methods.addSupplier(administrator.pkh).send());
      await runOperation(tezos, administrator, () => this.token.methods.mint(3000000, this.complianceRegistry.address).send());
      await runOperation(tezos, owner, () => this.contract.methods.beforeTransferHook(89013100, 890131, this.beforeTransferHookCallback.address, address1.pkh, realm.pkh, 0, address2.pkh, this.token.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
      await runOperation(tezos, owner, () => this.contract.methods.beforeTransferHook(89013200, 890132, this.beforeTransferHookCallback.address, address1.pkh, realm.pkh, 0, address2.pkh, this.token.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
      await runOperation(tezos, owner, () => this.contract.methods.beforeTransferHook(89013300, 890133, this.beforeTransferHookCallback.address, address1.pkh, realm.pkh, 0, address2.pkh, this.token.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
      await runOperation(tezos, owner, () => this.contract.methods.beforeTransferHook(89013400, 890134, this.beforeTransferHookCallback.address, address2.pkh, realm.pkh, 0, address1.pkh, this.token.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
      this.onHoldTransferListCallback = await ContractBuilder.new(tezos, 'ligo/mocks/OnHoldTransferListCallback.ligo', {}, []);
    });

    it('should be able to cancel on hold transfer updating minBoundary', async function() {
      await runOperation(tezos, owner, () => this.complianceRegistry.methods.getOnHoldTransfers(this.onHoldTransferListCallback.address, trustedIntermediary1.pkh).send());
      (await this.onHoldTransferListCallback.storage()).length.should.equal(4);
      (await (await this.complianceRegistry.storage()).trustedIntermediaries.get(trustedIntermediary1.pkh)).onHoldMinBoundary.should.be.bignumber.equal('0');
      await runOperation(tezos, address1, () => this.complianceRegistry.methods.cancelOnHoldTransfer(false, 0, trustedIntermediary1.pkh).send());
      await runOperation(tezos, address1, () => this.complianceRegistry.methods.cancelOnHoldTransfer(false, 2, trustedIntermediary1.pkh).send());
      (await (await this.complianceRegistry.storage()).trustedIntermediaries.get(trustedIntermediary1.pkh)).onHoldMinBoundary.should.be.bignumber.equal('1');
      await runOperation(tezos, owner, () => this.complianceRegistry.methods.getOnHoldTransfers(this.onHoldTransferListCallback.address, trustedIntermediary1.pkh).send());
      const ret = await this.onHoldTransferListCallback.storage();
      ret.length.should.equal(2);
      ret[0]['id_'].should.be.bignumber.equal('3');
      ret[0]['token_'].should.equal(this.token.address);
      ret[0]['from_'].should.equal(address2.pkh);
      ret[0]['to_'].should.equal(address1.pkh);
      ret[0]['amount_'].should.be.bignumber.equal('890134');
      ret[1]['id_'].should.be.bignumber.equal('1');
      ret[1]['token_'].should.equal(this.token.address);
      ret[1]['from_'].should.equal(address1.pkh);
      ret[1]['to_'].should.equal(address2.pkh);
      ret[1]['amount_'].should.be.bignumber.equal('890132');
    });

    it('should be able to cancel on hold transfer without updating minBoundary', async function() {
      await runOperation(tezos, owner, () => this.complianceRegistry.methods.getOnHoldTransfers(this.onHoldTransferListCallback.address, trustedIntermediary1.pkh).send());
      (await this.onHoldTransferListCallback.storage()).length.should.equal(4);
      (await (await this.complianceRegistry.storage()).trustedIntermediaries.get(trustedIntermediary1.pkh)).onHoldMinBoundary.should.be.bignumber.equal('0');
      await runOperation(tezos, address1, () => this.complianceRegistry.methods.cancelOnHoldTransfer(true, 0, trustedIntermediary1.pkh).send());
      await runOperation(tezos, address1, () => this.complianceRegistry.methods.cancelOnHoldTransfer(true, 2, trustedIntermediary1.pkh).send());
      (await (await this.complianceRegistry.storage()).trustedIntermediaries.get(trustedIntermediary1.pkh)).onHoldMinBoundary.should.be.bignumber.equal('0');
      await runOperation(tezos, owner, () => this.complianceRegistry.methods.getOnHoldTransfers(this.onHoldTransferListCallback.address, trustedIntermediary1.pkh).send());
      const ret = await this.onHoldTransferListCallback.storage();
      ret.length.should.equal(2);
      ret[0]['id_'].should.be.bignumber.equal('3');
      ret[0]['token_'].should.equal(this.token.address);
      ret[0]['from_'].should.equal(address2.pkh);
      ret[0]['to_'].should.equal(address1.pkh);
      ret[0]['amount_'].should.be.bignumber.equal('890134');
      ret[1]['id_'].should.be.bignumber.equal('1');
      ret[1]['token_'].should.equal(this.token.address);
      ret[1]['from_'].should.equal(address1.pkh);
      ret[1]['to_'].should.equal(address2.pkh);
      ret[1]['amount_'].should.be.bignumber.equal('890132');
    });

    it('reverts if a user is trying to cancel transfers not belonging to him', async function () {
      await shouldFail(runOperation(tezos, address1, () => this.complianceRegistry.methods.cancelOnHoldTransfer(false, 3, trustedIntermediary1.pkh).send()), "UR07");
    });
  });
});