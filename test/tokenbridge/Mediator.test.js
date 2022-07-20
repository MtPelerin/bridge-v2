require('chai/register-should');
const { TestHelper } = require('@openzeppelin/cli');
const { Contracts, ZWeb3 } = require('@openzeppelin/upgrades');
const { ether, expectEvent, shouldFail } = require('openzeppelin-test-helpers')
const { expect } = require('chai')

ZWeb3.initialize(web3.currentProvider);

const toEther = value => ether(value).toString(10)
const maxGasPerTx = toEther('1')
const exampleTxHash = '0xf308b922ab9f8a7128d9d7bc9bce22cd88b2c05c8213f0e2d8104d78e0a9ecbb'
const nonce = '0x96b6af865cdaa107ede916e237afbedffa5ed36bea84c0e77a33cc28fc2e9c01'

const Mediator = Contracts.getFromLocal('Mediator');
const ERC20Mock = artifacts.require('ERC20Mock.sol')
const AMBMock = artifacts.require('AMBMock.sol')

contract('Mediator', accounts => {
  const owner = accounts[0]
  const user = accounts[1]
  const mediatorContractOnOtherSide = accounts[2]
  const remoteDaiAddress = accounts[3]
  beforeEach(async () => {
    this.project = await TestHelper();
    this.bridgeContract = await AMBMock.new()
    await this.bridgeContract.setMaxGasPerTx(maxGasPerTx)
    this.localMediator = await this.project.createProxy(Mediator, {initArgs: [this.bridgeContract.address, mediatorContractOnOtherSide, maxGasPerTx, owner], gas: 200000});
    this.dai = await ERC20Mock.new('dai', 'DAI')
  })
  describe('tokenMapping', () => {
    beforeEach(async () => {
      await this.dai.mint(user, toEther('100000'), { from: owner })
    })
    it('should be able to add token mapping as owner', async () => {
      await this.localMediator.methods.setTokenMapping(this.dai.address, remoteDaiAddress).send({ from: owner })
      expect(await this.localMediator.methods.getTokenMapping(this.dai.address).call()).to.be.equal(remoteDaiAddress)
    })

    it('should not be able to add token mapping as user', async () => {
      await shouldFail.reverting.withMessage(this.localMediator.methods.setTokenMapping(this.dai.address, remoteDaiAddress).send({ from: user }), 'OP01')
    })

    it('should not be able to add token mapping with invalid address', async () => {
      await shouldFail.reverting.withMessage(this.localMediator.methods.setTokenMapping('0x0000000000000000000000000000000000000000', remoteDaiAddress).send({ from: owner }), 'AM01')
      await shouldFail.reverting.withMessage(this.localMediator.methods.setTokenMapping(this.dai.address, '0x0000000000000000000000000000000000000000').send({ from: owner }), 'AM01')
    })
  })
  describe('shouldBehaveLikeBasicMediator', () => {
    describe('initialize', () => {
      it('can set bridge contract from owner', async () => {
          const newBridgeContractAddress = this.dai.address
          await this.localMediator.methods.setBridgeContract(newBridgeContractAddress).send({ from: owner })
          expect(await this.localMediator.methods.bridgeContract().call()).to.be.equal(newBridgeContractAddress)
      })
      it('cannot set bridge contract from user', async () => {
        const newBridgeContractAddress = accounts[4]
        await shouldFail.reverting.withMessage(this.localMediator.methods.setBridgeContract(newBridgeContractAddress).send({ from: user }), 'Ownable: caller is not the owner')
      })
      it('cannot set bridge contract to a non contract address', async () => {
        const newBridgeContractAddress = accounts[4]
        await shouldFail.reverting.withMessage(this.localMediator.methods.setBridgeContract(newBridgeContractAddress).send({ from: owner }), 'AM02')
      })
      it('can set mediator contract from owner', async () => {
        const newMediatorContract = this.dai.address
        await this.localMediator.methods.setMediatorContractOnOtherSide(newMediatorContract).send({ from: owner })
        expect(await this.localMediator.methods.mediatorContractOnOtherSide().call()).to.be.equal(newMediatorContract)
      })
      it('cannot set mediator contract from user', async () => {
        const newMediatorContract = this.dai.address
        await shouldFail.reverting.withMessage(this.localMediator.methods.setMediatorContractOnOtherSide(newMediatorContract).send({ from: user }), 'Ownable: caller is not the owner')
      })
      it('can set request Gas Limit from owner', async () => {
        expect(await this.localMediator.methods.requestGasLimit().call()).to.be.equal(maxGasPerTx)
        const newMaxGasPerTx = toEther('0.5')

        await this.localMediator.methods.setRequestGasLimit(newMaxGasPerTx).send({ from: owner })
        expect(await this.localMediator.methods.requestGasLimit().call()).to.be.equal(newMaxGasPerTx)
      })
      it('cannot set request Gas Limit from user', async () => {
        expect(await this.localMediator.methods.requestGasLimit().call()).to.be.equal(maxGasPerTx)
        const newMaxGasPerTx = toEther('0.5')

        await shouldFail.reverting.withMessage(this.localMediator.methods.setRequestGasLimit(newMaxGasPerTx).send({ from: user }), 'Ownable: caller is not the owner')
      })
      it('can set request Gas Limit higher than bridge gas limit', async () => {
        expect(await this.localMediator.methods.requestGasLimit().call()).to.be.equal(maxGasPerTx)
        const invalidMaxGasPerTx = toEther('1.5')

        // invalidMaxGasPerTx > bridgeContract.maxGasPerTx
        await shouldFail.reverting.withMessage(this.localMediator.methods.setRequestGasLimit(invalidMaxGasPerTx).send({ from: owner }), 'AM03')
      })
    })
    describe('getBridgeMode', () => {
      it('should return bridge mode and interface', async () => {
        const bridgeModeHash = '0x212184bf' // 4 bytes of keccak256('erc20-to-erc20-lock-unlock-amb')
        expect(await this.localMediator.methods.getBridgeMode().call()).to.be.equal(bridgeModeHash)

        const { major, minor, patch } = await this.localMediator.methods.getBridgeInterfacesVersion().call()
        expect(major).to.be.equal('1')
        expect(minor).to.be.equal('0')
        expect(patch).to.be.equal('0')
      })
    })
    describe('requestFailedMessageFix', () => {
      let data
      beforeEach(async () => {
        await this.dai.mint(this.localMediator.address, toEther('100000'))

        data = await this.localMediator.methods.handleBridgedTokens(user, this.dai.address, toEther('100'), nonce).encodeABI()
      })
      it('should allow to request a failed message fix', async () => {
        // Given
        await this.bridgeContract.executeMessageCall(
          this.localMediator.address,
          mediatorContractOnOtherSide,
          data,
          exampleTxHash,
          100
        )
        expect(await this.bridgeContract.messageCallStatus(exampleTxHash)).to.be.equal(false)

        const dataHash = await this.bridgeContract.failedMessageDataHash(exampleTxHash)

        const { transactionHash: tx } = await this.localMediator.methods.requestFailedMessageFix(exampleTxHash).send({ gas: 300000 })

        // Then
        const receipt = await web3.eth.getTransactionReceipt(tx)
        const logs = AMBMock.decodeLogs(receipt.logs)
        expect(logs.length).to.be.equal(1)
        expect(logs[0].args.encodedData.includes(dataHash.replace(/^0x/, ''))).to.be.equal(true)
      })
      it('should be a failed transaction', async () => {
        // Given
        await this.bridgeContract.executeMessageCall(
          this.localMediator.address,
          mediatorContractOnOtherSide,
          data,
          exampleTxHash,
          1000000
        )
        expect(await this.bridgeContract.messageCallStatus(exampleTxHash)).to.be.equal(true)

        // When
        await shouldFail.reverting.withMessage(this.localMediator.methods.requestFailedMessageFix(exampleTxHash).send(), 'AM04')
      })
      it('should be the receiver of the failed transaction', async () => {
        // Given
        await this.bridgeContract.executeMessageCall(
          this.bridgeContract.address,
          mediatorContractOnOtherSide,
          data,
          exampleTxHash,
          1000000
        )
        expect(await this.bridgeContract.messageCallStatus(exampleTxHash)).to.be.equal(false)

        // When
        await shouldFail.reverting.withMessage(this.localMediator.methods.requestFailedMessageFix(exampleTxHash).send(), 'AM05')
      })
      it('message sender should be mediator from other side', async () => {
        // Given
        await this.bridgeContract.executeMessageCall(this.localMediator.address, this.localMediator.address, data, exampleTxHash, 1000000)
        expect(await this.bridgeContract.messageCallStatus(exampleTxHash)).to.be.equal(false)

        // When
        await shouldFail.reverting.withMessage(this.localMediator.methods.requestFailedMessageFix(exampleTxHash).send(), 'AM06')
      })
      it('should allow to request a fix multiple times', async () => {
        // Given
        await this.bridgeContract.executeMessageCall(
          this.localMediator.address,
          mediatorContractOnOtherSide,
          data,
          exampleTxHash,
          100
        )
        expect(await this.bridgeContract.messageCallStatus(exampleTxHash)).to.be.equal(false)

        const dataHash = await this.bridgeContract.failedMessageDataHash(exampleTxHash)

        const { transactionHash: tx } = await this.localMediator.methods.requestFailedMessageFix(exampleTxHash).send()

        const receipt = await web3.eth.getTransactionReceipt(tx)
        const logs = AMBMock.decodeLogs(receipt.logs)
        expect(logs.length).to.be.equal(1)
        expect(logs[0].args.encodedData.includes(dataHash.replace(/^0x/, ''))).to.be.equal(true)

        // When
        const { transactionHash: secondTx } = await this.localMediator.methods.requestFailedMessageFix(exampleTxHash).send()

        // Then
        const secondReceipt = await web3.eth.getTransactionReceipt(secondTx)
        const secondLogs = AMBMock.decodeLogs(secondReceipt.logs)
        expect(secondLogs.length).to.be.equal(1)
        expect(secondLogs[0].args.encodedData.includes(dataHash.replace(/^0x/, ''))).to.be.equal(true)
      })
    })
  })
  describe('transferToken', () => {
    it('should transfer tokens to mediator and emit event on amb bridge ', async () => {
      // Given
      await this.dai.mint(user, toEther('100000'), { from: owner })

      await this.dai.approve(this.localMediator.address, toEther('100'), { from: user, gas: 200000 })
      await this.localMediator.methods.setTokenMapping(this.dai.address, remoteDaiAddress).send({ from: owner })

      const {transactionHash} = await this.localMediator.methods.transferToken(user, this.dai.address, toEther('100')).send({ from: user, gas: 300000});

      // Then
      await expectEvent.inTransaction(transactionHash, ERC20Mock, 'Transfer', {
        from: user,
        to: this.localMediator.address,
        value: toEther('100')
      })
      await expectEvent.inTransaction(transactionHash, AMBMock, 'MockedEvent')
    })
  })
  describe('handleBridgedTokens', () => {
    it('should transfer locked token', async () => {
      // Given
      /* Mint tokens directly on contract to simulate lock */
      await this.dai.mint(this.localMediator.address, toEther('100000'), { from: owner })

      expect(await this.dai.totalSupply()).to.be.bignumber.equal(toEther('100000'))
      expect(await this.dai.balanceOf(user)).to.be.bignumber.equal(toEther('0'))

      // must be called from bridge
      await shouldFail.reverting(
        this.localMediator.methods.handleBridgedTokens(user, this.dai.address, toEther('100'), nonce).send({ from: user })
      )
      await shouldFail.reverting(
        this.localMediator.methods.handleBridgedTokens(user, this.dai.address, toEther('100'), nonce).send({ from: owner })
      )

      const data = await this.localMediator.methods
        .handleBridgedTokens(user, this.dai.address, toEther('100'), nonce)
        .encodeABI()

      const failedTxHash = '0x2ebc2ccc755acc8eaf9252e19573af708d644ab63a39619adb080a3500a4ff2e'

      // message must be generated by mediator contract on the other network
      await this.bridgeContract.executeMessageCall(this.localMediator.address, owner, data, failedTxHash, 1000000)
      expect(await this.bridgeContract.messageCallStatus(failedTxHash)).to.be.equal(false)

      const { tx } = await this.bridgeContract.executeMessageCall(
        this.localMediator.address,
        mediatorContractOnOtherSide,
        data,
        exampleTxHash,
        1000000
      )

      expect(await this.bridgeContract.messageCallStatus(exampleTxHash)).to.be.equal(true)

      // Then
      expect(await this.dai.totalSupply()).to.be.bignumber.equal(toEther('100000'))
      expect(await this.dai.balanceOf(user)).to.be.bignumber.equal(toEther('100'))

      await expectEvent.inTransaction(tx, ERC20Mock, 'Transfer', {
        from: this.localMediator.address,
        to: user,
        value: toEther('100')
      })
    })
  })
  describe('fixFailedMessage', () => {
    let dai
    let dataHash
    beforeEach(async () => {
      await this.dai.mint(user, toEther('100000'), { from: owner })

      // User transfer token to mediator and generate amb event
      await this.dai.approve(this.localMediator.address, toEther('100'), { from: user, gas: 200000 })
      await this.localMediator.methods.setTokenMapping(this.dai.address, remoteDaiAddress).send({ from: owner })
      const { transactionHash } = await this.localMediator.methods.transferToken(user, this.dai.address, toEther('100')).send({ from: user, gas: 300000 })

      // Get data passed to AMBMock initiall
      const receipt = await web3.eth.getTransactionReceipt(transactionHash)
      const logs = AMBMock.decodeLogs(receipt.logs)
      const data = `0x${logs[0].args.encodedData.substr(148, logs[0].args.encodedData.length - 148)}`

      // Test token mapping
      const remoteDaiAddressFromData = `0x${data.substr(98, 40)}`
      expect(remoteDaiAddressFromData).to.be.equal(remoteDaiAddress.toLowerCase())

      // Bridge calls mediator from other side
      await this.bridgeContract.executeMessageCall(this.localMediator.address, mediatorContractOnOtherSide, data, transactionHash, 100)
      // Message failed
      expect(await this.bridgeContract.messageCallStatus(transactionHash)).to.be.equal(false)

      // mediator from other side should use this dataHash to request fix the failed message
      dataHash = await this.bridgeContract.failedMessageDataHash(transactionHash)
    })
    it('should fix locked tokens', async () => {
      // Given
      expect(await this.localMediator.methods.messageFixed(dataHash).call()).to.be.equal(false)
      expect(await this.dai.totalSupply()).to.be.bignumber.equal(toEther('100000'))
      expect(await this.dai.balanceOf(user)).to.be.bignumber.equal(toEther('99900'))

      // When
      const fixData = await this.localMediator.methods.fixFailedMessage(dataHash).encodeABI()

      await this.bridgeContract.executeMessageCall(
        this.localMediator.address,
        mediatorContractOnOtherSide,
        fixData,
        exampleTxHash,
        1000000
      )

      // Then
      expect(await this.bridgeContract.messageCallStatus(exampleTxHash)).to.be.equal(true)
      expect(await this.localMediator.methods.messageFixed(dataHash).call()).to.be.equal(true)
      expect(await this.dai.totalSupply()).to.be.bignumber.equal(toEther('100000'))
      expect(await this.dai.balanceOf(user)).to.be.bignumber.equal(toEther('100000'))

      const otherTxHash = '0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121'
      // can only fix it one time
      await this.bridgeContract.executeMessageCall(
        this.localMediator.address,
        mediatorContractOnOtherSide,
        fixData,
        otherTxHash,
        1000000
      )
      expect(await this.bridgeContract.messageCallStatus(otherTxHash)).to.be.equal(false)
      expect(await this.dai.totalSupply()).to.be.bignumber.equal(toEther('100000'))
      expect(await this.dai.balanceOf(user)).to.be.bignumber.equal(toEther('100000'))

      // Re send token to know that dataHash is different even if same token and value is used
      await this.dai.approve(this.localMediator.address, toEther('100'), { from: user, gas: 200000 })
      const { transactionHash } = await this.localMediator.methods.transferToken(user, this.dai.address, toEther('100')).send({ from: user, gas: 300000 })

      expect(await this.dai.totalSupply()).to.be.bignumber.equal(toEther('100000'))
      expect(await this.dai.balanceOf(user)).to.be.bignumber.equal(toEther('99900'))

      // Get data passed to AMBMock initially
      const receipt = await web3.eth.getTransactionReceipt(transactionHash)
      const logs = AMBMock.decodeLogs(receipt.logs)
      const data = `0x${logs[0].args.encodedData.substr(148, logs[0].args.encodedData.length - 148)}`

      // Test token mapping
      const remoteDaiAddressFromData = `0x${data.substr(98, 40)}`
      expect(remoteDaiAddressFromData).to.be.equal(remoteDaiAddress.toLowerCase())

      // Bridge calls mediator from other side
      await this.bridgeContract.executeMessageCall(this.localMediator.address, mediatorContractOnOtherSide, data, transactionHash, 100)
      // Message failed
      expect(await this.bridgeContract.messageCallStatus(transactionHash)).to.be.equal(false)

      // mediator from other side should use this dataHash to request fix the failed message
      const newDataHash = await this.bridgeContract.failedMessageDataHash(transactionHash)

      expect(newDataHash).not.to.be.equal(dataHash)
      expect(await this.dai.totalSupply()).to.be.bignumber.equal(toEther('100000'))
      expect(await this.dai.balanceOf(user)).to.be.bignumber.equal(toEther('99900'))
    })
    it('should be called by bridge', async () => {
      await shouldFail.reverting(this.localMediator.methods.fixFailedMessage(dataHash).send({ from: owner }))
    })
    it('message sender should be mediator from other side ', async () => {
      // Given
      expect(await this.localMediator.methods.messageFixed(dataHash).call()).to.be.equal(false)

      // When
      const fixData = await this.localMediator.methods.fixFailedMessage(dataHash).encodeABI()

      await this.bridgeContract.executeMessageCall(this.localMediator.address, this.localMediator.address, fixData, exampleTxHash, 1000000)

      // Then
      expect(await this.bridgeContract.messageCallStatus(exampleTxHash)).to.be.equal(false)
      expect(await this.localMediator.methods.messageFixed(dataHash).call()).to.be.equal(false)
    })
  }),
  describe('claim tokens', () => {
    beforeEach(async () => {
      await this.dai.mint(user, toEther('100000'), { from: owner })
      await this.dai.transfer(this.localMediator.address, toEther('100'), { from: user })
    })
    it('should be able to claim tokens as owner', async () => {
      expect(await this.dai.totalSupply()).to.be.bignumber.equal(toEther('100000'))
      expect(await this.dai.balanceOf(user)).to.be.bignumber.equal(toEther('99900'))
      expect(await this.dai.balanceOf(this.localMediator.address)).to.be.bignumber.equal(toEther('100'))
      await this.localMediator.methods.claimTokens(this.dai.address, user).send({ from: owner })
      expect(await this.dai.totalSupply()).to.be.bignumber.equal(toEther('100000'))
      expect(await this.dai.balanceOf(user)).to.be.bignumber.equal(toEther('100000'))
      expect(await this.dai.balanceOf(this.localMediator.address)).to.be.bignumber.equal(toEther('0'))
    })
    it('should not be able to claim tokens as user', async () => {
      await shouldFail.reverting.withMessage(this.localMediator.methods.claimTokens(this.dai.address, user).send({ from: user }), 'Ownable: caller is not the owner')
    })
    it('should not be able to claim tokens to an invalid address', async () => {
      await shouldFail.reverting.withMessage(this.localMediator.methods.claimTokens(this.dai.address, '0x0000000000000000000000000000000000000000').send({ from: owner }), 'AM01')
    })
  })
})
