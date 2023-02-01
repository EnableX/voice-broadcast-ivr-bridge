# **Basic Client Examples to demonstrate Broadcast Calls using Enablex Voice APIs. **
This example contains instructions how users can initiate Broadcast Calls.


## Pre-requisite
- You will need Enablex Application credentials, APP ID and APP KEY. To find credentials, register with EnableX (https://portal.enablex.io/cpaas/trial-sign-up/).
- You will need a place for hosting this application either cloud or local machine.
- If hosting on local machine, you need to install ngrok from https://ngrok.com/


## Installation
- `git clone https://github.com/EnableX/voice-api-broadcast.git`
- `cd voice-api-broadcast`
- `npm install`


## Setting up configurations using environment variables

For Mac and Linux, open a terminal window and type the following commands. Note - Replace all the characters after the = with values from your EnableX account:

- Set APP ID and APP KEY. It is required configuration.
  - `export ENABLEX_APP_ID=`
  - `export ENABLEX_APP_KEY=`

- Set port. Default port is set to 3000. It is an optional configuration.
  - `export SERVICE_PORT=`

Windows

- Make a file with name ".env" in root directory . And copy content of .env.example in .env file . Then set the environment variables manually in .env file. And below are the environment variables.
  - `ENABLEX_APP_ID` , `ENABLEX_APP_KEY` , `SERVICE_PORT` 
  Their explanation is given in Linux/Mac section (Upper section).


## Webhook - EnableX will send HTTP requests to your application (`/event`) after certain events occur.

For Mac and Linux, open a terminal window and type the following commands. Note - Replace all the characters after the = with values from your EnableX account:

- If you have deployed this service on a web server which is publicly accessible, set the public URL. Example - `https://{PUBLIC_URL}`
  - `export PUBLIC_WEBHOOK_URL=`
- If you want to test this service on a web server running locally on your own computer at a given port, with ngrok, you can generate URL that tunnels requests to your web server running locally. Once ngrok installed, run following -
  - `./ngrok http {SERVICE_PORT}` . It should provide you a ngrok URL something similar to `https://fc6c892d6cd7.ngrok.io`. Now, Set the ngrok URL. Example - `https://fc6c892d6cd7.ngrok.io`
    - `export PUBLIC_WEBHOOK_URL=`
- Set to run the service on http / https (false / true)
  - `export LISTEN_SSL=`

Windows

 - In .env file also update these fields  `PUBLIC_WEBHOOK_URL`, `LISTEN_SSL`. Their explanation is given in Linux/Mac section (Upper section).

## SSL Certificate (Self Signed or Registered). It is required configuration if USE_PUBLIC_WEBHOOK is set to true or LISTEN_SSL is set to true.

Mac/Linux
  - Make a directory called certs on the root of the project
    - `mkdir certs`
  - Change to certs directory
    - `cd certs`
  - Create and Install certificates
    - `sudo openssl req -nodes -new -x509   -keyout example.key -out example.crt   -days 365   -subj '/CN=example.com/O=My Company Name LTD./C=US'; cat example.crt > example.ca-bundle`
  - use the certificate .key [self signed or registered]
    - `export CERTIFICATE_SSL_KEY=`
  - use the certificate .crt [self signed or registered]
    - `export CERTIFICATE_SSL_CERT=`
  - use the certificate CA[chain] [self signed or registered]
    - `export CERTIFICATE_SSL_CACERTS=`
  - switch to the root of the project
    - `cd ..`

Windows
 - Make a directory called certs on the root of the project
    - `mkdir certs`
  - Change to certs directory
    - `cd certs`
  - Create and Install certificates
    - `openssl req -nodes -new -x509   -keyout example.key -out example.crt   -days 365`   
    - `cat example.crt > example.ca-bundle`
  - Update the values of `CERTIFICATE_SSL_KEY`, `CERTIFICATE_SSL_CERT` and `CERTIFICATE_SSL_CACERTS` if you want to change the locations of .crt, .key and ca-bundle files or else ignore this step.
  - switch to the root of the project
    - `cd ..`



## Starting the client application script
- For Broadcast Calls
  - `node client-broadcast.js`
