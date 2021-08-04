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
const { ether, expectEvent, shouldFail } = require('openzeppelin-test-helpers')

ZWeb3.initialize(web3.currentProvider);

const toEther = value => ether(value).toString(10)

const Contract = Contracts.getFromLocal('TokenLocker');
const ERC20Mock = artifacts.require('ERC20Mock.sol')

const tezosAddress = web3.utils.fromAscii("tz1XpS3v4txEAcAT3DS3JK7ZZHWwsim1zoaS");

contract('TokenLocker', ([_, owner, operator, address1, address2]) => {
  beforeEach(async function () {
    this.project = await TestHelper();
    this.contract = await this.project.createProxy(Contract, {initArgs: [owner]});
    this.token = await ERC20Mock.new('TST', 'TST')
  })

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

    it('can unlock tokens', async function () {
      await this.token.mint(this.contract.address, toEther('100000'));
      await this.contract.methods.unlock(this.token.address, address1, toEther('10000')).send({from: operator});
      (await this.token.balanceOf(this.contract.address)).should.be.bignumber.equal(toEther('90000'));
      (await this.token.balanceOf(address1)).should.be.bignumber.equal(toEther('10000'));
    });
  });

  context('When standard user', function () {
    it('can send tokens to locker by setting an allowance and calling lock', async function () {
      await this.token.mint(address1, toEther('100000'));
      await this.token.approve(this.contract.address, toEther('10000'), {from: address1});
      ({events: this.events} = await this.contract.methods.lock(this.token.address, tezosAddress, toEther('10000')).send({from: address1}));
      (await this.token.balanceOf(address1)).should.be.bignumber.equal(toEther('90000'));
      (await this.token.balanceOf(this.contract.address)).should.be.bignumber.equal(toEther('10000'));
      this.events.should.have.property('TokenLocked');
      this.events.TokenLocked.returnValues.should.have.property('from', address1);
      this.events.TokenLocked.returnValues.should.have.property('token', this.token.address);
      this.events.TokenLocked.returnValues.should.have.property('to', tezosAddress);
      this.events.TokenLocked.returnValues.should.have.property('value', toEther('10000'));
    });

    it('can send tokens to locker by calling transferAndCall', async function () {
      await this.token.mint(address1, toEther('100000'));
      ({receipt: this.receipt} = await this.token.transferAndCall(this.contract.address, toEther('10000'), tezosAddress, {from: address1}));
      (await this.token.balanceOf(address1)).should.be.bignumber.equal(toEther('90000'));
      (await this.token.balanceOf(this.contract.address)).should.be.bignumber.equal(toEther('10000'));
      const rawLogs = this.receipt.rawLogs;
      const TokenLocked = rawLogs[1];
      TokenLocked.data.indexOf(web3.eth.abi.encodeParameter('uint256', toEther('10000')).replace('0x', '')).should.equal(66);
      TokenLocked.data.indexOf(tezosAddress.replace('0x', '')).should.equal(194);
      TokenLocked.topics[1].should.equal(web3.eth.abi.encodeParameter('address', address1));
      TokenLocked.topics[2].should.equal(web3.eth.abi.encodeParameter('address', this.token.address));
    });

    it('reverts when sending eth to contract', async function () {
      await shouldFail.reverting.withMessage(web3.eth.sendTransaction({from: address1, to: this.contract.address, value: web3.utils.toWei('1',"ether"), gas: 200000}), "Not accepting ETH");
    });

    it('reverts when trying to unlock tokens', async function () {    
      await shouldFail.reverting.withMessage(this.contract.methods.unlock(this.token.address, address1, toEther('10000')).send({from: address1}), "OP01");
    });
  });
});
