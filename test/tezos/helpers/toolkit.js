const { InMemorySigner } = require('@taquito/signer');
const { TezosToolkit } = require('@taquito/taquito');
const { spawn } = require('child_process');
const { delay } = require('../../helpers/utils');
const accounts = require('./accounts');

const alice = accounts[0];

function profiles() {
    return {
        default: {
            // used for local tests
            rpc: 'http://localhost:8732',
            ownerAddress: alice.pkh,
            secretKey: alice.sk,
        }
    };
}

const currentProfile = function () {
    let name = process.env.PROFILE || 'default';
    let profile = profiles()[name];
    if (!profile) {
        throw new Error(`No such profile: ${name}`);
    }
    return profile;
}

const tezosToolkit = function () {
    const profile = currentProfile();
    const rpc = process.env.RPC_URL || profile.rpc;
    const toolkit = new TezosToolkit(rpc);
    toolkit.setProvider({
        signer: new InMemorySigner(profile.secretKey),
        config: {
            confirmationPollingIntervalSecond: 1,
            confirmationPollingTimeoutSecond: 120,
        },
    });
    //toolkit.addExtension(new Tzip16Module());
    return toolkit;
}

const bakeBlock = function () {
    return new Promise((resolve, reject) => {
        // Use spawn() instead of exec() here so that the OS can take care of escaping args.
        let docker = spawn('docker', ['exec', 'my-sandbox', 'tezos-client', '--wait', 'none', '--endpoint', 'http://localhost:20000', '--base-dir', '/tmp/mininet-test/Client-base-C-N000', 'bake', 'for', 'bootacc-0', '--force', '--minimal-timestamp']);

        let stdout = '';
        let stderr = '';

        docker.stdout.on('data', data => {
            stdout += data;
        });

        docker.stderr.on('data', data => {
            stderr += data;
        });

        docker.on('close', code => {
            if (code != 0) {
                reject(stderr || stdout);
                return;
            }

            resolve(stdout.trim());
        });
    });
}

module.exports = {
    tezosToolkit,
    runOperation: async function (tezos, signer, what) {
        if (signer) {
            tezos.setSignerProvider(new InMemorySigner(signer.sk || signer));
        }
        let op = await what();
        let fetchedBlock = null;
        await bakeBlock();
    
        async function seenOperationInBlock(block) {
            let fetchedBlock = await tezos.rpc.getBlock(block ? { block } : undefined);
            if (fetchedBlock.operations.some(blockOps => blockOps.some(blockOp => blockOp.hash === op.hash))) {
                return fetchedBlock;
            }
            return null;
        }
    
        // confirmation() has a known issue with missed confirmations.
        // see https://github.com/ecadlabs/taquito/issues/276
    
        // check previous block first
        fetchedBlock = await seenOperationInBlock('head~1');
        if (fetchedBlock !== null) {
            return {op, block: fetchedBlock};
        }
    
        // keep looking
        const maxTries = 120;
        for (let i = 0; i < maxTries; i++) {
            fetchedBlock = await seenOperationInBlock()
            if (fetchedBlock !== null) {
                return {op, block: fetchedBlock};
            }
            await delay(500);
        }
    
        throw new Error(`Giving up after ${maxTries} tries waiting for a confirmation`);
    },
    currentProfile
}