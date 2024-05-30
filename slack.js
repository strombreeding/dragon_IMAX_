const { WebClient } = require("@slack/web-api");
const { createEventAdapter } = require("@slack/events-api");
require("dotenv").config();

const slackSigningSecret = process.env.SLACK_SECRET;
const botToken = process.env.SLACK_BOT;

const slackEvents = createEventAdapter(slackSigningSecret);
const webClient = new WebClient(botToken);

function sendSlackBot(message) {
  webClient.chat
    .postMessage({
      channel: "C075V24PU0L",
      text: message,
    })
    .then((res) => {
      console.log("Message sent:", res.ts);
    })
    .catch(console.error);
}

module.exports = {
  sendSlackBot,
};
