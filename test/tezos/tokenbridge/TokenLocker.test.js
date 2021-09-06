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
const web3Utils = require('web3-utils');
const ContractBuilder = contract.ContractBuilder;

let tezos = tezosToolkit();

const ethAddress = web3Utils.fromAscii("0x76b084ae665610628d3b782cae5a43eb3b9531e7").replace('0x', '');

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

contract('TokenLocker', function ([_, owner, operator, administrator, address1, trustedIntermediary1, trustedIntermediary2, realm]) {
  beforeEach(async function () {
    tezos.setSignerProvider(new InMemorySigner(owner.sk));
    this.contract = await ContractBuilder.new(tezos, 'ligo/tokenbridge/TokenLocker.ligo', {}, {
      owner: owner.pkh,
      roles: new MichelsonMap(),
      events: new MichelsonMap(),
    });
    this.yesNo = await ContractBuilder.new(tezos, 'ligo/rules/YesNoRule.ligo', {}, {});
    this.yesNoUpdate = await ContractBuilder.new(tezos, 'ligo/rules/YesNoUpdateRule.ligo', {}, '0');
    const rules = new MichelsonMap();
    rules.set(0, this.yesNo.address);
    rules.set(1, this.yesNoUpdate.address);
    this.ruleEngine = await ContractBuilder.new(tezos, 'ligo/operating/RuleEngine.ligo', {}, { 
      owner: owner.pkh,
      roles: new MichelsonMap(),
      rules,
      internalState: {
        isTransferValidParam_: DEFAULT_IS_TRANSFER_VALID_PARAM,
        ruleResponses_: new MichelsonMap(),
        beforeTransferHookParam_: DEFAULT_BEFORE_TRANSFER_HOOK_PARAM,
      }
    })
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
        ruleEngine: this.ruleEngine.address,
        contact: "",
        tokenizedSharePercentage: 100,
        boardResolutionDocumentHash: '',
        boardResolutionDocumentUrl: '',
        tempRealm: BURN_ADDRESS
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
      await runOperation(tezos, owner, () => this.token.methods.addAdministrator(administrator.pkh).send());
      await runOperation(tezos, administrator, () => this.token.methods.addSupplier(administrator.pkh).send());
      this.natCallback = await ContractBuilder.new(tezos, 'ligo/mocks/NatCallback.ligo', {}, '0');
    });
    it('can unlock tokens', async function () {
      await runOperation(tezos, administrator, () => this.token.methods.mint(100000, this.contract.address).send());
      await runOperation(tezos, operator, () => this.contract.methods.unlock(address1.pkh, this.token.address, 10000).send());
      await runOperation(tezos, address1, () => this.token.methods.getBalance(this.contract.address, this.natCallback.address).send());
      (await this.natCallback.storage()).should.be.bignumber.equal('90000');
      await runOperation(tezos, address1, () => this.token.methods.getBalance(address1.pkh, this.natCallback.address).send());
      (await this.natCallback.storage()).should.be.bignumber.equal('10000');
    });
  });
  
  context('When standard user', function () {
    beforeEach(async function () {
      await runOperation(tezos, owner, () => this.contract.methods.addOperator(operator.pkh).send());
      await runOperation(tezos, owner, () => this.token.methods.addAdministrator(administrator.pkh).send());
      await runOperation(tezos, administrator, () => this.token.methods.addSupplier(administrator.pkh).send());
      this.natCallback = await ContractBuilder.new(tezos, 'ligo/mocks/NatCallback.ligo', {}, '0');
    });
    it('can send tokens to locker by setting an allowance and calling lock', async function () {
      await runOperation(tezos, administrator, () => this.token.methods.mint(100000, address1.pkh).send());
      await runOperation(tezos, address1, () => this.token.methods.approve(this.contract.address, 10000).send());
      const {block} = await runOperation(tezos, address1, () => this.contract.methods.lock(ethAddress, this.token.address, 10000).send());
      await runOperation(tezos, address1, () => this.token.methods.getBalance(address1.pkh, this.natCallback.address).send());
      (await this.natCallback.storage()).should.be.bignumber.equal('90000');
      await runOperation(tezos, address1, () => this.token.methods.getBalance(this.contract.address, this.natCallback.address).send());
      (await this.natCallback.storage()).should.be.bignumber.equal('10000');
      const level = "" + block.header.level;
      const events = await (await this.contract.storage()).events.get(level);
      events[0].from_.should.equal(address1.pkh);
      events[0].token_.should.equal(this.token.address);
      events[0].to_.should.equal(ethAddress);
      events[0].value_.should.be.bignumber.equal('10000');
    });

    it('reverts when trying to unlock tokens', async function () {    
      await shouldFail(runOperation(tezos, address1, () => this.contract.methods.unlock(address1.pkh, this.token.address, 10000).send()), "OP01");
    });
  });
});