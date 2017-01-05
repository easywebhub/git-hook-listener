'use strict';
module.exports = {
    "host": "127.0.0.1",
    "port": 8001,
    "hookPath": "/web-hook",
    "secret": "bay gio da biet",
    "auth": [
    ],
    "repositories": [
        {
            "repoUrl": "git@gitlab.com:nerve/alice.git",
            "branch": "master",
            "cloneBranch": "master",
            "path": "../alice",
            "args": [],
            "then": [
                {
                    "command": "pm2",
                    "args": [
                        "restart", "alice"
                    ],
                    "options": {env: process.env}
                }
            ]
        }
    ]
};
