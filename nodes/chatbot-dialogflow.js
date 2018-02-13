var _ = require('underscore');
var utils = require('../lib/helpers/utils');
var lcd = require('../lib/helpers/lcd');

var when = utils.when;


module.exports = function(RED) {

  function ChatBotDialogflow(config) {
    RED.nodes.createNode(this, config);
    var node = this;
    node.dialogflow = config.dialogflow;
    node.language = config.language;
    node.debug = config.debug;

    this.on('input', function (msg) {

      var chatContext = msg.chat();
      var dialogFlowNode = RED.nodes.getNode(node.dialogflow);
      var language = utils.extractValue('string', 'language', node, msg, false);
      var debug = utils.extractValue('boolean', 'debug', node, msg, false);

      // exit if empty credentials
      if (dialogFlowNode == null || dialogFlowNode.credentials == null || _.isEmpty(dialogFlowNode.credentials.token)) {
        lcd.warn('Dialogflow.ai token is missing.');
        return;
      }

      var chatId = utils.getChatId(msg);
      //var sessionPath = sessionClient.sessionPath('guidone', chatId);
      // exit if not message
      if (!utils.message.isMessage(msg)) {
        node.send([null, msg]);
        return;
      }

      var requestUrl = 'https://api.dialogflow.com/v1/query?'
        + 'v=20170712'
        + '&query=' + encodeURIComponent(msg.payload.content)
        + '&lang=' + language.toLowerCase()
        + '&resetContexts=true'
        + '&sessionId=' + chatId
        + '&timezone=CET';
      var dialogFlow = {
        method: 'GET',
        url: requestUrl,
        json: true,
        headers: {
          'Authorization': 'Bearer ' + dialogFlowNode.credentials.token
        }
      };
      var intent = null;
      var variables = null;

      utils.request(dialogFlow)
        .then(
          function(body) {

          if (body.result != null && body.result.metadata != null && body.result.metadata.intentName != null) {
            // test if no match
            if (body.result.action === 'input.unknown') {
              // if didn't matched any intent
              node.send([null, msg]);
            } else {
              intent = body.result.metadata.intentName;
              variables = body.result.parameters;

              // remove empty vars
              _(variables).each(function(value, key) {
                if (_.isEmpty(value)) {
                  delete variables[key];
                }
              });

              return when(chatContext.set('topic', intent));
            }
          }
        })
        .then(function() {
          msg.payload = {
            intent: intent,
            variables: variables
          };
          if (debug) {
            lcd.node(msg.payload, { node: node, title: 'Dialogflow.ai' });
          }
          node.send([msg, null]);
        })
        .catch(function(error) {
          node.error(error);
        });
    });
  }

  RED.nodes.registerType('chatbot-dialogflow', ChatBotDialogflow);

  function DialogflowToken(n) {
    RED.nodes.createNode(this, n);
  }

  RED.nodes.registerType('chatbot-dialogflow-token', DialogflowToken, {
    credentials: {
      token: {
        type: 'text'
      }
    }
  });

};
