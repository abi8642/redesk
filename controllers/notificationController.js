const Notification = require("../models/notification");

exports.getNotification = async (req, res) => {
  const id = req.user._id;
  try {
    const result = await Notification.find({
      users: {
        $in: [id],
      },
    });

    if (result.length == 0) {
      return res.status(200).send({
        status: 200,
        message: "No notification to read",
      });
    }

    // await Notification.updateMany(
    //   { send_to: id },
    //   {
    //     $set: {
    //       status: "READ",
    //     },
    //   }
    // );
    return res.status(200).send({
      status: 200,
      result,
    });
  } catch (err) {
    return res.status(400).send({
      status: 400,
      message: "Error",
    });
  }
};
