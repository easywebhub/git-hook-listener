## Git hook listener
Nghe webhook event sau đó clone hoặc pull repository đã config
#### Cài đặt: trong thư mục app chạy command line
`npm install`
#### Chạy app
`node index.js`
#### Debug mode
`node index.js --debug`

### Cấu hình ví dụ
```js
{
    host:         '0.0.0.0',
    port:         4567,
    hookPath:     '/webhook',
    secret:       'bay gio da biet',
    auth:         [
        {
            username: 'admin',
            password: '123'
        }
    ],
    repositories: [
        {
            repoUrl:     'https://username:password@github.com/nemesisqp/test-gh2.git',
            branch:      'master',
            cloneBranch: 'master',
            path:        'repositories/test',
            args:        [],
            then:        [
                {
                    command: 'git',
                    args:    ['aa'],
                    options: {}
                }
            ]
        }
    ]
}
```
### Options
* [host](#): Network interface app sẽ listen default 0.0.0.0 (required)
* [port](#): Cổng app sẽ listen (required)
* [hookPath](#): Url path config trên git server (required)
* [secret](#): Secret config tren git server (optional)
* [auth](#): Account basic auth có thể add config repository qua rest api (optional)
  * giá trị là mảng các đối tượng  `{ username: 'user', password: 'pass' }`
* [repositories](#repository): array các repository app sẽ xử lý (required)

### repository
* [repoUrl](#):  Url git repository sẽ pull hiện tại chỉ hỗ trợ http(s) url có username và password đi kèm (required)
* [branch](#):  Tên branch của webhook event mặc định là `master` (required)
* [cloneBranch](#):  Tên branch app sẽ clone `repoUrl` về local mặc định là sẽ bằng giá trị của `branch` option (optional)
* [args](#):  Các tham số truyền thêm cho lệnh `git clone` ví dụ `--depth=1`,  `--single-branch` (optional)
* [then](#action):  Mảng các lệnh sẽ chạy sau khi git clone hoặc pull xong (optional)

### action
* [command](#):  Lệnh sẽ chạy (required)
* [args](#):  parameters cho lệnh sẽ chạy (optional)
* [options](#):  các config thêm (optional) tài liệu chi tiết ở [nodejs spawn](https://nodejs.org/api/child_process.html#child_process_child_process_spawnsync_command_args_options)
 

### Edit repository config using REST API, pagination wrapper sẽ chỉnh lại khi team đồng ý chuẩn chung
### sử dụng basic Auth theo như trong config key `auth`
### Error response
```json
{
  "code": "ResourceNotFound",
  "message": "/repositories/1/2 does not exist"
}
```

### List web hook config `GET` `/repositories`
```json
{
  "data": [
    {
      "repoUrl": "https://:user:pass@github.com/nemesisqp/test-gh2.git",
      "branch": "master",
      "cloneBranch": "master",
      "path": "repositories/test",
      "args": [],
      "then": [
        {
          "command": "git",
          "args": [
            "aa"
          ],
          "options": {}
        }
      ]
    },
    {
      "repoUrl": "https://github.com/user/myRepo.git",
      "branch": "master",
      "cloneBranch": "master",
      "path": "repositories/test2",
      "args": []
    }
  ],
  "recordsFiltered": 2,
  "recordsTotal": 2
}
```

### Create new web hook config `POST` `/repositories`
#### JSON post data [repository](#repository)
```json
{
    "repoUrl":     "https://github.com/user/myRepo.git",
    "branch":      "master",
    "cloneBranch": "master",
    "path":        "repositories/test2",
    "args":        []
}
```
Response là object vừa thêm vào, cái này json file store nên không có thêm gì vô cả
```json
{
    "repoUrl":     "https://github.com/user/myRepo.git",
    "branch":      "master",
    "cloneBranch": "master",
    "path":        "repositories/test2",
    "args":        []
}
```

### Edit web hook config `PATCH` `/repositories/:configArrayIndex`
```json
{
	"cloneBranch": "deploy"
}
```
Response
```json
{
    "repoUrl":     "https://github.com/user/myRepo.git",
    "branch":      "master",
    "cloneBranch": "deploy",
    "path":        "repositories/test2",
    "args":        []
}
```

### Delete a web hook config `DELETE` `/repositories/:configArrayIndex`
Response just deleted web hook config
```json
{
    "repoUrl":     "https://github.com/user/myRepo.git",
    "branch":      "master",
    "cloneBranch": "deploy",
    "path":        "repositories/test2",
    "args":        []
}
```
