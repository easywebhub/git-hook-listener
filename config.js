'use strict';

module.exports = {
    host: '0.0.0.0',
    port: 4567,
    hookPath: '/web-hook',
    secret: 'bay gio da biet',
    dataPath: 'repositories',
    repositories: {
        'test-github': {
            repositoryUrl: 'https://github.com/tungptvn/test-push-to-deploy.git',
            branch: 'master'
        },
        'gitlab.com/ndqphuong/test-web-hook': {
            repositoryUrl: 'https://ndqphuong:Ccc5rzQR2H-s7FfSyzxj@gitlab.com/ndqphuong/test-web-hook.git',
            branch: 'master',
            dataPath: 'ccc'
        },
        'test-ptd': {
            repositoryUrl: 'http://gitlab.vienthonga.com/phamthanhtung/test-ptd.git',
            branch: 'master'
        },
        'test': {
            repositoryUrl: 'http://git.easywebhub.com/tungptvn/test.git',
            branch: 'master',
            github: 'https://github.com/tungptvn/gogss.git'
        }
    }
}
