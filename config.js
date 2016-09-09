'use strict';

module.exports = {
    host: '0.0.0.0',
    port: 4567,
    hookPath: '/web-hook',
    secret: 'bay gio da biet',
    dataPath: 'repositories',
    repositories: {
        'github.com/nemesisqp/test-gh2': {
            repositoryUrl: 'https://github.com/nemesisqp/test-gh2.git',
            branch: 'gh-pages',
            dataPath: 'bbb'
        },
        'gitlab.com/ndqphuong/test-web-hook': {
            repositoryUrl: 'https://ndqphuong:Ccc5rzQR2H-s7FfSyzxj@gitlab.com/ndqphuong/test-web-hook.git',
            branch: 'master',
            dataPath: 'ccc'
        }
    }
};
