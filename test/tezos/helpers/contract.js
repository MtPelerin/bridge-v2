const accounts = require('./accounts');
const { runOperation } = require('./toolkit');
const { spawn } = require('child_process');

const CONTRACT_CACHE = {};

const contract = function (name, cb) {
    cb(accounts);
}

function unixPath(path) {
    if (process.platform == 'win32') {
        return path.replace(/\\/g, '/');
    }
    return path;
}

function execLigo(args) {
    return new Promise((resolve, reject) => {
        const ligoImage = 'ligolang/ligo:0.19.0';

        // Use spawn() instead of exec() here so that the OS can take care of escaping args.
        let docker = spawn('docker', ['run', '-v', `${process.cwd()}:/project`, '-w', '/project', '--rm', '-i', ligoImage].concat(args));

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

            const jsonContractOutput = stdout.trim();

            resolve(jsonContractOutput);
        });
    });
}

async function compileContract(sourcePath) {
    if (CONTRACT_CACHE[sourcePath]) return CONTRACT_CACHE[sourcePath];
    const contract = JSON.parse(await execLigo(['compile-contract', '--michelson-format=json', '--disable-michelson-typechecking', unixPath(sourcePath), 'main']));
    CONTRACT_CACHE[sourcePath] = contract;
    return contract;
}

contract.ContractBuilder = {
    new: async function(tezos, path, config, storage) {
        config = config || {};
        storage = storage || {};
        let originationOp = await runOperation(
            tezos,
            null, 
            async () => {
                try {
                    return await tezos.contract.originate({
                        code: await compileContract(path),
                        storage,
                        balance: config.balance,
                    })
                } catch (err) {
                    console.log(JSON.stringify(err));
                    throw new Error(err.message);
                }
            }
        );
        return await tezos.contract.at(originationOp.contractAddress);
    }
}

module.exports = contract;