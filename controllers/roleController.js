const roleModel = require("../models/role");

exports.createRole = (req, res) => {
  roleModel
    .create(req.body)
    .then((role) => {
      if (role) {
        return res
          .status(200)
          .send({ status: "200", message: "Successfully Inserted Role", role });
      }
    })
    .catch((err) => {
      return res
        .status(400)
        .send({ status: "400", message: "Something went wrong", err });
    });
};

exports.getRole = (req, res) => {
  roleModel.find((err, docs) => {
    if (!err) {
      return res
        .status(200)
        .send({ status: "200", message: "Role List", docs });
    } else {
      return res.status(400).send({
        status: "400",
        message: "Failed to retrieve the Role List",
        err,
      });
    }
  });
};
