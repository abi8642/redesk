const User = require("../models/user");

exports.resetPassword = async (req, res) => {
  const _id = req.params.id;
  const { password, cpassword } = req.body;

  try {
    if (password === cpassword) {
      const user = await User.findById(_id);

      user.password = password;
      const result = await user.save();

      return res.status(200).send({
        status: 200,
        message: "Password update successfully",
      });
    } else {
      return res.status(401).send({
        status: 401,
        message: "Password and confirm password should be same.",
      });
    }
  } catch (error) {
    return res.status(500).send({
      status: 500,
      message: "User not found",
    });
  }
};
