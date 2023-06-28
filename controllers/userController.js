const User = require("../models/user");
const jwt = require("jsonwebtoken");
const { sendMail } = require("../services/sendEmail");
const config = require("../config/config");
const Organisation = require("../models/organisation");
const { validationResult } = require("express-validator");
const task = require("../models/task");

exports.sendOtp = async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email, status: "approved" });

  if (!user) {
    return res.status(400).send({ status: "400", message: "Email not found" });
  }
  const otp = Math.floor(100000 + Math.random() * 900000);

  sendMail(email, "OTP for login", `Your OTP for login is <b>${otp}</b>`);

  const updateUser = await User.updateMany({ email }, { otp });
  return res
    .status(200)
    .send({ status: "200", message: "OTP sent successfully" });
};
exports.verifyOtp = async (req, res) => {
  const { email, otp } = req.body;
  const user = await User.findOne({ email, otp }).populate(
    "organisation_list.organisation"
  );

  if (!user) {
    return res.status(400).send({ status: "400", message: "Email not found" });
  }

  let orgs = [];
  // user.forEach((u) => {
  //   orgs.push(u.organisation_list);
  // });
  orgs.push(...user.organisation_list);
  //if one then jwtb token
  // console.log(orgs);
  if (orgs.length == 1) {
    jwt.sign(
      { _id: user._id, email: user.email, organisation: orgs[0].organisation },
      process.env.SECRET,
      { expiresIn: "1h" },
      async (err, token) => {
        if (err) {
          return res.status(400).send({ status: "400", message: err });
        }

        //regenerate otp
        const otp = Math.floor(100000 + Math.random() * 900000);
        // console.log(otp);
        await User.updateMany({ email }, { otp });

        return res.status(200).send({
          status: "200",
          message: "Otp verified and Token generated",
          token: "Bearer " + token,
          user: {
            _id: user._id,
            role: user.role,
            name: user.name,
            email: user.email,
            token: `Bearer ${token}`,
          },
        });
      }
    );
  }

  //if more than one then send org list
  else {
    jwt.sign(
      { _id: user._id, email: user.email },
      process.env.ACCOUNT_ACTIVATION,
      { expiresIn: "1h" },
      async (err, token) => {
        if (err) {
          return res.status(400).send({ status: "400", message: err });
        }
        const otp = Math.floor(100000 + Math.random() * 900000);
        // console.log(otp);
        await User.updateMany({ email }, { otp });
        return res.status(200).send({
          status: "200",
          message: "Otp verified and Token generated",
          token: "Bearer " + token,
          data: orgs,
        });
      }
    );

    // return res
    //   .status(200)
    //   .send({ status: "200", message: "OTP verified", data: orgs });
  }
};

exports.requestToken = async (req, res) => {
  const token = req.headers.authorization.split(" ")[1];
  let decoded = jwt.verify(token, process.env.ACCOUNT_ACTIVATION);
  //if token is not valid use another secret
  if (!decoded) {
    decoded = jwt.verify(token, process.env.SECRET);
  }
  if (!decoded) {
    return res.status(400).send({ status: "400", message: "Token expired" });
  }
  const { organisation } = req.body;
  // const user = await User.findOne({
  //   _id: decoded._id,
  //   email: decoded.email,
  // }).populate("organisation_list.organisation");
  // const { email, organisation } = req.body;
  const user = await User.findOne({
    email: decoded.email,
    status: "approved",
    organisation_list: { $elemMatch: { organisation } },
  });

  if (!user) {
    return res.status(400).send({ status: "400", message: "Email not found" });
  }
  jwt.sign(
    { _id: user._id, email: user.email, organisation },
    process.env.SECRET,
    { expiresIn: "1h" },
    (err, token) => {
      if (err) {
        return res.status(400).send({ status: "400", message: err });
      }
      return res.status(200).send({
        status: "200",
        message: "Token generated",
        token: "Bearer " + token,
      });
    }
  );
};

exports.signup = (req, res) => {
  // Check whether email already exists
  const { email } = req.body;

  User.findOne({ email }, (err, email) => {
    if (err || email) {
      // console.log(err);
      return res
        .status(400)
        .send({ status: "400", message: "Email already exists" });
    }

    // If email don't exist, create user
    const user = new User(req.body);
    user.save((err, user) => {
      if (err) {
        return res.status(400).send({
          status: "500",
          message: "Unable to signup. Try again later",
          err,
        });
      }
      return res.status(201).send({
        status: "201",
        message: "Successfully added user",
        user: {
          id: user._id,
          role: user.role,
          name: user.name,
          email: user.email,
          phone_number: user.phone_number,
        },
      });
    });
  });
};
exports.signupwithorgs = async (req, res) => {
  // Check whether email already exists
  const { email, token } = req.body;
  if (!token) {
    return res.status(400).json({
      status: "400",
      message: "Token is required",
    });
  }

  jwt.verify(token, process.env.INVITE_KEY, async (err, decoded) => {
    if (err) {
      return res.status(401).send({
        status: "401",
        message: "Expired link. Signup again",
      });
    }

    const { _id, email } = decoded;
    if (email !== req.body.email) {
      return res.status(401).send({
        status: "401",
        message: "Email does not match",
      });
    }
    const organisation = await Organisation.findOne({ _id });
    if (!organisation) {
      return res.status(400).send({
        status: "400",
        message: "Organisation does not exist",
      });
    }
    User.findOne({ email, organisation_list: { $elemMatch: { organisation } } })
      .populate("organisation_list.organisation")
      .exec((err, user) => {
        if (err || user) {
          return res.status(400).send({
            status: "400",
            message: "Email already exists for orgs",
          });
        }
        req.body.organisation_list = [
          {
            organisation: organisation._id,
            priority: 1,
          },
        ];
        // req.body.role ? (req.body.role = "user") : null; //IF ROLE PASSED FROM FRONTEND
        req.body.role = "user";
        const newuser = new User(req.body);
        newuser.save((err, user) => {
          if (err) {
            return res.status(400).send({
              status: "500",
              message: "Unable to signup. Try again later",
              err,
            });
          }
          return res.status(201).send({
            status: "201",
            message: "Successfully added user",
            user: {
              id: newuser._id,
              role: newuser.role,
              name: newuser.name,
              email: newuser.email,
            },
          });
        });
      });
  });

  //Previous code flow
  //   User.findOne({ email, organisation: _id }, (err, email) => {
  //     if (err || email) {
  //       // console.log(err);
  //       return res
  //         .status(400)
  //         .send({ status: "400", message: "Email already exists for orgs" });
  //     }

  //     // If email don't exist, create user
  //     req.body.organisation = _id;
  //     try {
  //       const user = new User(req.body);
  //       user.save((err, user) => {
  //         if (err) {
  //           return res.status(400).send({
  //             status: "500",
  //             message: "Unable to signup. Try again later",
  //             err,
  //           });
  //         }
  //         return res.status(201).send({
  //           status: "201",
  //           message: "Successfully added user",
  //           user: {
  //             id: user._id,
  //             role: user.role,
  //             name: user.name,
  //             email: user.email,
  //             phone_number: user.phone_number,
  //             organisation: user.organisation,
  //           },
  //         });
  //       });
  //     } catch (err) {
  //       res.status(400).send({
  //         status: "400",
  //         message: "Something went wrong",
  //         err,
  //       });
  //     }
  //   });
  // });
};

exports.signin = (req, res) => {
  const { email, password } = req.body;

  User.findOne({ email }, (err, user) => {
    if (err || !user) {
      return res
        .status(400)
        .send({ status: "400", message: "Email does not exists" });
    }

    /**
     * @DESC Check Role Middleware
     */
    if (user.status === "approved") {
      if (!user.authenticate(password)) {
        return res.status(400).send({
          status: "400",
          message: "Email and password does not match",
        });
      }
      const primaryOrg = user.organisation_list.find(
        (org) => org.priority === 1
      );
      // create a token
      const token = jwt.sign(
        {
          _id: user._id,
          role: user.role,
          email: user.email,
          organisation: primaryOrg.organisation,
        },
        process.env.SECRET,
        { expiresIn: "100m" }
      );

      // Put token in cookie
      res.cookie("token", token);
      // Send response to front end
      // const { _id, name, email, role } = user
      return res.status(200).send({
        status: "200",
        user: {
          _id: user._id,
          role: user.role,
          name: user.name,
          email: user.email,
          pic: user.pic,
          token: `Bearer ${token}`,
        },
      });
    } else if (user.status === "pending") {
      return res
        .status(401)
        .send({ status: "401", message: "Account is not active yet" });
    } else if (user.status === "rejected") {
      return res.status(401).send({
        status: "401",
        message: "Your account is rejected by the admin",
      });
    }
  });
};
exports.signinwithorgs = async (req, res) => {
  const { email, password, sub_domain } = req.body;

  const orgs = await Organisation.findOne({ sub_domain });
  if (!orgs) {
    return res.status(400).send({
      status: "400",
      message: "Organisation does not exists",
    });
  }
  // console.log(orgs);

  User.findOne({ email, organisation: orgs._id })
    .populate("organisation")
    .exec((err, user) => {
      if (err || !user) {
        return res
          .status(400)
          .send({ status: "400", message: "Email does not exists" });
      }

      if (user.status === "approved") {
        if (!user.authenticate(password)) {
          return res.status(400).send({
            status: "400",
            message: "Email and password does not match",
          });
        }
        if (sub_domain != user.organisation?.sub_domain)
          return res.status(400).send({
            status: "400",
            message: "Email and Organisation does not match",
          });

        // create a token
        const token = jwt.sign(
          {
            _id: user._id,
            role: user.role,
            email: user.email,
            organisation: user.organisation._id,
          },
          process.env.SECRET,
          { expiresIn: "100m" }
        );

        // Put token in cookie
        res.cookie("token", token);
        // Send response to front end
        // const { _id, name, email, role } = user
        return res.status(200).send({
          status: "200",
          user: {
            _id: user._id,
            role: user.role,
            name: user.name,
            email: user.email,
            token: `Bearer ${token}`,
            organisation: user.organisation,
          },
        });
      } else if (user.status === "pending") {
        return res
          .status(401)
          .send({ status: "401", message: "Account is not active yet" });
      } else if (user.status === "rejected") {
        return res.status(401).send({
          status: "401",
          message: "Your account is rejected by the admin",
        });
      }
    });
};

exports.signout = (req, res) => {
  res.clearCookie("token");
  res.status(200).send({ status: "200", message: "User signout successful" });
};

exports.getUser = (req, res) => {
  const user = req.user;
  // console.log("asda" + req.io);

  // if (user.role === "admin") {
  if (true) {
    //not include role admin
    User.find(
      {
        role: { $nin: ["admin", "observer", "client", "subadmin"] },
        organisation: user.organisation,
        // status: "approved",
      },
      async (err, docs) => {
        // User.find((err, docs) => {
        if (!err) {
          // req.io.emit("message", docs);
          // req.io.to("room2").emit("message", docs);
          const tasks = await task.find({
            task_assignee: { $in: docs.map((doc) => doc._id) },
            status: { $in: ["pending", "in_progress"] },
            organisation: user.organisation,
          });

          res.status(200).send({ status: "200", message: "User List", docs });
        } else {
          return res.status(400).send({
            status: "400",
            message: "Failed to retrieve the User List: " + err,
          });
        }
      }
    );
  } else {
    res.status(400).send({
      status: 400,
      message: "Only admin can access this",
    });
  }
};
exports.allUserFromOrgs = (req, res) => {
  const user = req.user;
  // console.log("asda" + req.io);

  // if (user.role === "admin") {
  if (true) {
    //not include role admin
    User.find(
      {
        organisation: user.organisation,
        // status: "approved",
      },
      (err, docs) => {
        // User.find((err, docs) => {
        if (!err) {
          // req.io.emit("message", docs);
          // req.io.to("room2").emit("message", docs);
          res.status(200).send({ status: "200", message: "User List", docs });
        } else {
          return res.status(400).send({
            status: "400",
            message: "Failed to retrieve the User List: " + err,
          });
        }
      }
    );
  } else {
    res.status(400).send({
      status: 400,
      message: "Only admin can access this",
    });
  }
};

exports.getEmployeeList = (req, res) => {
  const user = req.user;
  // console.log("asda" + req.io);

  // if (user.role === "admin") {
  if (true) {
    //not include role admin
    User.find(
      {
        role: {
          $nin: ["admin", "team_leader", "observer", "client", "subadmin"],
        },
        organisation: user.organisation,
      },
      (err, docs) => {
        // User.find((err, docs) => {
        if (!err) {
          // req.io.emit("message", docs);
          // req.io.to("room2").emit("message", docs);
          res.status(200).send({ status: "200", message: "User List", docs });
        } else {
          return res.status(400).send({
            status: "400",
            message: "Failed to retrieve the User List: " + err,
          });
        }
      }
    );
  } else {
    res.status(400).send({
      status: 400,
      message: "Only admin can access this",
    });
  }
};
exports.getTeamLeaderList = (req, res) => {
  const user = req.user;
  // console.log("asda" + req.io);

  // if (user.role === "admin") {
  if (true) {
    User.find(
      { role: "team_leader", organisation: user.organisation },
      (err, docs) => {
        if (!err) {
          // req.io.emit("message", docs);
          // req.io.to("room2").emit("message", docs);
          res
            .status(200)
            .send({ status: "200", message: "Team Leader List", docs });
        } else {
          return res.status(400).send({
            status: "400",
            message: "Failed to retrieve the User List: " + err,
          });
        }
      }
    );
  } else {
    res.status(400).send({
      status: 400,
      message: "Only admin can access this",
    });
  }
};
exports.getObserversList = (req, res) => {
  const user = req.user;
  console.log("asda" + user.role);

  // if (user.role === "admin") {
  if (true) {
    User.find(
      { role: "observer", organisation: user.organisation },
      (err, docs) => {
        if (!err) {
          // req.io.emit("message", docs);
          // req.io.to("room2").emit("message", docs);
          res
            .status(200)
            .send({ status: "200", message: "Observer Leader List", docs });
        } else {
          return res.status(400).send({
            status: "400",
            message: "Failed to retrieve the User List: " + err,
          });
        }
      }
    );
  } else {
    res.status(400).send({
      status: 400,
      message: "Only admin can access this",
    });
  }
};

exports.getLoginUser = (req, res) => {
  const user = req.user;

  // res.send(userDetails);
  const token = req.headers.authorization.split(" ")[1];

  return res.status(200).send({
    status: "200",
    user: {
      _id: user._id,
      role: user.role,
      name: user.name,
      email: user.email,
      pic: user.pic,
      token: `Bearer ${token}`,
    },
  });
};
exports.changeUserRoles = (req, res) => {
  const condition = { _id: req.params.id };
  const role = parseInt(req.body.role);

  if (role >= 3) {
    return res
      .status(400)
      .send({ status: "400", message: "Failed to user Update" });
  }
  let newRole = config.user_role[role];
  console.log(newRole);
  User.findOneAndUpdate(condition, { role: newRole })
    .then((docs) => {
      if (!docs) {
        return res
          .status(400)
          .send({ status: "400", message: "Failed to user Update" });
      }
      return res
        .status(200)
        .send({ status: "200", message: "Succesffully Updated User", docs });
    })
    .catch((err) => {
      return res
        .status(400)
        .send({ status: "400", message: "Something went wrong", err });
    });
};

exports.userEdit = (req, res) => {
  const user = req.user;

  const validationErrors = validationResult(req);
  if (!validationErrors.isEmpty()) {
    return res.status(422).json({
      status: 422,
      msg: "err",
      validationErrors: validationErrors.array({ onlyFirstError: true }),
    });
  }

  const condition = { _id: user._id, organisation: user.organisation };
  if (req.body.role) {
    return res.status(400).send({ status: "400", message: "Cant update role" });
  }
  User.updateMany(condition, req.body)
    .then((docs) => {
      if (!docs) {
        return res
          .status(400)
          .send({ status: "400", message: "Failed to user Update" });
      }
      return res
        .status(200)
        .send({ status: "200", message: "Succesffully Updated User" });
    })
    .catch((err) => {
      return res
        .status(400)
        .send({ status: "400", message: "Something went wrong", err });
    });
};

// Approve or reject user by the admin
exports.userApproveOrReject = async (req, res) => {
  const user = req.user;
  if (user.role === "admin" || user.role === "subadmin") {
    try {
      const _id = req.params.id;
      const body = req.body.status;
      let status = "";
      status = config.user_status[body + ""];
      // if (body === 1) {
      //   status = "approved";
      // } else if (body === 0) {
      //   status = "rejected";
      // }
      const result = await User.findByIdAndUpdate(
        _id,
        {
          $set: { status },
        },
        { new: true }
      );
      if (body === 1) {
        return res
          .status(200)
          .send({ status: "200", message: "User signup approved" });
      } else if (body === 0) {
        return res
          .status(200)
          .send({ status: "200", message: "User signup rejected" });
      } else {
        return res
          .status(200)
          .send({ status: "200", message: "User signup Pending" });
      }
    } catch (err) {
      res.status(500).send({
        status: 500,
        message: "Error",
        err,
      });
    }
  } else {
    res.status(401).send({
      status: 401,
      message: "Only admin can access this",
    });
  }
};

exports.forgetPassword = async (req, res) => {
  const email = req.body.email;
  const sub_domain = req.body.sub_domain;

  let org = await Organisation.findOne({ sub_domain });
  // console.log(org);
  if (!org) {
    return res.status(400).send({
      status: "400",
      message: "Organisation not found",
    });
  }
  User.findOne({ email, organisation: org._id })
    .then(async (docs) => {
      if (!docs) {
        return res
          .status(400)
          .send({ status: "400", message: "User not found" });
      }
      if (docs.status === "approved") {
        const userMail = docs.email;

        let password = Math.random().toString(36).slice(2, 10);
        docs.password = password;

        // console.log(password + " " + userMail);
        await docs.save();

        sendMail(
          userMail,
          "Reset Password",
          "Your password for redesk is " + password
        )
          .then((result) => {
            return res.status(200).send({
              status: "200",
              message: "Password reset successfully",
            });
          })
          .catch((err) => {
            return res.status(500).send({
              status: "500",
              message: "Something went wrong. Try again later",
            });
          });
      } else {
        return res.status(401).send({
          status: "401",
          message: "You are not allowed to signIn",
        });
      }
    })
    .catch((err) => {
      return res.status(500).send({
        status: "500",
        message: "Something went wrong. Try again later" + err,
      });
    });
};
exports.changePassword = async (req, res) => {
  const user = req.user;
  const email = user.email;

  const oldPassword = req.body.oldpassword;
  const newPassword = req.body.newpassword;

  if (!oldPassword || !newPassword) {
    return res.status(400).send({
      status: "400",
      message: "All fields are required",
    });
  }

  // let org = await Organisation.findOne({ sub_domain });
  // // console.log(org);
  // if (!org) {
  //   return res.status(400).send({
  //     status: "400",
  //     message: "Organisation not found",
  //   });
  // }
  User.findOne({ email, organisation: user.organisation })
    .then(async (docs) => {
      if (!docs) {
        return res
          .status(400)
          .send({ status: "400", message: "User not found" });
      }
      if (docs.status === "approved" && docs.authenticate(oldPassword)) {
        docs.password = newPassword;

        await docs.save();

        return res.status(200).send({
          status: "200",
          message: "Password reset successfully",
        });
      } else {
        return res.status(401).send({
          status: "401",
          message: "Old password is incorrect",
        });
      }
    })
    .catch((err) => {
      return res.status(500).send({
        status: "500",
        message: "Something went wrong. Try again later" + err,
      });
    });
};
// exports.verifyOtp = async (req, res) => {
//   const email = req.body.email;
//   const otp = req.body.otp;
//   const sub_domain = req.body.sub_domain;

//   let user = await User.findOne({ email, organisation: org._id });
//   if (!user) {
//     return res.status(400).send({
//       status: "400",
//       message: "User not found",
//     });
//   }
//   if (user.otp === otp) {
//     return res.status(200).send({
//       status: "200",
//       message: "OTP verified",
//     });
//   } else {
//     return res.status(401).send({
//       status: "401",

//       message: "OTP not verified",
//     });
//   }
// };

exports.inviteUser = (req, res) => {
  const userMail = req.body.email;
  const sendUrl = "http://192.168.0.121:8001/api/signup";
  sendMail(userMail, sendUrl, res);

  return res.status(401).send({
    status: "401",
    message: "You are not allowed to signIn",
  });
};

exports.allUsers = async (req, res) => {
  const user = req.user;
  const keyword = req.query.search
    ? {
        $and: [
          {
            $or: [
              { name: { $regex: req.query.search, $options: "i" } },
              { email: { $regex: req.query.search, $options: "i" } },
            ],
          },
          { organisation: user.organisation, status: "approved" },
        ],
      }
    : {};

  const users = await User.find(keyword).find({ _id: { $ne: req.user._id } });
  res.send(users);
};
exports.createObserver = async (req, res) => {
  const user = req.user;
  if (user.role === "admin" || user.role === "subadmin") {
    // const { name, email, password, role, pic, status } = req.body;

    // const hashedPassword = await bcrypt.hash(password, 12);

    req.body.role = "observer";
    req.body.status = "approved";
    req.body.organisation = user.organisation;

    console.log(req.body);
    let userExist = await User.find({
      email: req.body.email,
      organisation: user.organisation,
    });
    if (userExist.length > 0) {
      return res.status(400).send({
        status: "400",
        message: "User already exist",
      });
    }
    try {
      const newUser = new User(req.body);
      const result = await newUser.save();
      res.status(200).send({
        status: "200",
        message: "Observer created successfully",
        result,
      });
    } catch (err) {
      res.status(400).send({
        status: "400",
        message: "Something went wrong",
        err,
      });
    }
  } else {
    res.status(400).send({
      status: 400,
      message: "Only admin can access this",
    });
  }
};
exports.getObserver = async (req, res) => {
  const user = req.user;

  const docs = await User.find({
    role: "observer",
    organisation: user.organisation,
  });
  if (!docs) {
    return res.status(400).send({
      status: "400",
      message: "Observer not found",
    });
  }

  res.status(200).send({
    status: "200",
    message: "Observer fetched successfully",
    docs,
  });
};

exports.createClient = async (req, res) => {
  const user = req.user;
  if (user.role === "admin" || user.role === "subadmin") {
    // const { name, email, password, role, pic, status } = req.body;

    // const hashedPassword = await bcrypt.hash(password, 12);

    req.body.role = "client";
    req.body.status = "approved";
    req.body.organisation = user.organisation;
    let userExist = await User.find({
      email: req.body.email,
      organisation: user.organisation,
    });
    if (userExist.length > 0) {
      return res.status(400).send({
        status: "400",
        message: "User already exist",
      });
    }

    try {
      const newUser = new User(req.body);
      const result = await newUser.save();
      res.status(200).send({
        status: "200",
        message: "Client created successfully",
        result,
      });
    } catch (err) {
      res.status(400).send({
        status: "400",
        message: "Something went wrong",
        err,
      });
    }
  } else {
    res.status(400).send({
      status: 400,
      message: "Only admin can access this",
    });
  }
};

exports.getClient = async (req, res) => {
  const user = req.user;

  const client = await User.find({
    role: "client",
    organisation: user.organisation,
  });
  if (!client) {
    return res.status(400).send({
      status: "400",
      message: "Client not found",
    });
  }

  res.status(200).send({
    status: "200",
    message: "Client fetched successfully",
    client,
  });
};

exports.createSubAdmin = async (req, res) => {
  const user = req.user;
  if (user.role === "admin" || user.role === "subadmin") {
    // const { name, email, password, role, pic, status } = req.body;

    // const hashedPassword = await bcrypt.hash(password, 12);

    req.body.role = "subadmin";
    req.body.status = "approved";
    req.body.organisation = user.organisation;

    console.log(req.body);
    let userExist = await User.find({
      email: req.body.email,
      organisation: user.organisation,
    });
    if (userExist.length > 0) {
      return res.status(400).send({
        status: "400",
        message: "User already exist",
      });
    }
    try {
      const newUser = new User(req.body);
      const result = await newUser.save();
      res.status(200).send({
        status: "200",
        message: "Sub Admin created successfully",
        result,
      });
    } catch (err) {
      res.status(400).send({
        status: "400",
        message: "Something went wrong",
        err,
      });
    }
  } else {
    res.status(400).send({
      status: 400,
      message: "Only admin can access this",
    });
  }
};
exports.getSubadmin = async (req, res) => {
  const user = req.user;

  const docs = await User.find({
    role: "subadmin",
    organisation: user.organisation,
  });
  if (!docs) {
    return res.status(400).send({
      status: "400",
      message: "Subadmin not found",
    });
  }

  res.status(200).send({
    status: "200",
    message: "Subadmin fetched successfully",
    docs,
  });
};
