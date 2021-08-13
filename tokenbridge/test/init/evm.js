/* eslint-disable max-len */
'use strict';

const async = require('async');
const Web3 = require('web3');

const rpcUrl = 'http://localhost:8545';
const web3 = new Web3(rpcUrl);
global.web3 = web3;
require('chai/register-should');
const {TestHelper} = require('@openzeppelin/cli');
const {Contracts, ZWeb3} = require('@openzeppelin/upgrades');
const {ether, expectEvent, shouldFail} = require('openzeppelin-test-helpers');

Contracts.buildDir = '../build/contracts';
Contracts.contractsDir = '../contracts';

ZWeb3.initialize(web3.currentProvider);

const Contract = Contracts.getFromLocal('TokenLocker');
const ERC20Mock = require('../../../build/contracts/ERC20Mock.json');

const accounts = [
  '0xDf08F82De32B8d460adbE8D72043E3a7e25A3B39',
  '0x6704Fbfcd5Ef766B287262fA2281C105d57246a6',
  '0x9E1Ef1eC212F5DFfB41d35d9E5c14054F26c6560',
  '0xce42bdB34189a93c55De250E011c68FaeE374Dd3',
  '0x97A3FC5Ee46852C1Cf92A97B7BaD42F2622267cC',
  '0xB9dcBf8A52Edc0C8DD9983fCc1d97b1F5d975Ed7',
  '0x26064a2E2b568D9A6D01B93D039D1da9Cf2A58CD',
  '0xe84Da28128a48Dd5585d1aBB1ba67276FdD70776',
  '0xCc036143C68A7A9a41558Eae739B428eCDe5EF66',
  '0xE2b3204F29Ab45d5fd074Ff02aDE098FbC381D42',
  '0x5D82c01e0476a0cE11C56b1711FeFf2d80CbB8B6',
  '0x87c490ad2bE5447A61bdED4fac06fC3a2A7542b8',
  '0xeAD3fC31668c1Ea45efEc3De609DEC1ded72cF79',
  '0x85DD021EA241AB4b83A6E08640767d1e9C624e85',
  '0x3c08562EA7E4F77aB3b1105B77CCAde4d078D45A'];

const TOKENBRIDGE = {public: '0x9DDa6711b8Fef7930612B6b91000a2f5626FE95b', private: '0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b750120f'};

const [owner, address1] = accounts;

module.exports = function(done) {
  global.config.evm.tokenbridge = TOKENBRIDGE;
  global.config.evm.address1 = address1;
  global.config.evm.rpcUrl = rpcUrl;
  async.waterfall([
    (cb) => TestHelper().then((project) => cb(null, project)),
    (project, cb) => project.createProxy(Contract, {initArgs: [owner]}).then((contract) => {
      global.config.evm.tokenLocker = contract;
      cb();
    }),
    (cb) => global.config.evm.tokenLocker.methods.addOperator(TOKENBRIDGE.public).send({from: owner}).then(() => cb()),
    (cb) => (new web3.eth.Contract(ERC20Mock.abi)).deploy({data: ERC20Mock.bytecode, arguments: ['TST', 'TST']}).send({from: owner, gas: 10000000}).then((token) => {
      global.config.evm.token = token;
      cb();
    }),
    (cb) => global.config.evm.token.methods.mint(address1, 10000).send({from: owner}).then(() => cb()),
    (cb) => global.config.evm.token.methods.mint(global.config.evm.tokenLocker.address, 100000).send({from: owner}).then(() => cb()),
  ], done);
};

