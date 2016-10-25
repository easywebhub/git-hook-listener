"use strict";

const http = require('http');
const path = require('path');
const Promise = require('bluebird');
const fs = require('fs');
const fse = require('fs-extra');
const express = require('express');
const bodyParser = require('body-parser');
const createHandler = require('./github-webhook-handler/index.js');
var spawnShell = require('./helpers/spawn');
const config = require('./config.js');
var GithubMng = require('./github.mng');

const handler = createHandler({
    path: config.hookPath,
    secret: config.secret
});

process.on('uncaughtException', err => {
    console.log(err);
});


// gitlab payload https://gitlab.com/gitlab-org/gitlab-ce/blob/master/doc/web_hooks/web_hooks.md
// github payload https://developer.github.com/v3/activity/events/types/#pushevent

function getPushBranch(event) {
    return event.payload.ref.split('/').pop();
}

/*
 * getRepoKey(pushEvent)
 * key is github.com/:username/:projectName/:branch
 * @returns a key of config.repositories
 * @param {any} pushEvent
 */
function getRepoKey(pushEvent) {
    try {
        let nameSpace = '';
        let branch = getPushBranch(pushEvent);
        if (pushEvent.payload.project) {

            nameSpace = `${pushEvent.payload.project.path_with_namespace}`;
        } else {

            nameSpace = `${pushEvent.payload.repository.full_name}`;
        }
        let repoPath = Object.keys(config.repositories).filter(key => {
            let repoName = config.repositories[key].repositoryUrl.split('/').pop().split('.').shift();
            return repoName == nameSpace.split('/').pop() && config.repositories[key].branch === branch
        });
        return repoPath.shift() + '/' + branch || '';
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

var app = express();


app.post('/web-hook', function (req, res, err) {
    handler(req, res, function (err) {
        console.log(req.body);
        if (err) {
            console.log(err);
        }
        res.statusCode = 404;
        res.end('no such location');
    });
});

app.listen(config.port, function () {

    console.log(`git hook listener server listening on ${config.host}:${config.port}`);
});

handler.on('error', err => {
    console.error('Error:', err.message);
});

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
    let GH = new GithubMng({
        folderPath: dataPath,
        githubUrl: ' https://github.com/tungptvn/gogss.git'
    });


    gitCloneOrPullBranch(
        repoConfig.repositoryUrl,
        repoConfig.branch,
        dataPath
    ).then(rs => {
        console.log('END: ', rs);


        GH.push().then(result => {
            console.log('push to github: ', result);
        });
    }).catch(ex => {
        console.log('git error', ex)
    });

});