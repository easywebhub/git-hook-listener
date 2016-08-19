'use strict';

// single hook path for many repos

const HOST = '0.0.0.0';
const PORT = 18000;
const HOOK_PATH = '/web-hook';
const SECRET = 'bay gio da biet';

const http = require('http');
const path = require('path');
const spawn = require('child_process').spawn;
const createHandler = require('github-webhook-handler');
const handler = createHandler({ path: HOOK_PATH, secret: SECRET });

process.on('uncaughtException', err => {
  console.log(err);
});

// gitlab payload https://gitlab.com/gitlab-org/gitlab-ce/blob/master/doc/web_hooks/web_hooks.md
// github payload https://developer.github.com/v3/activity/events/types/#pushevent

function getReposKey(event) {
  try {
    if (event.payload.project) {
      // gitlab "path_with_namespace":"mike/diaspora",
      return event.payload.project['path_with_namespace'];
    } else {
      // github "full_name": "baxterthehacker/public-repo",
      return event.payload.repository['full_name'];
    }
  } catch (ex) {
    console.log('not supported push payload', event);
    return '';
  }
}

// TODO load config from json ?
const pushHandlers = {
  'nemesisqp/test-gh2': (key, event) => {
    // do whatever you want
    // e.g. call git pull in ./local-project/test-gh2
    // NOTICE git permission (https://USERNAME:PASSWORD@) or GIT_SSH_COMMAND='ssh -i private_key_file' git clone host:repo.git if use ssh
    // notice cwd dir must exists or weird error will happend
    const childProcess = spawn('git', ['pull', 'origin', 'master'], {
      cwd: path.join(__dirname, 'local-project', 'nemesisqp_test-gh2'),
      shell: true,
      env: process.env
    });

    childProcess.stdout.on('data', (data) => {
      console.log(`repos handler ${key} stdout: ${data}`);
    });

    childProcess.stderr.on('data', (data) => {
      console.log(`repos handler ${key} stderr: ${data}`);
    });

    childProcess.on('close', (code) => {
      console.log(`repos handler ${key} child process exited with code ${code}`);
    });
  }
}

const server = http.createServer((req, res) => {
  handler(req, res, function (err) {
    res.statusCode = 404;
    res.end('no such location');
  })
}).listen(PORT, HOST, () => {
  console.log(`git hook listener server listening on ${HOST}:${PORT}`);
});

handler.on('error', function (err) {
  console.error('Error:', err.message);
})

handler.on('push', function (event) {
  let key = getReposKey(event);
  let handler = pushHandlers[key];
  if (!handler) {
    console.log(`no handler for repos: ${event.payload.repository.name}`);
    return;
  }
  // call handler
  handler(key, event);
})
