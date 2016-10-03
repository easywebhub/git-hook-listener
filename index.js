'use strict';

const http = require('http');
const url = require('url');
const path = require('path');
// const mkdirp = require('mkdirp');
const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const ChildProcess = require('child_process');
const fse = require('fs-extra');
// const rimrafAsync = Promise.promisify(require('rimraf'));
const createHandler = require('./github-webhook-handler/index.js');
const config = require('./config.js');
const handler = createHandler({
    path: config.hookPath,
    secret: config.secret
});

process.on('uncaughtException', err => {
    console.log(err);
});

// gitlab payload https://gitlab.com/gitlab-org/gitlab-ce/blob/master/doc/web_hooks/web_hooks.md
// github payload https://developer.github.com/v3/activity/events/types/#pushevent

/*
 * getRepoKey(pushEvent)
 * key is github.com/:username/:projectName
 * @param {any} pushEvent
 * @returns
 */
function getRepoKey(pushEvent) {
    try {
        if (pushEvent.payload.project) {
            // gitlab "path_with_namespace":"mike/diaspora",
            let hostname = url.parse(pushEvent.payload.project['web_url']).hostname;
            return `${hostname}/${pushEvent.payload.project['path_with_namespace']}`;
        } else {
            // github "full_name": "baxterthehacker/public-repo",
            let hostname = url.parse(pushEvent.payload.repository['html_url']).hostname;
            return `${hostname}/${pushEvent.payload.repository['full_name']}`;
        }
    } catch (ex) {
        console.log('not supported push payload', pushEvent);
        return '';
    }
}

// github_com_:username_:projectName
function genRepoFolderName(repoKey) {
    let rpk = repoKey;
    rpk = rpk.replace(/\./g, '_');
    return rpk.replace(/\//g, '_');
}

function getPushBranch(event) {
    return event.payload.ref.split('/').pop();
}

function isFolderExists(localPath) {
    try {
        let stat = fs.statSync(localPath);
        return stat.isDirectory();
    } catch (_) {
        return false;
    }
}

function spawnShell(command, args, opts) {
    opts = opts || {};
    return new Promise((resolve, reject) => {
        let out = '';
        let stdErr = '';

        let env = process.env;
        // bug ssl ca store not found
        env.GIT_SSL_NO_VERIFY = true;

        let newProcess = ChildProcess.spawn(command, args, {
            env: env,
            cwd: opts.cwd || {},
            shell: true
        });

        newProcess.on('error', err => {
            reject(err);
        });

        newProcess.stdout.on('data', data => {
            out += `${data}`
        });

        newProcess.stderr.on('data', data => {
            stdErr += `${data}`
        });

        newProcess.on('close', (code) => {
            console.log('close code shell ', code);
            //to-do check flow ...
            if (code === 0) {
                resolve(out);
            } else {
                reject(stdErr);
            }
        });
    });
}

function doGitCloneBranch(repoUrl, branch, repoLocalDirs) {
    let repoLocalDir = path.resolve(repoLocalDirs);
    let gitFolderPath = path.join(repoLocalDir, '.git');
    let opts = {
        cwd: repoLocalDir + path.sep
    };
    if (isFolderExists(repoLocalDir)) {
        // if exists call git pull
        console.log('pull', repoUrl, branch, 'to', repoLocalDir);
        return Promise.resolve(spawnShell('git', ['pull'], opts));
    } else {
        // if .git folder not exists delete all file and folder
        fse.removeSync(repoLocalDir);
        fs.mkdirSync(repoLocalDir);
        console.log('clone', repoUrl, branch, 'to', repoLocalDir);
        return Promise.resolve(spawnShell('git', ['clone', '-b', branch, '--single-branch', repoUrl, '.'], opts));
    }
};

function gitCloneOrPullBranch(repoUrl, branch, repoLocalDirs) {
    console.log(repoLocalDirs);
    if (isFolderExists(repoLocalDirs) === false)
        fse.mkdirpSync(repoLocalDirs);

    return Promise.resolve(doGitCloneBranch(repoUrl, branch, repoLocalDirs));
}


const server = http.createServer((req, res) => {
    handler(req, res, function (err) {
        res.statusCode = 404;
        res.end('no such location');
    })
}).listen(config.port, config.host, () => {
    console.log(`git hook listener server listening on ${config.host}:${config.port}`);
});

handler.on('error', err => {
    console.error('Error:', err.message);
})

handler.on('push', event => {
    console.log('on push');
    let repoKey = getRepoKey(event);
    let branch = getPushBranch(event);
    let repoConfig = config.repositories[repoKey];

    if (!repoConfig) {
        console.log(`no config for repos: ${event.payload.repository.name}`);
        return;
    }

    if (branch !== repoConfig.branch) {
        console.log(`repo ${event.payload.repository.name}, repoConfig branch "${repoConfig.branch}"" not match with push event branch "${branch}", do nothing`);
        return;
    }
    let repoFolderName = genRepoFolderName(repoKey);

    let dataPath = repoConfig.dataPath || '';
    if (!dataPath)
        dataPath = path.join(config.dataPath, repoFolderName);

    gitCloneOrPullBranch(
            repoConfig.repositoryUrl,
            repoConfig.branch,
            dataPath
        ).then(rs => {
            console.log('end=>: ', rs)
        })
        .catch(ex => {
            console.log('git error', ex)
        });

})