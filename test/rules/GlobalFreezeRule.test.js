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
const { TestHelper } = require('@openzeppelin/cli');
const { Contracts, ZWeb3 } = require('@openzeppelin/upgrades');
const { expectEvent, shouldFail } = require('openzeppelin-test-helpers');

ZWeb3.initialize(web3.currentProvider);

const Contract = Contracts.getFromLocal('GlobalFreezeRule');

const timestamp = function () {
  return Math.floor(new Date().getTime()/1000);
};

contract('GlobalFreezeRule', function ([_, owner, operator, token, address1, address2]) {
  beforeEach(async function () {
    this.project = await TestHelper();
    this.contract = await this.project.createProxy(Contract, {initArgs: [owner]});
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

    it('can freeze transfers', async function () {
      (await this.contract.methods.allFrozenUntil().call()).should.equal('0');
      this.timestamp = '' + (timestamp() + 3600);
      ({events: this.events} = await this.contract.methods.freezeAll(this.timestamp).send({from: operator}));
      (await this.contract.methods.allFrozenUntil().call()).should.equal(this.timestamp);
    });

    it('emits a GlobalFreeze event', function () {
      this.events.should.have.property('GlobalFreeze');
      this.events.GlobalFreeze.returnValues.should.have.property('until', this.timestamp);
    });

    it('reverts if trying to freeze with end date in the past', async function () {
      this.timestamp = '' + (timestamp() - 3600);
      await shouldFail.reverting.withMessage(this.contract.methods.freezeAll(this.timestamp).send({from: operator}), "GF01");
    });

    it('can unfreeze transfers', async function () {
      (await this.contract.methods.allFrozenUntil().call()).should.equal('0');
      this.timestamp = '' + (timestamp() + 3600);
      await this.contract.methods.freezeAll(this.timestamp).send({from: operator});
      (await this.contract.methods.allFrozenUntil().call()).should.equal(this.timestamp);
      ({events: this.events} = await this.contract.methods.unfreezeAll().send({from: operator}));
    });

    it('emits a GlobalUnfreeze event', function () {
      this.events.should.have.property('GlobalUnfreeze');
    });
  });

  context('When initial state', function () {
    it('allows transfers', async function () {
      const ret = await this.contract.methods.isTransferValid(token, address1, address2, 100, 0).call();
      ret['0'].should.equal('1');
      ret['1'].should.equal('0');
    });
  });

  context('When frozen', function () {
    beforeEach(async function () {
      await this.contract.methods.addOperator(operator).send({from: owner});
      this.timestamp = '' + (timestamp() + 3600);
      // Freeze
      await this.contract.methods.freezeAll(this.timestamp).send({from: operator});
    });

    it('rejects transfers', async function () {
      const ret = await this.contract.methods.isTransferValid(token, address1, address2, 100, 0).call();
      ret['0'].should.equal('0');
      ret['1'].should.equal('1');
    });

    context('When unfrozen', function () {
      beforeEach(async function () {
        // Unfreeze
        await this.contract.methods.unfreezeAll().send({from: operator});
      });

      it('allows transfers', async function () {
        const ret = await this.contract.methods.isTransferValid(token, address1, address2, 100, 0).call();
        ret['0'].should.equal('1');
        ret['1'].should.equal('0');
      });
    });
  });

  context('When standard user', function () {
    it('reverts if trying to freeze', async function () {
      this.timestamp = '' + (timestamp() + 3600);
      await shouldFail.reverting.withMessage(this.contract.methods.freezeAll(this.timestamp).send({from: address1}), "OP01");
    });

    it('reverts if trying to unfreeze', async function () {
      await shouldFail.reverting.withMessage(this.contract.methods.unfreezeAll().send({from: address1}), "OP01");
    });
  });

  context('Update after transfer', function () {
    it('should revert if trying to update', async function () {
      await shouldFail.reverting.withMessage(this.contract.methods.afterTransferHook(token, address1, address2, 10000, 15000).send({from: address1}), "RU02");
    });
  });
});