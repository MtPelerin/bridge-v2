/* eslint-disable max-len */
'use strict';

var app, supertest;

const chai = require('chai');
chai.use(require('chai-bignumber')());
const web3Utils = require('web3-utils');

/* eslint camelcase: ["error", {properties: "never"}] */
/* global api:true data:true */
/* eslint no-undef: "error" */

const _toEVMBytes = (str) => web3Utils.fromAscii(str);
const _toTezosBytes = (str) => _toEVMBytes(str).replace('0x', '');

describe('Transfer test suite', function() {
  before(function(done) {
    process.env.BRIDGE_INTERVAL = 99999999999;
    process.env.CONFIRMATIONS = 0;

    process.env.CHAIN1_NAME = 'Ethereum';
    process.env.CHAIN1_TYPE = 'evm';
    process.env.CHAIN1_LOCKER = global.config.evm.tokenLocker.address;
    process.env.CHAIN1_ADDRESS = global.config.evm.tokenbridge.public;
    process.env.CHAIN1_PRIVATE_KEY = global.config.evm.tokenbridge.private;
    process.env.CHAIN1_RPC_URL = global.config.evm.rpcUrl;
    process.env.CHAIN1_CHAIN_ID = 1;
    process.env.CHAIN1_DEFAULT_BLOCK = 1;

    process.env.CHAIN2_NAME = 'Tezos';
    process.env.CHAIN2_TYPE = 'tezos';
    process.env.CHAIN2_LOCKER = global.config.tezos.tokenLocker.address;
    process.env.CHAIN2_ADDRESS = global.config.tezos.tokenbridge.pkh;
    process.env.CHAIN2_PRIVATE_KEY = global.config.tezos.tokenbridge.sk;
    process.env.CHAIN2_RPC_URL = global.config.tezos.rpcUrl;
    process.env.CHAIN2_CHAIN_ID = 1;
    process.env.CHAIN2_DEFAULT_BLOCK = 1;

    const tokenMapping = {};
    tokenMapping[global.config.tezos.token.address] = global.config.evm.token._address;
    tokenMapping[global.config.evm.token._address] = global.config.tezos.token.address;

    process.env.TOKEN_MAPPING = JSON.stringify(tokenMapping);

    global.config.evm.token.methods.transferAndCall(global.config.evm.tokenLocker.address, 5000, _toEVMBytes(global.config.tezos.address1.pkh)).send({from: global.config.evm.address1}).then(() => {
      global.config.tezos.run.runOperation(global.config.tezos.run.tezos, global.config.tezos.address1, () => global.config.tezos.tokenLocker.methods.lock(_toTezosBytes(global.config.evm.address1), global.config.tezos.token.address, 7000).send()).then(() => {
        done();
      });
    });
  });
  describe('Has processed tokens', function() {
    it('should fail', function(done) {
      app = require('../../server/server');
      setTimeout(() => {
        app.models.Transfer.processTokenBridge(async function () {
          //Execute random operation to force block mining
          await global.config.tezos.run.runOperation(global.config.tezos.run.tezos, global.config.tezos.run.owner, () => global.config.tezos.tokenLocker.methods.removeOperator(global.config.tezos.tokenbridge.pkh).send());
          (await global.config.evm.token.methods.balanceOf(global.config.evm.tokenLocker.address).call()).should.equal('98000');
          (await global.config.evm.token.methods.balanceOf(global.config.evm.address1).call()).should.equal('12000');
          (await (await global.config.tezos.token.storage()).balances.get(global.config.tezos.address1.pkh)).should.be.bignumber.equal(8000);
          (await (await global.config.tezos.token.storage()).balances.get(global.config.tezos.tokenLocker.address)).should.be.bignumber.equal(102000);
          done();
        });
      }, 5000);
    });
  });
  /* describe('Create some data and verify security model', function() {
    before(function(done) {
      data.users = {
        consumer1: '33bb6896-4104-46a6-b727-fb6ae50828b7',
        consumer2: '4e81f406-a92f-4428-bd35-b92d9c174a4a',
        consumer3: 'dbe985dc-050d-4bb7-9391-fced762f2317',
        consumer4: '57fd174e-cf7c-4c3d-b3ce-d76a1f647c4f',
        reader1: '164146e0-e52e-403d-87ad-ba2c47b5fece',
        writer1: '5fe5df52-e3f1-4615-a127-59614aaecf9f',
        admin1: 'ea67b844-725e-434f-b843-2c83264666ae',
        orgConsumer1: '0ace01a5-a604-4e9d-b64e-3a0a0d4d74bc',
        orgConsumer2: '00237d18-4e75-4a52-bddc-82894914363e',
        orgReader1: '1f339b95-bad7-4fa5-9faf-30646b4b0ad8',
        orgReader2: '0ceb6ae9-aa98-48fd-92ac-2c09e3a67c50',
        orgWriter1: '9ecb99ec-ba8e-411f-82c3-ff5c3b3cbe2b',
        orgWriter2: 'ac05f96e-b3c6-42d0-bb48-0a218f518d69',
        orgAdmin1: '6860dc7b-1d47-4fda-8216-cb39114ceddd',
        orgAdmin2: 'c938fb8f-66af-4c17-86b7-d8d7fc67af5e',
      };
      done();
    });

    it('should not be able to create data as standard user', function(done) {
      api.post('/api/accounts')
      .set('x-consumer-username', data.users.consumer1)
      .set('x-consumer-groups', 'smex-authenticated-user')
      .send({
        title: 'Should not exist',
      })
      .expect(401, done);
    });

    describe('smex write security model', function() {
      it('should not be able to create data as reader user', function(done) {
        api.post('/api/accounts')
        .set('x-consumer-username', data.users.reader1)
        .set('x-consumer-groups', 'smex-account-reader')
        .send({
          title: 'Should not exist',
        })
        .expect(401, done);
      });

      it('should be able to create data as a writer user with scope autopopulation to user_id value', function(done) {
        api.post('/api/accounts')
        .set('x-consumer-username', data.users.writer1)
        .set('x-consumer-groups', 'smex-account-writer')
        .send({
          type: 'external',
          status: 'active',
          bank_code: 'MPL',
          bank_name: 'Mt Pelerin',
          currency: 'CHF',
          iban: 'CH2700666987654323CHF',
          owner_email: 'hello@smex.tech',
          owner_firstname: 'Smex',
          owner_lastname: 'Tech',
          owner_companyname: 'SMEx',
          owner_phone: '+41 22 123 45 67',
          owner_street: 'Place de la Fusterie, 5bis',
          owner_postcode: '1201',
          owner_city: 'Geneva',
          owner_country: 'CH',
          economic_context: 'employer',
          funds_origin: 'salary',
          source_name: 'Ibani SA',
          source_email: 'hello@ibani.com',
          comment: 'My CHF salary from Ibani',
          communication: 'Salary from Ibani',
          reference: 'IBANI1234567890',
          verified_date: new Date(),
          user_id: data.users.consumer1,
          user_is_owner: 'false',
          locked: 'false',
          amount: 0,
          balance: 0,
          linked_accounts: [],
        })
        .expect(200)
        .expect(function(res) {
          data.accounts[0] = res.body;
          res.body.should.have.property('user_id', data.users.consumer1);
          res.body.should.have.property('scope_id', data.users.consumer1);
          res.body.should.have.property('reference', 'IBANI1234567890');
        })
        .end(done);
      });

      it('should be able to create data as an admin user with a specific scope', function(done) {
        api.post('/api/accounts')
        .set('x-consumer-username', data.users.admin1)
        .set('x-consumer-groups', 'smex-account-admin')
        .send({
          type: 'external',
          status: 'active',
          bank_code: 'MPL',
          bank_name: 'Mt Pelerin',
          currency: 'CHF',
          iban: 'CH7400666987654324CHF',
          owner_email: 'hello@smex.tech',
          owner_firstname: 'Smex',
          owner_lastname: 'Tech',
          owner_companyname: 'SMEx',
          owner_phone: '+41 22 123 45 67',
          owner_street: 'Place de la Fusterie, 5bis',
          owner_postcode: '1201',
          owner_city: 'Geneva',
          owner_country: 'CH',
          economic_context: 'employer',
          funds_origin: 'salary',
          source_name: 'Ibani SA',
          source_email: 'hello@ibani.com',
          comment: 'My CHF salary from Ibani',
          communication: 'Salary from Ibani',
          reference: 'IBANI1234567891',
          verified_date: new Date(),
          user_id: data.users.consumer2,
          scope_id: data.users.consumer1,
          user_is_owner: 'false',
          locked: 'false',
          amount: 0,
          balance: 0,
          linked_accounts: [],
        })
        .expect(200)
        .expect(function(res) {
          data.accounts[1] = res.body;
          res.body.should.have.property('user_id', data.users.consumer2);
          res.body.should.have.property('scope_id', data.users.consumer1);
          res.body.should.have.property('reference', 'IBANI1234567891');
        })
        .end(done);
      });
    });

    describe('Org security model', function() {
      it('should not be able to create data as an org reader user', function(done) {
        api.post('/api/accounts')
        .set('x-consumer-username', data.users.orgReader1)
        .set('x-consumer-groups', 'org-.IBA-account-reader')
        .send({
          title: 'Should not exist',
        })
        .expect(401, done);
      });

      it('should be able to create data as an org writer user with scope autopopulation to user_id value', function(done) {
        api.post('/api/accounts')
        .set('x-consumer-username', data.users.orgWriter1)
        .set('x-consumer-groups', 'org-.IBA-account-writer')
        .send({
          type: 'external',
          status: 'active',
          bank_code: 'MPL',
          bank_name: 'Mt Pelerin',
          currency: 'CHF',
          iban: 'CH2700666987654323CHF',
          owner_email: 'hello@smex.tech',
          owner_firstname: 'Smex',
          owner_lastname: 'Tech',
          owner_companyname: 'SMEx',
          owner_phone: '+41 22 123 45 67',
          owner_street: 'Place de la Fusterie, 5bis',
          owner_postcode: '1201',
          owner_city: 'Geneva',
          owner_country: 'CH',
          economic_context: 'employer',
          funds_origin: 'salary',
          source_name: 'Ibani SA',
          source_email: 'hello@ibani.com',
          comment: 'My CHF salary from Ibani',
          communication: 'Salary from Ibani',
          reference: 'IBANI1234567890',
          verified_date: new Date(),
          user_id: data.users.orgConsumer1,
          user_is_owner: 'false',
          locked: 'false',
          amount: 0,
          balance: 0,
          linked_accounts: [],
        })
        .expect(200)
        .expect(function(res) {
          data.accounts[100] = res.body;
          res.body.should.have.property('user_id', data.users.orgConsumer1);
          res.body.should.have.property('scope_id', data.users.orgConsumer1);
          res.body.should.have.property('reference', 'IBANI1234567890');
        })
        .end(done);
      });

      it('should be able to create data as an org admin user with a specific scope', function(done) {
        api.post('/api/accounts')
      .set('x-consumer-username', data.users.orgAdmin1)
      .set('x-consumer-groups', 'org-.IBA-account-admin')
      .send({
        type: 'external',
        status: 'active',
        bank_code: 'MPL',
        bank_name: 'Mt Pelerin',
        currency: 'CHF',
        iban: 'CH7400666987654324CHF',
        owner_email: 'hello@smex.tech',
        owner_firstname: 'Smex',
        owner_lastname: 'Tech',
        owner_companyname: 'SMEx',
        owner_phone: '+41 22 123 45 67',
        owner_street: 'Place de la Fusterie, 5bis',
        owner_postcode: '1201',
        owner_city: 'Geneva',
        owner_country: 'CH',
        economic_context: 'employer',
        funds_origin: 'salary',
        source_name: 'Ibani SA',
        source_email: 'hello@ibani.com',
        comment: 'My CHF salary from Ibani',
        communication: 'Salary from Ibani',
        reference: 'IBANI1234567891',
        verified_date: new Date(),
        user_id: data.users.orgConsumer2,
        scope_id: data.users.orgConsumer1,
        user_is_owner: 'false',
        locked: 'false',
        amount: 0,
        balance: 0,
        linked_accounts: [],
      })
      .expect(200)
      .expect(function(res) {
        data.accounts[101] = res.body;
        res.body.should.have.property('user_id', data.users.orgConsumer2);
        res.body.should.have.property('scope_id', data.users.orgConsumer1);
        res.body.should.have.property('reference', 'IBANI1234567891');
      })
      .end(done);
      });

      it('should be able to retrieve accounts as an org reader user', function(done) {
        api.get('/api/accounts')
      .set('x-consumer-username', data.users.orgReader1)
      .set('x-consumer-groups', 'org-.IBA-account-reader')
      .expect(200)
      .expect(function(res) {
        res.body.should.be.an.Array();
        res.body.should.have.length(2);
      })
      .end(done);
      });

      it('should be able to retrieve accounts as an org admin user', function(done) {
        api.get('/api/accounts')
      .set('x-consumer-username', data.users.orgAdmin1)
      .set('x-consumer-groups', 'org-.IBA-account-admin')
      .expect(200)
      .expect(function(res) {
        res.body.should.be.an.Array();
        res.body.should.have.length(2);
      })
      .end(done);
      });

      it('should not be able to override orgs as an org writer user', function(done) {
        data.accounts[100].orgs = '.IBA,.MTP';
        api.put('/api/accounts')
        .set('x-consumer-username', data.users.orgWriter1)
        .set('x-consumer-groups', 'org-.IBA-account-writer')
        .send(data.accounts[100])
        .expect(200)
        .expect(function(res) {
          res.body.should.have.property('user_id', data.users.orgConsumer1);
          res.body.should.have.property('scope_id', data.users.orgConsumer1);
          res.body.should.have.property('orgs', '.IBA');
        })
        .end(done);
      });

      it('should be able to override orgs as an org admin user', function(done) {
        data.accounts[101].orgs = '.IBA,.MTP';
        api.put('/api/accounts')
        .set('x-consumer-username', data.users.orgAdmin1)
        .set('x-consumer-groups', 'org-.IBA-account-admin')
        .send(data.accounts[101])
        .expect(200)
        .expect(function(res) {
          res.body.should.have.property('user_id', data.users.orgConsumer2);
          res.body.should.have.property('scope_id', data.users.orgConsumer1);
          res.body.should.have.property('orgs', '.IBA,.MTP');
        })
        .end(done);
      });

      it('should be able to retrieve accounts as an another org reader user', function(done) {
        api.get('/api/accounts')
      .set('x-consumer-username', data.users.orgReader2)
      .set('x-consumer-groups', 'org-.MTP-account-reader')
      .expect(200)
      .expect(function(res) {
        res.body.should.be.an.Array();
        res.body.should.have.length(1);
      })
      .end(done);
      });
    });

    describe('Standard user security model', function() {
      it('should be able to retrieve accounts as standard user', function(done) {
        api.get('/api/accounts')
        .set('x-consumer-username', data.users.consumer1)
        .set('x-consumer-groups', 'smex-authenticated-user')
        .expect(200)
        .expect(function(res) {
          res.body.should.be.an.Array();
          res.body.should.have.length(1);
          res.body[0].should.have.property('user_id', data.users.consumer1);
          res.body[0].should.have.property('scope_id', data.users.consumer1);
        })
        .end(done);
      });

      it('should not be able to retrieve accounts for a specific scope as standard user if scope has not been granted', function(done) {
        api.get('/api/accounts')
        .set('x-consumer-username', data.users.consumer1)
        .set('x-consumer-scope', data.users.consumer1)
        .set('x-consumer-groups', 'smex-authenticated-user')
        .expect(200)
        .expect(function(res) {
          res.body.should.be.an.Array();
          res.body.should.have.length(1);
          res.body[0].should.have.property('user_id', data.users.consumer1);
          res.body[0].should.have.property('scope_id', data.users.consumer1);
        })
        .end(done);
      });

      it('should be able to retrieve accounts for a specific scope as standard user if scope has been granted', function(done) {
        api.get('/api/accounts')
        .set('x-consumer-username', data.users.consumer1)
        .set('x-consumer-scope', data.users.consumer1)
        .set('x-consumer-groups', 'smex-authenticated-user,' +  data.users.consumer1 + '-reader')
        .expect(200)
        .expect(function(res) {
          res.body.should.be.an.Array();
          res.body.should.have.length(2);
          res.body[0].should.have.property('user_id', data.users.consumer1);
          res.body[0].should.have.property('scope_id', data.users.consumer1);
          res.body[1].should.have.property('user_id', data.users.consumer2);
          res.body[1].should.have.property('scope_id', data.users.consumer1);
        })
        .end(done);
      });

      it('should not be able to retrieve accounts for a specific scope as standard user if scope writer only has been granted', function(done) {
        api.get('/api/accounts')
        .set('x-consumer-username', data.users.consumer1)
        .set('x-consumer-scope', data.users.consumer1)
        .set('x-consumer-groups', 'smex-authenticated-user,' + data.users.consumer1 + '-writer')
        .expect(200)
        .expect(function(res) {
          res.body.should.be.an.Array();
          res.body.should.have.length(1);
          res.body[0].should.have.property('user_id', data.users.consumer1);
          res.body[0].should.have.property('scope_id', data.users.consumer1);
        })
        .end(done);
      });

      it('should not be able to override user_id filter parameter', function(done) {
        api.get('/api/accounts?filter[where][user_id]=' + data.users.consumer2)
        .set('x-consumer-username', data.users.consumer1)
        .set('x-consumer-groups', 'smex-authenticated-user')
        .expect(200)
        .expect(function(res) {
          res.body.should.be.an.Array();
          res.body.should.have.length(1);
          res.body[0].should.have.property('user_id', data.users.consumer1);
          res.body[0].should.have.property('scope_id', data.users.consumer1);
        })
        .end(done);
      });

      it('should not be able to override scope_id filter parameter', function(done) {
        api.get('/api/accounts?filter[where][scope_id]=' + data.users.consumer1)
        .set('x-consumer-username', data.users.consumer2)
        .set('x-consumer-groups', 'smex-authenticated-user')
        .expect(200)
        .expect(function(res) {
          res.body.should.be.an.Array();
          res.body.should.have.length(0);
        })
        .end(done);
      });

      it('should be able to retrieve an account belonging to himself as standard user', function(done) {
        api.get('/api/accounts/' + data.accounts[0].id)
        .set('x-consumer-username', data.users.consumer1)
        .set('x-consumer-groups', 'smex-authenticated-user')
        .expect(200)
        .expect(function(res) {
          res.body.should.have.property('user_id', data.users.consumer1);
          res.body.should.have.property('scope_id', data.users.consumer1);
          res.body.should.have.property('id', data.accounts[0].id);
        })
        .end(done);
      });

      it('should be able to retrieve an account belonging to his scope as standard user (1/2)', function(done) {
        api.get('/api/accounts/' + data.accounts[1].id)
        .set('x-consumer-username', data.users.consumer2)
        .set('x-consumer-scope', data.users.consumer1)
        .set('x-consumer-groups', 'smex-authenticated-user,' + data.users.consumer1 + '-reader')
        .expect(200)
        .expect(function(res) {
          res.body.should.have.property('user_id', data.users.consumer2);
          res.body.should.have.property('scope_id', data.users.consumer1);
          res.body.should.have.property('id', data.accounts[1].id);
        })
        .end(done);
      });

      it('should be able to retrieve an account belonging to his scope as standard user (2/2)', function(done) {
        api.get('/api/accounts/' + data.accounts[0].id)
        .set('x-consumer-username', data.users.consumer2)
        .set('x-consumer-scope', data.users.consumer1)
        .set('x-consumer-groups', 'smex-authenticated-user,' + data.users.consumer1 + '-reader')
        .expect(200)
        .expect(function(res) {
          res.body.should.have.property('user_id', data.users.consumer1);
          res.body.should.have.property('scope_id', data.users.consumer1);
          res.body.should.have.property('id', data.accounts[0].id);
        })
        .end(done);
      });

      it('should not be able to retrieve an account belonging to another user as standard user', function(done) {
        api.get('/api/accounts/' + data.accounts[1].id)
        .set('x-consumer-username', data.users.consumer1)
        .set('x-consumer-groups', 'smex-authenticated-user')
        .expect(401, done);
      });

      it('should be able to retrieve an account belonging to himself as standard user', function(done) {
        api.get('/api/accounts/findOne?filter[where][user_id]=' + data.accounts[0].user_id)
        .set('x-consumer-username', data.users.consumer1)
        .set('x-consumer-groups', 'smex-authenticated-user')
        .expect(200)
        .expect(function(res) {
          res.body.should.have.property('user_id', data.users.consumer1);
          res.body.should.have.property('scope_id', data.users.consumer1);
          res.body.should.have.property('id', data.accounts[0].id);
        })
        .end(done);
      });

      it('should not be able to retrieve an account belonging to another user as standard user', function(done) {
        api.get('/api/accounts/findOne?filter[where][user_id]=' + data.accounts[1].user_id)
        .set('x-consumer-username', data.users.consumer1)
        .set('x-consumer-groups', 'smex-authenticated-user')
        .expect(200)
        .expect(function(res) {
          res.body.should.have.property('user_id', data.users.consumer1);
          res.body.should.have.property('scope_id', data.users.consumer1);
          res.body.should.not.have.property('id', data.accounts[1].id);
        })
        .end(done);
      });
    });

    describe('smex read security model', function() {
      it('should be able to retrieve accounts as a reader user', function(done) {
        api.get('/api/accounts')
        .set('x-consumer-username', data.users.reader1)
        .set('x-consumer-groups', 'smex-account-reader')
        .expect(200)
        .expect(function(res) {
          res.body.should.be.an.Array();
          res.body.should.have.length(4);
        })
        .end(done);
      });

      it('should be able to retrieve accounts as an admin user', function(done) {
        api.get('/api/accounts')
        .set('x-consumer-username', data.users.admin1)
        .set('x-consumer-groups', 'smex-account-admin')
        .expect(200)
        .expect(function(res) {
          res.body.should.be.an.Array();
          res.body.should.have.length(4);
        })
        .end(done);
      });
    });

    describe('Proxy accounts management', function() {
      it('should be able to create a proxy account as standard user', function(done) {
        const proxy = {
          status: 'pending_validation',
          currency: 'CHF',
          owner_email: 'consumer-1@smex.tech',
          owner_firstname: 'Consumer',
          owner_lastname: 'One',
          owner_phone: '+41 78 123 45 67',
          owner_street: 'Avenue de la Praille 50',
          owner_postcode: '1207',
          owner_city: 'Carouge',
          owner_country: 'CH',
          economic_context: 'employer',
          reference: 'My transfer',
          funds_origin: 'salary',
        };
        const beneficiary = {
          status: 'pending_validation',
          bank_name: 'Belgian Bank',
          iban: 'BE16517682243567',
          currency: 'EUR',
          owner_companyname: null,
          owner_firstname: 'Consumer',
          owner_lastname: 'One',
          owner_email: 'consumer-1@smex.tech',
          owner_phone: '+41 78 123 45 67',
          owner_street: 'Avenue de la Praille 50',
          owner_postcode: '1207',
          owner_city: 'Carouge',
          owner_country: 'CH',
          communication: 'Beneficiary communication',
          economic_context: 'employer',
          funds_origin: 'salary',
          source_name: 'Ibani SA',
          source_email: 'hello@ibani.com',
          comment: 'My salary',
          reference: 'My transfer',
          user_is_owner: true,
        };
        const accountData = {proxy, beneficiary};
        api.post('/api/accounts/proxy')
        .set('x-consumer-username', data.users.consumer1)
        .set('x-consumer-groups', 'smex-authenticated-user')
        .send(accountData)
        .expect(200)
        .expect(function(res) {
          res.body.proxy.should.have.property('type', 'proxy');
          res.body.proxy.should.have.property('currency', 'CHF');
          res.body.proxy.should.have.property('iban', null);
          res.body.proxy.should.have.property('user_id', data.users.consumer1);
          res.body.proxy.should.have.property('scope_id', data.users.consumer1);
          res.body.beneficiary.should.have.property('type', 'beneficiary');
          res.body.beneficiary.should.have.property('currency', 'EUR');
          res.body.beneficiary.should.have.property('user_id', data.users.consumer1);
          res.body.beneficiary.should.have.property('scope_id', data.users.consumer1);
          res.body.proxy.linked_accounts.should.be.an.Array();
          res.body.beneficiary.linked_accounts.should.be.an.Array();
          res.body.proxy.linked_accounts.should.have.length(1);
          res.body.beneficiary.linked_accounts.should.have.length(1);
          res.body.proxy.linked_accounts[0].should.have.property('type', 'beneficiary');
          res.body.proxy.linked_accounts[0].should.have.property('id', res.body.beneficiary.id);
          res.body.beneficiary.linked_accounts[0].should.have.property('type', 'proxy');
          res.body.beneficiary.linked_accounts[0].should.have.property('id', res.body.proxy.id);
          data.accounts[2] = res.body.proxy;
          data.accounts[3] = res.body.beneficiary;
        })
        .end(done);
      });

      it('should be able to allocate proxy account as an admin', function(done) {
        api.post('/api/accounts/' + data.accounts[2].id + '/allocate')
        .set('x-consumer-username', data.users.admin1)
        .set('x-consumer-groups', 'smex-account-admin')
        .send({})
        .expect(200)
        .expect(function(res) {
          res.body.should.have.property('type', 'proxy');
          res.body.should.have.property('currency', 'CHF');
          res.body.should.have.property('iban', data.ibans[0].number);
          res.body.should.have.property('user_id', data.users.consumer1);
          res.body.should.have.property('scope_id', data.users.consumer1);
          data.accounts[2] = res.body;
        })
        .end(done);
      });

      it('should be able to update proxy account status as inactive as a standard user', function(done) {
        data.accounts[2].status = 'inactive';
        api.put('/api/accounts')
        .set('x-consumer-username', data.users.consumer1)
        .set('x-consumer-groups', 'smex-authenticated-user')
        .send(data.accounts[2])
        .expect(200)
        .expect(function(res) {
          res.body.should.have.property('type', 'proxy');
          res.body.should.have.property('currency', 'CHF');
          res.body.should.have.property('iban', data.ibans[0].number);
          res.body.should.have.property('user_id', data.users.consumer1);
          res.body.should.have.property('scope_id', data.users.consumer1);
          res.body.should.have.property('status', 'inactive');
        })
        .end(done);
      });

      it('should be able to update proxy account status as active as a standard user but status will be pending_validation', function(done) {
        data.accounts[2].status = 'active';
        api.put('/api/accounts')
        .set('x-consumer-username', data.users.consumer1)
        .set('x-consumer-groups', 'smex-authenticated-user')
        .send(data.accounts[2])
        .expect(200)
        .expect(function(res) {
          res.body.should.have.property('type', 'proxy');
          res.body.should.have.property('currency', 'CHF');
          res.body.should.have.property('iban', data.ibans[0].number);
          res.body.should.have.property('user_id', data.users.consumer1);
          res.body.should.have.property('scope_id', data.users.consumer1);
          res.body.should.have.property('status', 'pending_validation');
        })
        .end(done);
      });

      it('should not be able to allocate proxy account if already allocated', function(done) {
        api.post('/api/accounts/' + data.accounts[2].id + '/allocate')
        .set('x-consumer-username', data.users.admin1)
        .set('x-consumer-groups', 'smex-account-admin')
        .send({})
        .expect(422)
        .end(done);
      });

      it('should not be able to allocate beneficiary account', function(done) {
        api.post('/api/accounts/' + data.accounts[3].id + '/allocate')
        .set('x-consumer-username', data.users.admin1)
        .set('x-consumer-groups', 'smex-account-admin')
        .send({})
        .expect(422)
        .end(done);
      });

      it('should have the first created iban allocated to the account index 2', function(done) {
        api.get('/api/ibans/' + data.ibans[0].id)
        .set('x-consumer-username', data.users.admin1)
        .set('x-consumer-groups', 'smex-iban-admin')
        .expect(200)
        .expect(function(res) {
          data.ibans[0] = res.body;
          res.body.should.have.property('allocated', true);
          res.body.should.have.property('allocation_mode', 'proxy');
        })
        .end(done);
      });

      it('should be able to change an iban allocation mode to omnibus', function(done) {
        data.ibans[0].allocation_mode = 'omnibus';
        api.put('/api/ibans')
        .set('x-consumer-username', data.users.admin1)
        .set('x-consumer-groups', 'smex-iban-admin')
        .send(data.ibans[0])
        .expect(200)
        .expect(function(res) {
          res.body.should.have.property('allocation_mode', 'omnibus');
          data.ibans[0] = res.body;
        })
        .end(done);
      });

      it('should not be able to create proxy account as standard user for another user (way 1)', function(done) {
        const proxy = {
          status: 'pending_validation',
          currency: 'CHF',
          owner_email: 'consumer-1@smex.tech',
          owner_firstname: 'Consumer',
          owner_lastname: 'One',
          owner_phone: '+41 78 123 45 67',
          owner_street: 'Avenue de la Praille 50',
          owner_postcode: '1207',
          owner_city: 'Carouge',
          owner_country: 'CH',
          economic_context: 'employer',
          reference: 'My transfer',
          funds_origin: 'salary',
        };
        const beneficiary = {
          status: 'pending_validation',
          bank_name: 'Belgian Bank',
          iban: 'BE16517682243567',
          currency: 'EUR',
          owner_companyname: null,
          owner_firstname: 'Consumer',
          owner_lastname: 'One',
          owner_email: 'consumer-1@smex.tech',
          owner_phone: '+41 78 123 45 67',
          owner_street: 'Avenue de la Praille 50',
          owner_postcode: '1207',
          owner_city: 'Carouge',
          owner_country: 'CH',
          communication: 'Beneficiary communication',
          economic_context: 'employer',
          funds_origin: 'salary',
          source_name: 'Ibani SA',
          source_email: 'hello@ibani.com',
          comment: 'My salary',
          reference: 'My transfer',
          user_is_owner: true,
        };
        const accountData = {proxy, beneficiary, user_id: data.users.consumer2};
        api.post('/api/accounts/proxy')
        .set('x-consumer-username', data.users.consumer1)
        .set('x-consumer-groups', 'smex-authenticated-user')
        .send(accountData)
        .expect(200)
        .expect(function(res) {
          res.body.proxy.should.have.property('type', 'proxy');
          res.body.proxy.should.have.property('currency', 'CHF');
          res.body.proxy.should.have.property('iban', null);
          res.body.proxy.should.have.property('user_id', data.users.consumer1);
          res.body.proxy.should.have.property('scope_id', data.users.consumer1);
          res.body.beneficiary.should.have.property('type', 'beneficiary');
          res.body.beneficiary.should.have.property('currency', 'EUR');
          res.body.beneficiary.should.have.property('user_id', data.users.consumer1);
          res.body.beneficiary.should.have.property('scope_id', data.users.consumer1);
          res.body.proxy.linked_accounts.should.be.an.Array();
          res.body.beneficiary.linked_accounts.should.be.an.Array();
          res.body.proxy.linked_accounts.should.have.length(1);
          res.body.beneficiary.linked_accounts.should.have.length(1);
          res.body.proxy.linked_accounts[0].should.have.property('type', 'beneficiary');
          res.body.proxy.linked_accounts[0].should.have.property('id', res.body.beneficiary.id);
          res.body.beneficiary.linked_accounts[0].should.have.property('type', 'proxy');
          res.body.beneficiary.linked_accounts[0].should.have.property('id', res.body.proxy.id);
          data.accounts[4] = res.body.proxy;
          data.accounts[5] = res.body.beneficiary;
        })
        .end(done);
      });

      it('should not be able to allocate proxy account as a regular user', function(done) {
        api.post('/api/accounts/' + data.accounts[2].id + '/allocate')
        .set('x-consumer-username', data.users.consumer1)
        .set('x-consumer-groups', 'smex-authenticated-user')
        .send({})
        .expect(401)
        .end(done);
      });

      it('should not be able to create proxy account as standard user for another user (way 2)', function(done) {
        const proxy = {
          user_id: data.users.consumer2,
          status: 'pending_validation',
          currency: 'EUR',
          owner_email: 'consumer-1@smex.tech',
          owner_firstname: 'Consumer',
          owner_lastname: 'One',
          owner_phone: '+41 78 123 45 67',
          owner_street: 'Avenue de la Praille 50',
          owner_postcode: '1207',
          owner_city: 'Carouge',
          owner_country: 'CH',
          economic_context: 'employer',
          reference: 'My transfer',
          funds_origin: 'salary',
        };
        const beneficiary = {
          user_id: data.users.consumer2,
          status: 'pending_validation',
          bank_name: 'Belgian Bank',
          iban: 'BE16517682243567',
          currency: 'CHF',
          owner_companyname: null,
          owner_firstname: 'Consumer',
          owner_lastname: 'One',
          owner_email: 'consumer-1@smex.tech',
          owner_phone: '+41 78 123 45 67',
          owner_street: 'Avenue de la Praille 50',
          owner_postcode: '1207',
          owner_city: 'Carouge',
          owner_country: 'CH',
          communication: 'Beneficiary communication',
          economic_context: 'employer',
          funds_origin: 'salary',
          source_name: 'Ibani SA',
          source_email: 'hello@ibani.com',
          comment: 'My salary',
          reference: 'My transfer',
          user_is_owner: true,
        };
        const accountData = {proxy, beneficiary};
        api.post('/api/accounts/proxy')
        .set('x-consumer-username', data.users.consumer1)
        .set('x-consumer-groups', 'smex-authenticated-user')
        .send(accountData)
        .expect(200)
        .expect(function(res) {
          res.body.proxy.should.have.property('type', 'proxy');
          res.body.proxy.should.have.property('currency', 'EUR');
          res.body.proxy.should.have.property('iban', null);
          res.body.proxy.should.have.property('user_id', data.users.consumer1);
          res.body.proxy.should.have.property('scope_id', data.users.consumer1);
          res.body.beneficiary.should.have.property('type', 'beneficiary');
          res.body.beneficiary.should.have.property('currency', 'CHF');
          res.body.beneficiary.should.have.property('user_id', data.users.consumer1);
          res.body.beneficiary.should.have.property('scope_id', data.users.consumer1);
          res.body.proxy.linked_accounts.should.be.an.Array();
          res.body.beneficiary.linked_accounts.should.be.an.Array();
          res.body.proxy.linked_accounts.should.have.length(1);
          res.body.beneficiary.linked_accounts.should.have.length(1);
          res.body.proxy.linked_accounts[0].should.have.property('type', 'beneficiary');
          res.body.proxy.linked_accounts[0].should.have.property('id', res.body.beneficiary.id);
          res.body.beneficiary.linked_accounts[0].should.have.property('type', 'proxy');
          res.body.beneficiary.linked_accounts[0].should.have.property('id', res.body.proxy.id);
          data.accounts[6] = res.body.proxy;
          data.accounts[7] = res.body.beneficiary;
        })
        .end(done);
      });

      it('should be able to create a proxy account as standard user', function(done) {
        const proxy = {
          status: 'pending_validation',
          currency: 'CHF',
          owner_email: 'consumer-2@smex.tech',
          owner_firstname: 'Consumer',
          owner_lastname: 'Two',
          owner_phone: '+41 78 123 45 67',
          owner_street: 'Avenue de la Praille 50',
          owner_postcode: '1207',
          owner_city: 'Carouge',
          owner_country: 'CH',
          economic_context: 'employer',
          reference: 'My transfer',
          funds_origin: 'salary',
        };
        const beneficiary = {
          status: 'pending_validation',
          bank_name: 'Belgian Bank',
          iban: 'BE68539007547034',
          currency: 'EUR',
          owner_companyname: null,
          owner_firstname: 'Consumer',
          owner_lastname: 'Two',
          owner_email: 'consumer-2@smex.tech',
          owner_phone: '+41 78 123 45 67',
          owner_street: 'Avenue de la Praille 50',
          owner_postcode: '1207',
          owner_city: 'Carouge',
          owner_country: 'CH',
          communication: 'Beneficiary communication',
          economic_context: 'employer',
          funds_origin: 'salary',
          source_name: 'Ibani SA',
          source_email: 'hello@ibani.com',
          comment: 'My salary',
          reference: 'My transfer',
          user_is_owner: true,
        };
        const accountData = {proxy, beneficiary};
        api.post('/api/accounts/proxy')
        .set('x-consumer-username', data.users.consumer2)
        .set('x-consumer-groups', 'smex-authenticated-user')
        .send(accountData)
        .expect(200)
        .expect(function(res) {
          res.body.proxy.should.have.property('type', 'proxy');
          res.body.proxy.should.have.property('currency', 'CHF');
          res.body.proxy.should.have.property('iban', null);
          res.body.proxy.should.have.property('user_id', data.users.consumer2);
          res.body.proxy.should.have.property('scope_id', data.users.consumer2);
          res.body.beneficiary.should.have.property('type', 'beneficiary');
          res.body.beneficiary.should.have.property('currency', 'EUR');
          res.body.beneficiary.should.have.property('user_id', data.users.consumer2);
          res.body.beneficiary.should.have.property('scope_id', data.users.consumer2);
          res.body.proxy.linked_accounts.should.be.an.Array();
          res.body.beneficiary.linked_accounts.should.be.an.Array();
          res.body.proxy.linked_accounts.should.have.length(1);
          res.body.beneficiary.linked_accounts.should.have.length(1);
          res.body.proxy.linked_accounts[0].should.have.property('type', 'beneficiary');
          res.body.proxy.linked_accounts[0].should.have.property('id', res.body.beneficiary.id);
          res.body.beneficiary.linked_accounts[0].should.have.property('type', 'proxy');
          res.body.beneficiary.linked_accounts[0].should.have.property('id', res.body.proxy.id);
          data.accounts[8] = res.body.proxy;
          data.accounts[9] = res.body.beneficiary;
        })
        .end(done);
      });

      it('should be able to create a proxy account as standard user', function(done) {
        const proxy = {
          status: 'pending_validation',
          currency: 'CHF',
          owner_email: 'consumer-3@smex.tech',
          owner_firstname: 'Consumer',
          owner_lastname: 'Three',
          owner_phone: '+41 78 123 45 67',
          owner_street: 'Avenue de la Praille 50',
          owner_postcode: '1207',
          owner_city: 'Carouge',
          owner_country: 'CH',
          economic_context: 'employer',
          reference: 'My transfer',
          funds_origin: 'salary',
        };
        const beneficiary = {
          status: 'pending_validation',
          bank_name: 'Belgian Bank',
          iban: 'BE58465045170210',
          currency: 'EUR',
          owner_companyname: null,
          owner_firstname: 'Consumer',
          owner_lastname: 'Three',
          owner_email: 'consumer-3@smex.tech',
          owner_phone: '+41 78 123 45 67',
          owner_street: 'Avenue de la Praille 50',
          owner_postcode: '1207',
          owner_city: 'Carouge',
          owner_country: 'CH',
          communication: 'Beneficiary communication',
          economic_context: 'employer',
          funds_origin: 'salary',
          source_name: 'Ibani SA',
          source_email: 'hello@ibani.com',
          comment: 'My salary',
          reference: 'My transfer',
          user_is_owner: true,
        };
        const accountData = {proxy, beneficiary};
        api.post('/api/accounts/proxy')
        .set('x-consumer-username', data.users.consumer3)
        .set('x-consumer-groups', 'smex-authenticated-user')
        .send(accountData)
        .expect(200)
        .expect(function(res) {
          res.body.proxy.should.have.property('type', 'proxy');
          res.body.proxy.should.have.property('currency', 'CHF');
          res.body.proxy.should.have.property('iban', null);
          res.body.proxy.should.have.property('user_id', data.users.consumer3);
          res.body.proxy.should.have.property('scope_id', data.users.consumer3);
          res.body.beneficiary.should.have.property('type', 'beneficiary');
          res.body.beneficiary.should.have.property('currency', 'EUR');
          res.body.beneficiary.should.have.property('user_id', data.users.consumer3);
          res.body.beneficiary.should.have.property('scope_id', data.users.consumer3);
          res.body.proxy.linked_accounts.should.be.an.Array();
          res.body.beneficiary.linked_accounts.should.be.an.Array();
          res.body.proxy.linked_accounts.should.have.length(1);
          res.body.beneficiary.linked_accounts.should.have.length(1);
          res.body.proxy.linked_accounts[0].should.have.property('type', 'beneficiary');
          res.body.proxy.linked_accounts[0].should.have.property('id', res.body.beneficiary.id);
          res.body.beneficiary.linked_accounts[0].should.have.property('type', 'proxy');
          res.body.beneficiary.linked_accounts[0].should.have.property('id', res.body.proxy.id);
          data.accounts[10] = res.body.proxy;
          data.accounts[11] = res.body.beneficiary;
        })
        .end(done);
      });
    });
  }); */
});
