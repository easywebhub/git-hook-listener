# git-hook-listener
## usage:
- Open firewall port 18000 or change PORT config to opened port
- Hook listener server:
  - edit index.js change path and secret to your need
    ```
    const HOOK_PATH = '/web-hook';
    const SECRET = 'bay gio da biet';
    ```
  - add handler for each repository (notice key format 'nemesisqp/test-gh2') 
     ```
    const pushHandlers = {
    'nemesisqp/test-gh2': (key, event) => {
        // do whatever you want, call external .bat .sh file, or execute any js code
    ```
  - example use: auto call git pull on local repository on push event of remote git server
    - create local folder "local-project" inside "git-hook-listener" folder
    - go to "local-project" execute "git clone https://USERNAME:PASSWORD@github.com/user/project-name.git user_project-name"
    
- Go to github, gitlab or your git server admin page add webhook url: http[s]://HOST:PORT/HOOK_PATH and SECRET
    - e.g. http://192.168.1.1:18000/web-hook
    - HOST: git-hook-listener server ip or domain
    - PORT: 18000 or your changed port
    
- Done, any push on git server will call your handler code. 