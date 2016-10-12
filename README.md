# How to push to Deploy 

## Steps to do
### 1.Prepare a deployed server, see [more](#prepare-a-deployed-server)
  + Install [NodeJS](https://nodejs.org/en/download/) and [Git](https://git-scm.com/downloads) corresponding to current OS
  + Use NodeJS to run this repo with below config
  + modify `port`, `secret`, `dataPath` on `config.js`
  + verify the operation with a sample repo
  
### 2.Add a repo to 'push-to-deploy', see [more](#add-and-config-a-new-repository)
  + Add a Web Hook on the Setting of this repo and verify
    - e.g. http://192.168.1.1:4567/web-hook
  + Add new repository setting on `config.js` on deployed server
  + verify the deployed folder exists after pushed
  
### 3.Create domain point to deploy server
  + Set up IIS website on Windows
  + Set up Nginx, Apache, ... on Linux
  
test here

## How to setup [`config.js`](https://github.com/easywebhub/git-hook-listener/blob/master/config.js):
```
module.exports = {
    host: '0.0.0.0',
    port: 4567,
    hookPath: '/web-hook',
    secret: 'bay gio da biet',
    dataPath: 'websites',
    repositories: {
        'testGhPages': {
            repositoryUrl: 'https://github.com/nemesisqp/test-gh2.git',
            branch: 'gh-pages',
            dataPath: 'otherPath' // optional
        }
    }
};
```
### Prepare a deployed server
- Open port 4567 (or your own port) on Deployed Server
  - Windows: open on Firewall
  - Ubuntu: ```sudo ufw allow 4567/tcp```,  ```sudo ufw enable```
- Edit common fields
  - `secret` value to pair between Deployed Server và Git Server (github, gitlab,...) 
  - `dataPath` : path to save deployed source

### Add and config a new repository
  - Add new setting to `repositories`, e.g
```
'testOtherBranch': {
            repositoryUrl: 'https://github.com/nemesisqp/test-gh2.git',
            branch: 'otherBranch'
        }
```