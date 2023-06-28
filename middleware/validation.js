const { check } = require("express-validator");
exports.signupValidation = [
  check("email", "Email should be valid").isEmail(),
  check("password", "Password should be at least 6 characters").isLength({
    min: 6,
  }),
];

exports.loginValidation = [
  check("email", "Email should be valid").isEmail(),
  check("password", "Password should be at least 6 characters").isLength({
    min: 6,
  }),
];
