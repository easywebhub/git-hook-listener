"use strict";

const Restify = require('restify');
const Path = require('path');
const Promise = require('bluebird');
const Fs = Promise.promisifyAll(require('fs-extra'));
const Url = require('url');
const SpawnShell = require('./spawn-shell');
const _ = require('lodash');
const ERROR = require('./error-code');
const argv = require('minimist')(process.argv.slice(2));

const DEBUG = /--debug/.test(process.argv);

const CONFIG_FILE = argv.config || './config.js';

if (DEBUG) {
    console.debug = console.log;
} else {
    console.debug = function () {
    };
}

// console.dir(Url.parse('https://nemesisqp:1de34154d635dab80c1395ed6cba04ec54ad36ae@github.com/nemesisqp/test-gh2.git'));
// console.dir(Url.parse('git@github.com:easywebhub/git-hook-listener.git'));

const AppInfo = JSON.parse(Fs.readFileSync('package.json'));
const GitHookHandler = require('./git-hook-handler');

process.on('uncaughtException', err => {
    console.warn('uncaughtException', err);
});

const timerMap = {};
function delay(ms, name, cb) {
    let timer = timerMap[name];
    clearTimeout(timer);
    timerMap[name] = setTimeout(() => {
        if (cb) cb();
        delete timerMap[name];
    }, ms);
}

// load config
let config;
try {
    config = require(CONFIG_FILE);
} catch (error) {
    console.error('load config failed', error.message);
    process.exit(1);
}

// create git hook handler
const gitHookHandler = new GitHookHandler({
    path: config.hookPath,
    secret: config.secret
});

// auto hot reload config, use old config if new config file is invalid
Fs.watch('config.js', {
    persistent: true,
    recursive: false
}, (eventType, filename) => {
    // console.log('eventType', eventType, filename);
    if (eventType !== 'change') return;
    delay(300, 'reloadConfig', function () {
        console.info('config change detected, start reload');
        let oldConfig = JSON.parse(JSON.stringify(config)); // simple clone js object
        try {
            delete require.cache[require.resolve(CONFIG_FILE)];
            config = require(CONFIG_FILE);
            console.info('reload config success');
        } catch (ex) {
            config = oldConfig;
            console.error('load new config failed, reuse old config, error', ex.message);
        }
    });
});

// gitlab payload https://gitlab.com/gitlab-org/gitlab-ce/blob/master/doc/web_hooks/web_hooks.md
// github payload https://developer.github.com/v3/activity/events/types/#pushevent
// function getPushBranch(event) {
//     return event.payload.ref.split('/').pop();
// }

function saveConfig() {
    let configData = `'use strict';
module.exports = ${JSON.stringify(config, null, 4)};
`;
    return Fs.writeFileAsync(CONFIG_FILE, configData);
}


function getPushEventInfo(event) {
    let branch = event.payload.ref.split('/').pop();
    let cloneUrl;
    if (event.payload.project) {
        // gitlab
        cloneUrl = event.payload.project['git_http_url'];
    } else {
        if (event.payload.repository['clone_url']) {
            // github
            cloneUrl = event.payload.repository['clone_url'];
        } else {
            // gogs
            cloneUrl = event.payload.repository['url'];
        }
    }

    let info = getRepoInfoFromUrl(cloneUrl);
    info.branch = branch;
    return info;
}

function getRepoInfoFromUrl(url) {
    if (url.startsWith('git@'))
        url = 'ssh://' + url;

    let uri = Url.parse(url);
    if (uri.pathname.endsWith('.git')) {
        uri.pathname = uri.pathname.slice(0, uri.pathname.length - 4);
    }

    let parts = uri.pathname.split('/');
    if (parts.length != 3)
        return null;
    let ret = {
        host: uri.host,
        group: parts[1],
        project: parts[2],
    };

    if (ret.group.startsWith(':'))
        ret.group = ret.group.slice(1);
    return ret;
}

function isFolderExists(localPath) {
    try {
        let stat = Fs.statSync(localPath);
        return stat.isDirectory();
    } catch (ex) {
        return false;
    }
}

function doGitCloneBranch(repoUrl, branch, repoLocalDirs, args) {
    args = args || [];
    let repoLocalDir = Path.resolve(repoLocalDirs);

    // check exist the repo
    let gitFolderPath = Path.join(repoLocalDir, '.git');
    let opts = {
        cwd: repoLocalDir + Path.sep
    };

    if (isFolderExists(gitFolderPath)) {
        // if exists call git pull
        console.debug('pull', repoUrl, branch, 'to', repoLocalDir);
        return SpawnShell('git', ['pull'], opts);
    } else {
        // if .git folder not exists remove exists folder and clone repos
        Fs.removeSync(repoLocalDir);
        Fs.mkdirSync(repoLocalDir);
        console.debug('clone', repoUrl, branch, 'to', repoLocalDir);
        let cloneArgs = ['clone', '-b', branch];

        cloneArgs = cloneArgs.concat(args); // add custom args
        cloneArgs.push(repoUrl);
        cloneArgs.push('.'); // clone to working directory 'cwd'
        console.debug('clone command args', cloneArgs);
        return SpawnShell('git', cloneArgs, opts);
    }
}

const gitCloneOrPullBranch = Promise.coroutine(function* (repoUrl, branch, repoLocalDirs, args) {
    if (isFolderExists(repoLocalDirs) === false)
        Fs.mkdirpSync(repoLocalDirs);

    return doGitCloneBranch(repoUrl, branch, repoLocalDirs, args);
});

gitHookHandler.on('error', err => {
    console.error('Error:', err.message);
});

gitHookHandler.on('push', Promise.coroutine(function* (event) {
    // console.debug(`got webhook event push`, event);

    let eventInfo = getPushEventInfo(event);
    console.debug('eventInfo', eventInfo);
    let matchRepositories = config.repositories.filter(repository => {
        let info = getRepoInfoFromUrl(repository.repoUrl);
        console.log('info', info);
        return repository.branch === eventInfo.branch &&
            info.host === eventInfo.host &&
            info.group === eventInfo.group &&
            info.project === eventInfo.project;
    });

    console.debug('matchRepositories', matchRepositories);

    if (matchRepositories.length === 0) {
        console.info(`no config found for this event`, eventInfo);
    }

    yield Promise.mapSeries(matchRepositories, Promise.coroutine(function* (repository) {
        try {
            let cloneBranch = repository.cloneBranch;
            if (!cloneBranch) cloneBranch = repository.branch;

            let output = yield gitCloneOrPullBranch(repository.repoUrl, cloneBranch, repository.path, repository.args);
            console.info('gitCloneOrPullBranch output', output);
            // process post actions
            if (repository.then) {
                let actions;
                // normalize actions
                if (typeof (repository.then) === 'object') {
                    if (Array.isArray(repository.then))
                        actions = repository.then;
                    else
                        actions = [repository.then];
                } else {
                    return;
                }

                if (actions && actions.length > 0) {
                    yield Promise.mapSeries(actions, Promise.coroutine(function* (action) {
                        console.info('run action', 'command', action.command, 'args', action.args);
                        try {
                            let output;
                            action.args = action.args || [];
                            action.options = action.options || {};
                            action.options.env = process.env;

                            if (action.command) {
                                output = yield SpawnShell(action.command, action.args, action.options);
                                console.info('action output', output);
                            }
                        } catch (ex) {
                            console.error('action error', ex);
                        }
                    }));
                }
            }
        } catch (error) {
            console.error('process webhook failed', error);
        }
    }));
}));

const server = Restify.createServer({
    name: AppInfo.name,
    version: AppInfo.version
});

server.pre(Restify.pre.userAgentConnection());
server.pre(Restify.pre.sanitizePath());

server.use(Restify.authorizationParser());
server.use(Restify.CORS());
server.use(Restify.queryParser());

// handle route hookPath
server.post(config.hookPath, (req, res, next) => {
    gitHookHandler.handle(req, res, next);
});

// admin route
function responseArraySuccess(res, data, headers) {
    headers = headers || {};
    res.json(200, {
        'data': data,
        "recordsFiltered": data.length,
        "recordsTotal": data.length
    }, headers);
}

function responseSuccess(res, data, headers) {
    headers = headers || {};
    res.json(200, data, headers);
}

function responseError(res, code, message) {
    if (typeof (code) === 'object') {
        res.json(code.code, {
            'error': {
                'statusCode': code.code,
                'message': code.message
            }
        });
    } else {
        res.json(code, {
            'error': {
                'statusCode': code,
                'message': message
            }
        });
    }
}

function checkAuth(req, res) {
    // check no acc in config
    if (!config.auth || config.auth.length === 0)
        return true;

    // check no auth data in request
    if (!req.authorization || !req.authorization.basic) {
        responseError(res, ERROR.UNAUTHORIZED);
        return false;
    }

    // check auth match
    let foundUser = _.some(config.auth, acc => {
        return acc.username === req.authorization.basic.username &&
            acc.password === req.authorization.basic.password;
    });

    if (!foundUser) {
        responseError(res, ERROR.UNAUTHORIZED);
        return false;
    }

    return true;
}

function checkConfigRepoIndex(req, res) {
    if (!req.params.index) {
        responseError(res, ERROR.MISSING_REPOSITORY_CONFIG_INDEX);
        return false;
    }

    let index = parseInt(req.params.index);

    if (isNaN(index) || !config.repositories[index]) {
        responseError(res, ERROR.INVALID_REPOSITORY_CONFIG_INDEX);
        return false;
    }

    return true;
}

// get repositories config list
server.get('/repositories', (req, res) => {
    if (!checkAuth(req, res)) return;
    // remove options.env
    try {
        config.repositories.forEach(function(repo){
            config.repositories[index].then.forEach(function(action){
                delete action.options.env;
            });
        });
    } catch(ex){}
    return responseArraySuccess(res, config.repositories);
});

// get single repository
server.get('/repositories/:index', (req, res) => {
    if (!checkAuth(req, res)) return;
    if (!checkConfigRepoIndex(req, res))
        return;
    let index = parseInt(req.params.index);

    // remove options.env
    try {
        config.repositories[index].then.forEach(function(action){
            delete action.options.env;
        })
    } catch(ex){}
    
    return responseSuccess(res, config.repositories[index]);
});


// add new repository config object
server.post('/repositories', (req, res) => {
    if (!checkAuth(req, res)) return;
    // push new config
    var repoConfigJson = '';
    req.on('data', function (data) {
        repoConfigJson += data;
    });

    req.on('end', function () {
        try {
            let newRepoConfig = JSON.parse(repoConfigJson);
            // TODO validate new config
            config.repositories.push(newRepoConfig);
            // TODO temporary disable hot reload ?
            saveConfig();
            return responseSuccess(res, newRepoConfig);
        } catch (error) {
            responseError(res, ERROR.INTERNAL_ERROR.code, error.message);
        }
    });
});

// update repository data at index
server.patch('/repositories/:index', (req, res) => {
    if (!checkAuth(req, res)) return;
    if (!checkConfigRepoIndex(req, res))
        return;

    let index = parseInt(req.params.index);

    var repoConfigJson = '';
    req.on('data', function (data) {
        repoConfigJson += data;
    });

    req.on('end', function () {
        try {
            let newRepoConfig = JSON.parse(repoConfigJson);
            // TODO validate new config
            // merge config
            config.repositories[index] = _.merge({}, config.repositories[index], newRepoConfig);
            // TODO temporary disable hot reload ?
            saveConfig();
            return responseSuccess(res, config.repositories[index]);
        } catch (error) {
            responseError(res, ERROR.INTERNAL_ERROR.code, error.message);
        }
    });
});

// remove repository at index
server.del('/repositories/:index', (req, res) => {
    if (!checkAuth(req, res)) return;
    if (!checkConfigRepoIndex(req, res))
        return;

    let index = parseInt(req.params.index);
    let removedList = config.repositories.splice(index, 1);
    // TODO temporary disable hot reload ?
    saveConfig();

    responseSuccess(res, removedList[0]);
});

// remove all repository
server.del('/repositories', (req, res) => {
    if (!checkAuth(req, res)) return;
    if (!checkConfigRepoIndex(req, res))
        return;

    let removedList = config.repositories;
    config.repositories = [];

    saveConfig();

    responseArraySuccess(removedList);
});

server.listen(config.port, config.host, () => {
    console.info(`${server.name} listening at ${server.url}`);
});
