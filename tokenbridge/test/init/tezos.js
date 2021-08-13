/* eslint-disable max-len */
'use strict';

const path = require('path');
const chai = require('chai');
const async = require('async');
chai.use(require('chai-bignumber')());
require('chai/register-should');
const contract = require('../../../test/tezos/helpers/contract');
const {InMemorySigner} = require('@taquito/signer');
const {MichelsonMap} = require('@taquito/michelson-encoder');
const {packDataBytes} = require('@taquito/michel-codec');
global.TextEncoder = require('util').TextEncoder;
const {runOperation, tezosToolkit} = require('../../../test/tezos/helpers/toolkit');
const {shouldFail} = require('../../../test/tezos/helpers/shouldFail');
const {BURN_ADDRESS} = require('../../../test/tezos/helpers/constants');
const ContractBuilder = contract.ContractBuilder;

let tezos = tezosToolkit();
let CWD = path.resolve(process.cwd(), '..');

const DEFAULT_IS_TRANSFER_VALID_PARAM = {
  amount_: 0,
  amountInRefCurrency_: 0,
  from_: BURN_ADDRESS,
  realm_: BURN_ADDRESS,
  rules_: [],
  to_: BURN_ADDRESS,
  token_: BURN_ADDRESS,
  trustedIntermediaries_: [],
  canTransferCallbackAddress_: BURN_ADDRESS,
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
  canTransferCallbackAddress_: BURN_ADDRESS,
};

module.exports = function(done) {
  contract('TokenLocker', ([owner, realm, address1, trustedIntermediary1, trustedIntermediary2, tokenbridge]) => {
    global.config.tezos.run = {};
    global.config.tezos.run.tezos = tezos;
    global.config.tezos.run.owner = owner;
    global.config.tezos.run.runOperation = runOperation;
    global.config.tezos.tokenbridge = tokenbridge;
    global.config.tezos.address1 = address1;
    global.config.tezos.rpcUrl = 'http://localhost:8732';
    tezos.setSignerProvider(new InMemorySigner(owner.sk));
    async.waterfall([
      (cb) => ContractBuilder.new(tezos, 'ligo/tokenbridge/TokenLocker.ligo', {cwd: CWD}, {
        owner: owner.pkh,
        roles: new MichelsonMap(),
        events: new MichelsonMap(),
      }).then((contract) => {
        global.config.tezos.tokenLocker = contract;
        cb();
      }),
      (cb) => runOperation(tezos, owner, () => global.config.tezos.tokenLocker.methods.addOperator(tokenbridge.pkh).send()).then(() => cb()),
      (cb) => ContractBuilder.new(tezos, 'ligo/rules/YesNoRule.ligo', {cwd: CWD}, {}).then((contract) => {
        global.config.tezos.yesNo = contract;
        cb();
      }),
      (cb) => ContractBuilder.new(tezos, 'ligo/rules/YesNoUpdateRule.ligo', {cwd: CWD}, '0').then((contract) => {
        global.config.tezos.yesNoUpdate = contract;
        cb();
      }),
      (cb) => {
        const rules = new MichelsonMap();
        rules.set(0, global.config.tezos.yesNo.address);
        rules.set(1, global.config.tezos.yesNoUpdate.address);
        ContractBuilder.new(tezos, 'ligo/operating/RuleEngine.ligo', {cwd: CWD}, {
          owner: owner.pkh,
          roles: new MichelsonMap(),
          rules,
          internalState: {
            isTransferValidParam_: DEFAULT_IS_TRANSFER_VALID_PARAM,
            ruleResponses_: new MichelsonMap(),
            beforeTransferHookParam_: DEFAULT_BEFORE_TRANSFER_HOOK_PARAM,
          },
        }).then((contract) => {
          global.config.tezos.ruleEngine = contract;
          cb();
        });
      },
      (cb) => ContractBuilder.new(tezos, 'ligo/token/ShareBridgeToken.ligo', {cwd: CWD}, {
        owner: owner.pkh,
        roles: new MichelsonMap(),
        name: 'Test token',
        symbol: 'TST',
        decimals: 0,
        totalSupply: 0,
        balances: new MichelsonMap(),
        allowances: new MichelsonMap(),
        rules: [],
        trustedIntermediaries: [trustedIntermediary1.pkh, trustedIntermediary2.pkh],
        realm: realm.pkh,
        prices: new MichelsonMap(),
        ruleEngine: global.config.tezos.ruleEngine.address,
        contact: '',
        tokenizedSharePercentage: 100,
        boardResolutionDocumentHash: '',
        boardResolutionDocumentUrl: '',
        tempRealm: BURN_ADDRESS,
      }).then((contract) => {
        global.config.tezos.token = contract;
        cb();
      }),
      (cb) => runOperation(tezos, owner, () => global.config.tezos.token.methods.addSupplier(owner.pkh).send()).then(() => cb()),
      (cb) => runOperation(tezos, owner, () => global.config.tezos.token.methods.mint(10000, address1.pkh).send()).then(() => cb()),
      (cb) => runOperation(tezos, owner, () => global.config.tezos.token.methods.mint(100000, global.config.tezos.tokenLocker.address).send()).then(() => cb()),
      (cb) => runOperation(tezos, address1, () => global.config.tezos.token.methods.approve(7000, global.config.tezos.tokenLocker.address).send()).then(() => cb()),
    ], done);
  });
};
