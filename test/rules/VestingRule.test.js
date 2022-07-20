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
const { MAX_UINT256 } = require('openzeppelin-test-helpers/src/constants');

ZWeb3.initialize(web3.currentProvider);

const Contract = Contracts.getFromLocal('VestingRule');
const ComplianceRegistry = Contracts.getFromLocal('ComplianceRegistry');
const GovernableTokenMock = artifacts.require('OwnableGovernableTokenMock');
let token;

const TRANSFER_VALID = '1';
const TRANSFER_INVALID = '0';

const REASON_OK = '0';
const REASON_USER_NOT_FOUND = '1';
const REASON_TRANSFERS_FROZEN_VESTING = '2';

const BYPASS_KEY = 140;

const currentTimestamp = function () {
  return Math.floor(new Date().getTime()/1000);
};

const futureTimestamp = currentTimestamp() + 3600;

contract('VestingRule', function ([_, tokenOwner, owner, trustedIntermediary1, address1, address2, address3, address4, address5]) {
  beforeEach(async function () {
    this.project = await TestHelper();
    this.complianceRegistry = await this.project.createProxy(ComplianceRegistry, {initArgs: [owner]});
    await this.complianceRegistry.methods.registerUsers([address1, address2], [0, 100, 110, 111, 112], [1874872800, 1, 10000, 15000, 180000]).send({from: trustedIntermediary1, gas: 900000});
    await this.complianceRegistry.methods.registerUser(address3, [BYPASS_KEY], [1]).send({from: trustedIntermediary1, gas: 900000});

    this.contract = await this.project.createProxy(Contract, {initArgs: [this.complianceRegistry.address]});
    this.governableTokenMock = await GovernableTokenMock.new({ from: tokenOwner });
    token = this.governableTokenMock.address;
    await this.governableTokenMock.setTrustedIntermediaries([trustedIntermediary1]);

  });

  it('can get the contract version', async function () {
    (await this.contract.methods.VERSION().call()).should.equal('1');
  });

  context('When initial state', function () {
    it('allows transfers', async function () {
      const ret = await this.contract.methods.isTransferValid(token, address1, address2, 100, 0).call();
      ret['0'].should.equal(TRANSFER_VALID);
      ret['1'].should.equal(REASON_OK);
    });
  });

  context('When frozen', function () {

    it('user not found', async function () {
      const ret = await this.contract.methods.isTransferValid(token, address1, address4, 100, futureTimestamp).call();
      ret['0'].should.equal(TRANSFER_INVALID);
      ret['1'].should.equal(REASON_USER_NOT_FOUND);
    });

    it('use bypass key', async function () {
      const ret = await this.contract.methods.isTransferValid(token, address1, address3, 100,futureTimestamp).call();
      ret['0'].should.equal(TRANSFER_VALID);
      ret['1'].should.equal(REASON_OK);
    });

    it('from toker owner', async function () {
      const ret = await this.contract.methods.isTransferValid(token, tokenOwner, address2, 100, futureTimestamp).call();
      ret['0'].should.equal(TRANSFER_VALID);
      ret['1'].should.equal(REASON_OK);
    });

    it('rejects transfers', async function () {
      const ret = await this.contract.methods.isTransferValid(token, address1, address2, 100, futureTimestamp).call();
      ret['0'].should.equal(TRANSFER_INVALID);
      ret['1'].should.equal(REASON_TRANSFERS_FROZEN_VESTING);
    });
  });

    context('When unfrozen', function () {

      it('allows transfers', async function () {
        const ret = await this.contract.methods.isTransferValid(token, address1, address2, 100, 0).call();
        ret['0'].should.equal(TRANSFER_VALID);
        ret['1'].should.equal(REASON_OK);
      });
    });

});