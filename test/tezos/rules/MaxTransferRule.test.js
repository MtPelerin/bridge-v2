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
global.TextEncoder = require('util').TextEncoder;
const { runOperation, tezosToolkit } = require('../helpers/toolkit');
const { shouldFail } = require('../helpers/shouldFail');
const { BURN_ADDRESS } = require('../helpers/constants');
const ContractBuilder = contract.ContractBuilder;

let tezos = tezosToolkit();

contract('MaxTransferRule', function ([_, owner, token, address1, address2]) {
  beforeEach(async function () {
    tezos.setSignerProvider(new InMemorySigner(owner.sk));
    this.contract = await ContractBuilder.new(tezos, 'ligo/rules/MaxTransferRule.ligo', {}, {});
    this.callback = await ContractBuilder.new(tezos, 'ligo/mocks/RuleCallback.ligo', {}, {
      valid_: 0,
      reason_: 0,
    });
  });

  context('Check transfer validity', function () {
    it('returns that transfer is valid if amount is less than maxAmount', async function () {
      await runOperation(tezos, owner, () => this.contract.methods.isTransferValid(10000, 10000, this.callback.address, address1.pkh, BURN_ADDRESS, 15000, address2.pkh, token.pkh, []).send());
      const result = await this.callback.storage();
      result.reason_.should.be.bignumber.equal('0');
      result.valid_.should.be.bignumber.equal('1');
    });
    it('returns that transfer is valid if amount is equal to maxAmount', async function () {
      await runOperation(tezos, owner, () => this.contract.methods.isTransferValid(15000, 15000, this.callback.address, address1.pkh, BURN_ADDRESS, 15000, address2.pkh, token.pkh, []).send());
      const result = await this.callback.storage();
      result.reason_.should.be.bignumber.equal('0');
      result.valid_.should.be.bignumber.equal('1');
    });
    it('returns that transfer is invalid if amount is more than maxAmount', async function () {
      await runOperation(tezos, owner, () => this.contract.methods.isTransferValid(20000, 20000, this.callback.address, address1.pkh, BURN_ADDRESS, 15000, address2.pkh, token.pkh, []).send());
      const result = await this.callback.storage();
      result.reason_.should.be.bignumber.equal('1');
      result.valid_.should.be.bignumber.equal('0');
    });
  });

  context('Update after transfer', function () {
    it('should revert if trying to update', async function () {
      await shouldFail(runOperation(tezos, owner, () => this.contract.methods.afterTransferHook(10000, 10000, this.callback.address, address1.pkh, BURN_ADDRESS, 0, address2.pkh, token.pkh, []).send()), "RU02");
    });
  });
});