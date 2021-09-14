# Cross chain token bridge

The purpose of this project is to be the coordinating instance to bridge a token from any EVM chain to the Tezos blockchain or the other way around.

## Deployment
To deploy this project, you need to install node (14+)

Run the following command after cloning the project:

```npm install```

## Smart contracts

The bridge works by deploying a specific locking smart contract on each chain.
- [EVM smart contract](../contracts/tokenbridge/TokenLocker.sol)
- [Tezos smart contract](../ligo/tokenbridge/TokenLocker.ligo)

## Environment variables Configuration

- BRIDGE_INTERVAL: Interval between 2 checks of the bridging contracts (in milliseconds)
- CONFIRMATIONS: Number of confirmations to wait before processing the bridge between chains

- CHAIN1_NAME: name of the first chain
- CHAIN1_TYPE: type of the first chain (tezos|evm)
- CHAIN1_LOCKER: address of the deployed locking smart contract on the first chain
- CHAIN1_PRIVATE_KEY: address of the private key used by this bridge to sign the transactions on the first chain
- CHAIN1_ADDRESS: address of corresponding to the private key of this bridge
- CHAIN1_RPC_URL: url of the rpc node on the first chain
- CHAIN1_CHAIN_ID: (EVM only) ID of the first chain
- CHAIN1_DEFAULT_BLOCK: minimum start block for the scan of the first chain

- CHAIN2_NAME: name of the second chain
- CHAIN2_TYPE: type of the second chain (tezos|evm)
- CHAIN2_LOCKER: address of the deployed locking smart contract on the second chain
- CHAIN2_PRIVATE_KEY: address of the private key used by this bridge to sign the transactions on the second chain
- CHAIN2_ADDRESS: address of corresponding to the private key of this bridge
- CHAIN2_RPC_URL: url of the rpc node on the second chain
- CHAIN2_CHAIN_ID: (EVM only) ID of the second chain
- CHAIN2_DEFAULT_BLOCK: minimum start block for the scan of the second chain

- TOKEN_MAPPING: JSON serialized object of token mappings (ex: ```{"KT1NuYSsengcPew1MxSe3iUMtw4YB4kGHEq4":"0xE77e0560E6199eB0da5aC2A188A6FbaA6E4768eF","0xE77e0560E6199eB0da5aC2A188A6FbaA6E4768eF":"KT1NuYSsengcPew1MxSe3iUMtw4YB4kGHEq4"}```)

## Running

Run the following command to start the service:

```node .```

## Security

We take security very seriously, if you find any security related problem, drop us an email: [security@mtpelerin.com](mailto:security@mtpelerin.com)

## Disclaimer

This project is free software and is provided as is. You are solely responsible for the assets involved.