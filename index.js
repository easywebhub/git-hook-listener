'use strict';

const http = require('http');
const path = require('path');
const Promise = require('bluebird');
const ChildProcess = require('child_process');
const fs = require('fs');
const fse = require('fs-extra');
var express = require('express');
var bodyParser = require('body-parser');
var githubMdw = require("./middlewares/github-signature");

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
 * @returns path of repo or ||
 */
function getPushBranch(event) {
    return event.payload.ref.split('/').pop();
}

/* *
 * @param {any} pushEvent
 * @returns a key of config.repositories
 */
function getRepoKey(pushEvent) {
    try {
        let nameSpace = '';
        let branch = getPushBranch(pushEvent);
        if (pushEvent.payload.project) {

            nameSpace = `${pushEvent.payload.project['path_with_namespace']}`;
        } else {

            nameSpace = `${pushEvent.payload.repository['full_name']}`;
        }
        let repoPath = Object.keys(config.repositories).filter(key => config.repositories[key].repositoryUrl.indexOf(nameSpace) !== -1 && config.repositories[key].branch === branch);
        return repoPath.shift() || '';
    } catch (ex) {
        console.log('not supported push payload', pushEvent);
        return '';
    }
}

function isFolderExists(localPath) {
    try {
        let stat = fs.statSync(localPath);
        return stat.isDirectory();
    } catch (ex) {
        return false;
    }
}

function spawnShell(command, args, opts) {
    // opts = opts || {};
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
            out += `${data}`
        });

        newProcess.stderr.on('data', data => {
            stdErr += `${data}`;
            reject(stdErr);
        });

        newProcess.on('close', (code) => {
            out += `close code shell ', ${code}`
            resolve(out);
        });
    });
}

function doGitCloneBranch(repoUrl, branch, repoLocalDirs) {
    let repoLocalDir = path.resolve(repoLocalDirs);

    // check exist the repo
    let gitFolderPath = path.join(repoLocalDir, '.git');
    let opts = {
        cwd: repoLocalDir + path.sep
    };

    if (isFolderExists(gitFolderPath)) {
        // if exists call git pull
        console.log('pull', repoUrl, branch, 'to', repoLocalDir);
        return Promise.resolve(spawnShell('git', ['pull'], opts));
    } else {
        // if .git folder not exists
        fse.removeSync(repoLocalDir);
        fs.mkdirSync(repoLocalDir);
        console.log('clone', repoUrl, branch, 'to', repoLocalDir);
        return Promise.resolve(spawnShell('git', ['clone', '-b', branch, '--single-branch', repoUrl, '.'], opts));
    }
}

function gitCloneOrPullBranch(repoUrl, branch, repoLocalDirs) {
    console.log(repoLocalDirs);
    if (isFolderExists(repoLocalDirs) === false)
        fse.mkdirpSync(repoLocalDirs);

    return Promise.resolve(doGitCloneBranch(repoUrl, branch, repoLocalDirs));
}

var app = express()
app.use(githubMdw.verifyHmac)
app.use(bodyParser.urlencoded({
    extended: false
}))
app.use(bodyParser.json())


app.post('/web-hook', function (req, res, err) {
    handler(req, res, function (err) {
        console.log(req.body);
        if (err) {
            console.log(err);
        }
        res.statusCode = 404;
        res.end('no such location');
    })
});

app.listen(config.port, function () {

    console.log(`git hook listener server listening on ${config.host}:${config.port}`);
});

handler.on('error', err => {
    console.error('Error:', err.message);
})

handler.on('push', event => {
    console.log(`ON PUSH ${new Date()}`);
    let repoKey = getRepoKey(event);
    if (!repoKey) {
        console.log('not found repo');
        return;
    }
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
    // let repoFolderName = genRepoFolderName(repoKey);

    let dataPath = repoConfig.dataPath || '';
    if (!dataPath)
        dataPath = path.join(config.dataPath, repoKey);

    gitCloneOrPullBranch(
        repoConfig.repositoryUrl,
        repoConfig.branch,
        dataPath
    ).then(rs => {
        console.log('END: ', rs)
    }).catch(ex => {
        console.log('git error', ex)
    });

})