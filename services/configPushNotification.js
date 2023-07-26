const webPush = require("web-push");

const publicVapidKey = process.env.PUBLIC_KEY;
const privateVapidKey = process.env.PRIVATE_KEY;

webPush.setVapidDetails(
  "mailto:abinash.sahu@apptimates.com",
  publicVapidKey,
  privateVapidKey
);

// Function to send push notifications
exports.sendPushNotification = async (subscription, notifyMsg) => {
  try {
    await webPush.sendNotification(subscription, notifyMsg);
    console.log("Push notification sent successfully.");
  } catch (error) {
    console.error("Error sending push notification:", error);
    return res.status(400).send({
      status: 400,
      message: "UnSubscribed",
    });
  }
};
