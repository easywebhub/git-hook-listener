'use strict';

const Promise = require('bluebird');
const ChildProcess = require('child_process');

function spawnShell(command, args, options) {
    options = options || {};
    options.shell = true;

    let stdout = '';
    let stderr = '';

    options.env = options.env || {};
    options.env.GIT_SSL_NO_VERIFY = true; // bug ssl ca store not found

    return new Promise((resolve, reject) => {
        let process = ChildProcess.spawn(command, args, options);

        process.on('error', err => {
            reject(err);
        });

        process.stdout.on('data', data => {
            stdout += `${data}`.trim();
        });

        process.stderr.on('data', data => {
            stderr += `${data}`.trim();
        });

        process.on('close', (code) => {
            if (code === 0) {
                resolve(stdout);
            } else {
                reject(stderr);
            }
        });
    });
}

module.exports = spawnShell;
