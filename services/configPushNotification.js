// const webPush = require("web-push");

// const publicVapidKey = process.env.PUBLIC_KEY;
// const privateVapidKey = process.env.PRIVATE_KEY;

// webPush.setVapidDetails(
//   "mailto:abinash.sahu@apptimates.com",
//   publicVapidKey,
//   privateVapidKey
// );

// // Function to send push notifications
// exports.sendPushNotification = async (subscription, notifyMsg) => {
//   try {
//     await webPush.sendNotification(subscription, notifyMsg);
//     console.log("Push notification sent successfully.");
//   } catch (error) {
//     console.error("Error sending push notification:", error);
//     return res.status(400).send({
//       status: 400,
//       message: "UnSubscribed",
//     });
//   }
// };

const admin = require("firebase-admin");

const serviceAccount = require("../web-app-67650-firebase-adminsdk-112id-c5da97e59d.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

exports.sendPushNotification = async (message) => {
  try {
    const response = await admin.messaging().send(message);

    if (response) {
      return {
        status: 1,
        response,
      };
    }
  } catch (err) {
    return {
      status: 0,
      err,
    };
  }
};
