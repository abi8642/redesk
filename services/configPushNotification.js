const admin = require("firebase-admin");

const serviceAccount = require("../web-app-67650-firebase-adminsdk-112id-c5da97e59d.json");

const firebase = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

exports.sendPushNotification = async (message) => {
  try {
    const response = await admin.messaging(firebase).send(message);

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
