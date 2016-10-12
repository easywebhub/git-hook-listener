"use strict";
let spawn = require('./helpers/spawn');

/* @param {any} options 
 * {string} options.folderPath
 * {string} options.githubUrl
 */
function GithubMamager(options) {
    if (typeof options !== 'object') {
        return new TypeError('options invalid');
    }
    if (typeof options.folderPath !== 'string') {
        return new TypeError('folder path invalid');
    }
    if (typeof options.githubUrl !== 'string') {
        return new TypeError('githubUrl invalid');
    }
    let seft = this;
    seft.folderPath = options.folderPath;
    seft.githubUrl = options.githubUrl;

    // return Promise.resolve( spawn('git', ['push'], {} ));

}

function checkGithubRemoteExist(folderPath, githubUrl) {
    return new Promise((resolve, reject) => {
        spawn('git', ['remote', '-v'], {
                cwd: folderPath
            })
            .then(result => {
                if (result.indexOf(githubUrl) !== -1) {
                    resolve(true);
                }
                resolve(false);
            }).catch(err => reject(err));
    });
}


function addGithubRemoteUrl(folderPath, githubUrl) {
    return Promise.resolve(spawn('git', ['remote', 'add', 'github', githubUrl], {
        cwd: folderPath
    }));
}

function pushToGithub(folderPath) {
    let env = process.env;
    // bug ssl ca store not found
    env.GIT_SSL_NO_VERIFY = true;
    return Promise.resolve(spawn('git', ['push', 'github'], {
        cwd: folderPath,
        env: env
    }));
}

/**
 * https://github.com/easywebhub/git-hook-listener.git => /easywebhub/git-hook-listener
 * github Url
 * @param {string} url
 */
GithubMamager.getNameSpace = function (url) {
    return url.split('com').pop().split('.').shift();
};

/**
 * push to github
 * 
 * @returns
 */


GithubMamager.prototype.push = function () {

    return Promise.resolve(checkGithubRemoteExist(this.folderPath, this.githubUrl)
        .then(result => {
            if (result === true) {
                return pushToGithub(this.folderPath);
            } else {
                return addGithubRemoteUrl(this.folderPath, this.githubUrl)
                    .then(result => {
                        return pushToGithub(this.folderPath);
                    });
            }
        }));

};

module.exports = GithubMamager;