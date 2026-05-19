// core modules
const { request } = require('https');
// modules installed from npm
const btoa = require('btoa');
// application modules
require('dotenv').config();
const logger = require('./logger');

// EnableX server REST API call default options
const httpOptions = {
  host: 'api.enablex.io',
  port: 443,
  headers: {
    Authorization: `Basic ${btoa(`${process.env.ENABLEX_APP_ID}:${process.env.ENABLEX_APP_KEY}`)}`,
    'Content-Type': 'application/json',
  },
};

// To initiate Rest API Call to EnableX Server API
const connectEnablexServer = (data, callback) => {
  logger.info(`REQ URI:- ${httpOptions.method} ${httpOptions.host}:${httpOptions.port}${httpOptions.path}`);
  logger.info(`REQ PARAM:- ${data}`);

  const req = request(httpOptions, (res) => {
    let body = '';
    res.on('data', (response) => {
      body += response;
    });

    res.on('end', () => {
      callback(body);
    });

    res.on('error', (e) => {
      logger.info(`Got error: ${e.message}`);
    });
  });

  if (data == null) {
    req.end();
  } else {
    req.end(data);
  }
};

// Play TTS on active call — PUT /voice/v1/call/{voice_id}/play
// Set dtmf=true to collect a DTMF digit after the prompt plays
function playBroadcastIVR(voiceId, text, language, ttsPlayVoice, prompt_ref, dtmf, callback) {
  httpOptions.path = `/voice/v1/call/${voiceId}/play`;
  httpOptions.method = 'PUT';

  const postData = JSON.stringify({
    play: {
      type: 'tts',
      text: text,
      voice: ttsPlayVoice,
      language: language,
      prompt_ref: prompt_ref,
      dtmf: dtmf,
    },
  });

  connectEnablexServer(postData, (response) => {
    logger.info(`RESPONSE:- ${response}`);
    callback(response);
  });
}

// Bridge/connect active call to another number — PUT /voice/v1/call/{voice_id}/connect
function connectBroadCast(voiceId, fromNumber, toNumber, callback) {
  httpOptions.path = `/voice/v1/call/${voiceId}/connect`;
  httpOptions.method = 'PUT';

  const postData = JSON.stringify({
    from: fromNumber,
    to: toNumber,
  });

  connectEnablexServer(postData, (response) => {
    logger.info(`RESPONSE:- ${response}`);
    callback(response);
  });
}

// Terminate an active call — DELETE /voice/v1/call/{voice_id}
function hangupCall(voiceId, callback) {
  httpOptions.path = `/voice/v1/call/${voiceId}`;
  httpOptions.method = 'DELETE';
  connectEnablexServer('', (response) => {
    logger.info(`RESPONSE:- ${response}`);
    callback(response);
  });
}

// Initiate broadcast call — POST /voice/v1/broadcast
function makeBroadcastCall(reqDetails, callback) {
  httpOptions.path = '/voice/v1/broadcast';
  httpOptions.method = 'POST';

  const recipients = reqDetails.to.split(',').map((phoneNumber) => ({
    to: phoneNumber.trim(),
    play: {
      type: 'tts',
      text: reqDetails.play_text,
      voice: reqDetails.play_voice,
      language: reqDetails.play_language,
      prompt_ref: reqDetails.prompt_ref,
    },
  }));

  const postData = JSON.stringify({
    name: 'TEST_APP',
    owner_ref: 'XYZ',
    from: reqDetails.from,
    answering_machine_detection: false,
    recipients: recipients,
    event_url: `${process.env.PUBLIC_WEBHOOK_URL}/event`,
    call_handler_url: `${process.env.PUBLIC_WEBHOOK_URL}/event`,
  });

  connectEnablexServer(postData, (response) => {
    logger.info(`RESPONSE:- ${response}`);
    callback(response);
  });
}

module.exports = {
  playBroadcastIVR,
  makeBroadcastCall,
  hangupCall,
  connectBroadCast,
};
