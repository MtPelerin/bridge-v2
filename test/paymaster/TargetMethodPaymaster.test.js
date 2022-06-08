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

const { expectEvent, shouldFail } = require('openzeppelin-test-helpers');
require('chai').should()

const Contract = artifacts.require('TargetMethodPaymaster');

contract('TargetMethodPaymaster', function ([_, owner, target1, target2, senderAddress, relayWorker, paymaster, forwarder, address1]) {
  const method1 = '0x2a4a1b73';
  const method2 = '0xa4e9b2c4';
  const relayRequest1 = {
    target: target1,
    encodedFunction: method1 + '000000000000000000000000ce42bdb34189a93c55de250e011c68faee374dd300000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
    relayData: {
      senderAddress,
      senderNonce: '0',
      relayWorker,
      paymaster,
      forwarder
    },
    gasData: {
      pctRelayFee: '1',
      baseRelayFee: '0',
      gasPrice: '30',
      gasLimit: 1e6.toString()
    }
  };

  const relayRequest2 = {
    target: target1,
    encodedFunction: method2 + '000000000000000000000000ce42bdb34189a93c55de250e011c68faee374dd300000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
    relayData: {
      senderAddress,
      senderNonce: '0',
      relayWorker,
      paymaster,
      forwarder
    },
    gasData: {
      pctRelayFee: '1',
      baseRelayFee: '0',
      gasPrice: '30',
      gasLimit: 1e6.toString()
    }
  };

  const relayRequest3 = {
    target: target2,
    encodedFunction: method1 + '000000000000000000000000ce42bdb34189a93c55de250e011c68faee374dd300000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
    relayData: {
      senderAddress,
      senderNonce: '0',
      relayWorker,
      paymaster,
      forwarder
    },
    gasData: {
      pctRelayFee: '1',
      baseRelayFee: '0',
      gasPrice: '30',
      gasLimit: 1e6.toString()
    }
  };

  beforeEach(async function () {
    this.contract = await Contract.new({ from: owner });
  });

  context('Owner', () => {
    it('can set accepted target-method pairs', async function () {
      ({ logs: this.logs } = await this.contract.setTarget(target1, [method1, method2], { from: owner }));
    });

    it('emits a TargetMethodUpdated event', function () {
      expectEvent.inLogs(this.logs, 'TargetMethodUpdated', { target: target1 });
    });
  });

  context('Standard user', () => {
    it('reverts if trying to set accepted target-method pairs', async function () {
      await shouldFail.reverting(this.contract.setTarget(target1, [method1, method2], { from: address1 }))
    });
  });

  context('Nothing has been added to the whitelist', () => {
    it('reverts if relayed calls is not accepted', async function () {
      await shouldFail.reverting.withMessage(this.contract.acceptRelayedCall(relayRequest1, '0x', '0x', 1e6), "PM01");
    });
  })

  context('One method added to whitelist for a single target contract', () => {
    beforeEach(async function () {
      await this.contract.setTarget(target1, [method1], { from: owner });
    });

    it('accepts relayed calls for whitelisted target-method pair', async function () {
      await this.contract.acceptRelayedCall(relayRequest1, '0x', '0x', 1e6);
    });

    it('reverts if relayed calls is not accepted', async function () {
      await shouldFail.reverting.withMessage(this.contract.acceptRelayedCall(relayRequest2, '0x', '0x', 1e6), "PM01");
      await shouldFail.reverting.withMessage(this.contract.acceptRelayedCall(relayRequest3, '0x', '0x', 1e6), "PM01");
    });
  });

  context('One method added to whitelist for a multiple target contracts', () => {
    beforeEach(async function () {
      await this.contract.setTarget(target1, [method1], { from: owner });
      await this.contract.setTarget(target2, [method1], { from: owner });
    });

    it('accepts relayed calls for whitelisted target-method pair', async function () {
      await this.contract.acceptRelayedCall(relayRequest1, '0x', '0x', 1e6);
      await this.contract.acceptRelayedCall(relayRequest3, '0x', '0x', 1e6);
    });

    it('reverts if relayed calls is not accepted', async function () {
      await shouldFail.reverting.withMessage(this.contract.acceptRelayedCall(relayRequest2, '0x', '0x', 1e6), "PM01");
    });
  });

  context('Mutliple methods added to whitelist for a single target contract', () => {
    beforeEach(async function () {
      await this.contract.setTarget(target1, [method1, method2], { from: owner });
    });

    it('accepts relayed calls for whitelisted target-method pair', async function () {
      await this.contract.acceptRelayedCall(relayRequest1, '0x', '0x', 1e6);
      await this.contract.acceptRelayedCall(relayRequest2, '0x', '0x', 1e6);
    });

    it('reverts if relayed calls is not accepted', async function () {
      await shouldFail.reverting.withMessage(this.contract.acceptRelayedCall(relayRequest3, '0x', '0x', 1e6), "PM01");
    });
  });
});