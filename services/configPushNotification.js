const webPush = require("web-push");

const publicVapidKey = process.env.PUBLIC_KEY;
const privateVapidKey = process.env.PRIVATE_KEY;

webPush.setVapidDetails(
  "mailto:abinash.sahu@apptimates.com", // Your contact email address
  publicVapidKey,
  privateVapidKey
);

// Function to send push notifications
exports.sendPushNotification = async (subscription, notifyMsg) => {
  try {
    await webPush.sendNotification(subscription, JSON.stringify(notifyMsg));
    console.log("Push notification sent successfully.");
  } catch (error) {
    console.error("Error sending push notification:", error);
  }
};
