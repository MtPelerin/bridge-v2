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

require('chai/register-should');
const { TestHelper } = require('@openzeppelin/cli');
const { Contracts, ZWeb3 } = require('@openzeppelin/upgrades');
const { expectEvent, shouldFail } = require('openzeppelin-test-helpers');

ZWeb3.initialize(web3.currentProvider);

const Contract = Contracts.getFromLocal('VestingRule');
const ComplianceRegistry = Contracts.getFromLocal('ComplianceRegistry');

const timestamp = function () {
  return Math.floor(new Date().getTime()/1000);
};

contract('VestingRule', function ([_, owner, token, address1, address2]) {
  beforeEach(async function () {
    this.project = await TestHelper();
    this.complianceRegistry = await this.project.createProxy(ComplianceRegistry, {initArgs: [owner]});
    await this.complianceRegistry.methods.registerUser(address2, [140], [1]).send({from: trustedIntermediary1, gas: 900000});
    await this.complianceRegistry.methods.registerUser(address1, [], []).send({from: trustedIntermediary1, gas: 900000});
    this.contract = await this.project.createProxy(Contract, {initArgs: [owner, this.complianceRegistry.address]});
  });

  it('can get the contract version', async function () {
    (await this.contract.methods.VERSION().call()).should.equal('1');
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

      it('allows transfers', async function () {
        const ret = await this.contract.methods.isTransferValid(token, address1, address2, 100, 0).call();
        ret['0'].should.equal('1');
        ret['1'].should.equal('0');
      });
    });
  });

});