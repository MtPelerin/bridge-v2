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

contract('AddressThresholdLockRule', function ([owner, realm, administrator, address1, address2, trustedIntermediary1, trustedIntermediary2]) {
  beforeEach(async function () {
    tezos.setSignerProvider(new InMemorySigner(owner.sk));
    this.callback = await ContractBuilder.new(tezos, 'ligo/mocks/RuleCallback.ligo', {}, {
      valid_: 0,
      reason_: 0,
    });
    this.natCallback = await ContractBuilder.new(tezos, 'ligo/mocks/NatCallback.ligo', {}, '0');
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
    this.ruleEngine = await ContractBuilder.new(tezos, 'ligo/mocks/RuleEngineCallback.ligo', {}, {
      valid_: 0,
      reason_: 0,
    });
    this.contract = await ContractBuilder.new(tezos, 'ligo/rules/AddressThresholdLockRule.ligo', {}, {
      addressThresholdLock: new MichelsonMap(),
      internalState: {
        token_: BURN_ADDRESS,
        address_: BURN_ADDRESS,
        amount_: 0,
      },
      ruleEngine: this.ruleEngine.address,
    });
  });

  context('When not token administrator', function () {
    it('should revert if trying to update address lock threshold', async function () {
      await runOperation(tezos, address1, () => this.contract.methods.addressLockThreshold(address1.pkh, this.natCallback.address, this.token.address).send());
      (await this.natCallback.storage()).should.be.bignumber.equal('0');
      await runOperation(tezos, address1, () => this.contract.methods.addressLockThreshold(address2.pkh, this.natCallback.address, this.token.address).send());
      (await this.natCallback.storage()).should.be.bignumber.equal('0');
      await shouldFail(runOperation(tezos, address1, () => this.contract.methods.setAddressLockThreshold(address1.pkh, 10000, this.token.address).send()), "AD01");
      await runOperation(tezos, address1, () => this.contract.methods.addressLockThreshold(address1.pkh, this.natCallback.address, this.token.address).send());
      (await this.natCallback.storage()).should.be.bignumber.equal('0');
      await runOperation(tezos, address1, () => this.contract.methods.addressLockThreshold(address2.pkh, this.natCallback.address, this.token.address).send());
      (await this.natCallback.storage()).should.be.bignumber.equal('0');
    });
  });

  context('When token administrator', function () {
    beforeEach(async function () {
      await runOperation(tezos, owner, () => this.token.methods.addAdministrator(administrator.pkh).send());
    });

    it('be able to update address lock threshold', async function () {
      await runOperation(tezos, address1, () => this.contract.methods.addressLockThreshold(address1.pkh, this.natCallback.address, this.token.address).send());
      (await this.natCallback.storage()).should.be.bignumber.equal('0');
      await runOperation(tezos, address1, () => this.contract.methods.addressLockThreshold(address2.pkh, this.natCallback.address, this.token.address).send());
      (await this.natCallback.storage()).should.be.bignumber.equal('0');
      await runOperation(tezos, administrator, () => this.contract.methods.setAddressLockThreshold(address1.pkh, 10000, this.token.address).send());
      await runOperation(tezos, address1, () => this.contract.methods.addressLockThreshold(address1.pkh, this.natCallback.address, this.token.address).send());
      (await this.natCallback.storage()).should.be.bignumber.equal('10000');
      await runOperation(tezos, address1, () => this.contract.methods.addressLockThreshold(address2.pkh, this.natCallback.address, this.token.address).send());
      (await this.natCallback.storage()).should.be.bignumber.equal('0');
    });
  });

  context('Check lock threshold', function () {
    beforeEach(async function () {
      await runOperation(tezos, owner, () => this.token.methods.addAdministrator(administrator.pkh).send());
      await runOperation(tezos, administrator, () => this.contract.methods.setAddressLockThreshold(address1.pkh, 10000, this.token.address).send());
    });

    context('When address has no tokens', function () {
      it('allows transfers if amount is zero', async function () {
        await runOperation(tezos, owner, () => this.contract.methods.isTransferValid(0, 0, this.callback.address, address1.pkh, realm.pkh, 0, address2.pkh, this.token.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        const result = await this.ruleEngine.storage();
        result.reason_.should.be.bignumber.equal('0');
        result.valid_.should.be.bignumber.equal('1');
      });

      it('allows transfers if amount is not zero', async function () {
        await runOperation(tezos, owner, () => this.contract.methods.isTransferValid(100, 100, this.callback.address, address1.pkh, realm.pkh, 0, address2.pkh, this.token.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        const result = await this.ruleEngine.storage();
        result.reason_.should.be.bignumber.equal('0');
        result.valid_.should.be.bignumber.equal('1');
      });
    });

    context('When address has tokens', function () {
      beforeEach(async function () {
        await runOperation(tezos, administrator, () => this.token.methods.addSupplier(administrator.pkh).send());
        await runOperation(tezos, administrator, () => this.token.methods.mint(15000, address1.pkh).send());
      });

      it('allows transfers if amount is zero', async function () {
        await runOperation(tezos, owner, () => this.contract.methods.isTransferValid(100, 100, this.callback.address, address1.pkh, realm.pkh, 0, address2.pkh, this.token.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        const result = await this.ruleEngine.storage();
        result.reason_.should.be.bignumber.equal('0');
        result.valid_.should.be.bignumber.equal('1');
      });

      it('allows transfers if amount is more than balance (will fail later with BA01)', async function () {
        await runOperation(tezos, owner, () => this.contract.methods.isTransferValid(16000, 16000, this.callback.address, address1.pkh, realm.pkh, 0, address2.pkh, this.token.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        const result = await this.ruleEngine.storage();
        result.reason_.should.be.bignumber.equal('0');
        result.valid_.should.be.bignumber.equal('1');
      });

      it('rejects transfers if balance after transfer is less than threshold', async function () {
        await runOperation(tezos, owner, () => this.contract.methods.isTransferValid(6000, 6000, this.callback.address, address1.pkh, realm.pkh, 0, address2.pkh, this.token.address, [trustedIntermediary1.pkh, trustedIntermediary2.pkh]).send());
        const result = await this.ruleEngine.storage();
        result.reason_.should.be.bignumber.equal('1');
        result.valid_.should.be.bignumber.equal('0');
      });
    });
  });

  context('Update after transfer', function () {
    it('should revert if trying to update', async function () {
      await shouldFail(runOperation(tezos, owner, () => this.contract.methods.afterTransferHook(10000, 10000, this.callback.address, address1.pkh, BURN_ADDRESS, 0, address2.pkh, this.token.address, []).send()), "RU02");
    });
  });
});