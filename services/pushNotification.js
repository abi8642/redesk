const webPush = require("web-push");
require("dotenv").config();

const publicVapidKey = process.env.PUBLIC_KEY;
const privateVapidKey = process.env.PRIVATE_KEY;

webPush.setVapidDetails(
  "mailto:abinash.sahu@apptimates.com",
  publicVapidKey,
  privateVapidKey
);

exports.subscribe = async (req, res) => {
  const subscription = req.body;

  res.status(200).send("Subscribed");

  const payload = JSON.stringify({
    title: "Hello World",
    body: "This is your first push notification",
  });

  webPush
    .sendNotification(subscription, payload)
    .catch((err) => console.error(err));
};
