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

'use strict';

// Required by zos-lib when running from truffle
global.artifacts = artifacts;
global.web3 = web3;

const { Contracts, SimpleProject, ZWeb3 } = require('zos-lib')
ZWeb3.initialize(web3.currentProvider)

// Load the contract.
const rules = [
  'FreezeRule', 'LockRule', 'MaxTransferRule', 'MinTransferRule', 'UserKycThresholdRule', 
  'UserValidRule', 'YesNoRule',
];

const contracts = [
  'PriceOracle', 'AMLRegistry', 'RuleEngine', 'UserRegistry', 'Processor',
  ...rules,
];

const contractObjects = {};
const contractProxies = {};

contracts.forEach((contract) => {
  contractObjects[contract] = Contracts.getFromLocal(contract);
});

async function main() {

  // Instantiate a project.
  const initializerAddress = (await web3.eth.getAccounts())[1];
  const project = new SimpleProject('BridgeProtocol', { from: initializerAddress })

  console.log('Creating an upgradeable instance of PriceOracle...');
  contractProxies.PriceOracle = await project.createProxy(contractObjects.PriceOracle, { initArgs: [initializerAddress] })
  console.log('PriceOracle: ' + contractProxies.PriceOracle.address);

  console.log('Creating an upgradeable instance of AMLRegistry...');
  contractProxies.AMLRegistry = await project.createProxy(contractObjects.AMLRegistry, { initArgs: [initializerAddress] })
  console.log('AMLRegistry: ' + contractProxies.AMLRegistry.address);

  console.log('Creating an upgradeable instance of RuleEngine...');
  contractProxies.RuleEngine = await project.createProxy(contractObjects.RuleEngine, { initArgs: [initializerAddress] })
  console.log('RuleEngine: ' + contractProxies.RuleEngine.address);

  console.log('Creating an upgradeable instance of UserRegistry...');
  contractProxies.UserRegistry = await project.createProxy(contractObjects.UserRegistry, { initArgs: [initializerAddress] })
  console.log('UserRegistry: ' + contractProxies.UserRegistry.address);

  console.log('Creating an upgradeable instance of Processor...')
  contractProxies.Processor = await project.createProxy(contractObjects.Processor, { initArgs: [initializerAddress/*, contractProxies.UserRegistry.address, contractProxies.AMLRegistry.address, contractProxies.RuleEngine.address, contractProxies.PriceOracle.address*/] });
  console.log('Processor: ' + contractProxies.Processor.address);

  /* Rules */
  /*'FreezeRule', 'LockRule', 'MaxTransferRule', 'MinTransferRule', 'UserKycThresholdRule', 
  'UserValidRule', 'YesNoRule',*/

  console.log('Creating an upgradeable instance of FreezeRule...');
  contractProxies.FreezeRule = await project.createProxy(contractObjects.FreezeRule, { initArgs: [initializerAddress] })
  console.log('FreezeRule: ' + contractProxies.FreezeRule.address);

  console.log('Creating an upgradeable instance of LockRule...');
  contractProxies.LockRule = await project.createProxy(contractObjects.LockRule, { initArgs: [initializerAddress] })
  console.log('LockRule: ' + contractProxies.LockRule.address);

  console.log('Creating an upgradeable instance of MaxTransferRule...');
  contractProxies.MaxTransferRule = await project.createProxy(contractObjects.MaxTransferRule, { initArgs: [] })
  console.log('MaxTransferRule: ' + contractProxies.MaxTransferRule.address);

  console.log('Creating an upgradeable instance of MinTransferRule...');
  contractProxies.MinTransferRule = await project.createProxy(contractObjects.MinTransferRule, { initArgs: [] })
  console.log('MinTransferRule: ' + contractProxies.MinTransferRule.address);

  console.log('Creating an upgradeable instance of UserKycThresholdRule...');
  contractProxies.UserKycThresholdRule = await project.createProxy(contractObjects.UserKycThresholdRule, { initArgs: [contractProxies.UserRegistry.address] })
  console.log('UserKycThresholdRule: ' + contractProxies.UserKycThresholdRule.address);

  console.log('Creating an upgradeable instance of UserValidRule...');
  contractProxies.UserValidRule = await project.createProxy(contractObjects.UserValidRule, { initArgs: [contractProxies.UserRegistry.address] })
  console.log('UserValidRule: ' + contractProxies.UserValidRule.address);

  console.log('Setting rules on RuleEngine');
  const result = await contractProxies.RuleEngine.methods.setRules(
    [contractProxies.FreezeRule.address, contractProxies.LockRule.address, contractProxies.MaxTransferRule.address, contractProxies.MinTransferRule.address, contractProxies.UserKycThresholdRule.address, contractProxies.UserValidRule.address]
  ).send();
  console.log(result);
}

// For truffle exec
module.exports = function(callback) {
  main().then(() => callback()).catch(err => callback(err))
};