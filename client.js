// core modules
const fs = require('fs');
const http = require('http');
const https = require('https');
// modules installed from npm
const { EventEmitter } = require('events');
const express = require('express');
const bodyParser = require('body-parser');
const { createDecipher } = require('crypto');
require('dotenv').config();
const _ = require('lodash');
// application modules
const logger = require('./logger');
const {
  playBroadcastIVR, makeBroadcastCall, hangupCall, connectBroadCast,
} = require('./voiceapi');

const app = express();
const eventEmitter = new EventEmitter();

let server;
const sseMsg = [];
const servicePort = process.env.SERVICE_PORT || 3000;

// Call configuration — populated when UI submits the form
let callConfig = {};

// Per-call retry counters (keyed by voice_id) for wrong digits + timeouts
const retryCounts = new Map();
const MAX_RETRIES = 3;

function shutdown() {
  server.close(() => {
    logger.info('Shutting down the server');
    process.exit(0);
  });
  setTimeout(() => { process.exit(1); }, 10000);
}

function onListening() {
  logger.info(`Listening on Port ${servicePort}`);
}

function onError(error) {
  if (error.syscall !== 'listen') throw error;
  switch (error.code) {
    case 'EACCES':
      logger.error(`Port ${servicePort} requires elevated privileges`);
      process.exit(1);
      break;
    case 'EADDRINUSE':
      logger.error(`Port ${servicePort} is already in use`);
      process.exit(1);
      break;
    default:
      throw error;
  }
}

function createAppServer() {
  if (process.env.LISTEN_SSL !== 'false') {
    const options = {
      key: fs.readFileSync(process.env.CERTIFICATE_SSL_KEY).toString(),
      cert: fs.readFileSync(process.env.CERTIFICATE_SSL_CERT).toString(),
    };
    if (process.env.CERTIFICATE_SSL_CACERTS) {
      options.ca = [fs.readFileSync(process.env.CERTIFICATE_SSL_CACERTS).toString()];
    }
    server = https.createServer(options, app);
  } else {
    server = http.createServer(app);
  }
  app.set('port', servicePort);
  server.listen(servicePort);
  server.on('error', onError);
  server.on('listening', onListening);
}

if (process.env.ENABLEX_APP_ID && process.env.ENABLEX_APP_KEY) {
  createAppServer();
} else {
  logger.error('Please set env variables - ENABLEX_APP_ID, ENABLEX_APP_KEY');
}

process.on('SIGINT', () => {
  logger.info('Caught interrupt signal');
  shutdown();
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static('client'));

/* -----------------------------------------------------------------------
   IVR helper functions
   ----------------------------------------------------------------------- */

// Play the IVR menu with DTMF collection enabled
function playIvrMenu(voiceId) {
  logger.info(`[${voiceId}] Playing IVR menu prompt`);
  playBroadcastIVR(
    voiceId,
    callConfig.ivrPrompt,
    callConfig.language,
    callConfig.voice,
    'ivr_prompt',
    true,   // dtmf=true — wait for digit
    () => {},
  );
}

// Wrong digit received — retry or max-out
function handleWrongDigit(voiceId) {
  const count = (retryCounts.get(voiceId) || 0) + 1;
  retryCounts.set(voiceId, count);

  const msg = `Wrong digit — attempt ${count} of ${MAX_RETRIES}`;
  logger.info(`[${voiceId}] ${msg}`);
  sseMsg.push(msg);

  if (count >= MAX_RETRIES) {
    sseMsg.push('Maximum retry attempts reached. Disconnecting call.');
    playBroadcastIVR(
      voiceId,
      'You have exceeded the maximum number of attempts. Goodbye.',
      callConfig.language,
      callConfig.voice,
      'max_retry_prompt',
      false,
      () => {},
    );
    setTimeout(() => hangupCall(voiceId, () => {}), 5000);
  } else {
    playBroadcastIVR(
      voiceId,
      callConfig.wrongDigitPrompt,
      callConfig.language,
      callConfig.voice,
      'wrong_digit_prompt',
      false,
      () => {},
    );
  }
}

// No digit received within timeout — retry or max-out
function handleMenuTimeout(voiceId) {
  const count = (retryCounts.get(voiceId) || 0) + 1;
  retryCounts.set(voiceId, count);

  const msg = `Menu timeout — attempt ${count} of ${MAX_RETRIES}`;
  logger.info(`[${voiceId}] ${msg}`);
  sseMsg.push(msg);

  if (count >= MAX_RETRIES) {
    sseMsg.push('Maximum retry attempts reached. Disconnecting call.');
    playBroadcastIVR(
      voiceId,
      'You have exceeded the maximum number of attempts. Goodbye.',
      callConfig.language,
      callConfig.voice,
      'max_retry_prompt',
      false,
      () => {},
    );
    setTimeout(() => hangupCall(voiceId, () => {}), 5000);
  } else {
    playBroadcastIVR(
      voiceId,
      callConfig.timeoutPrompt,
      callConfig.language,
      callConfig.voice,
      'timeout_prompt',
      false,
      () => {},
    );
  }
}

/* -----------------------------------------------------------------------
   Routes
   ----------------------------------------------------------------------- */

// UI form posts here to initiate the broadcast call
app.post('/broadcast-call/', (req, res) => {
  callConfig = {
    from:             req.body.from,
    voice:            req.body.play_voice      || 'female',
    language:         req.body.play_language   || 'en-US',
    welcomePrompt:    req.body.welcomePrompt   || 'Welcome.',
    ivrPrompt:        req.body.ivrPrompt       || 'Press 1 or 2.',
    wrongDigitPrompt: req.body.wrongDigitPrompt || 'Sorry, invalid option. Please try again.',
    timeoutPrompt:    req.body.timeoutPrompt   || 'No input received. Please try again.',
    digit1Number:     req.body.digit1Number    || process.env.DIGIT1_NUMBER,
    digit2Number:     req.body.digit2Number    || process.env.DIGIT2_NUMBER,
  };

  retryCounts.clear();

  const body = {
    from:          callConfig.from,
    to:            req.body.to,
    play_text:     callConfig.welcomePrompt,
    play_voice:    callConfig.voice,
    play_language: callConfig.language,
    prompt_ref:    'welcome_prompt',
  };

  logger.info(`Initiating broadcast call: ${JSON.stringify(body)}`);

  makeBroadcastCall(body, (response) => {
    const msg = JSON.parse(response);
    logger.info(`Broadcast initiated — ID: ${msg.broadcast_id}`);
    sseMsg.push(`Broadcast call initiated — ID: ${msg.broadcast_id}`);
    res.status(200).json(msg);
  });
});

// SSE — stream webhook events to the browser
app.get('/event-stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const id = (new Date()).toLocaleTimeString();
  setInterval(() => {
    if (!_.isEmpty(sseMsg[0])) {
      const data = `${sseMsg[0]}`;
      res.write(`id: ${id}\n`);
      res.write(`data: ${data}\n\n`);
      sseMsg.pop();
    }
  }, 100);
});

// EnableX webhook — receives all call events
app.post('/event', (req, res) => {
  let jsonObj;
  if (req.headers['x-algoritm'] !== undefined) {
    const key = createDecipher(req.headers['x-algoritm'], process.env.ENABLEX_APP_ID);
    let decryptedData = key.update(req.body.encrypted_data, req.headers['x-format'], req.headers['x-encoding']);
    decryptedData += key.final(req.headers['x-encoding']);
    jsonObj = JSON.parse(decryptedData);
    logger.info(JSON.stringify(jsonObj));
  } else {
    jsonObj = req.body;
    logger.info(JSON.stringify(jsonObj));
  }
  res.statusCode = 200;
  res.send();
  res.end();
  sseMsg.push('__WEBHOOK__:' + JSON.stringify(jsonObj));
  eventEmitter.emit('voicestateevent', jsonObj);
});

/* -----------------------------------------------------------------------
   Webhook event handler

   IVR flow:
     welcome_prompt (playfinished)
       └─▶ ivr_prompt  (dtmf=true — waits for digit)
             ├─ digitcollected '1' → bridge_announcement_1 (playfinished) → bridge to digit1Number
             ├─ digitcollected '2' → bridge_announcement_2 (playfinished) → bridge to digit2Number
             ├─ digitcollected other → wrong_digit_prompt (playfinished) → ivr_prompt  [retry++]
             └─ menutimeout → timeout_prompt (playfinished) → ivr_prompt              [retry++]
                                    ↓ after MAX_RETRIES (3)
                              max_retry_prompt → hangup (5 s delay)
   ----------------------------------------------------------------------- */
function voiceEventHandler(voiceEvent) {
  logger.info(`Webhook event: ${JSON.stringify(voiceEvent)}`);
  const voiceId = voiceEvent.voice_id;

  // ── Call state events ────────────────────────────────────────────────
  if (voiceEvent.state) {
    const stateMessages = {
      connected:            `Call connected to ${voiceEvent.to}`,
      disconnected:         `Call disconnected — ${voiceEvent.disconnect_reason || ''}`,
      bridged:              `Call bridged to agent [${voiceId}]`,
      bridge_disconnected:  'Bridged call disconnected',
      broadcastcall_complete: 'Broadcast complete — all calls ended',
    };

    const msg = stateMessages[voiceEvent.state];
    if (msg) {
      logger.info(`[${voiceId}] ${msg}`);
      sseMsg.push(msg);
    }

    // Auto-hangup after bridge duration
    if (voiceEvent.state === 'bridged') {
      setTimeout(() => hangupCall(voiceId, () => {}), 20000);
    }
  }

  // ── Play state events ────────────────────────────────────────────────
  if (voiceEvent.playstate !== undefined) {
    const { playstate, prompt_ref: promptRef, digit } = voiceEvent;

    if (playstate === 'initiated') {
      logger.info(`[${voiceId}] Playback started — prompt_ref: ${promptRef}`);

    } else if (playstate === 'playfinished') {
      logger.info(`[${voiceId}] Play finished — prompt_ref: ${promptRef}`);

      if (promptRef === 'welcome_prompt') {
        sseMsg.push('Welcome prompt finished — playing IVR menu');
        playIvrMenu(voiceId);

      } else if (promptRef === 'wrong_digit_prompt') {
        sseMsg.push(`Wrong digit prompt finished — replaying IVR menu (retry ${retryCounts.get(voiceId) || 0}/${MAX_RETRIES})`);
        playIvrMenu(voiceId);

      } else if (promptRef === 'timeout_prompt') {
        sseMsg.push(`Timeout prompt finished — replaying IVR menu (retry ${retryCounts.get(voiceId) || 0}/${MAX_RETRIES})`);
        playIvrMenu(voiceId);

      } else if (promptRef === 'bridge_announcement_1') {
        logger.info(`[${voiceId}] Bridging call to ${callConfig.digit1Number}`);
        sseMsg.push(`Connecting to Digit-1 bridge number: ${callConfig.digit1Number}`);
        connectBroadCast(voiceId, callConfig.from, callConfig.digit1Number, () => {});

      } else if (promptRef === 'bridge_announcement_2') {
        logger.info(`[${voiceId}] Bridging call to ${callConfig.digit2Number}`);
        sseMsg.push(`Connecting to Digit-2 bridge number: ${callConfig.digit2Number}`);
        connectBroadCast(voiceId, callConfig.from, callConfig.digit2Number, () => {});
      }

    } else if (playstate === 'menutimeout') {
      handleMenuTimeout(voiceId);

    } else if (playstate === 'digitcollected') {
      logger.info(`[${voiceId}] Digit collected: ${digit}`);

      if (digit === '1') {
        const msg = `Digit 1 pressed — bridging to ${callConfig.digit1Number}`;
        logger.info(`[${voiceId}] ${msg}`);
        sseMsg.push(msg);
        playBroadcastIVR(
          voiceId,
          'Please hold while we connect your call.',
          callConfig.language,
          callConfig.voice,
          'bridge_announcement_1',
          false,
          () => {},
        );

      } else if (digit === '2') {
        const msg = `Digit 2 pressed — bridging to ${callConfig.digit2Number}`;
        logger.info(`[${voiceId}] ${msg}`);
        sseMsg.push(msg);
        playBroadcastIVR(
          voiceId,
          'Please hold while we connect your call.',
          callConfig.language,
          callConfig.voice,
          'bridge_announcement_2',
          false,
          () => {},
        );

      } else {
        const msg = `Invalid digit '${digit}' received`;
        logger.info(`[${voiceId}] ${msg}`);
        sseMsg.push(msg);
        handleWrongDigit(voiceId);
      }
    }
  }
}

eventEmitter.on('voicestateevent', voiceEventHandler);
