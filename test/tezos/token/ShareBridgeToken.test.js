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
const crypto = require('crypto');
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

contract('ShareBridgeToken', function ([owner, kingOwner, administrator, supplier, seizer, address1, address2, address3, address4]) {
  beforeEach(async function () {
    this.trustedIntermediary1 = owner;
    this.trustedIntermediary2 = kingOwner;
    this.addressParam = address4;
    tezos.setSignerProvider(new InMemorySigner(owner.sk));
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
    });
    this.contract = await ContractBuilder.new(tezos, 'ligo/token/ShareBridgeToken.ligo', {}, { 
      owner: owner.pkh,
      roles: new MichelsonMap(),
      name: 'Test token',
      symbol: 'TST',
      decimals: 3,
      totalSupply: 0,
      ledger: new MichelsonMap(),
      rules: [],
      trustedIntermediaries: [this.trustedIntermediary1.pkh, this.trustedIntermediary2.pkh],
      realm: BURN_ADDRESS,
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
      await shouldFail(runOperation(tezos, address1, () => this.contract.methods.transferOwnership(address1.pkh).send()), 'OW01');
      (await this.contract.storage()).owner.should.equal(owner.pkh);
    });

    it('can revoke ownership', async function () {
      (await this.contract.storage()).owner.should.equal(owner.pkh);
      await runOperation(tezos, owner, () => this.contract.methods.revokeOwnership(null).send());
      (await this.contract.storage()).owner.should.equal(BURN_ADDRESS);
    });

    it('cannot revoke ownership from non-owner', async function () {
      (await this.contract.storage()).owner.should.equal(owner.pkh);
      await shouldFail(runOperation(tezos, address1, () => this.contract.methods.revokeOwnership(null).send()), 'OW01');
      (await this.contract.storage()).owner.should.equal(owner.pkh);
    });

    it('can add administrator', async function () {
      await runOperation(tezos, owner, () => this.contract.methods.addAdministrator(administrator.pkh).send());
      const packed = packDataBytes([{string: "administrator"},{string: administrator.pkh}], [{prim: 'string'}, {prim: 'address'}]);
      (await (await this.contract.storage()).roles.get(packed.bytes)).should.equal(true);
    });

    it('reverts trying to add administrator from non owner', async function () {
      await shouldFail(runOperation(tezos, address1, () => this.contract.methods.addAdministrator(administrator.pkh).send()), 'OW01');
      const packed = packDataBytes([{string: "administrator"},{string: administrator.pkh}], [{prim: 'string'}, {prim: 'address'}]);
      (!!(await (await this.contract.storage()).roles.get(packed.bytes))).should.equal(false);
    });

    it('can remove administrator', async function () {
      await runOperation(tezos, owner, () => this.contract.methods.addAdministrator(administrator.pkh).send());
      const packed = packDataBytes([{string: "administrator"},{string: administrator.pkh}], [{prim: 'string'}, {prim: 'address'}]);
      (await (await this.contract.storage()).roles.get(packed.bytes)).should.equal(true);
      await runOperation(tezos, owner, () => this.contract.methods.removeAdministrator(administrator.pkh).send());
      (await (await this.contract.storage()).roles.get(packed.bytes)).should.equal(false);
    });

    it('reverts trying to remove administrator from non owner', async function () {
      await runOperation(tezos, owner, () => this.contract.methods.addAdministrator(administrator.pkh).send());
      const packed = packDataBytes([{string: "administrator"},{string: administrator.pkh}], [{prim: 'string'}, {prim: 'address'}]);
      (await (await this.contract.storage()).roles.get(packed.bytes)).should.equal(true);
      await shouldFail(runOperation(tezos, address1, () => this.contract.methods.removeAdministrator(administrator.pkh).send()), 'OW01');
      (await (await this.contract.storage()).roles.get(packed.bytes)).should.equal(true);
    });
  }); 

  context('When administrator', function () {
    beforeEach(async function () {
      await runOperation(tezos, owner, () => this.contract.methods.addAdministrator(administrator.pkh).send());
    });

    it('can set rule engine', async function () {
      (await this.contract.storage()).ruleEngine.should.equal(this.ruleEngine.address);
      await runOperation(tezos, administrator, () => this.contract.methods.setRuleEngine(this.addressParam.pkh).send());
      (await this.contract.storage()).ruleEngine.should.equal(this.addressParam.pkh);
    }); 

    it('can add a realm administrator', async function () {
      await runOperation(tezos, administrator, () => this.contract.methods.addRealmAdministrator(this.addressParam.pkh).send());
      const packed = packDataBytes([{string: "realmAdministrator"},{string: this.addressParam.pkh}], [{prim: 'string'}, {prim: 'address'}]);
      (await (await this.contract.storage()).roles.get(packed.bytes)).should.equal(true);
    });

    it('can remove realm administrator', async function () {
      await runOperation(tezos, administrator, () => this.contract.methods.addRealmAdministrator(this.addressParam.pkh).send());
      const packed = packDataBytes([{string: "realmAdministrator"},{string: this.addressParam.pkh}], [{prim: 'string'}, {prim: 'address'}]);
      (await (await this.contract.storage()).roles.get(packed.bytes)).should.equal(true);
      await runOperation(tezos, administrator, () => this.contract.methods.removeRealmAdministrator(this.addressParam.pkh).send());
      (await (await this.contract.storage()).roles.get(packed.bytes)).should.equal(false);
    });

    context('When changing realm', function () {
      beforeEach(async function () {
        this.king = await ContractBuilder.new(tezos, 'ligo/token/ShareBridgeToken.ligo', {}, { 
          owner: kingOwner.pkh,
          roles: new MichelsonMap(),
          name: 'King token',
          symbol: 'KNG',
          decimals: 0,
          totalSupply: 0,
          ledger: new MichelsonMap(),
          rules: [],
          trustedIntermediaries: [this.trustedIntermediary1.pkh, this.trustedIntermediary2.pkh],
          realm: BURN_ADDRESS,
          prices: new MichelsonMap(),
          ruleEngine: this.ruleEngine.address,
          contact: "",
          tokenizedSharePercentage: 100,
          boardResolutionDocumentHash: '',
          boardResolutionDocumentUrl: '',
          tempRealm: BURN_ADDRESS
        });
        await runOperation(tezos, kingOwner, () => this.king.methods.addRealmAdministrator(administrator.pkh).send());
      });

      it('can set realm', async function () {
        (await this.contract.storage()).realm.should.equal(BURN_ADDRESS);
        await runOperation(tezos, administrator, () => this.contract.methods.setRealm(this.king.address).send());
        (await this.contract.storage()).realm.should.equal(this.king.address);
      });

      it('reverts if setRealm caller is not king token administrator or king token owner', async function () {
        await shouldFail(runOperation(tezos, administrator, () => this.contract.methods.setRealm(this.king.address).send()), "KI01");
      });
    });

    it('can set trustedIntermediaries', async function () {
      (await this.contract.storage()).trustedIntermediaries.length.should.equal(2);
      await runOperation(tezos, administrator, () => this.contract.methods.setTrustedIntermediaries([this.trustedIntermediary1.pkh]).send());
      (await this.contract.storage()).trustedIntermediaries.length.should.equal(1);
    }); 

    it('can add seizer', async function () {
      await runOperation(tezos, administrator, () => this.contract.methods.addSeizer(seizer.pkh).send());
      const packed = packDataBytes([{string: "seizer"},{string: seizer.pkh}], [{prim: 'string'}, {prim: 'address'}]);
      (await (await this.contract.storage()).roles.get(packed.bytes)).should.equal(true);
    });

    it('can remove seizer', async function () {
      await runOperation(tezos, administrator, () => this.contract.methods.addSeizer(seizer.pkh).send());
      const packed = packDataBytes([{string: "seizer"},{string: seizer.pkh}], [{prim: 'string'}, {prim: 'address'}]);
      (await (await this.contract.storage()).roles.get(packed.bytes)).should.equal(true);
      await runOperation(tezos, administrator, () => this.contract.methods.removeSeizer(seizer.pkh).send());
      (await (await this.contract.storage()).roles.get(packed.bytes)).should.equal(false);
    });

    it('can add supplier', async function () {
      await runOperation(tezos, administrator, () => this.contract.methods.addSupplier(supplier.pkh).send());
      const packed = packDataBytes([{string: "supplier"},{string: supplier.pkh}], [{prim: 'string'}, {prim: 'address'}]);
      (await (await this.contract.storage()).roles.get(packed.bytes)).should.equal(true);
    });

    it('can remove supplier', async function () {
      await runOperation(tezos, administrator, () => this.contract.methods.addSupplier(supplier.pkh).send());
      const packed = packDataBytes([{string: "supplier"},{string: supplier.pkh}], [{prim: 'string'}, {prim: 'address'}]);
      (await (await this.contract.storage()).roles.get(packed.bytes)).should.equal(true);
      await runOperation(tezos, administrator, () => this.contract.methods.removeSupplier(supplier.pkh).send());
      (await (await this.contract.storage()).roles.get(packed.bytes)).should.equal(false);
    });

    it('can set rules', async function () {
      (await this.contract.storage()).rules.length.should.equal(0);
      await runOperation(tezos, administrator, () => this.contract.methods.setRules([{ruleId: 0, ruleParam: 1}, {ruleId: 1, ruleParam: 0}]).send());
      const rules = (await this.contract.storage()).rules;
      rules.length.should.equal(2);
      rules[0].ruleId.should.be.bignumber.equal('0');
      rules[0].ruleParam.should.be.bignumber.equal('1');
      rules[1].ruleId.should.be.bignumber.equal('1');
      rules[1].ruleParam.should.be.bignumber.equal('0');
    });

    it('can set contact', async function () {
      (await this.contract.storage()).contact.should.equal('');
      await runOperation(tezos, administrator, () => this.contract.methods.setContact('hello@mtpelerin.com').send());
      (await this.contract.storage()).contact.should.equal('hello@mtpelerin.com');
    });
    
    it('can set price', async function () {
      this.natPairCallback = await ContractBuilder.new(tezos, 'ligo/mocks/NatPairCallback.ligo', {}, [0,0]);
      await runOperation(tezos, address1, () => this.contract.methods.getPrice(this.natPairCallback.address, "CHF").send());
      (await this.natPairCallback.storage())[0].should.be.bignumber.equal('0'); 
      (await this.natPairCallback.storage())[1].should.be.bignumber.equal('0'); 
      await runOperation(tezos, administrator, () => this.contract.methods.setPrice("CHF", 18, "49024460000000000000").send());      
      await runOperation(tezos, address1, () => this.contract.methods.getPrice(this.natPairCallback.address, "CHF").send());
      (await this.natPairCallback.storage())[0].should.be.bignumber.equal('49024460000000000000'); 
      (await this.natPairCallback.storage())[1].should.be.bignumber.equal('18'); 
    });

    it('can set multiple prices', async function () {
      this.natPairCallback = await ContractBuilder.new(tezos, 'ligo/mocks/NatPairCallback.ligo', {}, [0,0]);
      await runOperation(tezos, address1, () => this.contract.methods.getPrice(this.natPairCallback.address, "CHF").send());
      (await this.natPairCallback.storage())[0].should.be.bignumber.equal('0'); 
      (await this.natPairCallback.storage())[1].should.be.bignumber.equal('0'); 
      await runOperation(tezos, address1, () => this.contract.methods.getPrice(this.natPairCallback.address, "EUR").send());
      (await this.natPairCallback.storage())[0].should.be.bignumber.equal('0'); 
      (await this.natPairCallback.storage())[1].should.be.bignumber.equal('0'); 
      await runOperation(tezos, address1, () => this.contract.methods.getPrice(this.natPairCallback.address, "USD").send());
      (await this.natPairCallback.storage())[0].should.be.bignumber.equal('0'); 
      (await this.natPairCallback.storage())[1].should.be.bignumber.equal('0'); 
      await runOperation(tezos, administrator, () => this.contract.methods.setPrices(["CHF", "EUR", "USD"], [18, 18, 0], ['4167781430693052713', '4325877590113664316929', '5']).send());
      await runOperation(tezos, address1, () => this.contract.methods.getPrice(this.natPairCallback.address, "CHF").send());
      (await this.natPairCallback.storage())[0].should.be.bignumber.equal('4167781430693052713'); 
      (await this.natPairCallback.storage())[1].should.be.bignumber.equal('18'); 
      await runOperation(tezos, address1, () => this.contract.methods.getPrice(this.natPairCallback.address, "EUR").send());
      (await this.natPairCallback.storage())[0].should.be.bignumber.equal('4325877590113664316929'); 
      (await this.natPairCallback.storage())[1].should.be.bignumber.equal('18'); 
      await runOperation(tezos, address1, () => this.contract.methods.getPrice(this.natPairCallback.address, "USD").send());
      (await this.natPairCallback.storage())[0].should.be.bignumber.equal('5'); 
      (await this.natPairCallback.storage())[1].should.be.bignumber.equal('0');  
    });  

    it('reverts if currencies is not the same length as prices', async function () {
      await shouldFail(runOperation(tezos, administrator, () => this.contract.methods.setPrices(["CHF", "EUR", "USD"], [18, 18, 0], ['4325877590113664316929', '5']).send()), 'PO01');
    });

    it('reverts if currencies is not the same length as decimals', async function () {
      await shouldFail(runOperation(tezos, administrator, () => this.contract.methods.setPrices(["CHF", "EUR", "USD"], [18, 18], ['4167781430693052713', '4325877590113664316929', '5']).send()), 'PO02');
    });

    it('reverts if trying to add administrator', async function () {
      await shouldFail(runOperation(tezos, administrator, () => this.contract.methods.addAdministrator(this.addressParam.pkh).send()), "OW01");
    });

    it('reverts if trying to remove administrator', async function () {
      await shouldFail(runOperation(tezos, administrator, () => this.contract.methods.removeAdministrator(this.addressParam.pkh).send()), "OW01");
    });

    it('reverts if trying to seize tokens', async function () {
      await shouldFail(runOperation(tezos, administrator, () => this.contract.methods.seize(10000, address1.pkh).send()), "SE02");
    });

    it('reverts if trying to mint tokens', async function () {
      await shouldFail(runOperation(tezos, administrator, () => this.contract.methods.mint(10000, address1.pkh).send()), "SU01");
    });

    it('reverts if trying to burn tokens', async function () {
      await shouldFail(runOperation(tezos, administrator, () => this.contract.methods.burn(10000, address1.pkh).send()), "SU01");
    });
  }); 

  context('When supplier', function () {
    beforeEach(async function () {
      await runOperation(tezos, owner, () => this.contract.methods.addAdministrator(administrator.pkh).send());
      await runOperation(tezos, administrator, () => this.contract.methods.addSupplier(supplier.pkh).send());
    });

    it('can mint tokens', async function () {
      (await this.contract.storage()).totalSupply.should.be.bignumber.equal('0');
      should.equal(await (await this.contract.storage()).ledger.get(address1.pkh), undefined);
      should.equal(await (await this.contract.storage()).ledger.get(address2.pkh), undefined);
      await runOperation(tezos, supplier, () => this.contract.methods.mint(10000, address1.pkh).send());
      (await this.contract.storage()).totalSupply.should.be.bignumber.equal('10000');
      (await (await this.contract.storage()).ledger.get(address1.pkh)).balance.should.be.bignumber.equal('10000');
      should.equal(await (await this.contract.storage()).ledger.get(address2.pkh), undefined);
    });

    it('can burn tokens', async function () {
      (await this.contract.storage()).totalSupply.should.be.bignumber.equal('0');
      should.equal(await (await this.contract.storage()).ledger.get(address1.pkh), undefined);
      should.equal(await (await this.contract.storage()).ledger.get(address2.pkh), undefined);
      await runOperation(tezos, supplier, () => this.contract.methods.mint(10000, address1.pkh).send());
      (await this.contract.storage()).totalSupply.should.be.bignumber.equal('10000');
      (await (await this.contract.storage()).ledger.get(address1.pkh)).balance.should.be.bignumber.equal('10000');
      should.equal(await (await this.contract.storage()).ledger.get(address2.pkh), undefined);
      await runOperation(tezos, supplier, () => this.contract.methods.burn(10000, address1.pkh).send());
      (await this.contract.storage()).totalSupply.should.be.bignumber.equal('0');
      (await (await this.contract.storage()).ledger.get(address1.pkh)).balance.should.be.bignumber.equal('0');
      should.equal(await (await this.contract.storage()).ledger.get(address2.pkh), undefined);
    });

    it('cannot burn more tokens than total supply', async function () {
      await runOperation(tezos, supplier, () => this.contract.methods.mint(10000, address1.pkh).send())
      await shouldFail(runOperation(tezos, supplier, () => this.contract.methods.burn(10001, address1.pkh).send()), "TT01"); 
    });

    it('cannot burn more tokens than available on address', async function () {
      await runOperation(tezos, supplier, () => this.contract.methods.mint(10000, address1.pkh).send())
      await runOperation(tezos, supplier, () => this.contract.methods.mint(10000, address2.pkh).send())
      await shouldFail(runOperation(tezos, supplier, () => this.contract.methods.burn(10001, address1.pkh).send()), "BA01"); 
    });

    it('reverts if trying to set rule engine', async function () {
      await shouldFail(runOperation(tezos, supplier, () => this.contract.methods.setRuleEngine(this.addressParam.pkh).send()), "AD01");
    });

    it('reverts if trying to set realm', async function () {
      await shouldFail(runOperation(tezos, supplier, () => this.contract.methods.setRealm(this.addressParam.pkh).send()), "AD01");
    });

    it('reverts if trying to set trustedIntermediaries', async function () {
      await shouldFail(runOperation(tezos, supplier, () => this.contract.methods.setTrustedIntermediaries([this.addressParam.pkh]).send()), "AD01");
    });

    it('reverts if trying to add administrator', async function () {
      await shouldFail(runOperation(tezos, supplier, () => this.contract.methods.addAdministrator(this.addressParam.pkh).send()), "OW01");
    });

    it('reverts if trying to remove administrator', async function () {
      await shouldFail(runOperation(tezos, supplier, () => this.contract.methods.removeAdministrator(this.addressParam.pkh).send()), "OW01");
    });

    it('reverts if trying to add realm administrator', async function () {
      await shouldFail(runOperation(tezos, supplier, () => this.contract.methods.addRealmAdministrator(this.addressParam.pkh).send()), "AD01");
    });

    it('reverts if trying to remove realm administrator', async function () {
      await shouldFail(runOperation(tezos, supplier, () => this.contract.methods.removeRealmAdministrator(this.addressParam.pkh).send()), "AD01");
    });

    it('reverts if trying to add seizer', async function () {
      await shouldFail(runOperation(tezos, supplier, () => this.contract.methods.addSeizer(this.addressParam.pkh).send()), "AD01");
    });

    it('reverts if trying to remove seizer', async function () {
      await shouldFail(runOperation(tezos, supplier, () => this.contract.methods.removeSeizer(this.addressParam.pkh).send()), "AD01");
    });

    it('reverts if trying to add supplier', async function () {
      await shouldFail(runOperation(tezos, supplier, () => this.contract.methods.addSupplier(this.addressParam.pkh).send()), "AD01");
    });

    it('reverts if trying to remove supplier', async function () {
      await shouldFail(runOperation(tezos, supplier, () => this.contract.methods.removeSupplier(this.addressParam.pkh).send()), "AD01");
    });

    it('reverts if trying to set rules', async function () {
      await shouldFail(runOperation(tezos, supplier, () => this.contract.methods.setRules([]).send()), "AD01");
    });

    it('reverts if trying to set price', async function () {
      await shouldFail(runOperation(tezos, supplier, () => this.contract.methods.setPrice("CHF", 18, "49024460000000000000").send()), "AD01");      
    });

    it('reverts if trying to set prices', async function () {
      await shouldFail(runOperation(tezos, supplier, () => this.contract.methods.setPrices(["CHF", "EUR", "USD"], [18, 18, 0], ['4167781430693052713', '4325877590113664316929', '5']).send()), "AD01");      
    });

    it('reverts if trying to set contact', async function () {
      await shouldFail(runOperation(tezos, supplier, () => this.contract.methods.setContact('hello@mtpelerin.com').send()), "AD01");
    });

    it('reverts if trying to seize tokens', async function () {
      await shouldFail(runOperation(tezos, supplier, () => this.contract.methods.seize(10000, address1.pkh).send()), "SE02");
    });
  }); 

  context('When seizer', function () {
    beforeEach(async function () {
      await runOperation(tezos, owner, () => this.contract.methods.addAdministrator(administrator.pkh).send());
      await runOperation(tezos, administrator, () => this.contract.methods.addSupplier(supplier.pkh).send());
      await runOperation(tezos, administrator, () => this.contract.methods.addSeizer(seizer.pkh).send());
      await runOperation(tezos, supplier, () => this.contract.methods.mint(10000, address1.pkh).send());
      await runOperation(tezos, supplier, () => this.contract.methods.mint(15000, address2.pkh).send());
    });

    it('can seize tokens', async function () {
      (await this.contract.storage()).totalSupply.should.be.bignumber.equal('25000');
      (await (await this.contract.storage()).ledger.get(address1.pkh)).balance.should.be.bignumber.equal('10000');
      (await (await this.contract.storage()).ledger.get(address2.pkh)).balance.should.be.bignumber.equal('15000');
      should.equal(await (await this.contract.storage()).ledger.get(seizer.pkh), undefined);
      await runOperation(tezos, seizer, () => this.contract.methods.seize(8000, address1.pkh).send());
      (await this.contract.storage()).totalSupply.should.be.bignumber.equal('25000');
      (await (await this.contract.storage()).ledger.get(address1.pkh)).balance.should.be.bignumber.equal('2000');
      (await (await this.contract.storage()).ledger.get(address2.pkh)).balance.should.be.bignumber.equal('15000');
      (await (await this.contract.storage()).ledger.get(seizer.pkh)).balance.should.be.bignumber.equal('8000');
    });

    it('cannot seize more tokens than available on address', async function () {
      await shouldFail(runOperation(tezos, seizer, () => this.contract.methods.seize(15000, address1.pkh).send()), "BA01");
    });

    it('reverts if trying to set rule engine', async function () {
      await shouldFail(runOperation(tezos, seizer, () => this.contract.methods.setRuleEngine(this.addressParam.pkh).send()), "AD01");
    });

    it('reverts if trying to set realm', async function () {
      await shouldFail(runOperation(tezos, seizer, () => this.contract.methods.setRealm(this.addressParam.pkh).send()), "AD01");
    });

    it('reverts if trying to set trustedIntermediaries', async function () {
      await shouldFail(runOperation(tezos, seizer, () => this.contract.methods.setTrustedIntermediaries([this.addressParam.pkh]).send()), "AD01");
    });

    it('reverts if trying to add administrator', async function () {
      await shouldFail(runOperation(tezos, seizer, () => this.contract.methods.addAdministrator(this.addressParam.pkh).send()), "OW01");
    });

    it('reverts if trying to remove administrator', async function () {
      await shouldFail(runOperation(tezos, seizer, () => this.contract.methods.removeAdministrator(this.addressParam.pkh).send()), "OW01");
    });

    it('reverts if trying to add realm administrator', async function () {
      await shouldFail(runOperation(tezos, seizer, () => this.contract.methods.addRealmAdministrator(this.addressParam.pkh).send()), "AD01");
    });

    it('reverts if trying to remove realm administrator', async function () {
      await shouldFail(runOperation(tezos, seizer, () => this.contract.methods.removeRealmAdministrator(this.addressParam.pkh).send()), "AD01");
    });

    it('reverts if trying to add seizer', async function () {
      await shouldFail(runOperation(tezos, seizer, () => this.contract.methods.addSeizer(this.addressParam.pkh).send()), "AD01");
    });

    it('reverts if trying to remove seizer', async function () {
      await shouldFail(runOperation(tezos, seizer, () => this.contract.methods.removeSeizer(this.addressParam.pkh).send()), "AD01");
    });

    it('reverts if trying to add supplier', async function () {
      await shouldFail(runOperation(tezos, seizer, () => this.contract.methods.addSupplier(this.addressParam.pkh).send()), "AD01");
    });

    it('reverts if trying to remove supplier', async function () {
      await shouldFail(runOperation(tezos, seizer, () => this.contract.methods.removeSupplier(this.addressParam.pkh).send()), "AD01");
    });

    it('reverts if trying to set rules', async function () {
      await shouldFail(runOperation(tezos, seizer, () => this.contract.methods.setRules([]).send()), "AD01");
    });

    it('reverts if trying to set price', async function () {
      await shouldFail(runOperation(tezos, seizer, () => this.contract.methods.setPrice("CHF", 18, "49024460000000000000").send()), "AD01");      
    });

    it('reverts if trying to set prices', async function () {
      await shouldFail(runOperation(tezos, seizer, () => this.contract.methods.setPrices(["CHF", "EUR", "USD"], [18, 18, 0], ['4167781430693052713', '4325877590113664316929', '5']).send()), "AD01");      
    });

    it('reverts if trying to set contact', async function () {
      await shouldFail(runOperation(tezos, seizer, () => this.contract.methods.setContact('hello@mtpelerin.com').send()), "AD01");
    });

    it('reverts if trying to mint tokens', async function () {
      await shouldFail(runOperation(tezos, seizer, () => this.contract.methods.mint(10000, address1.pkh).send()), "SU01");
    });

    it('reverts if trying to burn tokens', async function () {
      await shouldFail(runOperation(tezos, seizer, () => this.contract.methods.burn(10000, address1.pkh).send()), "SU01");
    });
  });

  context('When standard user', function () {
    beforeEach(async function () {
      await runOperation(tezos, owner, () => this.contract.methods.addAdministrator(administrator.pkh).send());
      await runOperation(tezos, administrator, () => this.contract.methods.addSupplier(supplier.pkh).send());
      await runOperation(tezos, administrator, () => this.contract.methods.addSeizer(seizer.pkh).send());
      await runOperation(tezos, supplier, () => this.contract.methods.mint(31000, address1.pkh).send());
      await runOperation(tezos, supplier, () => this.contract.methods.mint(32000, address2.pkh).send());
      await runOperation(tezos, supplier, () => this.contract.methods.mint(33000, address3.pkh).send());
      await runOperation(tezos, supplier, () => this.contract.methods.mint(4000, owner.pkh).send());
      await runOperation(tezos, administrator, () => this.contract.methods.setRules([{ruleId: 0, ruleParam: 1}, {ruleId: 1, ruleParam: 1}]).send());
    });

    context('Token structure', function () {
      beforeEach(async function () {
        this.callback = await ContractBuilder.new(tezos, 'ligo/mocks/StringCallback.ligo', {}, 'undefined');
        this.natCallback = await ContractBuilder.new(tezos, 'ligo/mocks/NatCallback.ligo', {}, '0');
      });

      it('has the defined name', async function () {
        await runOperation(tezos, address1, () => this.contract.methods.name(this.callback.address).send());
        (await this.callback.storage()).should.equal('Test token');
      });

      it('has the defined symbol', async function () {
        await runOperation(tezos, address1, () => this.contract.methods.symbol(this.callback.address).send());
        (await this.callback.storage()).should.equal('TST');
      });

      it('has the defined decimals', async function () {
        await runOperation(tezos, address1, () => this.contract.methods.decimals(this.natCallback.address).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('3');
      });

      it('can get the total supply', async function () {
        (await this.contract.storage()).totalSupply.should.be.bignumber.equal('100000');
        await runOperation(tezos, address1, () => this.contract.methods.getTotalSupply("", this.natCallback.address).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('100000');
      });

      it('can get the balance of an address', async function () {
        (await (await this.contract.storage()).ledger.get(address1.pkh)).balance.should.be.bignumber.equal('31000');
        await runOperation(tezos, address1, () => this.contract.methods.getBalance(address1.pkh, this.natCallback.address).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('31000');
      });
    });

    context('Allowance', function () {
      beforeEach(async function () {
        this.natCallback = await ContractBuilder.new(tezos, 'ligo/mocks/NatCallback.ligo', {}, '0');
      });

      it('allows address1 to define a spending allowance for address3', async function () {
        await runOperation(tezos, address1, () => this.contract.methods.getAllowance(address1.pkh, address3.pkh, this.natCallback.address).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('0');
        await runOperation(tezos, address1, () => this.contract.methods.approve(20000, address3.pkh).send());
        await runOperation(tezos, address1, () => this.contract.methods.getAllowance(address1.pkh, address3.pkh, this.natCallback.address).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('20000');   
      });
  
      it('allows address1 to increase the allowance for address3', async function () {
        await runOperation(tezos, address1, () => this.contract.methods.getAllowance(address1.pkh, address3.pkh, this.natCallback.address).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('0');
        await runOperation(tezos, address1, () => this.contract.methods.approve(20000, address3.pkh).send());
        await runOperation(tezos, address1, () => this.contract.methods.getAllowance(address1.pkh, address3.pkh, this.natCallback.address).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('20000');   
        await runOperation(tezos, address1, () => this.contract.methods.increaseApproval(10000, address3.pkh).send());
        await runOperation(tezos, address1, () => this.contract.methods.getAllowance(address1.pkh, address3.pkh, this.natCallback.address).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('30000');          
      });
  
      it('allows address1 to decrease the allowance for address3', async function () {
        await runOperation(tezos, address1, () => this.contract.methods.getAllowance(address1.pkh, address3.pkh, this.natCallback.address).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('0');
        await runOperation(tezos, address1, () => this.contract.methods.approve(20000, address3.pkh).send());
        await runOperation(tezos, address1, () => this.contract.methods.getAllowance(address1.pkh, address3.pkh, this.natCallback.address).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('20000');   
        await runOperation(tezos, address1, () => this.contract.methods.decreaseApproval(10000, address3.pkh).send());
        await runOperation(tezos, address1, () => this.contract.methods.getAllowance(address1.pkh, address3.pkh, this.natCallback.address).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('10000');       
      });
  
      it('allows address1 to redefine a spending allowance for address3', async function () {
        await runOperation(tezos, address1, () => this.contract.methods.getAllowance(address1.pkh, address3.pkh, this.natCallback.address).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('0');
        await runOperation(tezos, address1, () => this.contract.methods.approve(20000, address3.pkh).send());
        await runOperation(tezos, address1, () => this.contract.methods.getAllowance(address1.pkh, address3.pkh, this.natCallback.address).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('20000');   
        await runOperation(tezos, address1, () => this.contract.methods.approve(50000, address3.pkh).send());
        await runOperation(tezos, address1, () => this.contract.methods.getAllowance(address1.pkh, address3.pkh, this.natCallback.address).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('50000');       
      }); 
    });

    context('Transfer', function () {
      beforeEach(async function () {
        this.natCallback = await ContractBuilder.new(tezos, 'ligo/mocks/NatCallback.ligo', {}, '0');
      });

      context('Valid transfer', function () {
        it('allows address1 to transfer tokens to address2', async function () {
          (await this.yesNoUpdate.storage()).should.be.bignumber.equal('0');
          await runOperation(tezos, address1, () => this.contract.methods.transfer(address1.pkh, address2.pkh, 11000).send()); 
          (await (await this.contract.storage()).ledger.get(owner.pkh)).balance.should.be.bignumber.equal('4000');
          (await (await this.contract.storage()).ledger.get(address1.pkh)).balance.should.be.bignumber.equal('19999');
          (await (await this.contract.storage()).ledger.get(address2.pkh)).balance.should.be.bignumber.equal('43001');
          (await (await this.contract.storage()).ledger.get(address3.pkh)).balance.should.be.bignumber.equal('33000');
          (await this.contract.storage()).totalSupply.should.be.bignumber.equal('100000');
          (await this.yesNoUpdate.storage()).should.be.bignumber.equal('1');       
        });
    
        it('reverts if address1 transfers more tokens than owned to address2', async function () {
          await shouldFail(runOperation(tezos, address1, () => this.contract.methods.transfer(address1.pkh, address2.pkh, 50000).send()), "BA01");        
        });
    
        it('allows address3 to transfer tokens from address1 to address2 with the right allowance', async function () {
          // Define allowance
          await runOperation(tezos, address1, () => this.contract.methods.approve(20000, address3.pkh).send());
    
          // Transfer
          (await this.yesNoUpdate.storage()).should.be.bignumber.equal('0');
          await runOperation(tezos, address1, () => this.contract.methods.getAllowance(address1.pkh, address3.pkh, this.natCallback.address).send());
          (await this.natCallback.storage()).should.be.bignumber.equal('20000'); 
          await runOperation(tezos, address3, () => this.contract.methods.transfer(address1.pkh, address2.pkh, 11000).send()); 
          await runOperation(tezos, address1, () => this.contract.methods.getAllowance(address1.pkh, address3.pkh, this.natCallback.address).send());
          (await this.natCallback.storage()).should.be.bignumber.equal('8999'); 
          (await (await this.contract.storage()).ledger.get(owner.pkh)).balance.should.be.bignumber.equal('4000');
          (await (await this.contract.storage()).ledger.get(address1.pkh)).balance.should.be.bignumber.equal('19999');
          (await (await this.contract.storage()).ledger.get(address2.pkh)).balance.should.be.bignumber.equal('43001');
          (await (await this.contract.storage()).ledger.get(address3.pkh)).balance.should.be.bignumber.equal('33000');
          (await this.contract.storage()).totalSupply.should.be.bignumber.equal('100000');
          (await this.yesNoUpdate.storage()).should.be.bignumber.equal('1');            
        });
    
        it('reverts if address3 transfers more tokens than the allowance from address1 to address2', async function () {
          // Define allowance
          await runOperation(tezos, address1, () => this.contract.methods.getAllowance(address1.pkh, address3.pkh, this.natCallback.address).send());
          (await this.natCallback.storage()).should.be.bignumber.equal('0'); 
          await runOperation(tezos, address1, () => this.contract.methods.approve(20000, address3.pkh).send());
          await runOperation(tezos, address1, () => this.contract.methods.getAllowance(address1.pkh, address3.pkh, this.natCallback.address).send());
          (await this.natCallback.storage()).should.be.bignumber.equal('20000'); 
    
          // Transfer
          await shouldFail(runOperation(tezos, address3, () => this.contract.methods.transfer(address1.pkh, address2.pkh, 31000).send()), "AL01");        
        });
    
        it('reverts if address3 transfers more tokens than address1 owns from address1 to address2', async function () {
          await runOperation(tezos, address1, () => this.contract.methods.approve(1000000, address3.pkh).send());
          await shouldFail(runOperation(tezos, address3, () => this.contract.methods.transfer(address1.pkh, address2.pkh, 50000).send()), "BA01");              
        });
      });

      context('Invalid transfer', function () {
        beforeEach(async function () {
          await runOperation(tezos, administrator, () => this.contract.methods.setRules([{ruleId: 0, ruleParam: 1}, {ruleId: 1, ruleParam: 0}]).send());
        });

        it('reverts when address1 tries to transfer tokens to address2', async function () {
          await shouldFail(runOperation(tezos, address1, () => this.contract.methods.transfer(address1.pkh, address2.pkh, 11000).send()), "RU03");           
        });

        it('reverts when address3 tries to transfer tokens from address1 to address2 with the right allowance', async function () {
          // Define allowance
          await runOperation(tezos, address1, () => this.contract.methods.approve(20000, address3.pkh).send());
          // Transfer
          await shouldFail(runOperation(tezos, address3, () => this.contract.methods.transfer(address1.pkh, address2.pkh, 11000).send()), "RU03");           
        });
      });
    });

    context('Price conversion', function () {
      beforeEach(async function () {
        this.natCallback = await ContractBuilder.new(tezos, 'ligo/mocks/NatCallback.ligo', {}, '0');
        await runOperation(tezos, administrator, () => this.contract.methods.setPrice('CHF', 2, '500').send());
      });

      it('can convert price', async function () {
        // 1000 = 1 token in decimals (token is configured with 3 decimals)
        await runOperation(tezos, address1, () => this.contract.methods.convertTo(1000, this.natCallback.address, 'CHF', 20).send());
        (await this.natCallback.storage()).should.be.bignumber.equal('50000000000000000000000000000000000000000');
      });
    });

    context('Security model', function () {
      it('reverts if trying to set rule engine', async function () {
        await shouldFail(runOperation(tezos, address1, () => this.contract.methods.setRuleEngine(this.addressParam.pkh).send()), "AD01");
      });
  
      it('reverts if trying to set realm', async function () {
        await shouldFail(runOperation(tezos, address1, () => this.contract.methods.setRealm(this.addressParam.pkh).send()), "AD01");
      });
  
      it('reverts if trying to set trustedIntermediaries', async function () {
        await shouldFail(runOperation(tezos, address1, () => this.contract.methods.setTrustedIntermediaries([this.addressParam.pkh]).send()), "AD01");
      });
  
      it('reverts if trying to add administrator', async function () {
        await shouldFail(runOperation(tezos, address1, () => this.contract.methods.addAdministrator(this.addressParam.pkh).send()), "OW01");
      });
  
      it('reverts if trying to remove administrator', async function () {
        await shouldFail(runOperation(tezos, address1, () => this.contract.methods.removeAdministrator(this.addressParam.pkh).send()), "OW01");
      });
  
      it('reverts if trying to add realm administrator', async function () {
        await shouldFail(runOperation(tezos, address1, () => this.contract.methods.addRealmAdministrator(this.addressParam.pkh).send()), "AD01");
      });
  
      it('reverts if trying to remove realm administrator', async function () {
        await shouldFail(runOperation(tezos, address1, () => this.contract.methods.removeRealmAdministrator(this.addressParam.pkh).send()), "AD01");
      });
  
      it('reverts if trying to add seizer', async function () {
        await shouldFail(runOperation(tezos, address1, () => this.contract.methods.addSeizer(this.addressParam.pkh).send()), "AD01");
      });
  
      it('reverts if trying to remove seizer', async function () {
        await shouldFail(runOperation(tezos, address1, () => this.contract.methods.removeSeizer(this.addressParam.pkh).send()), "AD01");
      });
  
      it('reverts if trying to add supplier', async function () {
        await shouldFail(runOperation(tezos, address1, () => this.contract.methods.addSupplier(this.addressParam.pkh).send()), "AD01");
      });
  
      it('reverts if trying to remove supplier', async function () {
        await shouldFail(runOperation(tezos, address1, () => this.contract.methods.removeSupplier(this.addressParam.pkh).send()), "AD01");
      });
  
      it('reverts if trying to set rules', async function () {
        await shouldFail(runOperation(tezos, address1, () => this.contract.methods.setRules([]).send()), "AD01");
      });

      it('reverts if trying to set price', async function () {
        await shouldFail(runOperation(tezos, address1, () => this.contract.methods.setPrice("CHF", 18, "49024460000000000000").send()), "AD01");      
      });

      it('reverts if trying to set prices', async function () {
        await shouldFail(runOperation(tezos, address1, () => this.contract.methods.setPrices(["CHF", "EUR", "USD"], [18, 18, 0], ['4167781430693052713', '4325877590113664316929', '5']).send()), "AD01");      
      });
  
      it('reverts if trying to set contact', async function () {
        await shouldFail(runOperation(tezos, address1, () => this.contract.methods.setContact('hello@mtpelerin.com').send()), "AD01");
      });
  
      it('reverts if trying to mint tokens', async function () {
        await shouldFail(runOperation(tezos, address1, () => this.contract.methods.mint(10000, address1.pkh).send()), "SU01");
      });
  
      it('reverts if trying to burn tokens', async function () {
        await shouldFail(runOperation(tezos, address1, () => this.contract.methods.burn(10000, address1.pkh).send()), "SU01");
      });

      it('reverts if trying to seize tokens', async function () {
        await shouldFail(runOperation(tezos, address1, () => this.contract.methods.seize(10000, address1.pkh).send()), "SE02");
      });
    });
  });
});