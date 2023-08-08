const Log = require("../models/log");

exports.createLog = async (res, logData) => {
  try {
    await Log.create(logData);
  } catch (err) {
    return false;
  }
};

exports.getLogsByOrg = async (req, res) => {
  const user = req.user;

  const logs = await Log.find({
    organisation_id: user.organisation.organisation,
  });
  if (!logs) {
    return res.status(400).send({
      status: "400",
      message: "No Logs found",
    });
  }

  return res.status(200).send({ status: "200", message: "Logs Details", logs });
};

exports.getProjectLog = async (req, res) => {
  try {
    const user = req.user;
    const projectID = req.params.id;

    const logs = await Log.find({
      $and: [
        {
          organisation_id: user.organisation.organisation,
        },
        {
          "log_for.id": projectID,
        },
      ],
    }).populate("log_by organisation_id", "organisation_name name");
    if (!logs) {
      return res.status(400).send({
        status: "400",
        message: "No Logs found",
      });
    }
    return res
      .status(200)
      .send({ status: "200", message: "Logs Details", logs });
  } catch (err) {
    return res.status(500).send({
      status: "500",
      message: "Failed to get logs",
    });
  }
};
