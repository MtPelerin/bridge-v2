/* eslint-disable max-len */
'use strict';

const {TezosToolkit, createTransferOperation} = require('@taquito/taquito');
const {InMemorySigner} = require('@taquito/signer');
const {BigNumber} = require('bignumber.js');
const Web3 = require('web3');
const web3Utils = require('web3-utils');
const EthereumTx = require('ethereumjs-tx').Transaction;
const _ = require('lodash');
const async = require('async');

const BRIDGE_INTERVAL = Number(process.env.BRIDGE_INTERVAL) || 5 * 60 * 1000;

const CONFIRMATIONS = typeof process.env.CONFIRMATIONS === 'undefined' || process.env.CONFIRMATIONS === null ? 10 : Number(process.env.CONFIRMATIONS);

const CHAINS = {
  '1': {
    name: process.env.CHAIN1_NAME,
    type: process.env.CHAIN1_TYPE,
    locker: process.env.CHAIN1_LOCKER,
    address: process.env.CHAIN1_ADDRESS,
    privateKey: process.env.CHAIN1_PRIVATE_KEY,
    rpcUrl: process.env.CHAIN1_RPC_URL,
    chainId: process.env.CHAIN1_CHAIN_ID,
    defaultBlock: process.env.CHAIN1_DEFAULT_BLOCK,
  },
  '2': {
    name: process.env.CHAIN2_NAME,
    type: process.env.CHAIN2_TYPE,
    locker: process.env.CHAIN2_LOCKER,
    address: process.env.CHAIN2_ADDRESS,
    privateKey: process.env.CHAIN2_PRIVATE_KEY,
    rpcUrl: process.env.CHAIN2_RPC_URL,
    chainId: process.env.CHAIN2_CHAIN_ID,
    defaultBlock: process.env.CHAIN2_DEFAULT_BLOCK,
  },
};

const TOKEN_LOCKER_ABI = require('./TokenLocker.json').abi;
const ERC20_ABI = [
  {
    'constant': true,
    'inputs': [],
    'name': 'name',
    'outputs': [
      {
        'name': '',
        'type': 'string',
      },
    ],
    'payable': false,
    'stateMutability': 'view',
    'type': 'function',
  },
  {
    'constant': false,
    'inputs': [
      {
        'name': '_spender',
        'type': 'address',
      },
      {
        'name': '_value',
        'type': 'uint256',
      },
    ],
    'name': 'approve',
    'outputs': [
      {
        'name': '',
        'type': 'bool',
      },
    ],
    'payable': false,
    'stateMutability': 'nonpayable',
    'type': 'function',
  },
  {
    'constant': true,
    'inputs': [],
    'name': 'totalSupply',
    'outputs': [
      {
        'name': '',
        'type': 'uint256',
      },
    ],
    'payable': false,
    'stateMutability': 'view',
    'type': 'function',
  },
  {
    'constant': false,
    'inputs': [
      {
        'name': '_from',
        'type': 'address',
      },
      {
        'name': '_to',
        'type': 'address',
      },
      {
        'name': '_value',
        'type': 'uint256',
      },
    ],
    'name': 'transferFrom',
    'outputs': [
      {
        'name': '',
        'type': 'bool',
      },
    ],
    'payable': false,
    'stateMutability': 'nonpayable',
    'type': 'function',
  },
  {
    'constant': true,
    'inputs': [],
    'name': 'decimals',
    'outputs': [
      {
        'name': '',
        'type': 'uint8',
      },
    ],
    'payable': false,
    'stateMutability': 'view',
    'type': 'function',
  },
  {
    'constant': true,
    'inputs': [
      {
        'name': '_owner',
        'type': 'address',
      },
    ],
    'name': 'balanceOf',
    'outputs': [
      {
        'name': 'balance',
        'type': 'uint256',
      },
    ],
    'payable': false,
    'stateMutability': 'view',
    'type': 'function',
  },
  {
    'constant': true,
    'inputs': [],
    'name': 'symbol',
    'outputs': [
      {
        'name': '',
        'type': 'string',
      },
    ],
    'payable': false,
    'stateMutability': 'view',
    'type': 'function',
  },
  {
    'constant': false,
    'inputs': [
      {
        'name': '_to',
        'type': 'address',
      },
      {
        'name': '_value',
        'type': 'uint256',
      },
    ],
    'name': 'transfer',
    'outputs': [
      {
        'name': '',
        'type': 'bool',
      },
    ],
    'payable': false,
    'stateMutability': 'nonpayable',
    'type': 'function',
  },
  {
    'constant': true,
    'inputs': [
      {
        'name': '_owner',
        'type': 'address',
      },
      {
        'name': '_spender',
        'type': 'address',
      },
    ],
    'name': 'allowance',
    'outputs': [
      {
        'name': '',
        'type': 'uint256',
      },
    ],
    'payable': false,
    'stateMutability': 'view',
    'type': 'function',
  },
  {
    'payable': true,
    'stateMutability': 'payable',
    'type': 'fallback',
  },
  {
    'anonymous': false,
    'inputs': [
      {
        'indexed': true,
        'name': 'owner',
        'type': 'address',
      },
      {
        'indexed': true,
        'name': 'spender',
        'type': 'address',
      },
      {
        'indexed': false,
        'name': 'value',
        'type': 'uint256',
      },
    ],
    'name': 'Approval',
    'type': 'event',
  },
  {
    'anonymous': false,
    'inputs': [
      {
        'indexed': true,
        'name': 'from',
        'type': 'address',
      },
      {
        'indexed': true,
        'name': 'to',
        'type': 'address',
      },
      {
        'indexed': false,
        'name': 'value',
        'type': 'uint256',
      },
    ],
    'name': 'Transfer',
    'type': 'event',
  },
];
const EVENT_TOKEN_LOCKED = 'TokenLocked';

const DEFAULT_TEZOS_FEES = 100000;
const DEFAULT_TEZOS_GAS_LIMIT = 1000000;
const DEFAULT_TEZOS_STORAGE_LIMIT = 5000;

const CHAIN_TYPES = {
  TEZOS: 'tezos',
  EVM: 'evm',
};

const TOKEN_MAPPING = JSON.parse(process.env.TOKEN_MAPPING || '{}');

const _fromBytes = (bytes) => {
  bytes = bytes.indexOf('0x') === 0 ? bytes : '0x' + bytes;
  return web3Utils.toAscii(bytes);
};

const _toString = (object) => {
  const keys = Object.keys(object);
  keys.forEach((key) => {
    if (typeof object[key] === 'object') {
      _toString(object[key]);
    } else if (object[key]) {
      object[key] = `${object[key]}`;
    }
  });

  return object;
};

module.exports = function(Transfer) {
  const _processChain = (sourceId, destId, blocks, cb) => {
    const block = Number(blocks[sourceId] || CHAINS[sourceId].defaultBlock);
    _getEventsFromBlock(block, sourceId, (err, events) => {
      if (err) return cb(err);
      _processEvents(sourceId, destId, events, (err) => {
        if (err) return cb(err);
        cb();
      });
    });
  };

  const _getEventsFromBlock = (block, chainId, cb) => {
    _getCurrentBlock(chainId, (err, currentBlock) => {
      if (err) return cb(err);
      const rpcUrl = CHAINS[chainId].rpcUrl;
      if (CHAINS[chainId].type === CHAIN_TYPES.TEZOS) {
        const tezos = new TezosToolkit(rpcUrl);
        tezos.contract.at(CHAINS[chainId].locker).then((contract) => {
          contract.storage().then((contractStorage) => {
            const blocks = _.range(block, currentBlock + 1);
            const events = [];
            async.eachLimit(blocks, 10, (blockId, next) => {
              let contractEvents = contractStorage.events.get(BigNumber(blockId));
              // contractStorage.events.get(blockId).then((contractEvents) => {
              contractEvents = contractEvents || [];
              events.push(...contractEvents.map(e => ({
                from: e.from_,
                to: e.to_,
                token: e.token_,
                value: e.value_,
                block: blockId,
              })));
              next();
              // }).catch(next);
            }, (err) => {
              if (err) return cb(err);
              return cb(null, events);
            });
          }).catch(cb);
        }).catch(cb);
      } else if (CHAINS[chainId].type === CHAIN_TYPES.EVM) {
        const web3 = new Web3(rpcUrl);
        const contract = new web3.eth.Contract(TOKEN_LOCKER_ABI, CHAINS[chainId].locker);
        contract.getPastEvents('allEvents', {fromBlock: block, toBlock: currentBlock}).then((events) => {
          return cb(null, events.filter(e => e.event === EVENT_TOKEN_LOCKED).map(e => ({
            from: e.returnValues.from,
            to: e.returnValues.to,
            token: e.returnValues.token,
            value: BigNumber(e.returnValues.value),
            block: e.blockNumber,
          })));
        }).catch(cb);
      } else {
        return cb('Unknown chain type');
      }
    });
  };

  const _processEvents = (sourceId, destId, events, cb) => {
    async.each(events, (ev, next) => {
      const transfer = {
        sourceChain: CHAINS[sourceId].name,
        sourceBlock: ev.block,
        sourceToken: ev.token,
        amount: ev.value,
        from: ev.from,
        to: _fromBytes(ev.to),
        destChain: CHAINS[destId].name,
        destToken: TOKEN_MAPPING[ev.token],
        status: 'pending',
      };
      Transfer.findOne({where: {
        sourceChain: transfer.sourceChain,
        sourceBlock: transfer.sourceBlock,
        sourceToken: transfer.sourceToken,
        amount: transfer.amount,
        from: transfer.from,
        to: transfer.to,
        destChain: transfer.destChain,
        destToken: transfer.destToken,
      }}, (err, found) => {
        if (err) return next(err);
        if (!found) {
          Transfer.create(transfer, (err, transfer) => {
            if (err) return next(err);
            _unlockTransfer(destId, transfer, (err) => {
              if (err) return next(err);
              next();
            });
          });
        } else {
          console.log('Transfer already processed, ignoring...');
          next();
        }
      });
    }, cb);
  };

  const _unlockTransfer = (chainId, transfer, cb) => {
    console.log('Unlocking ' + transfer.amount + ' of ' + transfer.destToken + ' to ' + transfer.to + ' on ' + transfer.destChain);
    if (CHAINS[chainId].type === CHAIN_TYPES.TEZOS) {
      _unlockTransferTezos(chainId, transfer, cb);
    } else if (CHAINS[chainId].type === CHAIN_TYPES.EVM) {
      _unlockTransferEvm(chainId, transfer, cb);
    } else {
      return cb('Unknown chain type');
    }
  };

  const _unlockTransferTezos = (chainId, transfer, cb) => {
    const saveError = (err) => {
      transfer.status = 'error';
      transfer.error = err.message || err;
      console.log(transfer.error);
      transfer.save((err) => {
        if (err) console.log(err);
        cb();
      });
    };
    const tezos = new TezosToolkit(CHAINS[chainId].rpcUrl);

    const signer = new InMemorySigner(CHAINS[chainId].privateKey);
    const source = CHAINS[chainId].address;
    // We add the branch, the source and the counter to the operation object
    tezos.rpc.getContract(source).then(({counter}) => {
      counter = parseInt(counter || '0', 10) + 1;
      tezos.rpc.getBlockHeader().then(({hash}) => {
        const contents = [];

        tezos.contract.at(CHAINS[chainId].locker).then((contract) => {
          createTransferOperation(
            Object.assign(
              {},
              contract.methods.unlock(transfer.to, transfer.destToken, transfer.amount).toTransferParams(),
              {
                fee: DEFAULT_TEZOS_FEES,
                gasLimit: DEFAULT_TEZOS_GAS_LIMIT,
                storageLimit: DEFAULT_TEZOS_STORAGE_LIMIT,
              }
            )
          ).then((rpcTransferOperation) => {
            contents.push(
              Object.assign(
                {},
                rpcTransferOperation,
                {
                  source,
                  counter,
                }
              )
            );

            const op = {
              branch: hash,
              contents,
            };
            // We forge the operation
            tezos.rpc.forgeOperations(_toString(op)).then((forgedOp) => {
              signer.sign(forgedOp, new Uint8Array([3])).then((signed) => {
                tezos.rpc.injectOperation(signed.sbytes).then((hash) => {
                  console.log(hash);
                  transfer.status = 'finished';
                  transfer.save((err) => {
                    if (err) console.log(err);
                    cb();
                  });
                }).catch(saveError);
              }).catch(saveError);
            }).catch(saveError);
          }).catch(saveError);
        }).catch(saveError);
      }).catch(saveError);
    }).catch(saveError);
  };

  const _unlockTransferEvm = (chainId, transfer, cb) => {
    const saveError = (err) => {
      transfer.status = 'error';
      transfer.error = err.message || err;
      console.log(transfer.error);
      transfer.save((err) => {
        if (err) console.log(err);
        cb();
      });
    };

    const web3 = new Web3(CHAINS[chainId].rpcUrl);
    const contract = new web3.eth.Contract(TOKEN_LOCKER_ABI, CHAINS[chainId].locker);
    const source = CHAINS[chainId].address;
    web3.eth.getTransactionCount(source, 'pending').then(nonce => {
      web3.eth.getGasPrice().then((gasPrice) => {
        const gasPriceHex = web3.utils.toHex(gasPrice);
        const details = {
          'to': CHAINS[chainId].locker,
          'value': '0x0',
          'gas': 200000,
          'gasPrice': gasPriceHex,
          'data': contract.methods['unlock'](transfer.destToken, transfer.to, transfer.amount).encodeABI(),
          'nonce': nonce,
          'chainId': CHAINS[chainId].chainId,
        };

        const transaction = new EthereumTx(details, {chainId: CHAINS[chainId].chainId});
        const privKey = Buffer.from(CHAINS[chainId].privateKey.replace('0x', ''), 'hex');
        transaction.sign(privKey);

        const serializedTransaction = transaction.serialize();

        web3.eth.sendSignedTransaction('0x' + serializedTransaction.toString('hex')).on('receipt', () => {
          transfer.status = 'finished';
          transfer.save((err) => {
            if (err) console.log(err);
            cb();
          }).catch(saveError);
        }).catch(saveError);
      }).catch(saveError);
    }).catch(saveError);
  };

  const _getCurrentBlock = (chainId, cb) => {
    const rpcUrl = CHAINS[chainId].rpcUrl;
    if (CHAINS[chainId].type === CHAIN_TYPES.TEZOS) {
      const tezos = new TezosToolkit(rpcUrl);
      tezos.rpc.getBlock().then((block) => {
        return cb(null, Number(block.header.level) - CONFIRMATIONS);
      }).catch(cb);
    } else if (CHAINS[chainId].type === CHAIN_TYPES.EVM) {
      const web3 = new Web3(rpcUrl);
      web3.eth.getBlockNumber().then((currentBlock) => {
        return cb(null, Number(currentBlock) - CONFIRMATIONS);
      }).catch(cb);
    } else {
      return cb('Unknown chain type');
    }
  };

  Transfer.processTokenBridge = (cb) => {
    console.log('Processing tokens to be bridged');
    Transfer.app.models.Config.findOne({where: {key: 'blocks'}}, (err, blocks) => {
      blocks = blocks || {};
      if (err) return cb(err);
      _processChain('1', '2', blocks, (err) => {
        if (err) console.log(err);
        _processChain('2', '1', blocks, (err) => {
          if (err) console.log(err);
          console.log('Finished');
          cb();
        });
      });
    });
  };

  /* setInterval(() => {
    Transfer.processTokenBridge(() => {});
  }, BRIDGE_INTERVAL); */
};
