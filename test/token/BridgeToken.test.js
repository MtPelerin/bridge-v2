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

require('chai').should()
const crypto = require('crypto');
const { TestHelper } = require('@openzeppelin/cli');
const { Contracts, ZWeb3 } = require('@openzeppelin/upgrades');
const { expectEvent, shouldFail } = require('openzeppelin-test-helpers');
const { hexStringFromBuffer, signEIP712, PRIVATE_KEYS } = require('../helpers/EIP712');

ZWeb3.initialize(web3.currentProvider);

const Contract = Contracts.getFromLocal('BridgeToken');
const PriceOracle = Contracts.getFromLocal('PriceOracle');
const Processor = Contracts.getFromLocal('Processor');
const RuleEngine = Contracts.getFromLocal('RuleEngine');
const YesNoRule = Contracts.getFromLocal('YesNoRule');
const YesNoUpdateRule = Contracts.getFromLocal('YesNoUpdateRule');

const zero = '0x0000000000000000000000000000000000000000';

const PERMIT_TYPEHASH = web3.utils.keccak256('Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)');
const TRANSFER_WITH_AUTHORIZATION_TYPEHASH = web3.utils.keccak256("TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)");
const APPROVE_WITH_AUTHORIZATION_TYPEHASH = web3.utils.keccak256("ApproveWithAuthorization(address owner,address spender,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)");
const INCREASE_APPROVAL_WITH_AUTHORIZATION_TYPEHASH = web3.utils.keccak256("IncreaseApprovalWithAuthorization(address owner,address spender,uint256 increment,uint256 validAfter,uint256 validBefore,bytes32 nonce)");
const DECREASE_APPROVAL_WITH_AUTHORIZATION_TYPEHASH = web3.utils.keccak256("DecreaseApprovalWithAuthorization(address owner,address spender,uint256 decrement,uint256 validAfter,uint256 validBefore,bytes32 nonce)");
const CANCEL_AUTHORIZATION_TYPEHASH = web3.utils.keccak256("CancelAuthorization(address authorizer,bytes32 nonce)");

const [_Key, ownerKey, administratorKey, trustedIntermediary1Key, trustedIntermediary2Key, seizerKey, supplierKey, kingOwnerKey, realmAdministratorKey, realmKey, address1Key, address2Key, address3Key, address4Key] = PRIVATE_KEYS;

contract('BridgeToken', function ([_, owner, administrator, trustedIntermediary1, trustedIntermediary2, seizer, supplier, kingOwner, realmAdministrator, realm, address1, address2, address3, address4]) {
  beforeEach(async function () {
    this.project = await TestHelper();
    this.ruleEngine = await this.project.createProxy(RuleEngine, {initArgs: [owner]});
    this.yesNo = await this.project.createProxy(YesNoRule);
    this.yesNoUpdate = await this.project.createProxy(YesNoUpdateRule);
    await this.ruleEngine.methods.setRules([this.yesNo.address, this.yesNoUpdate.address]).send({from: owner, gas: 100000});
    this.processor = await this.project.createProxy(Processor, {initArgs: [owner, this.ruleEngine.address], gas: 100000});
    this.contract = await this.project.createProxy(Contract, {initArgs: [owner, this.processor.address, 'Test token', 'TST', 3, [trustedIntermediary1, trustedIntermediary2]], gas: 100000});
    this.computeDomainSeparator = () => {
      const chainId = 1; // Ganache chainId
      return web3.utils.keccak256(
        web3.eth.abi.encodeParameters(
          ["bytes32", "bytes32", "bytes32", "uint256", "address"],
          [
            web3.utils.keccak256(
              "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
            ),
            web3.utils.keccak256("Test token"),
            web3.utils.keccak256("2"),
            chainId,
            this.contract.address,
          ]
        )
      );
    };
  });

  context('When owner', function () {
    it('has proper owner', async function () {
      (await this.contract.methods.owner().call()).should.equal(owner);
    });

    it('can add administrator', async function () {
      ({events: this.events} = await this.contract.methods.addAdministrator(administrator).send({from: owner}));
      (await this.contract.methods.isAdministrator(administrator).call()).should.equal(true);
    });

    it('emits a AdministratorAdded event', function () {
      this.events.should.have.property('AdministratorAdded');
      this.events.AdministratorAdded.returnValues.should.have.property('administrator', administrator);
    });

    it('can remove administrator', async function () {
      await this.contract.methods.addAdministrator(administrator).send({from: owner});
      (await this.contract.methods.isAdministrator(administrator).call()).should.equal(true);
      ({events: this.events} = await this.contract.methods.removeAdministrator(administrator).send({from: owner}));
      (await this.contract.methods.isAdministrator(administrator).call()).should.equal(false);
    });

    it('emits a AdministratorRemoved event', function () {
      this.events.should.have.property('AdministratorRemoved');
      this.events.AdministratorRemoved.returnValues.should.have.property('administrator', administrator);
    });
  });

  context('When administrator', function () {
    beforeEach(async function () {
      await this.contract.methods.addAdministrator(administrator).send({from: owner});
    });

    it('can set processor', async function () {
      (await this.contract.methods.processor().call()).should.equal(this.processor.address);
      ({events: this.events} = await this.contract.methods.setProcessor(address1).send({from: administrator}));
      (await this.contract.methods.processor().call()).should.equal(address1);
    }); 

    it('emits a ProcessorChanged event', function () {
      this.events.should.have.property('ProcessorChanged');
      this.events.ProcessorChanged.returnValues.should.have.property('newProcessor', address1);
    });

    it('can add a realm administrator', async function () {
      ({events: this.events} = await this.contract.methods.addRealmAdministrator(realmAdministrator).send({from: administrator}));
      (await this.contract.methods.isRealmAdministrator(realmAdministrator).call()).should.equal(true);
    });

    it('emits a RealmAdministratorAdded event', function () {
      this.events.should.have.property('RealmAdministratorAdded');
      this.events.RealmAdministratorAdded.returnValues.should.have.property('administrator', realmAdministrator);
    });

    it('can remove realm administrator', async function () {
      await this.contract.methods.addRealmAdministrator(realmAdministrator).send({from: administrator});
      (await this.contract.methods.isRealmAdministrator(realmAdministrator).call()).should.equal(true);
      ({events: this.events} = await this.contract.methods.removeRealmAdministrator(realmAdministrator).send({from: administrator}));
      (await this.contract.methods.isRealmAdministrator(realmAdministrator).call()).should.equal(false);
    });

    it('emits a RealmAdministratorRemoved event', function () {
      this.events.should.have.property('RealmAdministratorRemoved');
      this.events.RealmAdministratorRemoved.returnValues.should.have.property('administrator', realmAdministrator);
    });

    context('When changing realm', function () {
      beforeEach(async function () {
        this.king = await this.project.createProxy(Contract, {initArgs: [kingOwner, this.processor.address, 'King token', 'KNG', 3, [trustedIntermediary1, trustedIntermediary2]], gas: 100000});
        await this.king.methods.addRealmAdministrator(administrator).send({from: kingOwner});
      });

      it('can set realm', async function () {
        this.realm = this.king.address;
        (await this.contract.methods.realm().call()).should.equal(this.contract.address);
        ({events: this.events} = await this.contract.methods.setRealm(this.realm).send({from: administrator}));
        (await this.contract.methods.realm().call()).should.equal(this.realm);
      });
  
      it('emits a RealmChanged event', function () {
        this.events.should.have.property('RealmChanged');
        this.events.RealmChanged.returnValues.should.have.property('newRealm', this.realm);
      });

      it('reverts if setRealm caller is not king token administrator or king token owner', async function () {
        await shouldFail.reverting.withMessage(this.contract.methods.setRealm(this.realm).send({from: owner}), "KI01");
      });
    });

    it('can set trustedIntermediaries', async function () {
      (await this.contract.methods.trustedIntermediaries().call()).length.should.equal(2);
      ({events: this.events} = await this.contract.methods.setTrustedIntermediaries([trustedIntermediary1]).send({from: administrator}));
      (await this.contract.methods.trustedIntermediaries().call()).length.should.equal(1);
    }); 

    it('emits a TrustedIntermediariesChanged event', function () {
      this.events.should.have.property('TrustedIntermediariesChanged');
      this.events.TrustedIntermediariesChanged.returnValues.should.have.property('newTrustedIntermediaries');
      this.events.TrustedIntermediariesChanged.returnValues.newTrustedIntermediaries.length.should.equal(1);
      this.events.TrustedIntermediariesChanged.returnValues.newTrustedIntermediaries[0].should.equal(trustedIntermediary1);
    });

    it('can set priceOracle', async function () {
      ({events: this.events} = await this.contract.methods.setPriceOracle(address1).send({from: administrator}));
     (await this.contract.methods.priceOracle().call()).should.equal(address1);
    }); 

    it('emits a PriceOracleChanged event', function () {
      this.events.should.have.property('PriceOracleChanged');
      this.events.PriceOracleChanged.returnValues.should.have.property('newPriceOracle', address1);
    });

    it('can add seizer', async function () {
      ({events: this.events} = await this.contract.methods.addSeizer(seizer).send({from: administrator}));
      (await this.contract.methods.isSeizer(seizer).call()).should.equal(true);
    });

    it('emits a SeizerAdded event', function () {
      this.events.should.have.property('SeizerAdded');
      this.events.SeizerAdded.returnValues.should.have.property('seizer', seizer);
    });

    it('can remove seizer', async function () {
      await this.contract.methods.addSeizer(seizer).send({from: administrator});
      (await this.contract.methods.isSeizer(seizer).call()).should.equal(true);
      ({events: this.events} = await this.contract.methods.removeSeizer(seizer).send({from: administrator}));
      (await this.contract.methods.isSeizer(seizer).call()).should.equal(false);
    });

    it('emits a SeizerRemoved event', function () {
      this.events.should.have.property('SeizerRemoved');
      this.events.SeizerRemoved.returnValues.should.have.property('seizer', seizer);
    });

    it('can add supplier', async function () {
      ({events: this.events} = await this.contract.methods.addSupplier(supplier).send({from: administrator}));
      (await this.contract.methods.isSupplier(supplier).call()).should.equal(true);
    });

    it('emits a SupplierAdded event', function () {
      this.events.should.have.property('SupplierAdded');
      this.events.SupplierAdded.returnValues.should.have.property('supplier', supplier);
    });

    it('can remove supplier', async function () {
      await this.contract.methods.addSupplier(supplier).send({from: administrator});
      (await this.contract.methods.isSupplier(supplier).call()).should.equal(true);
      ({events: this.events} = await this.contract.methods.removeSupplier(supplier).send({from: administrator}));
      (await this.contract.methods.isSupplier(supplier).call()).should.equal(false);
    });

    it('emits a SupplierRemoved event', function () {
      this.events.should.have.property('SupplierRemoved');
      this.events.SupplierRemoved.returnValues.should.have.property('supplier', supplier);
    });

    it('can set rules', async function () {
      (await this.contract.methods.rules().call())['0'].length.should.equal(0);
      ({events: this.events} = await this.contract.methods.setRules([0, 1], [1, 0]).send({from: administrator, gas: 200000}));
      const ret = await this.contract.methods.rules().call();
      ret['0'].length.should.equal(2);
      ret['0'][0].should.equal('0');
      ret['0'][1].should.equal('1');
      ret['1'][0].should.equal('1');
      ret['1'][1].should.equal('0');
    });

    it('emits a RulesChanged event', function () {
      this.events.should.have.property('RulesChanged');
      this.events.RulesChanged.returnValues.should.have.property('newRules');
      this.events.RulesChanged.returnValues.newRules.length.should.equal(2);
      this.events.RulesChanged.returnValues.newRules[0].should.equal('0');
      this.events.RulesChanged.returnValues.newRules[1].should.equal('1');
      this.events.RulesChanged.returnValues.should.have.property('newRulesParams');
      this.events.RulesChanged.returnValues.newRulesParams.length.should.equal(2);
      this.events.RulesChanged.returnValues.newRulesParams[0].should.equal('1');
      this.events.RulesChanged.returnValues.newRulesParams[1].should.equal('0');
    });

    it('can set contact', async function () {
      (await this.contract.methods.contact().call()).should.equal('');
      ({events: this.events} = await this.contract.methods.setContact('hello@mtpelerin.com').send({from: administrator}));
      (await this.contract.methods.contact().call()).should.equal('hello@mtpelerin.com');
    }); 

    it('emits a ContactSet event', function () {
      this.events.should.have.property('ContactSet');
      this.events.ContactSet.returnValues.should.have.property('contact', 'hello@mtpelerin.com');
    });

    it('reverts if trying to add administrator', async function () {
      await shouldFail.reverting(this.contract.methods.addAdministrator(administrator).send({from: administrator}));
    });

    it('reverts if trying to remove administrator', async function () {
      await shouldFail.reverting(this.contract.methods.removeAdministrator(administrator).send({from: administrator}));
    });

    it('reverts if trying to seize tokens', async function () {
      await shouldFail.reverting.withMessage(this.contract.methods.seize(address1, 10000).send({from: administrator}), "SE02");
    });

    it('reverts if trying to mint tokens', async function () {
      await shouldFail.reverting.withMessage(this.contract.methods.mint(address1, 10000).send({from: administrator}), "SU01");
    });

    it('reverts if trying to burn tokens', async function () {
      await shouldFail.reverting.withMessage(this.contract.methods.burn(address1, 10000).send({from: administrator}), "SU01");
    });
  });

  context('When supplier', function () {
    beforeEach(async function () {
      await this.contract.methods.addAdministrator(administrator).send({from: owner});
      await this.contract.methods.addSupplier(supplier).send({from: administrator});
    });

    it('can mint tokens', async function () {
      (await this.contract.methods.totalSupply().call()).should.equal('0');
      (await this.contract.methods.balanceOf(address1).call()).should.equal('0');
      (await this.contract.methods.balanceOf(address2).call()).should.equal('0');
      ({events: this.events} = await this.contract.methods.mint(address1, 10000).send({from: supplier}));
      (await this.contract.methods.totalSupply().call()).should.equal('10000');
      (await this.contract.methods.balanceOf(address1).call()).should.equal('10000');
      (await this.contract.methods.balanceOf(address2).call()).should.equal('0');
    });

    it('emits a Mint event', function () {
      this.events.should.have.property('Mint');
      this.events.Mint.returnValues.should.have.property('to', address1);
      this.events.Mint.returnValues.should.have.property('amount', '10000');
    });

    it('emits a Transfer event', function () {
      this.events.should.have.property('Transfer');
      this.events.Transfer.returnValues.should.have.property('from', zero);
      this.events.Transfer.returnValues.should.have.property('to', address1);
      this.events.Transfer.returnValues.should.have.property('value', '10000');
    });

    it('can burn tokens', async function () {
      (await this.contract.methods.totalSupply().call()).should.equal('0');
      (await this.contract.methods.balanceOf(address1).call()).should.equal('0');
      (await this.contract.methods.balanceOf(address2).call()).should.equal('0');
      await this.contract.methods.mint(address1, 10000).send({from: supplier});
      (await this.contract.methods.totalSupply().call()).should.equal('10000');
      (await this.contract.methods.balanceOf(address1).call()).should.equal('10000');
      (await this.contract.methods.balanceOf(address2).call()).should.equal('0');
      ({events: this.events} = await this.contract.methods.burn(address1, 10000).send({from: supplier}));
      (await this.contract.methods.totalSupply().call()).should.equal('0');
      (await this.contract.methods.balanceOf(address1).call()).should.equal('0');
      (await this.contract.methods.balanceOf(address2).call()).should.equal('0');
    });

    it('emits a Burn event', function () {
      this.events.should.have.property('Burn');
      this.events.Burn.returnValues.should.have.property('from', address1);
      this.events.Burn.returnValues.should.have.property('amount', '10000');
    });

    it('emits a Transfer event', function () {
      this.events.should.have.property('Transfer');
      this.events.Transfer.returnValues.should.have.property('from', address1);
      this.events.Transfer.returnValues.should.have.property('to', zero);
      this.events.Transfer.returnValues.should.have.property('value', '10000');
    });

    it('cannot burn more tokens than available on address', async function () {
      await shouldFail.reverting(this.contract.methods.burn(address1, 100000).send({from: supplier}));
    });

    it('reverts if trying to set processor', async function () {
      await shouldFail.reverting.withMessage(this.contract.methods.setProcessor(address1).send({from: supplier}), "AD01");
    });

    it('reverts if trying to set realm', async function () {
      await shouldFail.reverting.withMessage(this.contract.methods.setRealm(realm).send({from: supplier}), "AD01");
    });

    it('reverts if trying to set trustedIntermediaries', async function () {
      await shouldFail.reverting.withMessage(this.contract.methods.setTrustedIntermediaries([trustedIntermediary1]).send({from: supplier}), "AD01");
    });

    it('reverts if trying to set priceOracle', async function () {
      await shouldFail.reverting.withMessage(this.contract.methods.setPriceOracle(address1).send({from: supplier}), "AD01");
    });

    it('reverts if trying to add administrator', async function () {
      await shouldFail.reverting(this.contract.methods.addAdministrator(administrator).send({from: supplier}));
    });

    it('reverts if trying to remove administrator', async function () {
      await shouldFail.reverting(this.contract.methods.removeAdministrator(administrator).send({from: supplier}));
    });

    it('reverts if trying to add realm administrator', async function () {
      await shouldFail.reverting.withMessage(this.contract.methods.addRealmAdministrator(realmAdministrator).send({from: supplier}), "AD01");
    });

    it('reverts if trying to remove realm administrator', async function () {
      await shouldFail.reverting.withMessage(this.contract.methods.removeRealmAdministrator(realmAdministrator).send({from: supplier}), "AD01");
    });

    it('reverts if trying to add seizer', async function () {
      await shouldFail.reverting.withMessage(this.contract.methods.addSeizer(seizer).send({from: supplier}), "AD01");
    });

    it('reverts if trying to remove seizer', async function () {
      await shouldFail.reverting.withMessage(this.contract.methods.removeSeizer(seizer).send({from: supplier}), "AD01");
    });

    it('reverts if trying to add supplier', async function () {
      await shouldFail.reverting.withMessage(this.contract.methods.addSupplier(supplier).send({from: supplier}), "AD01");
    });

    it('reverts if trying to remove supplier', async function () {
      await shouldFail.reverting.withMessage(this.contract.methods.removeSupplier(supplier).send({from: supplier}), "AD01");
    });

    it('reverts if trying to set rules', async function () {
      await shouldFail.reverting.withMessage(this.contract.methods.setRules([0, 1], [1, 0]).send({from: supplier}), "AD01");
    });

    it('reverts if trying to set contact', async function () {
      await shouldFail.reverting.withMessage(this.contract.methods.setContact('hello@mtpelerin.com').send({from: supplier}), "AD01");
    });

    it('reverts if trying to seize tokens', async function () {
      await shouldFail.reverting.withMessage(this.contract.methods.seize(address1, 10000).send({from: supplier}), "SE02");
    });
  });

  context('When seizer', function () {
    beforeEach(async function () {
      await this.contract.methods.addAdministrator(administrator).send({from: owner});
      await this.contract.methods.addSupplier(supplier).send({from: administrator});
      await this.contract.methods.addSeizer(seizer).send({from: administrator});
      await this.contract.methods.mint(address1, 10000).send({from: supplier});
      await this.contract.methods.mint(address2, 15000).send({from: supplier});
    });

    it('can seize tokens', async function () {
      (await this.contract.methods.totalSupply().call()).should.equal('25000');
      (await this.contract.methods.balanceOf(address1).call()).should.equal('10000');
      (await this.contract.methods.balanceOf(address2).call()).should.equal('15000');
      (await this.contract.methods.balanceOf(seizer).call()).should.equal('0');
      ({events: this.events} = await this.contract.methods.seize(address1, 8000).send({from: seizer}));
      (await this.contract.methods.totalSupply().call()).should.equal('25000');
      (await this.contract.methods.balanceOf(seizer).call()).should.equal('8000');
      (await this.contract.methods.balanceOf(address1).call()).should.equal('2000');
      (await this.contract.methods.balanceOf(address2).call()).should.equal('15000');
    });

    it('emits a Seize event', function () {
      this.events.should.have.property('Seize');
      this.events.Seize.returnValues.should.have.property('account', address1);
      this.events.Seize.returnValues.should.have.property('amount', '8000');
    });

    it('emits a Transfer event', function () {
      this.events.should.have.property('Transfer');
      this.events.Transfer.returnValues.should.have.property('from', address1);
      this.events.Transfer.returnValues.should.have.property('to', seizer);
      this.events.Transfer.returnValues.should.have.property('value', '8000');
    });

    it('cannot seize more tokens than available on address', async function () {
      await shouldFail.reverting(this.contract.methods.seize(address1, 15000).send({from: seizer}));
    });

    it('reverts if trying to set processor', async function () {
      await shouldFail.reverting.withMessage(this.contract.methods.setProcessor(address1).send({from: seizer}), "AD01");
    });

    it('reverts if trying to set realm', async function () {
      await shouldFail.reverting.withMessage(this.contract.methods.setRealm(realm).send({from: seizer}), "AD01");
    });

    it('reverts if trying to set trustedIntermediaries', async function () {
      await shouldFail.reverting.withMessage(this.contract.methods.setTrustedIntermediaries([trustedIntermediary1]).send({from: seizer}), "AD01");
    });

    it('reverts if trying to set priceOracle', async function () {
      await shouldFail.reverting.withMessage(this.contract.methods.setPriceOracle(address1).send({from: seizer}), "AD01");
    });

    it('reverts if trying to add administrator', async function () {
      await shouldFail.reverting(this.contract.methods.addAdministrator(administrator).send({from: seizer}));
    });

    it('reverts if trying to remove administrator', async function () {
      await shouldFail.reverting(this.contract.methods.removeAdministrator(administrator).send({from: seizer}));
    });

    it('reverts if trying to add realm administrator', async function () {
      await shouldFail.reverting.withMessage(this.contract.methods.addRealmAdministrator(realmAdministrator).send({from: seizer}), "AD01");
    });

    it('reverts if trying to remove realm administrator', async function () {
      await shouldFail.reverting.withMessage(this.contract.methods.removeRealmAdministrator(realmAdministrator).send({from: seizer}), "AD01");
    });

    it('reverts if trying to add seizer', async function () {
      await shouldFail.reverting.withMessage(this.contract.methods.addSeizer(seizer).send({from: seizer}), "AD01");
    });

    it('reverts if trying to remove seizer', async function () {
      await shouldFail.reverting.withMessage(this.contract.methods.removeSeizer(seizer).send({from: seizer}), "AD01");
    });

    it('reverts if trying to add supplier', async function () {
      await shouldFail.reverting.withMessage(this.contract.methods.addSupplier(supplier).send({from: seizer}), "AD01");
    });

    it('reverts if trying to remove supplier', async function () {
      await shouldFail.reverting.withMessage(this.contract.methods.removeSupplier(supplier).send({from: seizer}), "AD01");
    });

    it('reverts if trying to set rules', async function () {
      await shouldFail.reverting.withMessage(this.contract.methods.setRules([0, 1], [1, 0]).send({from: seizer}), "AD01");
    });

    it('reverts if trying to set contact', async function () {
      await shouldFail.reverting.withMessage(this.contract.methods.setContact('hello@mtpelerin.com').send({from: seizer}), "AD01");
    });

    it('reverts if trying to mint tokens', async function () {
      await shouldFail.reverting.withMessage(this.contract.methods.mint(address1, 10000).send({from: seizer}), "SU01");
    });

    it('reverts if trying to burn tokens', async function () {
      await shouldFail.reverting.withMessage(this.contract.methods.burn(address1, 10000).send({from: seizer}), "SU01");
    });
  });

  context('When standard user', function () {
    beforeEach(async function () {
      await this.contract.methods.addAdministrator(administrator).send({from: owner});
      await this.contract.methods.setRules([0, 1], [1, 1]).send({from: administrator, gas: 200000});
      await this.contract.methods.addSupplier(supplier).send({from: administrator});
      await this.contract.methods.addSeizer(seizer).send({from: administrator});
      await this.contract.methods.mint(address1, 31000).send({from: supplier});
      await this.contract.methods.mint(address2, 32000).send({from: supplier});
      await this.contract.methods.mint(address3, 33000).send({from: supplier});
      await this.contract.methods.mint(owner, 4000).send({from: supplier});
    });

    context('Token structure', function () {
      it('has the defined name', async function () {
        (await this.contract.methods.name().call()).should.equal('Test token');
      });
      it('has the defined symbol', async function () {
        (await this.contract.methods.symbol().call()).should.equal('TST');
      });
      it('has the right number of decimals', async function () {
        (await this.contract.methods.decimals().call()).should.equal('3');
      });
      it('has proper realm', async function () {
        (await this.contract.methods.realm().call()).should.equal(this.contract.address);
      });
      it('has an EIP712 Domain Separator', async function () {
        const DOMAIN_SEPARATOR = this.computeDomainSeparator();
        (await this.contract.methods.DOMAIN_SEPARATOR().call()).should.equal(DOMAIN_SEPARATOR);
      });
    });

    context('Allowance', function () {
      it('allows address1 to define a spending allowance for address3', async function () {
        (await this.contract.methods.allowance(address1, address3).call()).should.equal('0');
        ({events: this.events} = await this.contract.methods.approve(address3, 20000).send({from: address1}));
        (await this.contract.methods.allowance(address1, address3).call()).should.equal('20000');     
      });
  
      it('emits an Approval event', function () {
        this.events.should.have.property('Approval');
        this.events.Approval.returnValues.should.have.property('owner', address1);
        this.events.Approval.returnValues.should.have.property('spender', address3);
        this.events.Approval.returnValues.should.have.property('value', '20000');
      });
  
      it('allows address1 to increase the allowance for address3', async function () {
        (await this.contract.methods.allowance(address1, address3).call()).should.equal('0');
        await this.contract.methods.approve(address3, 20000).send({from: address1});
        (await this.contract.methods.allowance(address1, address3).call()).should.equal('20000');  
        ({events: this.events} = await this.contract.methods.increaseApproval(address3, 10000).send({from: address1}));
        (await this.contract.methods.allowance(address1, address3).call()).should.equal('30000');           
      });
  
      it('emits an Approval event', function () {
        this.events.should.have.property('Approval');
        this.events.Approval.returnValues.should.have.property('owner', address1);
        this.events.Approval.returnValues.should.have.property('spender', address3);
        this.events.Approval.returnValues.should.have.property('value', '30000');
      });
  
      it('allows address1 to decrease the allowance for address3', async function () {
        (await this.contract.methods.allowance(address1, address3).call()).should.equal('0');
        await this.contract.methods.approve(address3, 20000).send({from: address1});
        (await this.contract.methods.allowance(address1, address3).call()).should.equal('20000');  
        ({events: this.events} = await this.contract.methods.decreaseApproval(address3, 10000).send({from: address1}));
        (await this.contract.methods.allowance(address1, address3).call()).should.equal('10000');           
      });
  
      it('emits an Approval event', function () {
        this.events.should.have.property('Approval');
        this.events.Approval.returnValues.should.have.property('owner', address1);
        this.events.Approval.returnValues.should.have.property('spender', address3);
        this.events.Approval.returnValues.should.have.property('value', '10000');
      });
  
      it('allows address1 to redefine a spending allowance for address3', async function () {
        (await this.contract.methods.allowance(address1, address3).call()).should.equal('0');
        await this.contract.methods.approve(address3, 20000).send({from: address1});
        (await this.contract.methods.allowance(address1, address3).call()).should.equal('20000');     
        ({events: this.events} = await this.contract.methods.approve(address3, 50000).send({from: address1}));
        (await this.contract.methods.allowance(address1, address3).call()).should.equal('50000'); 
      }); 
      
      it('emits an Approval event', function () {
        this.events.should.have.property('Approval');
        this.events.Approval.returnValues.should.have.property('owner', address1);
        this.events.Approval.returnValues.should.have.property('spender', address3);
        this.events.Approval.returnValues.should.have.property('value', '50000');
      });
    });

    context('EIP2612 - Permit function', function () {
      it('has the expected PERMIT_TYPEHASH', async function () {
        (await this.contract.methods.PERMIT_TYPEHASH().call()).should.equal(PERMIT_TYPEHASH);
      });

      it('allows address1 to permit spending allowance for address3 sent by address4', async function () {
        (await this.contract.methods.allowance(address1, address3).call()).should.equal('0');
        (await this.contract.methods.nonces(address1).call()).should.equal('0');
        const deadline = Math.floor(Date.now() / 1000) + 10;
        const params = {
          owner: address1,
          spender: address3,
          value: 20000,
          nonce: 0,
          deadline,
        };
        const domainSeparator = this.computeDomainSeparator();
        const { r, s, v } = signEIP712(domainSeparator, PERMIT_TYPEHASH, ["address", "address", "uint256", "uint256", "uint256"], [params.owner, params.spender, params.value, params.nonce, params.deadline], address1Key);
        ({events: this.events} = await this.contract.methods.permit(params.owner, params.spender, params.value, params.deadline, v, r, s).send({from: address4}));
        (await this.contract.methods.allowance(address1, address3).call()).should.equal('20000');
        (await this.contract.methods.nonces(address1).call()).should.equal('1');     
      });
  
      it('emits an Approval event', function () {
        this.events.should.have.property('Approval');
        this.events.Approval.returnValues.should.have.property('owner', address1);
        this.events.Approval.returnValues.should.have.property('spender', address3);
        this.events.Approval.returnValues.should.have.property('value', '20000');
      });

      it('should revert if trying to permit spending allowance for address3 sent by address4 with invalid nonce', async function () {
        (await this.contract.methods.allowance(address1, address3).call()).should.equal('0');
        (await this.contract.methods.nonces(address1).call()).should.equal('0');
        const deadline = Math.floor(Date.now() / 1000) + 10;
        const params = {
          owner: address1,
          spender: address3,
          value: 20000,
          nonce: 1,
          deadline,
        };
        const domainSeparator = this.computeDomainSeparator();
        const { r, s, v } = signEIP712(domainSeparator, PERMIT_TYPEHASH, ["address", "address", "uint256", "uint256", "uint256"], [params.owner, params.spender, params.value, params.nonce, params.deadline], address1Key);
        await shouldFail.reverting.withMessage(this.contract.methods.permit(params.owner, params.spender, params.value, params.deadline, v, r, s).send({from: address4}), 'SI01');
      });

      it('should revert if trying to permit spending allowance for address3 sent by address4 with invalid signature', async function () {
        (await this.contract.methods.allowance(address1, address3).call()).should.equal('0');
        (await this.contract.methods.nonces(address1).call()).should.equal('0');
        const deadline = Math.floor(Date.now() / 1000) + 10;
        const params = {
          owner: address1,
          spender: address3,
          value: 20000,
          nonce: 0,
          deadline,
        };
        const domainSeparator = this.computeDomainSeparator();
        const { r, s, v } = signEIP712(domainSeparator, PERMIT_TYPEHASH, ["address", "address", "uint256", "uint256", "uint256"], [params.owner, params.spender, params.value, params.nonce, params.deadline], address2Key);
        await shouldFail.reverting.withMessage(this.contract.methods.permit(params.owner, params.spender, params.value, params.deadline, v, r, s).send({from: address4}), 'SI01');
      });

      it('should revert if trying to permit spending allowance for address3 sent by address4 with expired deadline', async function () {
        (await this.contract.methods.allowance(address1, address3).call()).should.equal('0');
        (await this.contract.methods.nonces(address1).call()).should.equal('0');
        const deadline = Math.floor(Date.now() / 1000) - 1;
        const params = {
          owner: address1,
          spender: address3,
          value: 20000,
          nonce: 0,
          deadline,
        };
        const domainSeparator = this.computeDomainSeparator();
        const { r, s, v } = signEIP712(domainSeparator, PERMIT_TYPEHASH, ["address", "address", "uint256", "uint256", "uint256"], [params.owner, params.spender, params.value, params.nonce, params.deadline], address1Key);
        await shouldFail.reverting.withMessage(this.contract.methods.permit(params.owner, params.spender, params.value, params.deadline, v, r, s).send({from: address4}), 'EX01');
      });
    });

    context('EIP3009 - transferWithAuthorization function', function () {
      it('has the expected TRANSFER_WITH_AUTHORIZATION_TYPEHASH', async function () {
        (await this.contract.methods.TRANSFER_WITH_AUTHORIZATION_TYPEHASH().call()).should.equal(TRANSFER_WITH_AUTHORIZATION_TYPEHASH);
      });

      it('has the expected CANCEL_AUTHORIZATION_TYPEHASH', async function () {
        (await this.contract.methods.CANCEL_AUTHORIZATION_TYPEHASH().call()).should.equal(CANCEL_AUTHORIZATION_TYPEHASH);
      });

      it('allows address1 to transfer tokens from address1 to address2 sent by address4', async function () {
        (await this.yesNoUpdate.methods.updateCount().call()).should.equals('0');    
        (await this.contract.methods.balanceOf(owner).call()).should.equal('4000');
        (await this.contract.methods.balanceOf(address1).call()).should.equal('31000');
        (await this.contract.methods.balanceOf(address2).call()).should.equal('32000');
        (await this.contract.methods.balanceOf(address3).call()).should.equal('33000');
        const validAfter = Math.floor(Date.now() / 1000) - 10;
        const validBefore = Math.floor(Date.now() / 1000) + 10;
        const params = {
          from: address1,
          to: address2,
          value: 11000,
          validAfter,
          validBefore,
          nonce: hexStringFromBuffer(crypto.randomBytes(32)),
        };
        const domainSeparator = this.computeDomainSeparator();
        const { r, s, v } = signEIP712(domainSeparator, TRANSFER_WITH_AUTHORIZATION_TYPEHASH, ["address", "address", "uint256", "uint256", "uint256", "bytes32"], [params.from, params.to, params.value, params.validAfter, params.validBefore, params.nonce], address1Key);
        (await this.contract.methods.authorizationStates(address1, params.nonce).call()).should.equals('0'); 
        ({events: this.events} = await this.contract.methods.transferWithAuthorization(params.from, params.to, params.value, params.validAfter, params.validBefore, params.nonce, v, r, s).send({from: address4, gas: 200000})); 
        (await this.contract.methods.balanceOf(owner).call()).should.equal('4000');
        (await this.contract.methods.balanceOf(address1).call()).should.equal('20000');
        (await this.contract.methods.balanceOf(address2).call()).should.equal('43000');
        (await this.contract.methods.balanceOf(address3).call()).should.equal('33000');
        (await this.contract.methods.totalSupply().call()).should.equal('100000');   
        (await this.yesNoUpdate.methods.updateCount().call()).should.equals('1');   
        (await this.contract.methods.authorizationStates(address1, params.nonce).call()).should.equals('1');    
      });

      it('emits a Transfer event', function () {
        this.events.should.have.property('Transfer');
        this.events.Transfer.returnValues.should.have.property('from', address1);
        this.events.Transfer.returnValues.should.have.property('to', address2);
        this.events.Transfer.returnValues.should.have.property('value', '11000');
      });

      it('should revert if trying to transfer tokens from address1 to address2 sent by address4 with invalid signature', async function () {
        (await this.yesNoUpdate.methods.updateCount().call()).should.equals('0');    
        (await this.contract.methods.balanceOf(owner).call()).should.equal('4000');
        (await this.contract.methods.balanceOf(address1).call()).should.equal('31000');
        (await this.contract.methods.balanceOf(address2).call()).should.equal('32000');
        (await this.contract.methods.balanceOf(address3).call()).should.equal('33000');
        const validAfter = Math.floor(Date.now() / 1000) - 10;
        const validBefore = Math.floor(Date.now() / 1000) + 10;
        const params = {
          from: address1,
          to: address2,
          value: 11000,
          validAfter,
          validBefore,
          nonce: hexStringFromBuffer(crypto.randomBytes(32)),
        };
        const domainSeparator = this.computeDomainSeparator();
        const { r, s, v } = signEIP712(domainSeparator, TRANSFER_WITH_AUTHORIZATION_TYPEHASH, ["address", "address", "uint256", "uint256", "uint256", "bytes32"], [params.from, params.to, params.value, params.validAfter, params.validBefore, params.nonce], address2Key);
        (await this.contract.methods.authorizationStates(address1, params.nonce).call()).should.equals('0'); 
        await shouldFail.reverting.withMessage(this.contract.methods.transferWithAuthorization(params.from, params.to, params.value, params.validAfter, params.validBefore, params.nonce, v, r, s).send({from: address4, gas: 200000}), 'SI01'); 
        (await this.contract.methods.balanceOf(owner).call()).should.equal('4000');
        (await this.contract.methods.balanceOf(address1).call()).should.equal('31000');
        (await this.contract.methods.balanceOf(address2).call()).should.equal('32000');
        (await this.contract.methods.balanceOf(address3).call()).should.equal('33000');
        (await this.contract.methods.totalSupply().call()).should.equal('100000');   
        (await this.yesNoUpdate.methods.updateCount().call()).should.equals('0'); 
        (await this.contract.methods.authorizationStates(address1, params.nonce).call()).should.equals('0'); 
      });

      it('should revert if trying to transfer tokens from address1 to address2 sent by address4 before validAfter', async function () {
        (await this.yesNoUpdate.methods.updateCount().call()).should.equals('0');    
        (await this.contract.methods.balanceOf(owner).call()).should.equal('4000');
        (await this.contract.methods.balanceOf(address1).call()).should.equal('31000');
        (await this.contract.methods.balanceOf(address2).call()).should.equal('32000');
        (await this.contract.methods.balanceOf(address3).call()).should.equal('33000');
        const validAfter = Math.floor(Date.now() / 1000) + 10;
        const validBefore = Math.floor(Date.now() / 1000) + 20;
        const params = {
          from: address1,
          to: address2,
          value: 11000,
          validAfter,
          validBefore,
          nonce: hexStringFromBuffer(crypto.randomBytes(32)),
        };
        const domainSeparator = this.computeDomainSeparator();
        const { r, s, v } = signEIP712(domainSeparator, TRANSFER_WITH_AUTHORIZATION_TYPEHASH, ["address", "address", "uint256", "uint256", "uint256", "bytes32"], [params.from, params.to, params.value, params.validAfter, params.validBefore, params.nonce], address1Key);
        (await this.contract.methods.authorizationStates(address1, params.nonce).call()).should.equals('0'); 
        await shouldFail.reverting.withMessage(this.contract.methods.transferWithAuthorization(params.from, params.to, params.value, params.validAfter, params.validBefore, params.nonce, v, r, s).send({from: address4, gas: 200000}), 'EX02'); 
        (await this.contract.methods.balanceOf(owner).call()).should.equal('4000');
        (await this.contract.methods.balanceOf(address1).call()).should.equal('31000');
        (await this.contract.methods.balanceOf(address2).call()).should.equal('32000');
        (await this.contract.methods.balanceOf(address3).call()).should.equal('33000');
        (await this.contract.methods.totalSupply().call()).should.equal('100000');   
        (await this.yesNoUpdate.methods.updateCount().call()).should.equals('0'); 
        (await this.contract.methods.authorizationStates(address1, params.nonce).call()).should.equals('0'); 
      });

      it('should revert if trying to transfer tokens from address1 to address2 sent by address4 after validBefore', async function () {
        (await this.yesNoUpdate.methods.updateCount().call()).should.equals('0');    
        (await this.contract.methods.balanceOf(owner).call()).should.equal('4000');
        (await this.contract.methods.balanceOf(address1).call()).should.equal('31000');
        (await this.contract.methods.balanceOf(address2).call()).should.equal('32000');
        (await this.contract.methods.balanceOf(address3).call()).should.equal('33000');
        const validAfter = Math.floor(Date.now() / 1000) - 20;
        const validBefore = Math.floor(Date.now() / 1000) - 10;
        const params = {
          from: address1,
          to: address2,
          value: 11000,
          validAfter,
          validBefore,
          nonce: hexStringFromBuffer(crypto.randomBytes(32)),
        };
        const domainSeparator = this.computeDomainSeparator();
        const { r, s, v } = signEIP712(domainSeparator, TRANSFER_WITH_AUTHORIZATION_TYPEHASH, ["address", "address", "uint256", "uint256", "uint256", "bytes32"], [params.from, params.to, params.value, params.validAfter, params.validBefore, params.nonce], address1Key);
        (await this.contract.methods.authorizationStates(address1, params.nonce).call()).should.equals('0'); 
        await shouldFail.reverting.withMessage(this.contract.methods.transferWithAuthorization(params.from, params.to, params.value, params.validAfter, params.validBefore, params.nonce, v, r, s).send({from: address4, gas: 200000}), 'EX01'); 
        (await this.contract.methods.balanceOf(owner).call()).should.equal('4000');
        (await this.contract.methods.balanceOf(address1).call()).should.equal('31000');
        (await this.contract.methods.balanceOf(address2).call()).should.equal('32000');
        (await this.contract.methods.balanceOf(address3).call()).should.equal('33000');
        (await this.contract.methods.totalSupply().call()).should.equal('100000');   
        (await this.yesNoUpdate.methods.updateCount().call()).should.equals('0'); 
        (await this.contract.methods.authorizationStates(address1, params.nonce).call()).should.equals('0'); 
      });

      it('should revert if trying to transfer tokens from address1 to address2 sent by address4 and authorization has already been used', async function () {
        (await this.yesNoUpdate.methods.updateCount().call()).should.equals('0');    
        (await this.contract.methods.balanceOf(owner).call()).should.equal('4000');
        (await this.contract.methods.balanceOf(address1).call()).should.equal('31000');
        (await this.contract.methods.balanceOf(address2).call()).should.equal('32000');
        (await this.contract.methods.balanceOf(address3).call()).should.equal('33000');
        const validAfter = Math.floor(Date.now() / 1000) - 10;
        const validBefore = Math.floor(Date.now() / 1000) + 10;
        const params = {
          from: address1,
          to: address2,
          value: 11000,
          validAfter,
          validBefore,
          nonce: hexStringFromBuffer(crypto.randomBytes(32)),
        };
        const domainSeparator = this.computeDomainSeparator();
        const { r, s, v } = signEIP712(domainSeparator, TRANSFER_WITH_AUTHORIZATION_TYPEHASH, ["address", "address", "uint256", "uint256", "uint256", "bytes32"], [params.from, params.to, params.value, params.validAfter, params.validBefore, params.nonce], address1Key);
        (await this.contract.methods.authorizationStates(address1, params.nonce).call()).should.equals('0'); 
        ({events: this.events} = await this.contract.methods.transferWithAuthorization(params.from, params.to, params.value, params.validAfter, params.validBefore, params.nonce, v, r, s).send({from: address4, gas: 200000})); 
        (await this.contract.methods.balanceOf(owner).call()).should.equal('4000');
        (await this.contract.methods.balanceOf(address1).call()).should.equal('20000');
        (await this.contract.methods.balanceOf(address2).call()).should.equal('43000');
        (await this.contract.methods.balanceOf(address3).call()).should.equal('33000');
        (await this.contract.methods.totalSupply().call()).should.equal('100000');   
        (await this.yesNoUpdate.methods.updateCount().call()).should.equals('1'); 
        (await this.contract.methods.authorizationStates(address1, params.nonce).call()).should.equals('1'); 
        await shouldFail.reverting.withMessage(this.contract.methods.transferWithAuthorization(params.from, params.to, params.value, params.validAfter, params.validBefore, params.nonce, v, r, s).send({from: address4, gas: 200000}), 'EX03'); 
        (await this.contract.methods.balanceOf(owner).call()).should.equal('4000');
        (await this.contract.methods.balanceOf(address1).call()).should.equal('20000');
        (await this.contract.methods.balanceOf(address2).call()).should.equal('43000');
        (await this.contract.methods.balanceOf(address3).call()).should.equal('33000');
        (await this.contract.methods.totalSupply().call()).should.equal('100000');   
        (await this.yesNoUpdate.methods.updateCount().call()).should.equals('1'); 
        (await this.contract.methods.authorizationStates(address1, params.nonce).call()).should.equals('1'); 
      });

      it('should revert if trying to transfer tokens from address1 to address2 sent by address4 and authorization has been cancelled', async function () {
        (await this.yesNoUpdate.methods.updateCount().call()).should.equals('0');    
        (await this.contract.methods.balanceOf(owner).call()).should.equal('4000');
        (await this.contract.methods.balanceOf(address1).call()).should.equal('31000');
        (await this.contract.methods.balanceOf(address2).call()).should.equal('32000');
        (await this.contract.methods.balanceOf(address3).call()).should.equal('33000');
        const validAfter = Math.floor(Date.now() / 1000) - 10;
        const validBefore = Math.floor(Date.now() / 1000) + 10;
        const params = {
          from: address1,
          to: address2,
          value: 11000,
          validAfter,
          validBefore,
          nonce: hexStringFromBuffer(crypto.randomBytes(32)),
        };
        const domainSeparator = this.computeDomainSeparator();
        const cancellation = signEIP712(domainSeparator, CANCEL_AUTHORIZATION_TYPEHASH, ["address", "bytes32"], [params.from, params.nonce], address1Key);
        const { r, s, v } = signEIP712(domainSeparator, TRANSFER_WITH_AUTHORIZATION_TYPEHASH, ["address", "address", "uint256", "uint256", "uint256", "bytes32"], [params.from, params.to, params.value, params.validAfter, params.validBefore, params.nonce], address1Key);
        (await this.contract.methods.authorizationStates(address1, params.nonce).call()).should.equals('0'); 
        ({events: this.events} = await this.contract.methods.cancelAuthorization(params.from, params.nonce, cancellation.v, cancellation.r, cancellation.s).send({from: address2, gas: 200000})); 
        (await this.contract.methods.authorizationStates(address1, params.nonce).call()).should.equals('2'); 
        await shouldFail.reverting.withMessage(this.contract.methods.transferWithAuthorization(params.from, params.to, params.value, params.validAfter, params.validBefore, params.nonce, v, r, s).send({from: address4, gas: 200000}), 'EX03'); 
        (await this.contract.methods.balanceOf(owner).call()).should.equal('4000');
        (await this.contract.methods.balanceOf(address1).call()).should.equal('31000');
        (await this.contract.methods.balanceOf(address2).call()).should.equal('32000');
        (await this.contract.methods.balanceOf(address3).call()).should.equal('33000');
        (await this.contract.methods.totalSupply().call()).should.equal('100000');   
        (await this.yesNoUpdate.methods.updateCount().call()).should.equals('0'); 
        (await this.contract.methods.authorizationStates(address1, params.nonce).call()).should.equals('2'); 
      });
    }); 

    context('approveWithAuthorization function', function () {
      it('has the expected APPROVE_WITH_AUTHORIZATION_TYPEHASH', async function () {
        (await this.contract.methods.APPROVE_WITH_AUTHORIZATION_TYPEHASH().call()).should.equal(APPROVE_WITH_AUTHORIZATION_TYPEHASH);
      });

      it('allows address1 to approve spending allowance for address3 sent by address4', async function () {
        (await this.contract.methods.allowance(address1, address3).call()).should.equal('0');
        const validAfter = Math.floor(Date.now() / 1000) - 10;
        const validBefore = Math.floor(Date.now() / 1000) + 10;
        const params = {
          owner: address1,
          spender: address3,
          value: 20000,
          validAfter,
          validBefore,
          nonce: hexStringFromBuffer(crypto.randomBytes(32)),
        };
        const domainSeparator = this.computeDomainSeparator();
        const { r, s, v } = signEIP712(domainSeparator, APPROVE_WITH_AUTHORIZATION_TYPEHASH, ["address", "address", "uint256", "uint256", "uint256", "bytes32"], [params.owner, params.spender, params.value, params.validAfter, params.validBefore, params.nonce], address1Key);
        (await this.contract.methods.authorizationStates(address1, params.nonce).call()).should.equals('0'); 
        ({events: this.events} = await this.contract.methods.approveWithAuthorization(params.owner, params.spender, params.value, params.validAfter, params.validBefore, params.nonce, v, r, s).send({from: address4, gas: 200000}));      
        (await this.contract.methods.authorizationStates(address1, params.nonce).call()).should.equals('1');
        (await this.contract.methods.allowance(address1, address3).call()).should.equal('20000');
      });
  
      it('emits an Approval event', function () {
        this.events.should.have.property('Approval');
        this.events.Approval.returnValues.should.have.property('owner', address1);
        this.events.Approval.returnValues.should.have.property('spender', address3);
        this.events.Approval.returnValues.should.have.property('value', '20000');
      });

      it('should revert if trying to allow address1 to approve spending allowance for address3 sent by address4 with invalid signature', async function () {
        (await this.contract.methods.allowance(address1, address3).call()).should.equal('0');
        const validAfter = Math.floor(Date.now() / 1000) - 10;
        const validBefore = Math.floor(Date.now() / 1000) + 10;
        const params = {
          owner: address1,
          spender: address3,
          value: 20000,
          validAfter,
          validBefore,
          nonce: hexStringFromBuffer(crypto.randomBytes(32)),
        };
        const domainSeparator = this.computeDomainSeparator();
        const { r, s, v } = signEIP712(domainSeparator, APPROVE_WITH_AUTHORIZATION_TYPEHASH, ["address", "address", "uint256", "uint256", "uint256", "bytes32"], [params.owner, params.spender, params.value, params.validAfter, params.validBefore, params.nonce], address2Key);
        (await this.contract.methods.authorizationStates(address1, params.nonce).call()).should.equals('0'); 
        await shouldFail.reverting.withMessage(this.contract.methods.approveWithAuthorization(params.owner, params.spender, params.value, params.validAfter, params.validBefore, params.nonce, v, r, s).send({from: address4, gas: 200000}), 'SI01'); 
        (await this.contract.methods.allowance(address1, address3).call()).should.equal('0');
        (await this.contract.methods.authorizationStates(address1, params.nonce).call()).should.equals('0'); 
      });

      it('should revert if trying to allow address1 to approve spending allowance for address3 sent by address4 before validAfter', async function () {
        (await this.contract.methods.allowance(address1, address3).call()).should.equal('0');
        const validAfter = Math.floor(Date.now() / 1000) + 10;
        const validBefore = Math.floor(Date.now() / 1000) + 20;
        const params = {
          owner: address1,
          spender: address3,
          value: 20000,
          validAfter,
          validBefore,
          nonce: hexStringFromBuffer(crypto.randomBytes(32)),
        };
        const domainSeparator = this.computeDomainSeparator();
        const { r, s, v } = signEIP712(domainSeparator, APPROVE_WITH_AUTHORIZATION_TYPEHASH, ["address", "address", "uint256", "uint256", "uint256", "bytes32"], [params.owner, params.spender, params.value, params.validAfter, params.validBefore, params.nonce], address1Key);
        (await this.contract.methods.authorizationStates(address1, params.nonce).call()).should.equals('0'); 
        await shouldFail.reverting.withMessage(this.contract.methods.approveWithAuthorization(params.owner, params.spender, params.value, params.validAfter, params.validBefore, params.nonce, v, r, s).send({from: address4, gas: 200000}), 'EX02'); 
        (await this.contract.methods.allowance(address1, address3).call()).should.equal('0');
        (await this.contract.methods.authorizationStates(address1, params.nonce).call()).should.equals('0'); 
      });

      it('should revert if trying to allow address1 to approve spending allowance for address3 sent by address4 after validBefore', async function () {
        (await this.contract.methods.allowance(address1, address3).call()).should.equal('0');
        const validAfter = Math.floor(Date.now() / 1000) - 20;
        const validBefore = Math.floor(Date.now() / 1000) - 10;
        const params = {
          owner: address1,
          spender: address3,
          value: 20000,
          validAfter,
          validBefore,
          nonce: hexStringFromBuffer(crypto.randomBytes(32)),
        };
        const domainSeparator = this.computeDomainSeparator();
        const { r, s, v } = signEIP712(domainSeparator, APPROVE_WITH_AUTHORIZATION_TYPEHASH, ["address", "address", "uint256", "uint256", "uint256", "bytes32"], [params.owner, params.spender, params.value, params.validAfter, params.validBefore, params.nonce], address1Key);
        (await this.contract.methods.authorizationStates(address1, params.nonce).call()).should.equals('0'); 
        await shouldFail.reverting.withMessage(this.contract.methods.approveWithAuthorization(params.owner, params.spender, params.value, params.validAfter, params.validBefore, params.nonce, v, r, s).send({from: address4, gas: 200000}), 'EX01'); 
        (await this.contract.methods.allowance(address1, address3).call()).should.equal('0');
        (await this.contract.methods.authorizationStates(address1, params.nonce).call()).should.equals('0'); 
      });

      it('should revert if trying to allow address1 to approve spending allowance for address3 sent by address4 and authorization has already been used', async function () {
        (await this.contract.methods.allowance(address1, address3).call()).should.equal('0');
        const validAfter = Math.floor(Date.now() / 1000) - 10;
        const validBefore = Math.floor(Date.now() / 1000) + 10;
        const params = {
          owner: address1,
          spender: address3,
          value: 20000,
          validAfter,
          validBefore,
          nonce: hexStringFromBuffer(crypto.randomBytes(32)),
        };
        const domainSeparator = this.computeDomainSeparator();
        const { r, s, v } = signEIP712(domainSeparator, APPROVE_WITH_AUTHORIZATION_TYPEHASH, ["address", "address", "uint256", "uint256", "uint256", "bytes32"], [params.owner, params.spender, params.value, params.validAfter, params.validBefore, params.nonce], address1Key);
        (await this.contract.methods.authorizationStates(address1, params.nonce).call()).should.equals('0'); 
        ({events: this.events} = await this.contract.methods.approveWithAuthorization(params.owner, params.spender, params.value, params.validAfter, params.validBefore, params.nonce, v, r, s).send({from: address4, gas: 200000})); 
        (await this.contract.methods.allowance(address1, address3).call()).should.equal('20000');
        (await this.contract.methods.authorizationStates(address1, params.nonce).call()).should.equals('1'); 
        await shouldFail.reverting.withMessage(this.contract.methods.approveWithAuthorization(params.owner, params.spender, params.value, params.validAfter, params.validBefore, params.nonce, v, r, s).send({from: address4, gas: 200000}), 'EX03'); 
        (await this.contract.methods.allowance(address1, address3).call()).should.equal('20000');
        (await this.contract.methods.authorizationStates(address1, params.nonce).call()).should.equals('1'); 
      });

      it('should revert if trying to allow address1 to approve spending allowance for address3 sent by address4 and authorization has been cancelled', async function () {
        (await this.contract.methods.allowance(address1, address3).call()).should.equal('0');
        const validAfter = Math.floor(Date.now() / 1000) - 10;
        const validBefore = Math.floor(Date.now() / 1000) + 10;
        const params = {
          owner: address1,
          spender: address3,
          value: 20000,
          validAfter,
          validBefore,
          nonce: hexStringFromBuffer(crypto.randomBytes(32)),
        };
        const domainSeparator = this.computeDomainSeparator();
        const cancellation = signEIP712(domainSeparator, CANCEL_AUTHORIZATION_TYPEHASH, ["address", "bytes32"], [params.owner, params.nonce], address1Key);
        const { r, s, v } = signEIP712(domainSeparator, APPROVE_WITH_AUTHORIZATION_TYPEHASH, ["address", "address", "uint256", "uint256", "uint256", "bytes32"], [params.owner, params.spender, params.value, params.validAfter, params.validBefore, params.nonce], address1Key);
        (await this.contract.methods.authorizationStates(address1, params.nonce).call()).should.equals('0'); 
        ({events: this.events} = await this.contract.methods.cancelAuthorization(params.owner, params.nonce, cancellation.v, cancellation.r, cancellation.s).send({from: address2, gas: 200000})); 
        (await this.contract.methods.authorizationStates(address1, params.nonce).call()).should.equals('2'); 
        await shouldFail.reverting.withMessage(this.contract.methods.approveWithAuthorization(params.owner, params.spender, params.value, params.validAfter, params.validBefore, params.nonce, v, r, s).send({from: address4, gas: 200000}), 'EX03'); 
        (await this.contract.methods.allowance(address1, address3).call()).should.equal('0');
        (await this.contract.methods.authorizationStates(address1, params.nonce).call()).should.equals('2'); 
      });
    });

    context('increaseApprovalWithAuthorization function', function () {
      beforeEach(async function () {
        await this.contract.methods.approve(address3, 20000).send({from: address1});
      });

      it('has the expected INCREASE_APPROVAL_WITH_AUTHORIZATION_TYPEHASH', async function () {
        (await this.contract.methods.INCREASE_APPROVAL_WITH_AUTHORIZATION_TYPEHASH().call()).should.equal(INCREASE_APPROVAL_WITH_AUTHORIZATION_TYPEHASH);
      });

      it('allows address1 to increase spending allowance for address3 sent by address4', async function () {
        (await this.contract.methods.allowance(address1, address3).call()).should.equal('20000');
        const validAfter = Math.floor(Date.now() / 1000) - 10;
        const validBefore = Math.floor(Date.now() / 1000) + 10;
        const params = {
          owner: address1,
          spender: address3,
          value: 10000,
          validAfter,
          validBefore,
          nonce: hexStringFromBuffer(crypto.randomBytes(32)),
        };
        const domainSeparator = this.computeDomainSeparator();
        const { r, s, v } = signEIP712(domainSeparator, INCREASE_APPROVAL_WITH_AUTHORIZATION_TYPEHASH, ["address", "address", "uint256", "uint256", "uint256", "bytes32"], [params.owner, params.spender, params.value, params.validAfter, params.validBefore, params.nonce], address1Key);
        (await this.contract.methods.authorizationStates(address1, params.nonce).call()).should.equals('0'); 
        ({events: this.events} = await this.contract.methods.increaseApprovalWithAuthorization(params.owner, params.spender, params.value, params.validAfter, params.validBefore, params.nonce, v, r, s).send({from: address4, gas: 200000}));      
        (await this.contract.methods.authorizationStates(address1, params.nonce).call()).should.equals('1');
        (await this.contract.methods.allowance(address1, address3).call()).should.equal('30000');
      });
  
      it('emits an Approval event', function () {
        this.events.should.have.property('Approval');
        this.events.Approval.returnValues.should.have.property('owner', address1);
        this.events.Approval.returnValues.should.have.property('spender', address3);
        this.events.Approval.returnValues.should.have.property('value', '30000');
      });

      it('should revert if trying to allow address1 to increase spending allowance for address3 sent by address4 with invalid signature', async function () {
        (await this.contract.methods.allowance(address1, address3).call()).should.equal('20000');
        const validAfter = Math.floor(Date.now() / 1000) - 10;
        const validBefore = Math.floor(Date.now() / 1000) + 10;
        const params = {
          owner: address1,
          spender: address3,
          value: 10000,
          validAfter,
          validBefore,
          nonce: hexStringFromBuffer(crypto.randomBytes(32)),
        };
        const domainSeparator = this.computeDomainSeparator();
        const { r, s, v } = signEIP712(domainSeparator, INCREASE_APPROVAL_WITH_AUTHORIZATION_TYPEHASH, ["address", "address", "uint256", "uint256", "uint256", "bytes32"], [params.owner, params.spender, params.value, params.validAfter, params.validBefore, params.nonce], address2Key);
        (await this.contract.methods.authorizationStates(address1, params.nonce).call()).should.equals('0'); 
        await shouldFail.reverting.withMessage(this.contract.methods.increaseApprovalWithAuthorization(params.owner, params.spender, params.value, params.validAfter, params.validBefore, params.nonce, v, r, s).send({from: address4, gas: 200000}), 'SI01'); 
        (await this.contract.methods.allowance(address1, address3).call()).should.equal('20000');
        (await this.contract.methods.authorizationStates(address1, params.nonce).call()).should.equals('0'); 
      });

      it('should revert if trying to allow address1 to increase spending allowance for address3 sent by address4 before validAfter', async function () {
        (await this.contract.methods.allowance(address1, address3).call()).should.equal('20000');
        const validAfter = Math.floor(Date.now() / 1000) + 10;
        const validBefore = Math.floor(Date.now() / 1000) + 20;
        const params = {
          owner: address1,
          spender: address3,
          value: 10000,
          validAfter,
          validBefore,
          nonce: hexStringFromBuffer(crypto.randomBytes(32)),
        };
        const domainSeparator = this.computeDomainSeparator();
        const { r, s, v } = signEIP712(domainSeparator, INCREASE_APPROVAL_WITH_AUTHORIZATION_TYPEHASH, ["address", "address", "uint256", "uint256", "uint256", "bytes32"], [params.owner, params.spender, params.value, params.validAfter, params.validBefore, params.nonce], address1Key);
        (await this.contract.methods.authorizationStates(address1, params.nonce).call()).should.equals('0'); 
        await shouldFail.reverting.withMessage(this.contract.methods.increaseApprovalWithAuthorization(params.owner, params.spender, params.value, params.validAfter, params.validBefore, params.nonce, v, r, s).send({from: address4, gas: 200000}), 'EX02'); 
        (await this.contract.methods.allowance(address1, address3).call()).should.equal('20000');
        (await this.contract.methods.authorizationStates(address1, params.nonce).call()).should.equals('0'); 
      });

      it('should revert if trying to allow address1 to increase spending allowance for address3 sent by address4 after validBefore', async function () {
        (await this.contract.methods.allowance(address1, address3).call()).should.equal('20000');
        const validAfter = Math.floor(Date.now() / 1000) - 20;
        const validBefore = Math.floor(Date.now() / 1000) - 10;
        const params = {
          owner: address1,
          spender: address3,
          value: 10000,
          validAfter,
          validBefore,
          nonce: hexStringFromBuffer(crypto.randomBytes(32)),
        };
        const domainSeparator = this.computeDomainSeparator();
        const { r, s, v } = signEIP712(domainSeparator, INCREASE_APPROVAL_WITH_AUTHORIZATION_TYPEHASH, ["address", "address", "uint256", "uint256", "uint256", "bytes32"], [params.owner, params.spender, params.value, params.validAfter, params.validBefore, params.nonce], address1Key);
        (await this.contract.methods.authorizationStates(address1, params.nonce).call()).should.equals('0'); 
        await shouldFail.reverting.withMessage(this.contract.methods.increaseApprovalWithAuthorization(params.owner, params.spender, params.value, params.validAfter, params.validBefore, params.nonce, v, r, s).send({from: address4, gas: 200000}), 'EX01'); 
        (await this.contract.methods.allowance(address1, address3).call()).should.equal('20000');
        (await this.contract.methods.authorizationStates(address1, params.nonce).call()).should.equals('0'); 
      });

      it('should revert if trying to allow address1 to increase spending allowance for address3 sent by address4 and authorization has already been used', async function () {
        (await this.contract.methods.allowance(address1, address3).call()).should.equal('20000');
        const validAfter = Math.floor(Date.now() / 1000) - 10;
        const validBefore = Math.floor(Date.now() / 1000) + 10;
        const params = {
          owner: address1,
          spender: address3,
          value: 10000,
          validAfter,
          validBefore,
          nonce: hexStringFromBuffer(crypto.randomBytes(32)),
        };
        const domainSeparator = this.computeDomainSeparator();
        const { r, s, v } = signEIP712(domainSeparator, INCREASE_APPROVAL_WITH_AUTHORIZATION_TYPEHASH, ["address", "address", "uint256", "uint256", "uint256", "bytes32"], [params.owner, params.spender, params.value, params.validAfter, params.validBefore, params.nonce], address1Key);
        (await this.contract.methods.authorizationStates(address1, params.nonce).call()).should.equals('0'); 
        ({events: this.events} = await this.contract.methods.increaseApprovalWithAuthorization(params.owner, params.spender, params.value, params.validAfter, params.validBefore, params.nonce, v, r, s).send({from: address4, gas: 200000})); 
        (await this.contract.methods.allowance(address1, address3).call()).should.equal('30000');
        (await this.contract.methods.authorizationStates(address1, params.nonce).call()).should.equals('1'); 
        await shouldFail.reverting.withMessage(this.contract.methods.increaseApprovalWithAuthorization(params.owner, params.spender, params.value, params.validAfter, params.validBefore, params.nonce, v, r, s).send({from: address4, gas: 200000}), 'EX03'); 
        (await this.contract.methods.allowance(address1, address3).call()).should.equal('30000');
        (await this.contract.methods.authorizationStates(address1, params.nonce).call()).should.equals('1'); 
      });

      it('should revert if trying to allow address1 to increase spending allowance for address3 sent by address4 and authorization has been cancelled', async function () {
        (await this.contract.methods.allowance(address1, address3).call()).should.equal('20000');
        const validAfter = Math.floor(Date.now() / 1000) - 10;
        const validBefore = Math.floor(Date.now() / 1000) + 10;
        const params = {
          owner: address1,
          spender: address3,
          value: 10000,
          validAfter,
          validBefore,
          nonce: hexStringFromBuffer(crypto.randomBytes(32)),
        };
        const domainSeparator = this.computeDomainSeparator();
        const cancellation = signEIP712(domainSeparator, CANCEL_AUTHORIZATION_TYPEHASH, ["address", "bytes32"], [params.owner, params.nonce], address1Key);
        const { r, s, v } = signEIP712(domainSeparator, INCREASE_APPROVAL_WITH_AUTHORIZATION_TYPEHASH, ["address", "address", "uint256", "uint256", "uint256", "bytes32"], [params.owner, params.spender, params.value, params.validAfter, params.validBefore, params.nonce], address1Key);
        (await this.contract.methods.authorizationStates(address1, params.nonce).call()).should.equals('0'); 
        ({events: this.events} = await this.contract.methods.cancelAuthorization(params.owner, params.nonce, cancellation.v, cancellation.r, cancellation.s).send({from: address2, gas: 200000})); 
        (await this.contract.methods.authorizationStates(address1, params.nonce).call()).should.equals('2'); 
        await shouldFail.reverting.withMessage(this.contract.methods.increaseApprovalWithAuthorization(params.owner, params.spender, params.value, params.validAfter, params.validBefore, params.nonce, v, r, s).send({from: address4, gas: 200000}), 'EX03'); 
        (await this.contract.methods.allowance(address1, address3).call()).should.equal('20000');
        (await this.contract.methods.authorizationStates(address1, params.nonce).call()).should.equals('2'); 
      });
    });

    context('decreaseApprovalWithAuthorization function', function () {
      beforeEach(async function () {
        await this.contract.methods.approve(address3, 20000).send({from: address1});
      });

      it('has the expected DECREASE_APPROVAL_WITH_AUTHORIZATION_TYPEHASH', async function () {
        (await this.contract.methods.DECREASE_APPROVAL_WITH_AUTHORIZATION_TYPEHASH().call()).should.equal(DECREASE_APPROVAL_WITH_AUTHORIZATION_TYPEHASH);
      });

      it('allows address1 to decrease spending allowance for address3 sent by address4', async function () {
        (await this.contract.methods.allowance(address1, address3).call()).should.equal('20000');
        const validAfter = Math.floor(Date.now() / 1000) - 10;
        const validBefore = Math.floor(Date.now() / 1000) + 10;
        const params = {
          owner: address1,
          spender: address3,
          value: 10000,
          validAfter,
          validBefore,
          nonce: hexStringFromBuffer(crypto.randomBytes(32)),
        };
        const domainSeparator = this.computeDomainSeparator();
        const { r, s, v } = signEIP712(domainSeparator, DECREASE_APPROVAL_WITH_AUTHORIZATION_TYPEHASH, ["address", "address", "uint256", "uint256", "uint256", "bytes32"], [params.owner, params.spender, params.value, params.validAfter, params.validBefore, params.nonce], address1Key);
        (await this.contract.methods.authorizationStates(address1, params.nonce).call()).should.equals('0'); 
        ({events: this.events} = await this.contract.methods.decreaseApprovalWithAuthorization(params.owner, params.spender, params.value, params.validAfter, params.validBefore, params.nonce, v, r, s).send({from: address4, gas: 200000}));      
        (await this.contract.methods.authorizationStates(address1, params.nonce).call()).should.equals('1');
        (await this.contract.methods.allowance(address1, address3).call()).should.equal('10000');
      });
  
      it('emits an Approval event', function () {
        this.events.should.have.property('Approval');
        this.events.Approval.returnValues.should.have.property('owner', address1);
        this.events.Approval.returnValues.should.have.property('spender', address3);
        this.events.Approval.returnValues.should.have.property('value', '10000');
      });

      it('should revert if trying to allow address1 to decrease spending allowance for address3 sent by address4 with invalid signature', async function () {
        (await this.contract.methods.allowance(address1, address3).call()).should.equal('20000');
        const validAfter = Math.floor(Date.now() / 1000) - 10;
        const validBefore = Math.floor(Date.now() / 1000) + 10;
        const params = {
          owner: address1,
          spender: address3,
          value: 10000,
          validAfter,
          validBefore,
          nonce: hexStringFromBuffer(crypto.randomBytes(32)),
        };
        const domainSeparator = this.computeDomainSeparator();
        const { r, s, v } = signEIP712(domainSeparator, DECREASE_APPROVAL_WITH_AUTHORIZATION_TYPEHASH, ["address", "address", "uint256", "uint256", "uint256", "bytes32"], [params.owner, params.spender, params.value, params.validAfter, params.validBefore, params.nonce], address2Key);
        (await this.contract.methods.authorizationStates(address1, params.nonce).call()).should.equals('0'); 
        await shouldFail.reverting.withMessage(this.contract.methods.decreaseApprovalWithAuthorization(params.owner, params.spender, params.value, params.validAfter, params.validBefore, params.nonce, v, r, s).send({from: address4, gas: 200000}), 'SI01'); 
        (await this.contract.methods.allowance(address1, address3).call()).should.equal('20000');
        (await this.contract.methods.authorizationStates(address1, params.nonce).call()).should.equals('0'); 
      });

      it('should revert if trying to allow address1 to decrease spending allowance for address3 sent by address4 before validAfter', async function () {
        (await this.contract.methods.allowance(address1, address3).call()).should.equal('20000');
        const validAfter = Math.floor(Date.now() / 1000) + 10;
        const validBefore = Math.floor(Date.now() / 1000) + 20;
        const params = {
          owner: address1,
          spender: address3,
          value: 10000,
          validAfter,
          validBefore,
          nonce: hexStringFromBuffer(crypto.randomBytes(32)),
        };
        const domainSeparator = this.computeDomainSeparator();
        const { r, s, v } = signEIP712(domainSeparator, DECREASE_APPROVAL_WITH_AUTHORIZATION_TYPEHASH, ["address", "address", "uint256", "uint256", "uint256", "bytes32"], [params.owner, params.spender, params.value, params.validAfter, params.validBefore, params.nonce], address1Key);
        (await this.contract.methods.authorizationStates(address1, params.nonce).call()).should.equals('0'); 
        await shouldFail.reverting.withMessage(this.contract.methods.decreaseApprovalWithAuthorization(params.owner, params.spender, params.value, params.validAfter, params.validBefore, params.nonce, v, r, s).send({from: address4, gas: 200000}), 'EX02'); 
        (await this.contract.methods.allowance(address1, address3).call()).should.equal('20000');
        (await this.contract.methods.authorizationStates(address1, params.nonce).call()).should.equals('0'); 
      });

      it('should revert if trying to allow address1 to decrease spending allowance for address3 sent by address4 after validBefore', async function () {
        (await this.contract.methods.allowance(address1, address3).call()).should.equal('20000');
        const validAfter = Math.floor(Date.now() / 1000) - 20;
        const validBefore = Math.floor(Date.now() / 1000) - 10;
        const params = {
          owner: address1,
          spender: address3,
          value: 10000,
          validAfter,
          validBefore,
          nonce: hexStringFromBuffer(crypto.randomBytes(32)),
        };
        const domainSeparator = this.computeDomainSeparator();
        const { r, s, v } = signEIP712(domainSeparator, DECREASE_APPROVAL_WITH_AUTHORIZATION_TYPEHASH, ["address", "address", "uint256", "uint256", "uint256", "bytes32"], [params.owner, params.spender, params.value, params.validAfter, params.validBefore, params.nonce], address1Key);
        (await this.contract.methods.authorizationStates(address1, params.nonce).call()).should.equals('0'); 
        await shouldFail.reverting.withMessage(this.contract.methods.decreaseApprovalWithAuthorization(params.owner, params.spender, params.value, params.validAfter, params.validBefore, params.nonce, v, r, s).send({from: address4, gas: 200000}), 'EX01'); 
        (await this.contract.methods.allowance(address1, address3).call()).should.equal('20000');
        (await this.contract.methods.authorizationStates(address1, params.nonce).call()).should.equals('0'); 
      });

      it('should revert if trying to allow address1 to decrease spending allowance for address3 sent by address4 and authorization has already been used', async function () {
        (await this.contract.methods.allowance(address1, address3).call()).should.equal('20000');
        const validAfter = Math.floor(Date.now() / 1000) - 10;
        const validBefore = Math.floor(Date.now() / 1000) + 10;
        const params = {
          owner: address1,
          spender: address3,
          value: 10000,
          validAfter,
          validBefore,
          nonce: hexStringFromBuffer(crypto.randomBytes(32)),
        };
        const domainSeparator = this.computeDomainSeparator();
        const { r, s, v } = signEIP712(domainSeparator, DECREASE_APPROVAL_WITH_AUTHORIZATION_TYPEHASH, ["address", "address", "uint256", "uint256", "uint256", "bytes32"], [params.owner, params.spender, params.value, params.validAfter, params.validBefore, params.nonce], address1Key);
        (await this.contract.methods.authorizationStates(address1, params.nonce).call()).should.equals('0'); 
        ({events: this.events} = await this.contract.methods.decreaseApprovalWithAuthorization(params.owner, params.spender, params.value, params.validAfter, params.validBefore, params.nonce, v, r, s).send({from: address4, gas: 200000})); 
        (await this.contract.methods.allowance(address1, address3).call()).should.equal('10000');
        (await this.contract.methods.authorizationStates(address1, params.nonce).call()).should.equals('1'); 
        await shouldFail.reverting.withMessage(this.contract.methods.decreaseApprovalWithAuthorization(params.owner, params.spender, params.value, params.validAfter, params.validBefore, params.nonce, v, r, s).send({from: address4, gas: 200000}), 'EX03'); 
        (await this.contract.methods.allowance(address1, address3).call()).should.equal('10000');
        (await this.contract.methods.authorizationStates(address1, params.nonce).call()).should.equals('1'); 
      });

      it('should revert if trying to allow address1 to decrease spending allowance for address3 sent by address4 and authorization has been cancelled', async function () {
        (await this.contract.methods.allowance(address1, address3).call()).should.equal('20000');
        const validAfter = Math.floor(Date.now() / 1000) - 10;
        const validBefore = Math.floor(Date.now() / 1000) + 10;
        const params = {
          owner: address1,
          spender: address3,
          value: 10000,
          validAfter,
          validBefore,
          nonce: hexStringFromBuffer(crypto.randomBytes(32)),
        };
        const domainSeparator = this.computeDomainSeparator();
        const cancellation = signEIP712(domainSeparator, CANCEL_AUTHORIZATION_TYPEHASH, ["address", "bytes32"], [params.owner, params.nonce], address1Key);
        const { r, s, v } = signEIP712(domainSeparator, DECREASE_APPROVAL_WITH_AUTHORIZATION_TYPEHASH, ["address", "address", "uint256", "uint256", "uint256", "bytes32"], [params.owner, params.spender, params.value, params.validAfter, params.validBefore, params.nonce], address1Key);
        (await this.contract.methods.authorizationStates(address1, params.nonce).call()).should.equals('0'); 
        ({events: this.events} = await this.contract.methods.cancelAuthorization(params.owner, params.nonce, cancellation.v, cancellation.r, cancellation.s).send({from: address2, gas: 200000})); 
        (await this.contract.methods.authorizationStates(address1, params.nonce).call()).should.equals('2'); 
        await shouldFail.reverting.withMessage(this.contract.methods.decreaseApprovalWithAuthorization(params.owner, params.spender, params.value, params.validAfter, params.validBefore, params.nonce, v, r, s).send({from: address4, gas: 200000}), 'EX03'); 
        (await this.contract.methods.allowance(address1, address3).call()).should.equal('20000');
        (await this.contract.methods.authorizationStates(address1, params.nonce).call()).should.equals('2'); 
      });
    });

    context('cancelAuthorization function', function () {
      it('has the expected CANCEL_AUTHORIZATION_TYPEHASH', async function () {
        (await this.contract.methods.CANCEL_AUTHORIZATION_TYPEHASH().call()).should.equal(CANCEL_AUTHORIZATION_TYPEHASH);
      });

      it('allows address1 to cancel authorization sent by address2', async function () {
        const validAfter = Math.floor(Date.now() / 1000) - 10;
        const validBefore = Math.floor(Date.now() / 1000) + 10;
        this.nonce = hexStringFromBuffer(crypto.randomBytes(32));
        const params = {
          owner: address1,
          spender: address3,
          value: 10000,
          validAfter,
          validBefore,
          nonce: this.nonce,
        };
        const domainSeparator = this.computeDomainSeparator();
        const cancellation = signEIP712(domainSeparator, CANCEL_AUTHORIZATION_TYPEHASH, ["address", "bytes32"], [params.owner, params.nonce], address1Key);
        (await this.contract.methods.authorizationStates(address1, params.nonce).call()).should.equals('0'); 
        ({events: this.events} = await this.contract.methods.cancelAuthorization(params.owner, params.nonce, cancellation.v, cancellation.r, cancellation.s).send({from: address2, gas: 200000})); 
        (await this.contract.methods.authorizationStates(address1, params.nonce).call()).should.equals('2'); 
      });
  
      it('emits an AuthorizationCanceled event', function () {
        this.events.should.have.property('AuthorizationCanceled');
        this.events.AuthorizationCanceled.returnValues.should.have.property('authorizer', address1);
        this.events.AuthorizationCanceled.returnValues.should.have.property('nonce', this.nonce);
      });

      it('should revert if trying to cancel already used authorization', async function () {
        (await this.contract.methods.allowance(address1, address3).call()).should.equal('0');
        const validAfter = Math.floor(Date.now() / 1000) - 10;
        const validBefore = Math.floor(Date.now() / 1000) + 10;
        const params = {
          owner: address1,
          spender: address3,
          value: 20000,
          validAfter,
          validBefore,
          nonce: hexStringFromBuffer(crypto.randomBytes(32)),
        };
        const domainSeparator = this.computeDomainSeparator();
        const cancellation = signEIP712(domainSeparator, CANCEL_AUTHORIZATION_TYPEHASH, ["address", "bytes32"], [params.owner, params.nonce], address1Key);
        const { r, s, v } = signEIP712(domainSeparator, APPROVE_WITH_AUTHORIZATION_TYPEHASH, ["address", "address", "uint256", "uint256", "uint256", "bytes32"], [params.owner, params.spender, params.value, params.validAfter, params.validBefore, params.nonce], address1Key);
        (await this.contract.methods.authorizationStates(address1, params.nonce).call()).should.equals('0'); 
        await this.contract.methods.approveWithAuthorization(params.owner, params.spender, params.value, params.validAfter, params.validBefore, params.nonce, v, r, s).send({from: address4, gas: 200000});      
        (await this.contract.methods.authorizationStates(address1, params.nonce).call()).should.equals('1');
        (await this.contract.methods.allowance(address1, address3).call()).should.equal('20000');
        await shouldFail.reverting.withMessage(this.contract.methods.cancelAuthorization(params.owner, params.nonce, cancellation.v, cancellation.r, cancellation.s).send({from: address2, gas: 200000}), 'EX03'); 
        (await this.contract.methods.authorizationStates(address1, params.nonce).call()).should.equals('1'); 
      });

      it('should revert if trying to cancel authorization with wrong signature', async function () {
        const validAfter = Math.floor(Date.now() / 1000) - 10;
        const validBefore = Math.floor(Date.now() / 1000) + 10;
        this.nonce = hexStringFromBuffer(crypto.randomBytes(32));
        const params = {
          owner: address1,
          spender: address3,
          value: 10000,
          validAfter,
          validBefore,
          nonce: this.nonce,
        };
        const domainSeparator = this.computeDomainSeparator();
        const cancellation = signEIP712(domainSeparator, CANCEL_AUTHORIZATION_TYPEHASH, ["address", "bytes32"], [params.owner, params.nonce], address2Key);
        (await this.contract.methods.authorizationStates(address1, params.nonce).call()).should.equals('0'); 
        await shouldFail.reverting.withMessage(this.contract.methods.cancelAuthorization(params.owner, params.nonce, cancellation.v, cancellation.r, cancellation.s).send({from: address2, gas: 200000}), 'SI01'); 
        (await this.contract.methods.authorizationStates(address1, params.nonce).call()).should.equals('0'); 
      });
    });

    context('Transfer', function () {
      context('Valid transfer', function () {
        it('allows address1 to transfer tokens to address2', async function () {
          (await this.yesNoUpdate.methods.updateCount().call()).should.equals('0');    
          ({events: this.events} = await this.contract.methods.transfer(address2, 11000).send({from: address1, gas: 200000})); 
          (await this.contract.methods.balanceOf(owner).call()).should.equal('4000');
          (await this.contract.methods.balanceOf(address1).call()).should.equal('20000');
          (await this.contract.methods.balanceOf(address2).call()).should.equal('43000');
          (await this.contract.methods.balanceOf(address3).call()).should.equal('33000');
          (await this.contract.methods.totalSupply().call()).should.equal('100000');   
          (await this.yesNoUpdate.methods.updateCount().call()).should.equals('1');        
        });

        it('emits a Transfer event', function () {
          this.events.should.have.property('Transfer');
          this.events.Transfer.returnValues.should.have.property('from', address1);
          this.events.Transfer.returnValues.should.have.property('to', address2);
          this.events.Transfer.returnValues.should.have.property('value', '11000');
        });
    
        it('reverts if address1 transfers more tokens than owned to address2', async function () {
          await shouldFail.reverting(this.contract.methods.transfer(address2, 50000).send({from: address1}));        
        });

        it('allows address1 to bulk transfer tokens to address2, address3 and address4', async function () {
          (await this.yesNoUpdate.methods.updateCount().call()).should.equals('0');    
          ({events: this.events} = await this.contract.methods.bulkTransfer([address2, address3, address4], [1000, 2000, 3000]).send({from: address1, gas: 500000})); 
          (await this.contract.methods.balanceOf(owner).call()).should.equal('4000');
          (await this.contract.methods.balanceOf(address1).call()).should.equal('25000');
          (await this.contract.methods.balanceOf(address2).call()).should.equal('33000');
          (await this.contract.methods.balanceOf(address3).call()).should.equal('35000');
          (await this.contract.methods.balanceOf(address4).call()).should.equal('3000');
          (await this.contract.methods.totalSupply().call()).should.equal('100000');   
          (await this.yesNoUpdate.methods.updateCount().call()).should.equals('3');        
        });

        it('emits Transfer events', function () {
          this.events.should.have.property('Transfer');
          this.events.Transfer.should.have.length(3);
          this.events.Transfer[0].returnValues.should.have.property('from', address1);
          this.events.Transfer[0].returnValues.should.have.property('to', address2);
          this.events.Transfer[0].returnValues.should.have.property('value', '1000');
          this.events.Transfer[1].returnValues.should.have.property('from', address1);
          this.events.Transfer[1].returnValues.should.have.property('to', address3);
          this.events.Transfer[1].returnValues.should.have.property('value', '2000');
          this.events.Transfer[2].returnValues.should.have.property('from', address1);
          this.events.Transfer[2].returnValues.should.have.property('to', address4);
          this.events.Transfer[2].returnValues.should.have.property('value', '3000');
        });

        it('reverts if trying to bulk transfer from address1 but to and values arrays are not the same size', async function () {
          await shouldFail.reverting.withMessage(this.contract.methods.bulkTransfer([address2, address3, address4], [1000, 2000]).send({from: address1, gas: 500000}), "BK01");        
        });

        it('reverts if address1 transfers more tokens than owned', async function () {
          await shouldFail.reverting(this.contract.methods.bulkTransfer([address2, address3, address4], [10000, 20000, 30000]).send({from: address1, gas: 500000}));        
        });
    
        it('allows address3 to transfer tokens from address1 to address2 with the right allowance', async function () {
          // Define allowance
          await this.contract.methods.approve(address3, 20000).send({from: address1});
    
          // Transfer
          (await this.yesNoUpdate.methods.updateCount().call()).should.equal('0');  
          (await this.contract.methods.allowance(address1, address3).call()).should.equal('20000');
          ({events: this.events} = await this.contract.methods.transferFrom(address1, address2, 11000).send({from: address3, gas: 200000})); 
          (await this.contract.methods.allowance(address1, address3).call()).should.equal('9000');
          (await this.contract.methods.balanceOf(owner).call()).should.equal('4000');
          (await this.contract.methods.balanceOf(address1).call()).should.equal('20000');
          (await this.contract.methods.balanceOf(address2).call()).should.equal('43000');
          (await this.contract.methods.balanceOf(address3).call()).should.equal('33000');
          (await this.contract.methods.totalSupply().call()).should.equal('100000'); 
          (await this.yesNoUpdate.methods.updateCount().call()).should.equals('1');              
        });

        it('emits a Transfer event', function () {
          this.events.should.have.property('Transfer');
          this.events.Transfer.returnValues.should.have.property('from', address1);
          this.events.Transfer.returnValues.should.have.property('to', address2);
          this.events.Transfer.returnValues.should.have.property('value', '11000');
        });
    
        it('reverts if address3 transfers more tokens than the allowance from address1 to address2', async function () {
          // Define allowance
          (await this.contract.methods.allowance(address1, address3).call()).should.equal('0');
          await this.contract.methods.approve(address3, 20000).send({from: address1});
          (await this.contract.methods.allowance(address1, address3).call()).should.equal('20000');
    
          // Transfer
          await shouldFail.reverting.withMessage(this.contract.methods.transferFrom(address1, address2, 31000).send({from: address3, gas: 200000}), "AL01");        
        });
    
        it('reverts if address3 transfers more tokens than address1 owns from address1 to address2', async function () {
          await this.contract.methods.approve(address3, 1000000).send({from: address1});
          await shouldFail.reverting(this.contract.methods.transferFrom(address1, address2, 50000).send({from: address3}));        
        });

        it('allows address3 to bulk transfer tokens from address1 to address2 and address4 with the right allowance', async function () {
          // Define allowance
          await this.contract.methods.approve(address3, 20000).send({from: address1});
    
          // Transfer
          (await this.yesNoUpdate.methods.updateCount().call()).should.equal('0');  
          (await this.contract.methods.allowance(address1, address3).call()).should.equal('20000');
          ({events: this.events} = await this.contract.methods.bulkTransferFrom(address1, [address2, address4], [2000, 4000]).send({from: address3, gas: 300000})); 
          (await this.contract.methods.allowance(address1, address3).call()).should.equal('14000');
          (await this.contract.methods.balanceOf(owner).call()).should.equal('4000');
          (await this.contract.methods.balanceOf(address1).call()).should.equal('25000');
          (await this.contract.methods.balanceOf(address2).call()).should.equal('34000');
          (await this.contract.methods.balanceOf(address3).call()).should.equal('33000');
          (await this.contract.methods.balanceOf(address4).call()).should.equal('4000');
          (await this.contract.methods.totalSupply().call()).should.equal('100000'); 
          (await this.yesNoUpdate.methods.updateCount().call()).should.equals('2');              
        });

        it('emits a Transfer event', function () {
          this.events.should.have.property('Transfer');
          this.events.Transfer.should.have.length(2);
          this.events.Transfer[0].returnValues.should.have.property('from', address1);
          this.events.Transfer[0].returnValues.should.have.property('to', address2);
          this.events.Transfer[0].returnValues.should.have.property('value', '2000');
          this.events.Transfer[1].returnValues.should.have.property('from', address1);
          this.events.Transfer[1].returnValues.should.have.property('to', address4);
          this.events.Transfer[1].returnValues.should.have.property('value', '4000');
        });
    
        it('reverts if address3 tries to bulk transfer more tokens than the allowance from address1 to address2 and address4', async function () {
          // Define allowance
          (await this.contract.methods.allowance(address1, address3).call()).should.equal('0');
          await this.contract.methods.approve(address3, 20000).send({from: address1});
          (await this.contract.methods.allowance(address1, address3).call()).should.equal('20000');
    
          // Transfer
          await shouldFail.reverting.withMessage(this.contract.methods.bulkTransferFrom(address1, [address2, address4], [11000, 10000]).send({from: address3, gas: 300000}), "AL01");        
        });
    
        it('reverts if address3 tries to bulk transfer more tokens than address1 owns from address1 to address2 and address4', async function () {
          await this.contract.methods.approve(address3, 1000000).send({from: address1});
          await shouldFail.reverting(this.contract.methods.bulkTransferFrom(address1, [address2, address4], [20000, 30000]).send({from: address3}));        
        });
      });

      context('Invalid transfer', function () {
        beforeEach(async function () {
          await this.contract.methods.setRules([0, 1], [1, 0]).send({from: administrator, gas: 200000});
        });

        it('reverts when address1 tries to transfer tokens to address2', async function () {
          await shouldFail.reverting.withMessage(this.contract.methods.transfer(address2, 11000).send({from: address1}), "RU03");           
        });

        it('reverts if trying to bulk transfer from address1 but rule disallow it', async function () {
          await shouldFail.reverting.withMessage(this.contract.methods.bulkTransfer([address2, address3, address4], [1000, 2000, 3000]).send({from: address1, gas: 500000}), "RU03");        
        });

        it('reverts when address3 tries to transfer tokens from address1 to address2 with the right allowance', async function () {
          // Define allowance
          await this.contract.methods.approve(address3, 20000).send({from: address1});
          // Transfer
          await shouldFail.reverting.withMessage(this.contract.methods.transferFrom(address1, address2, 11000).send({from: address3}), "RU03");           
        });

        it('reverts when address3 tries to transfer tokens from address1 to address2 and address4 with the right allowance', async function () {
          // Define allowance
          await this.contract.methods.approve(address3, 20000).send({from: address1});
          // Transfer
          await shouldFail.reverting.withMessage(this.contract.methods.bulkTransferFrom(address1, [address2, address4], [2000, 4000]).send({from: address3, gas: 300000}), "RU03");           
        });
      });
    });

    context('Price conversion', function () {
      beforeEach(async function () {
        this.priceOracle = await this.project.createProxy(PriceOracle, {initArgs: [owner]});
        await this.priceOracle.methods.setPrice(web3.utils.fromAscii('TST'), web3.utils.fromAscii('CHF'), '500', 2).send({from: owner, gas: 100000});
        await this.contract.methods.setPriceOracle(this.priceOracle.address).send({from: owner});
      });

      it('can convert price', async function () {
        // 1000 = 1 token in decimals (token is configured with 3 decimals)
        (await this.contract.methods.convertTo(1000, 'CHF', 20).call()).should.equal('50000000000000000000000000000000000000000');
      });
    });

    context('Rules', function () {
      it('can get rules', async function () {
        const ret = await this.contract.methods.rules().call();
        ret['0'].length.should.equal(2);
        ret['0'][0].should.equal('0');
        ret['0'][1].should.equal('1');
        ret['1'][0].should.equal('1');
        ret['1'][1].should.equal('1');
      });

      it('can get single rule', async function () {
        const ret = await this.contract.methods.rule(1).call();
        ret['0'].should.equal('1');
        ret['1'].should.equal('1');
      });
    });

    context('Security model', function () {
      it('reverts if trying to set processor', async function () {
        await shouldFail.reverting.withMessage(this.contract.methods.setProcessor(address1).send({from: address2}), "AD01");
      });

      it('reverts if trying to set realm', async function () {
        await shouldFail.reverting.withMessage(this.contract.methods.setRealm(realm).send({from: address2}), "AD01");
      });

      it('reverts if trying to set trustedIntermediaries', async function () {
        await shouldFail.reverting.withMessage(this.contract.methods.setTrustedIntermediaries([trustedIntermediary1]).send({from: address2}), "AD01");
      });

      it('reverts if trying to set priceOracle', async function () {
        await shouldFail.reverting.withMessage(this.contract.methods.setPriceOracle(address1).send({from: address2}), "AD01");
      });

      it('reverts if trying to add administrator', async function () {
        await shouldFail.reverting(this.contract.methods.addAdministrator(administrator).send({from: address2}));
      });

      it('reverts if trying to remove administrator', async function () {
        await shouldFail.reverting(this.contract.methods.removeAdministrator(administrator).send({from: address2}));
      });

      it('reverts if trying to add realm administrator', async function () {
        await shouldFail.reverting.withMessage(this.contract.methods.addRealmAdministrator(realmAdministrator).send({from: address2}), "AD01");
      });
  
      it('reverts if trying to remove realm administrator', async function () {
        await shouldFail.reverting.withMessage(this.contract.methods.removeRealmAdministrator(realmAdministrator).send({from: address2}), "AD01");
      });

      it('reverts if trying to add seizer', async function () {
        await shouldFail.reverting.withMessage(this.contract.methods.addSeizer(seizer).send({from: address2}), "AD01");
      });

      it('reverts if trying to remove seizer', async function () {
        await shouldFail.reverting.withMessage(this.contract.methods.removeSeizer(seizer).send({from: address2}), "AD01");
      });

      it('reverts if trying to add supplier', async function () {
        await shouldFail.reverting.withMessage(this.contract.methods.addSupplier(supplier).send({from: address2}), "AD01");
      });

      it('reverts if trying to remove supplier', async function () {
        await shouldFail.reverting.withMessage(this.contract.methods.removeSupplier(supplier).send({from: address2}), "AD01");
      });

      it('reverts if trying to set rules', async function () {
        await shouldFail.reverting.withMessage(this.contract.methods.setRules([0, 1], [1, 0]).send({from: address2}), "AD01");
      });

      it('reverts if trying to set contact', async function () {
        await shouldFail.reverting.withMessage(this.contract.methods.setContact('hello@mtpelerin.com').send({from: address2}), "AD01");
      });

      it('reverts if trying to mint tokens', async function () {
        await shouldFail.reverting.withMessage(this.contract.methods.mint(address1, 10000).send({from: address2}), "SU01");
      });

      it('reverts if trying to burn tokens', async function () {
        await shouldFail.reverting.withMessage(this.contract.methods.burn(address1, 10000).send({from: address2}), "SU01");
      });

      it('reverts if trying to seize tokens', async function () {
        await shouldFail.reverting.withMessage(this.contract.methods.seize(address1, 10000).send({from: address2}), "SE02");
      });
    });
  }); 

  context("Storage slots positions", function () {
    it('retains original slot for DOMAIN_SEPARATOR', async function () {
      const data = await web3.eth.getStorageAt(this.contract.address, 261);
      const DOMAIN_SEPARATOR = this.computeDomainSeparator();
      data.should.equal(DOMAIN_SEPARATOR);
    });
  });
});