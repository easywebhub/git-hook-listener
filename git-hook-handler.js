'use strict';

const EventEmitter = require('events');
const Crypto = require('crypto');
const BufferList = require('bl');

const WEB_HOOK_EVENTS = {
    '*':                           'Any time any event is triggered',
    'commit_comment':              'Any time a Commit is commented on',
    'create':                      'Any time a Repository, Branch, or Tag is created',
    'delete':                      'Any time a Branch or Tag is deleted',
    'deployment_status':           'Any time a deployment for the Repository has a status update from the API',
    'deployment':                  'Any time a Repository has a new deployment created from the API',
    'fork':                        'Any time a Repository is forked',
    'gollum':                      'Any time a Wiki page is updated',
    'issue_comment':               'Any time an Issue is commented on',
    'issues':                      'Any time an Issue is opened or closed',
    'member':                      'Any time a User is added as a collaborator to a non-Organization Repository',
    'page_build':                  'Any time a Pages site is built or results in a failed build',
    'public':                      'Any time a Repository changes from private to public',
    'pull_request_review_comment': 'Any time a Commit is commented on while inside a Pull Request review (the Files Changed tab)',
    'pull_request':                'Any time a Pull Request is opened, closed, or synchronized (updated due to a new push in the branch that the pull request is tracking)',
    'push':                        'Any git push to a Repository. This is the default event',
    'release':                     'Any time a Release is published in the Repository',
    'status':                      'Any time a Repository has a status update from the API',
    'team_add':                    'Any time a team is added or modified on a Repository',
    'watchAny':                    'time a User watches the Rep'
};

function signBlob(key, blob) {
    return 'sha1=' + Crypto.createHmac('sha1', key).update(blob).digest('hex');
}

function hasError(self, req, res, next, msg) {
    res.writeHead(400, {
        'content-type': 'application/json'
    });

    res.end(JSON.stringify({
        error: msg
    }));

    self.emit('error', new Error(msg), req);
}

function handleGithub(self, req, res, next) {
    console.log('on github handler');
    // if (req.url.split('?').shift() !== self.options.path)
    //     return next();

    let responseError = function (msg) {
        return hasError(self, req, res, next, msg);
    };

    var sig = req.headers['x-hub-signature'];
    var event = req.headers['x-github-event'];
    var id = req.headers['x-github-delivery'];

    if (self.options.secret && !sig)
        return responseError('No X-Hub-Signature found on request');

    if (!event)
        return responseError('No X-Github-Event found on request');

    if (!id)
        return responseError('No X-Github-Delivery found on request');

    console.log('check event index', !WEB_HOOK_EVENTS[event]);
    if (!WEB_HOOK_EVENTS[event])
        return responseError('X-Github-Event is not acceptable');

    req.pipe(BufferList(function (err, data) {
        if (err) {
            return responseError(err.message);
        }
        let obj;
        if (sig) {
            let computedSig = new Buffer(signBlob(self.options.secret, data));

            if (!(new Buffer(sig)).equals(computedSig))
                return responseError('X-Hub-Signature does not match blob signature')
        }

        try {
            obj = JSON.parse(data)
        } catch (e) {
            return responseError(e.message)
        }

        res.writeHead(200, {
            'content-type': 'application/json'
        });
        res.end('{"ok":true}');

        let emitData = {
            event:    event,
            payload:  obj,
            protocol: req.protocol,
            host:     req.headers['host'],
            url:      req.url
        };

        self.emit(event, emitData);
        self.emit('*', emitData);
    }));
}

function handleGitlab(self, req, res, next) {
    console.debug('on gitlab handler', req);
    // if (req.url.split('?').shift() !== self.options.path)
    //     return callback();

    let responseError = function (msg) {
        return hasError(self, req, res, next, msg);
    };

    let token = req.headers['x-gitlab-token'];
    let event = req.headers['x-gitlab-event'];
    if (event === 'Push Hook')
		event = 'push';

    if (!event)
        return hasError('No X-Gitlab-Event found on request');

    if (!WEB_HOOK_EVENTS[event])
        return responseError('X-Gitlab-Event is not acceptable');


    req.pipe(BufferList(function (err, data) {
        if (err)
            return hasError(err.message);

        let obj;
        if (token) {
            if (self.options.secret !== token)
                return responseError('X-Gitlab-Token does not match')
        }

        try {
            obj = JSON.parse(data)
        } catch (e) {
            return responseError(e.message)
        }

        res.writeHead(200, {
            'content-type': 'application/json'
        });
        res.end('{"ok":true}');

        if (req.headers['x-gitlab-event']) {
            event = obj['event_name'];
        }

        let emitData = {
            event:    event,
            payload:  obj,
            protocol: req.protocol,
            host:     req.headers['host'],
            url:      req.url
        };

        self.emit(event, emitData);
        self.emit('*', emitData);
    }));
}

function handleGogs(self, req, res, next) {
    console.debug('on gogs handler', req);
    // if (req.url.split('?').shift() !== options.path)
    //     return callback();

    let responseError = function (msg) {
        return hasError(self, req, res, next, msg);
    };

    let event = req.headers['x-gogs-event'];

    req.pipe(BufferList(function (err, data) {
        if (err)
            return hasError(err.message);

        let payload;
        try {
            payload = JSON.parse(data)
        } catch (e) {
            return responseError(e.message)
        }
        if (!event)
            return responseError('x-gogs-event found on request');

        //if (!id)
        // return hasError('No X-Github-Delivery or X-Gitlab-Delivery found on request')

        if (!WEB_HOOK_EVENTS[event])
            return responseError('X-Gogs-Event is not acceptable');

        if ((payload.secret || self.options.secret) && self.options.secret !== payload.secret) {
            return responseError('secret does not match')
        }

        res.writeHead(200, {
            'content-type': 'application/json'
        });
        res.end('{"ok":true}');

        let emitData = {
            event:    event,
            payload:  payload,
            protocol: req.protocol,
            host:     req.headers['host'],
            url:      req.url
        };
        // console.log('emitData', emitData);

        self.emit(event, emitData);
        self.emit('*', emitData);

    }));
    // console.log('post', post);
}

class GitHookHandler extends EventEmitter {
    constructor(options) {
        super();
        this.options = options;
    }

    handle(req, res, next) {
        let self = this;
        if (req.headers['x-github-event']) {
            handleGithub(self, req, res, next);
        } else if (req.headers['x-gitlab-event']) {
            handleGitlab(self, req, res, next);
        } else if (req.headers['x-gogs-event']) {
            handleGogs(self, req, res, next);
        } else {
            console.info('unsupported web hook event');
            next(new Error('unsupported web hook event'));
        }
    }
}

module.exports = GitHookHandler;
