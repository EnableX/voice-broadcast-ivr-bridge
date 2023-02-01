// core modules
const { request } = require('https');
// modules installed from npm
const btoa = require('btoa');
// application modules
require('dotenv').config();
const logger = require('./logger');

// EnableX server REST API call default options
const httpOptions = {
  host: 'api-qa.enablex.io',
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

// Voice API call to broadcast IVR using TTS
function playBroadcastIVR(callAppInstance, voiceId, text, language, ttsPlayVoice, prompt_ref, callback) {
  httpOptions.path = `/voice/v1/broadcast/${callAppInstance}/call/${voiceId}/play`;
  httpOptions.method = 'PUT';

  const postData = JSON.stringify({
      text: text,
      voice: ttsPlayVoice,
      language: language,
      prompt_ref: prompt_ref,
      dtmf: true
  });

  connectEnablexServer(postData, (response) => {
    callback(response);
  });
}

function connectBroadCast(callAppInstance, voiceId, fromNumber , toNumber, callback) {
  httpOptions.path = `/voice/v1/broadcast/${callAppInstance}/call/${voiceId}/connect`;
  httpOptions.method = 'PUT';

  const postData = JSON.stringify({
    from : fromNumber,
    to : toNumber
  });

  connectEnablexServer(postData, (response) => {
    logger.info(`RESPONSE:- ${response}`);
    callback(response);
  });
}


// Voice API call to hangup the call
function hangupCall(callAppInstance, voiceId, callback) {
  httpOptions.path = `/voice/v1/broadcast/${callAppInstance}/call/${voiceId}`;
  httpOptions.method = 'DELETE';
  connectEnablexServer('', (response) => {
    logger.info(`RESPONSE:- ${response}`);
    callback(response);
  });
}

// Voice API call to make an outbound call
function makeBroadcastCall(reqDetails, callback) {
  httpOptions.path = '/voice/v1/broadcast';
  httpOptions.method = 'POST';

  const jsonNumberArray = reqDetails.to.split(',');
  const broadCastNumbers = [];

  jsonNumberArray.forEach((phoneNumber) => {
    broadCastNumbers.push({ phone: phoneNumber });
  });

  const postData = JSON.stringify({
    name: 'TEST_APP',
    owner_ref: 'XYZ',
    broadcast_numbers: JSON.stringify(broadCastNumbers),
    from: reqDetails.from,
    action_on_connect: {
      play: {
        text: reqDetails.play_text,
        voice: reqDetails.play_voice,
        language: reqDetails.play_language,
        prompt_ref: reqDetails.prompt_ref,
      },
    },
    call_param: {
      IntervalBetweenRetries: 5000,
      NumberOfRetries: 3,
    },
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
