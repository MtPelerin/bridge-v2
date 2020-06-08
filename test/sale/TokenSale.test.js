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

const bytes32 = function (val) {
  return web3.utils.fromAscii(val);
};

const timestamp = function () {
  return Math.floor(new Date().getTime()/1000);
};

const TKN = bytes32('TKN');
const CHF = bytes32('CHF');
const ETH = bytes32('ETH');

const Contract = Contracts.getFromLocal('TokenSale');
const PriceOracle = Contracts.getFromLocal('PriceOracle');
const BrigeToken = Contracts.getFromLocal('BridgeToken');
const RuleEngine = Contracts.getFromLocal('RuleEngine');
const YesNoRule = Contracts.getFromLocal('YesNoRule');
const Processor = Contracts.getFromLocal('Processor');

contract('TokenSale', function ([_, owner, operator, administrator, supplier, etherVault, tokenVault, trustedIntermediary1, address1, address2]) {
  beforeEach(async function () {
    this.project = await TestHelper();
    this.ruleEngine = await this.project.createProxy(RuleEngine, {initArgs: [owner]});
    this.yesNo = await this.project.createProxy(YesNoRule);
    await this.ruleEngine.methods.setRules([this.yesNo.address]).send({from: owner, gas: 100000});
    this.priceOracle = await this.project.createProxy(PriceOracle, {initArgs: [owner]});
    this.processor = await this.project.createProxy(Processor, {initArgs: [owner, this.ruleEngine.address], gas: 100000});
    this.token = await this.project.createProxy(BrigeToken, {initArgs: [owner, this.processor.address, 'Token', 'TKN', 0, [trustedIntermediary1]], gas: 100000});
    await this.token.methods.setPriceOracle(this.priceOracle.address).send({from: owner})
    this.contract = await this.project.createProxy(Contract, {initArgs: [owner, this.token.address, etherVault, tokenVault, 'CHF', 2], gas: 100000});
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
    it('can pause/unpause the sale', async function () {
      (await this.contract.methods.paused().call()).should.equal(false);
      await this.contract.methods.pause().send({from: owner});
      (await this.contract.methods.paused().call()).should.equal(true);
      await this.contract.methods.unpause().send({from: owner});
      (await this.contract.methods.paused().call()).should.equal(false);
    });
  });

  context('When operator', function () {
    beforeEach(async function () {
      await this.contract.methods.addOperator(operator).send({from: owner});
    });

    it('can set max Ether balance', async function () {
      (await this.contract.methods.maxEtherBalance().call()).should.equal(web3.utils.toWei('10',"ether"));
      await this.contract.methods.setMaxEtherBalance(web3.utils.toWei('100',"ether")).send({from: operator});
      (await this.contract.methods.maxEtherBalance().call()).should.equal(web3.utils.toWei('100',"ether"));
    });  

    context('When sale is not open yet', function () {
      it('can set schedule', async function () {
        (await this.contract.methods.startAt().call()).should.equal('0');
        (await this.contract.methods.endAt().call()).should.equal('0');
        await this.contract.methods.setSchedule('1567987200', '1568246400').send({from: operator});
        (await this.contract.methods.startAt().call()).should.equal('1567987200');
        (await this.contract.methods.endAt().call()).should.equal('1568246400');
      }); 
  
      it('reverts if trying to set schedule with start date >= end date', async function () {
        (await this.contract.methods.startAt().call()).should.equal('0');
        (await this.contract.methods.endAt().call()).should.equal('0');
        await shouldFail.reverting.withMessage(this.contract.methods.setSchedule('1568246400', '1567987200').send({from: operator}), "TS02");
      }); 
    });

    context('When sale is open', function () {
      beforeEach(async function () {
        await this.contract.methods.setSchedule(timestamp() - 3600, timestamp() + 3600).send({from: operator});
      });

      it('reverts if trying to set schedule', async function () {
        await shouldFail.reverting.withMessage(this.contract.methods.setSchedule(timestamp() + 3600, timestamp() + 7200).send({from: operator}), "TS11");
      }); 
    });

    it('reverts if trying to add investment of 0 tokens', async function () {
      (await this.token.methods.balanceOf(address1).call()).should.equal('0');
      await shouldFail.reverting.withMessage(this.contract.methods.investRefCurrency(address1, 0).send({from: operator}), "TS05");
    }); 

    context('When TKNCHF price rate not set', function () {
      it('reverts if trying to add investment in reference currency without price rate set', async function () {
        (await this.token.methods.balanceOf(address1).call()).should.equal('0');
        await shouldFail.reverting.withMessage(this.contract.methods.investRefCurrency(address1, '100000').send({from: operator}), "TS09");
      }); 
    });

    context('When TKNCHF price rate set', function () {
      beforeEach(async function () {
        await this.priceOracle.methods.setPrices([TKN], [CHF], ['1000'], [2]).send({from: owner, gas: 200000});
      });

      context('When contract has no allowance on token vault', function () {
        it('reverts if trying to add investment and vault is empty', async function () {
          (await this.token.methods.balanceOf(address1).call()).should.equal('0');
          await shouldFail.reverting.withMessage(this.contract.methods.investRefCurrency(address1, '100000').send({from: operator}), "AL01");
        }); 
      });

      context('When contract has allowance on token vault', function () {
        beforeEach(async function () {
          await this.token.methods.approve(this.contract.address, 1000000).send({from: tokenVault});  
        });

        it('reverts if trying to add investment and vault is empty', async function () {
          (await this.token.methods.balanceOf(address1).call()).should.equal('0');
          await shouldFail.reverting(this.contract.methods.investRefCurrency(address1, '1000').send({from: operator}));
        }); 

        context('When token vault has tokens and contract has allowance', function () {
          beforeEach(async function () {
            await this.token.methods.addAdministrator(administrator).send({from: owner});
            await this.token.methods.addSupplier(supplier).send({from: administrator});
            await this.token.methods.mint(tokenVault, 10000).send({from: supplier, gas: 200000});  
          });

          it('can add investment in reference currency', async function () {
            (await this.token.methods.balanceOf(address1).call()).should.equal('0');
            await this.contract.methods.investRefCurrency(address1, '100000').send({from: operator, gas: 200000});
            (await this.token.methods.balanceOf(address1).call()).should.equal('100');
          });
        });
      });
    });

    context('When contract has Ether', function () {
      beforeEach(async function () {
        await this.token.methods.addAdministrator(administrator).send({from: owner});
        await this.token.methods.addSupplier(supplier).send({from: administrator});
        await this.token.methods.mint(tokenVault, 10000).send({from: supplier, gas: 200000}); 
        await this.token.methods.approve(this.contract.address, 1000000).send({from: tokenVault});  
        await this.priceOracle.methods.setPrices([TKN], [ETH], [web3.utils.toWei('0.1',"ether")], [18]).send({from: owner, gas: 200000});
        await this.contract.methods.setSchedule(timestamp() - 3600, timestamp() + 3600).send({from: operator});
        await web3.eth.sendTransaction({from: address1, to: this.contract.address, value: web3.utils.toWei('1',"ether"), gas: 200000});
      });

      it('can withdraw Ether', async function () {
        (await web3.eth.getBalance(etherVault)).should.equal(web3.utils.toWei('1000000',"ether"));
        await this.contract.methods.withdrawEther().send({from: operator});
        (await web3.eth.getBalance(etherVault)).should.equal(web3.utils.toWei('1000001',"ether"));
      });
    });
  });

  context('When standard user', function () {
    it('has the proper token parameter', async function () {
      (await this.contract.methods.token().call()).should.equal(this.token.address);
    });
    it('has the proper Ether vault parameter', async function () {
      (await this.contract.methods.etherVault().call()).should.equal(etherVault);
    });
    it('has the proper token vault parameter', async function () {
      (await this.contract.methods.tokenVault().call()).should.equal(tokenVault);
    });
    it('has the proper reference currency parameter', async function () {
      (await this.contract.methods.refCurrency().call()).should.equal('CHF');
    });
    it('has the proper reference currency decimals parameter', async function () {
      (await this.contract.methods.refCurrencyDecimals().call()).should.equal('2');
    });
    it('can get the contract version', async function () {
      (await this.contract.methods.VERSION().call()).should.equal('1');
    });
    context('Security model', function () {
      it('reverts if trying to set max Ether balance', async function () {
        await shouldFail.reverting.withMessage(this.contract.methods.setMaxEtherBalance(1000).send({from: address1}), "OP01");
      });  

      it('reverts if trying to set schedule', async function () {
        await shouldFail.reverting.withMessage(this.contract.methods.setSchedule('1567987200', '1568246400').send({from: address1}), "OP01");
      });

      it('reverts if trying to withdraw Ether', async function () {
        await shouldFail.reverting.withMessage(this.contract.methods.withdrawEther().send({from: address1}), "OP01");
      });

      it('reverts if trying add investment in reference currency', async function () {
        await shouldFail.reverting.withMessage(this.contract.methods.investRefCurrency(address1, '100000').send({from: address1, gas: 200000}), "OP01");
      });
    });

    context('When sale is not open', function () { 
      beforeEach(async function () {
        await this.contract.methods.addOperator(operator).send({from: owner});
        await this.contract.methods.setSchedule(timestamp() + 3600, timestamp() + 7200).send({from: operator});
      });

      it('reverts if trying to send Ether to the contract', async function () {
        await shouldFail.reverting.withMessage(web3.eth.sendTransaction({from: address1, to: this.contract.address, value: web3.utils.toWei('10',"ether"), gas: 200000}), "TS01");
      });

      it('reverts if trying to invest Ether', async function () {
        await shouldFail.reverting.withMessage(this.contract.methods.investEther().send({from: address1, value: web3.utils.toWei('10',"ether"), gas: 200000}), "TS01");
      });
    });

    context("When sale is open", function () {
      beforeEach(async function () {
        await this.contract.methods.addOperator(operator).send({from: owner});
        await this.contract.methods.setSchedule(timestamp() - 3600, timestamp() + 3600).send({from: operator});
      });

      context('When sale is paused', function () {
        beforeEach(async function () {
          await this.contract.methods.pause().send({from: owner});
        });

        it('reverts if trying to send Ether to the contract', async function () {
          await shouldFail.reverting(web3.eth.sendTransaction({from: address1, to: this.contract.address, value: web3.utils.toWei('10',"ether"), gas: 200000}));
        });
  
        it('reverts if trying to invest Ether', async function () {
          await shouldFail.reverting(this.contract.methods.investEther().send({from: address1, value: web3.utils.toWei('10',"ether"), gas: 200000}));
        });
      });

      context('When sale is not paused', function () {
        context('When TKNETH price rate not set', function() {
          it('reverts if trying to invest Ether', async function () {
            await shouldFail.reverting.withMessage(this.contract.methods.investEther().send({from: address1, value: web3.utils.toWei('10',"ether"), gas: 200000}), "TS06");
          });
        });

        context('When TKNETH price rate set', function() {
          beforeEach(async function () {
            await this.token.methods.addAdministrator(administrator).send({from: owner});
            await this.token.methods.addSupplier(supplier).send({from: administrator});
            await this.token.methods.mint(tokenVault, 10000).send({from: supplier, gas: 200000}); 
            await this.token.methods.approve(this.contract.address, 1000000).send({from: tokenVault});  
            await this.priceOracle.methods.setPrices([TKN], [ETH], [web3.utils.toWei('0.1',"ether")], [18]).send({from: owner, gas: 200000});
          });

          it('can invest by sending Ether to the contract', async function () {
            (await this.token.methods.balanceOf(address1).call()).should.equal('0');
            await web3.eth.sendTransaction({from: address1, to: this.contract.address, value: web3.utils.toWei('10',"ether"), gas: 200000});
            (await this.token.methods.balanceOf(address1).call()).should.equal('100');
          });

          it('can invest by calling the investEthers function', async function () {
            (await this.token.methods.balanceOf(address1).call()).should.equal('0');
            await this.contract.methods.investEther().send({from: address1, value: web3.utils.toWei('10',"ether"), gas: 200000});
            (await this.token.methods.balanceOf(address1).call()).should.equal('100');
          });

          it('rebalances Ether correctly from the contract to the etherVault', async function () {
            (await web3.eth.getBalance(etherVault)).should.equal(web3.utils.toWei('1000001',"ether"));
            await web3.eth.sendTransaction({from: address1, to: this.contract.address, value: web3.utils.toWei('20',"ether"), gas: 200000});
            (await web3.eth.getBalance(etherVault)).should.equal(web3.utils.toWei('1000021',"ether"));
          });

          it('reverts if trying to invest 0 Ether', async function () {
            await shouldFail.reverting.withMessage(this.contract.methods.investEther().send({from: address1, value: '0', gas: 200000}), "TS05");
          });
        });
      });
    });
  });
});