"use strict";
const Promise = require('Bluebird'),
    ChildProcess = require('child_process');

function spawnShell(command, args, options) {
    let opts = options || {};
    return new Promise((resolve, reject) => {
        let out = '';
        let stdErr = '';

        let env = process.env;
        // bug ssl ca store not found
        env.GIT_SSL_NO_VERIFY = true;

        let newProcess = ChildProcess.spawn(command, args, {
            env,
            cwd: opts.cwd || {},
            shell: true
        });

        newProcess.on('error', err => {
            reject(err);
        });

        newProcess.stdout.on('data', data => {
            out += `${data}`;
        });
        newProcess.on('close', (code) => {
            out += `close code shell ', ${code}`
            resolve(out);
        });
    });
}

module.exports = spawnShell;