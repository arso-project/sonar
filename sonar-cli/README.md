# sonar-cli

CLI commands and utitilities for [sonar](https://github.com/arso-project/sonar).

```
sonar <command>

$ sonar help

Commands:
  bin.js db <command>      database
  bin.js fs <command>      file system
  bin.js island <command>  manage islands
  bin.js search <query>    make search queries
  bin.js server <command>  server
  bin.js ui [dev|serve]    ui

Options :
  --version       Version anzeigen                                     [boolean]
  --endpoint, -e  api endpoint url       [Standard: "http://localhost:9191/api"]
  --island, -i    island key or name                       [Standard: "default"]
  --help          Hilfe anzeigen                                       [boolean]

$ ./sonar server help

Commands:
  sonar server start  start the sonar server
  sonar server stop   stop server

$ ./sonar ui help

Commands:
  sonar ui dev    start sonar ui (dev mode)
  sonar ui serve  start sonar ui (dev mode)

$ ./sonar db help

Commands:
  sonar db get <id>           get records
  sonar db put [id]           put record from stdin
  sonar db put-schema [name]  put schema from stdin
  sonar db get-schema [name]  get schemas
  sonar db list-schemas       list schemas

