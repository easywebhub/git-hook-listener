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
            "repoUrl": "http://qq:d65f1c188efa497d2e9d28f1ea83b42625b574b1ec7e98b02db1404a9882faf2@source.easywebhub.com/qq/test-pull.git",
            "branch": "gh-pages",
            "cloneBranch": "gh-pages",
            "path": "repositories/test-pull",
            "args": [],
            "then": [
                {
                    "command": "git",
                    "args": [
                        "remote", "add", "github", "https://thayUserNameVoDay:thayPassVoDay@github.com/nemesisqp/test-pull-dst.git"
                    ],
                    "options": {env: process.env, cwd: "repositories/test-pull"}
                },
                {
                    "command": "git",
                    "args": [
                        "push", "--force", "github", "gh-pages"
                    ],
                    "options": {env: process.env, cwd: "repositories/test-pull"}
                }
            ]
        }
    ]
};
