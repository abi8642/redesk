const jwt = require("jsonwebtoken");
const User = require("../models/user");
const project = require("../models/project");

exports.requiredAuth =
  (role = []) =>
  async (req, res, next) => {
    if (
      !req.headers.authorization ||
      !req.headers.authorization.startsWith("Bearer") ||
      !req.headers.authorization.split(" ")[1]
    ) {
      return res
        .status(422)
        .send({ status: "422", message: "Please provide the token" });
    }
    const token = req.headers.authorization.split(" ")[1];
    jwt.verify(token, process.env.SECRET, async (err, decoded) => {
      if (err) {
        return res
          .status(401)
          .send({ status: "401", message: "Unauthorized!" + err });
      }
      // console.log(decoded.organisation, "decoded");
      if (role.length !== 0 && !role.includes(decoded.organisation.role)) {
        return res.status(403).send({ error: 1, msg: "access denied." });
      }

      // get user details using token
      const _id = decoded._id;
      // console.log(_id);
      const result = await User.findById(_id);

      if (!result) {
        return res
          .status(401)
          .send({ status: "401", message: "Unauthorized!" });
      }

      // console.log(result);
      req.user = {};
      req.user.id = result._id;
      req.user.status = result.status;
      req.user.email = result.email;
      req.user.name = result.name;
      req.user.organisation = decoded.organisation;

      next();
    });
  };
