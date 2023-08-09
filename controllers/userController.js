const User = require("../models/user");
const jwt = require("jsonwebtoken");
const { sendMail } = require("../services/sendEmail");
const config = require("../config/config");
const Organisation = require("../models/organisation");
const { validationResult } = require("express-validator");
const task = require("../models/task");
const project = require("../models/project");
const Log = require("../models/log");
const { sendPushNotification } = require("../services/configPushNotification");
const { createLog } = require("./logController");

exports.sendOtp = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({
      email,
    });

    if (!user) {
      return res
        .status(400)
        .send({ status: "400", message: "Email not found" });
    }
    const otp = Math.floor(100000 + Math.random() * 900000);

    await sendMail(
      email,
      "OTP for login",
      `Your OTP for login is <b>${otp}</b>`
    );

    const updateUser = await User.updateMany({ email }, { otp });

    return res
      .status(200)
      .send({ status: "200", message: "OTP sent successfully" });
  } catch (err) {
    return res
      .status(400)
      .send({ status: "400", message: "Unable to send OTP" });
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res
        .status(400)
        .send({ status: "400", message: "Email not found" });
    }

    if (user.otp !== otp) {
      return res
        .status(400)
        .send({ status: "400", message: "OTP does not match" });
    }

    let orgs = [];
    orgs.push(...user.organisation_list);

    // If only one organization exist
    if (orgs.length == 1) {
      jwt.sign(
        { _id: user._id, email: user.email, organisation: orgs[0] },
        process.env.SECRET,
        { expiresIn: "1d" },
        async (err, token) => {
          if (err) {
            return res.status(400).send({ status: "400", message: err });
          }

          //regenerate new otp
          const otp = Math.floor(100000 + Math.random() * 900000);
          await User.updateMany(
            { email },
            {
              otp,
            }
          );

          let log = {
            date_time: new Date(),
            log_type: 2,
            log_heading: "User Login",
            log_message: `${user.name} Logged In`,
            log_for: {
              id: "" + user._id,
              name: user.name,
            },
            log_by: user._id,
            organisation_id: orgs[0].organisation,
          };

          await createLog(res, log);

          return res.status(200).send({
            status: "200",
            message: "Otp verified and Token generated",
            token: "Bearer " + token,
            user: {
              _id: user._id,
              organisation: orgs[0],
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
        { expiresIn: "1d" },
        async (err, token) => {
          if (err) {
            return res.status(400).send({ status: "400", message: err });
          }
          const otp = Math.floor(100000 + Math.random() * 900000);
          await User.updateMany({ email }, { otp });

          const orgDetails = await User.findOne({ email }).populate(
            "organisation_list.organisation",
            "organisation_name _id"
          );

          return res.status(200).send({
            status: "200",
            message: "Otp verified and Token generated",
            token: "Bearer " + token,
            data: orgDetails,
          });
        }
      );
    }
  } catch (e) {
    return res
      .status(500)
      .send({ status: "500", message: "Something Went Wrong" });
  }
};

// Subscribe to firebase push notifications
exports.subscribeForPushNotification = async (req, res) => {
  try {
    const { registrationToken } = req.body;
    const user = req.user;
    let userDetails = await User.findOne({ _id: user.id });

    if (userDetails) {
      let newUserDetails = await User.findOneAndUpdate(
        { _id: user.id },
        {
          notification_subscription: registrationToken,
        }
      );

      // let log = {
      //   date_time: new Date(),
      //   log_type: 2,
      //   log_heading: "User Notification Token Added",
      //   log_message: `${newUserDetails.name}'s notification token updated`,
      //   before_update: userDetails.notification_subscription,
      //   request: req.body,
      //   response: newUserDetails.notification_subscription,
      //   log_for: {
      //     id: "" + newUserDetails._id,
      //     name: newUserDetails.name,
      //   },
      //   log_by: user.id,
      //   organisation_id: user.organisation.organisation,
      // };

      // await Log.create(log);
    } else {
      return res.status(400).send({
        status: 400,
        message: "User Not Found",
      });
    }
  } catch (error) {
    return res.status(400).send({
      status: 400,
      message: "Error sending notification",
      error,
    });
  }
};

exports.selectOrganization = async (req, res) => {
  const { organization } = req.body;
  let blankFields = [];
  try {
    if (!organization || typeof organization !== "string") {
      blankFields.push("Organization");
    }
    if (
      !req.headers.authorization ||
      !req.headers.authorization.startsWith("Bearer") ||
      !req.headers.authorization.split(" ")[1]
    ) {
      blankFields.push("Authorization Token");
    }

    if (blankFields.length > 0) {
      return res
        .status(400)
        .send({ status: "400", message: `${blankFields} is required` });
    }

    jwt.verify(
      req.headers.authorization.split(" ")[1],
      process.env.ACCOUNT_ACTIVATION,
      async (err, decoded) => {
        if (err) {
          return res
            .status(400)
            .send({ status: "400", message: "Token Not Valid" });
        }

        const user = await User.findOne({ email: decoded.email });

        if (!user) {
          return res
            .status(400)
            .send({ status: "400", message: "Email not Exist" });
        }

        let orgs = [];

        for (let org of user.organisation_list) {
          if (organization == org._id) orgs.push(org);
        }

        jwt.sign(
          { _id: user._id, email: user.email, organisation: orgs[0] },
          process.env.SECRET,
          { expiresIn: "1d" },
          async (err, token) => {
            if (err) {
              return res.status(400).send({ status: "400", message: err });
            }

            //regenerate otp
            const otp = Math.floor(100000 + Math.random() * 900000);
            // console.log(otp);
            await User.updateMany({ email: user.email }, { otp });

            let log = {
              date_time: new Date(),
              log_type: 2,
              log_heading: "User Login",
              log_message: `${user.name} Logged In`,
              log_for: {
                id: "" + user._id,
                name: user.name,
              },
              log_by: user._id,
              organisation_id: orgs[0].organisation,
            };

            await createLog(res, log);

            return res.status(200).send({
              status: "200",
              message: "Otp verified and Token generated",
              token: "Bearer " + token,
              user: {
                _id: user._id,
                organization: orgs[0],
                name: user.name,
                email: user.email,
                token: `Bearer ${token}`,
              },
            });
          }
        );
      }
    );
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .send({ status: "500", message: "Unable to Register user" });
  }
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
  try {
    const user = req.user;

    let userList = [];
    User.find(
      {
        "organisation_list.organisation": user.organisation.organisation,
      },
      async (err, docs) => {
        if (err) {
          return res.status(400).send({
            status: "400",
            message: "Failed to retrieve the User List: ",
          });
        }

        // loop all users to add the task details of each user to the user List
        for (let doc of docs) {
          let users = {};
          users.name = doc.name;
          users.email = doc.email;
          users._id = doc._id;
          users.pic = doc.pic;

          for (let data of doc.organisation_list) {
            if (data.organisation == user.organisation.organisation) {
              users.status = data.status;
              users.role = data.role;
            }
          }

          await task.find(
            {
              task_assignee: { $in: doc._id },
              organisation: user.organisation.organisation,
            },
            (err, results) => {
              if (err) {
                return res
                  .status(400)
                  .send({ status: "400", message: "Failed To Get User List" });
              }
              let projectIds = [];
              users.totalProjectCount = 0;
              for (let result of results) {
                let i = 0;
                for (i = 0; i < projectIds.length; i++) {
                  if (
                    projectIds[i].toString() == result.project_id.toString()
                  ) {
                    break;
                  }
                }
                if (i == projectIds.length) {
                  projectIds[i++] = result.project_id;
                }
                const uniqueProjectCount = projectIds.length;
                users.totalProjectCount = uniqueProjectCount;
              }

              users.taskCount = {};
              let taskCount = {};

              taskCount.active = {};
              taskCount.active.count = 0;
              taskCount.active.taskDetails = [];
              taskCount.onProcess = {};
              taskCount.onProcess.count = 0;
              taskCount.onProcess.taskDetails = [];
              taskCount.complete = {};
              taskCount.complete.count = 0;
              taskCount.complete.taskDetails = [];
              taskCount.QA = {};
              taskCount.QA.count = 0;
              taskCount.QA.taskDetails = [];

              taskCount.backlogs = {};
              taskCount.backlogs.count = 0;
              taskCount.backlogs.taskDetails = [];
              taskCount.confirmed = {};
              taskCount.confirmed.count = 0;
              taskCount.confirmed.taskDetails = [];

              for (let taskObj of results) {
                // console.log(taskObj);

                switch (taskObj.task_status) {
                  case 1:
                    taskCount.active.count++;
                    taskCount.active.taskDetails.push(taskObj);
                    break;
                  case 2:
                    taskCount.onProcess.count++;
                    taskCount.onProcess.taskDetails.push(taskObj);
                    break;
                  case 3:
                    taskCount.QA.count++;
                    taskCount.QA.taskDetails.push(taskObj);
                    break;
                  case 4:
                    taskCount.complete.count++;
                    taskCount.complete.taskDetails.push(taskObj);
                    break;
                  case 5:
                    taskCount.backlogs.count++;
                    taskCount.backlogs.taskDetails.push(taskObj);
                    break;
                  case 6:
                    taskCount.confirmed.count++;
                    taskCount.confirmed.taskDetails.push(taskObj);
                    break;
                }
              }
              users.taskCount = taskCount;
            }
          );
          userList.push(users);
        }
        if (!err) {
          // req.io.emit("message", docs);
          // req.io.to("room2").emit("message", docs);

          return res
            .status(200)
            .send({ status: "200", message: "User List", userList });
        }
      }
    );
  } catch (err) {
    return res
      .status(500)
      .send({ status: "500", message: "Something went wrong" });
  }
};

exports.userDetails = (req, res) => {
  try {
    const { userID } = req.params;

    User.findOne({ _id: userID })
      .then(async (users) => {
        if (!users) {
          return res.status(404).json({
            status: "404",
            message: "User not found",
          });
        }

        const userProjectTaskList = {
          _id: users._id,
          pic: users.pic,
          name: users.name,
          email: users.email,
          projectDetails: [],
        };

        let orgs = [];

        for (let org of users.organisation_list) {
          if (req.user.organisation.organisation == org.organisation)
            orgs.push(org);
        }

        userProjectTaskList.role = orgs[0].role;
        userProjectTaskList.status = orgs[0].status;

        const projectList = await project.find({
          $or: [
            { project_assignee: users._id },
            { project_leader: users._id },
            { created_by: users._id },
          ],
        });

        for (const eachProject of projectList) {
          const taskList = await task.find({
            $and: [
              { project_id: eachProject._id },
              {
                $or: [{ task_assignee: users._id }, { created_by: users._id }],
              },
            ],
          });

          const projectWithTasks = {
            _id: eachProject._id,
            name: eachProject.name,
            description: eachProject.description,
            project_status: eachProject.project_status,
            category: eachProject.project_category,
            project_client: eachProject.project_client,
            project_start_date: eachProject.project_start_date,
            project_end_date: eachProject.project_end_date,
            project_no: eachProject.project_no,
            created_by: eachProject.created_by,
            project_leader: eachProject.project_leader,
            project_assignee: eachProject.project_assignee,
            taskList: taskList,
          };

          userProjectTaskList.projectDetails.push(projectWithTasks);
        }
        return res.status(200).json({
          status: "200",
          message: "Success",
          data: userProjectTaskList,
        });
      })
      .catch((error) => {
        return res.status(500).json({
          status: "500",
          message: "Internal Server Error",
        });
      });
  } catch (error) {
    return res.status(500).json({
      status: "500",
      message: "Internal Server Error",
    });
  }
};

exports.getSingleUserData = async (req, res) => {
  try {
    const { userID } = req.params;
    const user = req.user;
    const userData = await User.findOne({ _id: userID });

    if (!userData) {
      return res.status(404).json({
        status: "404",
        message: "User not found",
      });
    }

    const userProjectTaskList = {
      _id: userData._id,
      pic: userData.pic,
      name: userData.name,
      email: userData.email,
      projectDetails: [],
    };
    let orgs = [];

    for (let org of userData.organisation_list) {
      if (req.user.organisation.organisation == org.organisation)
        orgs.push(org);
    }
    userProjectTaskList.role = orgs[0].role;
    userProjectTaskList.status = orgs[0].status;

    const projectList = await project.find({
      $or: [
        { project_assignee: userData._id },
        { project_leader: userData._id },
        { created_by: userData._id },
      ],
    });

    if (projectList) userProjectTaskList.projectCount = projectList.length;

    if (
      user.organisation.role === "admin" ||
      user.organisation.role === "subadmin"
    ) {
      if (projectList) {
        for (const eachProject of projectList) {
          const taskList = await task.find({
            $and: [
              { project_id: eachProject._id },
              {
                $or: [
                  { task_assignee: userData._id },
                  { created_by: userData._id },
                ],
              },
            ],
          });
          const projectWithTasks = {
            _id: eachProject._id,
            name: eachProject.name,
            description: eachProject.description,
            project_status: eachProject.project_status,
            category: eachProject.project_category,
            project_client: eachProject.project_client,
            project_start_date: eachProject.project_start_date,
            project_end_date: eachProject.project_end_date,
            project_no: eachProject.project_no,
            created_by: eachProject.created_by,
            project_leader: eachProject.project_leader,
            project_assignee: eachProject.project_assignee,
            taskList: taskList,
          };

          userProjectTaskList.projectDetails.push(projectWithTasks);
        }
      }
    } else {
      userProjectTaskList.projectDetails = projectList;
    }

    return res.status(200).json({
      status: "200",
      message: "Success",
      data: userProjectTaskList,
    });
  } catch (error) {
    return res.status(500).json({
      status: "500",
      message: "Internal Server Error" + error,
    });
  }
};

exports.allUserFromOrgs = (req, res) => {
  try {
    const user = req.user;

    User.find(
      {
        organisation_list: {
          $elemMatch: {
            status: "approved",
            organisation: user.organisation.organisation,
          },
        },
      },
      { _id: 1, email: 1, name: 1, pic: 1 }
    ).exec((err, docs) => {
      if (!err) {
        // req.io.emit("message", docs);
        // req.io.to("room2").emit("message", docs);
        return res
          .status(200)
          .send({ status: "200", message: "User List", docs });
      } else {
        return res.status(400).send({
          status: "400",
          message: "Failed to retrieve the User List: " + err,
        });
      }
    });
  } catch (err) {
    return res.status(500).send({
      status: 500,
      message: "Failed to get user list",
    });
  }
};

exports.getEmployeeList = async (req, res) => {
  try {
    const user = req.user;
    const employeeList = await User.find({
      organisation_list: {
        $elemMatch: {
          role: "user",
          status: "approved",
          organisation: user.organisation.organisation,
        },
      },
    });
    const employeeListDetails = [];

    if (employeeList) {
      // req.io.emit("message", docs);
      // req.io.to("room2").emit("message", docs);
      for (let employee of employeeList) {
        employeeListDetails.push({
          id: employee._id,
          name: employee.name,
          email: employee.email,
          pic: employee.pic,
        });
      }
      return res
        .status(200)
        .send({ status: "200", message: "User List", employeeListDetails });
    } else {
      return res.status(400).send({
        status: "400",
        message: "Failed to retrieve the User List",
      });
    }
  } catch (err) {
    return res.status(500).send({
      status: "500",
      message: "Something went wrong",
    });
  }
};

exports.getTeamLeaderList = async (req, res) => {
  try {
    const user = req.user;
    const leaderList = await User.find({
      organisation_list: {
        $elemMatch: {
          role: "team_leader",
          status: "approved",
          organisation: user.organisation.organisation,
        },
      },
    });
    const leaderListDetails = [];

    if (leaderList) {
      // req.io.emit("message", docs);
      // req.io.to("room2").emit("message", docs);
      for (let leader of leaderList) {
        leaderListDetails.push({
          id: leader._id,
          name: leader.name,
          email: leader.email,
          pic: leader.pic,
        });
      }
      return res.status(200).send({
        status: "200",
        message: "Team Leader List",
        leaderListDetails,
      });
    } else {
      return res.status(400).send({
        status: "400",
        message: "Failed to retrieve the User List",
      });
    }
  } catch (err) {
    return res.status(500).send({
      status: "500",
      message: "Something went wrong",
    });
  }
};

exports.getLoginUser = (req, res) => {
  try {
    const user = req.user;
    const token = req.headers.authorization.split(" ")[1];

    return res.status(200).send({
      status: "200",
      user: {
        _id: user.id,
        role: user.organisation.role,
        name: user.name,
        email: user.email,
        pic: user.pic,
        token: `Bearer ${token}`,
      },
    });
  } catch (e) {
    return res.status(400).send({
      status: "400",
      message: "Failed to Get User Details",
    });
  }
};

exports.changeUserRoles = async (req, res) => {
  try {
    const user = req.user;
    const condition = {
      _id: req.params.id,
    };
    const role = parseInt(req.body.role);

    const getUser = await User.findOne(condition);

    let oldRole;
    for (let org of getUser.organisation_list) {
      if (org.organisation == user.organisation.organisation) {
        oldRole = org.role;
      }
    }

    if (role > 6 || role < 1) {
      return res.status(400).send({ status: "400", message: "Wrong Status" });
    }
    let newRole = config.user_role[role];

    User.findByIdAndUpdate(
      condition,
      { $set: { "organisation_list.$[element].role": newRole } },
      {
        arrayFilters: [
          { "element.organisation": user.organisation.organisation },
        ],
        new: true,
      }
    )
      .then(async (docs) => {
        if (!docs) {
          return res
            .status(400)
            .send({ status: "400", message: "Failed to user Update" });
        }

        let log = {
          date_time: new Date(),
          log_type: 2,
          log_heading: "User Role Updated",
          log_message: `User ${getUser.name}'s Role changed from ${oldRole} to ${newRole} by ${user.name}`,
          before_update: oldRole,
          request: { role: newRole },
          response: docs,
          log_for: {
            id: "" + docs._id,
            name: docs.name,
          },
          log_by: user.id,
          organisation_id: user.organisation.organisation,
        };

        await Log.create(log);

        const totalUserList = await User.find({
          $and: [
            {
              "organisation_list.organisation": user.organisation.organisation,
            },
            {
              $or: [
                {
                  "organisation_list.role": "admin",
                },
                {
                  "organisation_list.role": "subadmin",
                },
              ],
            },
          ],
        });
        if (totalUserList) {
          if (totalUserList.length > 0) {
            for (let singleUser of totalUserList) {
              if (singleUser._id + "" != "" + user.id) {
                if (singleUser && singleUser.notification_subscription) {
                  const message = {
                    notification: {
                      title: "User Role Changed",
                      body: `User ${getUser.name}'s Role changed from ${oldRole} to ${newRole} by ${user.name}`,
                    },
                    token: singleUser.notification_subscription,
                  };

                  await sendPushNotification(message);
                }
              }
            }
          }
        }

        return res
          .status(200)
          .send({ status: "200", message: "Succesffully Updated User" });
      })
      .catch((err) => {
        return res
          .status(400)
          .send({ status: "400", message: "Something went wrong" });
      });
  } catch (e) {
    return res
      .status(500)
      .send({ status: "500", message: "Something went wrong" });
  }
};

exports.userEdit = async (req, res) => {
  try {
    const user = req.user;

    const validationErrors = validationResult(req);
    if (!validationErrors.isEmpty()) {
      return res.status(422).json({
        status: 422,
        msg: "error",
        validationErrors: validationErrors.array({ onlyFirstError: true }),
      });
    }

    const condition = {
      _id: user.id,
      organisation: user.organisation.organisation,
    };

    let filterFields = {
      _id: 1,
      name: 1,
    };

    let fields = [];

    if (req.body._id) {
      fields.push(" id ");
    }
    if (req.body.email) {
      fields.push(" email ");
    }
    if (req.body.otp) {
      fields.push(" otp ");
    }
    if (req.body.role) {
      fields.push(" role ");
    }

    if (fields.length > 0) {
      return res.status(400).send({
        status: "400",
        message: `[${fields}] can not be updated`,
      });
    }

    if (req.body.name && typeof req.body.name === "string") {
      filterFields.name = 1;
    }
    if (req.body.phone && typeof req.body.phone === "number") {
      filterFields.phone = 1;
    }
    if (req.body.pic) {
      filterFields.pic = 1;
    }

    const getUser = await User.findOne(
      {
        _id: user.id,
      },
      filterFields
    );

    User.findByIdAndUpdate(condition, req.body, { new: true })
      .then(async (docs) => {
        if (!docs) {
          return res
            .status(400)
            .send({ status: "400", message: "Failed to user Update" });
        }

        let log = {
          date_time: new Date(),
          log_type: 2,
          log_heading: "User Profile Updated",
          log_message: `User ${result.name}'s profile updated`,
          before_update: getUser,
          request: req.body,
          response: docs,
          log_for: {
            id: "" + DecompressionStream._id,
            name: DecompressionStream.name,
          },
          log_by: user.id,
          organisation_id: user.organisation.organisation,
        };

        await Log.create(log);

        return res
          .status(200)
          .send({ status: "200", message: "Succesffully Updated User" });
      })
      .catch((err) => {
        return res
          .status(400)
          .send({ status: "400", message: "Something went wrong", err });
      });
  } catch (err) {
    return res
      .status(500)
      .send({ status: "500", message: "Something went wrong" });
  }
};

exports.userApproveOrReject = async (req, res) => {
  try {
    const user = req.user;
    if (
      user.organisation.role === "admin" ||
      user.organisation.role === "subadmin"
    ) {
      const _id = req.params.id;
      const body = parseInt(req.body.status);

      const getUser = await User.findOne(
        { _id: _id },
        { _id: 1, organisation_list: 1, name: 1 }
      );

      let oldStatus;
      for (let org of getUser.organisation_list) {
        if (org.organisation == user.organisation.organisation) {
          oldStatus = org.status;
        }
      }

      if (body === 1 || body === 0) {
        let status = config.user_status[body];

        const result = await User.findByIdAndUpdate(
          _id,
          {
            $set: { "organisation_list.$[element].status": status },
          },
          {
            arrayFilters: [
              { "element.organisation": user.organisation.organisation },
            ],
            new: true,
          }
        );

        if (result) {
          let log = {
            date_time: new Date(),
            log_type: 2,
            log_heading: "User Status Changed",
            log_message: `User ${result.name}'s status changed from ${oldStatus} to ${status} by ${user.name}`,
            before_update: oldStatus,
            request: { status: status },
            response: result,
            log_for: {
              id: "" + result._id,
              name: result.name,
            },
            log_by: user.id,
            organisation_id: user.organisation.organisation,
          };

          await Log.create(log);

          const totalUserList = await User.find({
            $and: [
              {
                "organisation_list.organisation":
                  user.organisation.organisation,
              },
              {
                $or: [
                  {
                    "organisation_list.role": "admin",
                  },
                  {
                    "organisation_list.role": "subadmin",
                  },
                ],
              },
            ],
          });
          if (totalUserList) {
            if (totalUserList.length > 0) {
              for (let singleUser of totalUserList) {
                if (singleUser._id + "" != "" + user.id) {
                  if (singleUser && singleUser.notification_subscription) {
                    const message = {
                      notification: {
                        title: "User Status Changed",
                        body: `User ${getUser.name}'s Status changed from ${oldStatus} to ${status} by ${user.name}`,
                      },
                      token: singleUser.notification_subscription,
                    };

                    await sendPushNotification(message);
                  }
                }
              }
            }
          }

          if (body === 1) {
            return res
              .status(200)
              .send({ status: "200", message: "User Status approved" });
          } else if (body === 0) {
            return res
              .status(200)
              .send({ status: "200", message: "User Status rejected" });
          }
        } else {
          res.status(400).send({
            status: 400,
            message: "Failed to change status",
          });
        }
      } else {
        res.status(400).send({
          status: 400,
          message: "Invalid Status",
        });
      }
    } else {
    }
  } catch (err) {
    res.status(500).send({
      status: 500,
      message: "Failed to change status" + err,
    });
  }
};

exports.allUsers = async (req, res) => {
  try {
    const user = req.user;
    if (req.query.search === "") {
      res.status(400).send({
        status: "400",
        message: "Enter name or email to find some one",
      });
    }
    const keyword = req.query.search
      ? {
          $and: [
            {
              $or: [
                { name: { $regex: req.query.search, $options: "i" } },
                { email: { $regex: req.query.search, $options: "i" } },
              ],
            },
            {
              organisation_list: {
                $elemMatch: {
                  organisation: user.organisation.organisation,
                  status: "approved",
                },
              },
            },
          ],
        }
      : {};

    const users = await User.find(keyword).find({ _id: { $ne: user.id } });
    return res
      .status(200)
      .send({ code: 200, message: "User List fetched", users });
  } catch (err) {
    res.status(500).send({
      status: "500",
      message: "Failed to User List",
    });
  }
};

exports.createObserver = async (req, res) => {
  try {
    const user = req.user;
    if (
      user.organisation.role === "admin" ||
      user.organisation.role === "subadmin"
    ) {
      req.body.role = "observer";
      req.body.status = "approved";
      req.body.organisation = user.organisation.organisation;

      let userExist = await User.findOne({
        email: req.body.email,
      });
      if (userExist !== null) {
        let existOrNot = false;
        for (const value of userExist.organisation_list) {
          if (value.organisation == user.organisation.organisation) {
            existOrNot = true;
            break;
          }
        }

        if (existOrNot) {
          return res.status(400).send({
            status: "400",
            message: "User is already exist on the organization",
          });
        } else {
          const userDoc = await User.updateOne(
            { _id: userExist._id },
            {
              $push: {
                organisation_list: {
                  organisation: user.organisation.organisation,
                  role: req.body.role,
                  priority: 1,
                  status: req.body.status,
                },
              },
            }
          );

          let log = {
            date_time: new Date(),
            log_type: 1,
            log_heading: "Observer Added",
            log_message: `${userExist.name} added as Observer by ${user.name}`,
            request: req.body,
            response: userDoc,
            log_for: {
              id: "" + userDoc._id,
              name: userDoc.name,
            },
            log_by: user.id,
            organisation_id: user.organisation.organisation,
          };

          await Log.create(log);

          const totalUserList = await User.find({
            $and: [
              {
                "organisation_list.organisation":
                  user.organisation.organisation,
              },
              {
                $or: [
                  {
                    "organisation_list.role": "admin",
                  },
                  {
                    "organisation_list.role": "subadmin",
                  },
                ],
              },
            ],
          });
          if (totalUserList) {
            if (totalUserList.length > 0) {
              for (let singleUser of totalUserList) {
                if (singleUser._id + "" != "" + user.id) {
                  if (singleUser && singleUser.notification_subscription) {
                    const message = {
                      notification: {
                        title: "New Observer Added",
                        body: `${userExist.name} added as Observer by ${user.name}`,
                      },
                      token: singleUser.notification_subscription,
                    };

                    await sendPushNotification(message);
                  }
                }
              }
            }
          }

          return res.status(201).send({
            status: "201",
            message: "Successfully added User the to Organisation",
          });
        }
      } else {
        const newUser = new User({
          email: req.body.email,
          name: req.body.name,
          organisation_list: [
            {
              organisation: user.organisation.organisation,
              role: req.body.role,
              priority: 1,
              status: req.body.status,
            },
          ],
        });
        const result = await newUser.save();

        let log = {
          date_time: new Date(),
          log_type: 1,
          log_heading: "Observer Added",
          log_message: `${req.body.name} added as Observer by ${user.name}`,
          request: req.body,
          response: result,
          log_for: {
            id: "" + result._id,
            name: result.name,
          },
          log_by: user.id,
          organisation_id: user.organisation.organisation,
        };

        await Log.create(log);

        const totalUserList = await User.find({
          $and: [
            {
              "organisation_list.organisation": user.organisation.organisation,
            },
            {
              $or: [
                {
                  "organisation_list.role": "admin",
                },
                {
                  "organisation_list.role": "subadmin",
                },
              ],
            },
          ],
        });
        if (totalUserList) {
          if (totalUserList.length > 0) {
            for (let singleUser of totalUserList) {
              if (singleUser._id + "" != "" + user.id) {
                if (singleUser && singleUser.notification_subscription) {
                  const message = {
                    notification: {
                      title: "New Observer Added",
                      body: `${req.body.name} added as Observer by ${user.name}`,
                    },
                    token: singleUser.notification_subscription,
                  };

                  await sendPushNotification(message);
                }
              }
            }
          }
        }

        res.status(201).send({
          status: "201",
          message: "Observer created successfully",
          result,
        });
      }
    } else {
      res.status(401).send({
        status: 401,
        message: "Unauthorized user",
      });
    }
  } catch (err) {
    res.status(500).send({
      status: "500",
      message: "Something went wrong",
      err,
    });
  }
};

exports.getObserver = async (req, res) => {
  try {
    const user = req.user;
    const docs = await User.find(
      {
        organisation_list: {
          $elemMatch: {
            role: "observer",
            status: "approved",
            organisation: user.organisation.organisation,
          },
        },
      },
      {
        _id: 1,
        email: 1,
        name: 1,
        pic: 1,
      }
    );
    if (!docs) {
      return res.status(400).send({
        status: "400",
        message: "No Observer Found",
      });
    }

    return res.status(200).send({
      status: "200",
      message: "Observer fetched successfully",
      docs,
    });
  } catch (err) {
    return res.status(500).send({
      status: "500",
      message: "Failed to Get Observer List",
      docs,
    });
  }
};

exports.createClient = async (req, res) => {
  try {
    const user = req.user;
    req.body.role = "client";
    req.body.status = "approved";
    const findUser = await User.findOne({ email: req.body.email });

    if (findUser !== null) {
      let existOrNot = false;
      for (const value of findUser.organisation_list) {
        if (value.organisation == user.organisation.organisation) {
          existOrNot = true;
          break;
        }
      }

      if (existOrNot) {
        return res.status(400).send({
          status: "400",
          message: "User is already exist on the organization",
        });
      } else {
        const userDoc = await User.updateOne(
          { _id: findUser._id },
          {
            $push: {
              organisation_list: {
                organisation: user.organisation.organisation,
                role: req.body.role,
                priority: 1,
                status: req.body.status,
              },
            },
          }
        );

        let log = {
          date_time: new Date(),
          log_type: 1,
          log_heading: "Client Added",
          log_message: `${findUser.name} added as Client by ${user.name}`,
          request: req.body,
          response: userDoc,
          log_for: {
            id: "" + userDoc._id,
            name: userDoc.name,
          },
          log_by: user.id,
          organisation_id: user.organisation.organisation,
        };

        await Log.create(log);

        const totalUserList = await User.find({
          $and: [
            {
              "organisation_list.organisation": user.organisation.organisation,
            },
            {
              $or: [
                {
                  "organisation_list.role": "admin",
                },
                {
                  "organisation_list.role": "subadmin",
                },
              ],
            },
          ],
        });
        if (totalUserList) {
          if (totalUserList.length > 0) {
            for (let singleUser of totalUserList) {
              if (singleUser._id + "" != "" + user.id) {
                if (singleUser && singleUser.notification_subscription) {
                  const message = {
                    notification: {
                      title: "New Client Added",
                      body: `${findUser.name} added as Client by ${user.name}`,
                    },
                    token: singleUser.notification_subscription,
                  };

                  await sendPushNotification(message);
                }
              }
            }
          }
        }

        return res.status(201).send({
          status: "201",
          message: "Successfully added User the to Organisation",
        });
      }
    } else {
      const newUser = new User({
        email: req.body.email,
        name: req.body.name,
        organisation_list: [
          {
            organisation: user.organisation.organisation,
            role: req.body.role,
            priority: 1,
            status: req.body.status,
          },
        ],
      });
      const result = await newUser.save();

      let log = {
        date_time: new Date(),
        log_type: 1,
        log_heading: "Client Added",
        log_message: `${req.body.name} added as Client by ${user.name}`,
        request: req.body,
        response: result,
        log_for: {
          id: "" + result._id,
          name: result.name,
        },
        log_by: user.id,
        organisation_id: user.organisation.organisation,
      };

      await Log.create(log);

      const totalUserList = await User.find({
        $and: [
          {
            "organisation_list.organisation": user.organisation.organisation,
          },
          {
            $or: [
              {
                "organisation_list.role": "admin",
              },
              {
                "organisation_list.role": "subadmin",
              },
            ],
          },
        ],
      });
      if (totalUserList) {
        if (totalUserList.length > 0) {
          for (let singleUser of totalUserList) {
            if (singleUser._id + "" != "" + user.id) {
              if (singleUser && singleUser.notification_subscription) {
                const message = {
                  notification: {
                    title: "New Client Added",
                    body: `${req.body.name} added as Client by ${user.name}`,
                  },
                  token: singleUser.notification_subscription,
                };

                await sendPushNotification(message);
              }
            }
          }
        }
      }

      return res.status(201).send({
        status: "201",
        message: "Successfully added the User to Organisation",
      });
    }
  } catch (err) {
    res.status(500).send({
      status: "500",
      message: "Something went wrong",
    });
  }
};

exports.getClient = async (req, res) => {
  try {
    const user = req.user;
    const client = await User.find(
      {
        organisation_list: {
          $elemMatch: {
            role: "client",
            status: "approved",
            organisation: user.organisation.organisation,
          },
        },
      },
      {
        _id: 1,
        email: 1,
        name: 1,
        pic: 1,
      }
    );

    if (!client) {
      return res.status(400).send({
        status: "400",
        message: "Client not found",
      });
    }

    return res.status(200).send({
      status: "200",
      message: "Client fetched successfully",
      client,
    });
  } catch (err) {
    return res.status(500).send({
      status: "500",
      message: "Failed To Get Client",
    });
  }
};

exports.createSubAdmin = async (req, res) => {
  try {
    const user = req.user;
    if (
      user.organisation.role === "admin" ||
      user.organisation.role === "subadmin"
    ) {
      req.body.role = "subadmin";
      req.body.status = "approved";
      req.body.organisation = user.organisation.organisation;

      let userExist = await User.findOne({
        email: req.body.email,
      });
      if (userExist !== null) {
        let existOrNot = false;
        for (const value of userExist.organisation_list) {
          if (value.organisation == user.organisation.organisation) {
            existOrNot = true;
            break;
          }
        }

        if (existOrNot) {
          return res.status(400).send({
            status: "400",
            message: "User is already exist on the organization",
          });
        } else {
          const userDoc = await User.updateOne(
            { _id: userExist._id },
            {
              $push: {
                organisation_list: {
                  organisation: user.organisation.organisation,
                  role: req.body.role,
                  priority: 1,
                  status: req.body.status,
                },
              },
            }
          );

          let log = {
            date_time: new Date(),
            log_type: 1,
            log_heading: "Subadmin Added",
            log_message: `${userExist.name} added as Subadmin by ${user.name}`,
            request: req.body,
            response: userDoc,
            log_for: {
              id: "" + userDoc._id,
              name: userDoc.name,
            },
            log_by: user.id,
            organisation_id: user.organisation.organisation,
          };

          await Log.create(log);

          const totalUserList = await User.find({
            $and: [
              {
                "organisation_list.organisation":
                  user.organisation.organisation,
              },
              {
                $or: [
                  {
                    "organisation_list.role": "admin",
                  },
                  {
                    "organisation_list.role": "subadmin",
                  },
                ],
              },
            ],
          });
          if (totalUserList) {
            if (totalUserList.length > 0) {
              for (let singleUser of totalUserList) {
                if (singleUser._id + "" != "" + user.id) {
                  if (singleUser && singleUser.notification_subscription) {
                    const message = {
                      notification: {
                        title: "New Subadmin Added",
                        body: `${userExist.name} added as Subadmin by ${user.name}`,
                      },
                      token: singleUser.notification_subscription,
                    };

                    await sendPushNotification(message);
                  }
                }
              }
            }
          }

          return res.status(201).send({
            status: "201",
            message: "Sub Admin created successfully",
          });
        }
      } else {
        const newUser = new User({
          email: req.body.email,
          name: req.body.name,
          organisation_list: [
            {
              organisation: user.organisation.organisation,
              role: req.body.role,
              priority: 1,
              status: req.body.status,
            },
          ],
        });
        const result = await newUser.save();

        let log = {
          date_time: new Date(),
          log_type: 1,
          log_heading: "Subadmin Added",
          log_message: `${req.body.name} added as Subadmin by ${user.name}`,
          request: req.body,
          response: result,
          log_for: {
            id: "" + result._id,
            name: result.name,
          },
          log_by: user.id,
          organisation_id: user.organisation.organisation,
        };

        await Log.create(log);

        const totalUserList = await User.find({
          $and: [
            {
              "organisation_list.organisation": user.organisation.organisation,
            },
            {
              $or: [
                {
                  "organisation_list.role": "admin",
                },
                {
                  "organisation_list.role": "subadmin",
                },
              ],
            },
          ],
        });
        if (totalUserList) {
          if (totalUserList.length > 0) {
            for (let singleUser of totalUserList) {
              if (singleUser._id + "" != "" + user.id) {
                if (singleUser && singleUser.notification_subscription) {
                  const message = {
                    notification: {
                      title: "New Subadmin Added",
                      body: `${req.body.name} added as Subadmin by ${user.name}`,
                    },
                    token: singleUser.notification_subscription,
                  };

                  await sendPushNotification(message);
                }
              }
            }
          }
        }

        res.status(201).send({
          status: "201",
          message: "Sub Admin created successfully",
          result,
        });
      }
    } else {
      res.status(401).send({
        status: 401,
        message: "Unauthorized user",
      });
    }
  } catch (err) {
    res.status(500).send({
      status: "500",
      message: "Something went wrong",
      err,
    });
  }
};

exports.getSubadmin = async (req, res) => {
  try {
    const user = req.user;
    const docs = await User.find(
      {
        organisation_list: {
          $elemMatch: {
            role: "subadmin",
            status: "approved",
            organisation: user.organisation.organisation,
          },
        },
      },
      {
        _id: 1,
        email: 1,
        name: 1,
        pic: 1,
      }
    );
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
  } catch (err) {
    res.status(500).send({
      status: "500",
      message: "Failed to Get Subadmin",
    });
  }
};

// Unused apis for now
// ****************************************************************
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
    "organisation_list.status": "approved",
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

exports.forgetPassword = async (req, res) => {
  const email = req.body.email;
  const sub_domain = email.split("@")[1];

  let org = await Organisation.findOne({ sub_domain });
  // console.log(org);
  if (!org) {
    return res.status(400).send({
      status: "400",
      message: "Organisation not found",
    });
  }
  User.findOne({ email, "organisation_list.organisation": org._id })
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
              message: "Password reset mail sent successfully",
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
          message: "Your account is inactive",
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

  User.findOne({
    email,
    "organisation_list.organisation": user.organisation.organisation,
  })
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

exports.getObserversList = async (req, res) => {
  const user = req.user;

  const observerList = await User.find({
    "organisation_list.role": "observer",
    "organisation_list.organisation": user.organisation.organisation,
    "organisation_list.status": "approved",
  });
  const observerListDetails = [];

  if (observerList) {
    // req.io.emit("message", docs);
    // req.io.to("room2").emit("message", docs);
    for (let observer of observerList) {
      observerListDetails.push({
        id: observer._id,
        name: observer.name,
        email: observer.email,
        pic: observer.pic,
      });
    }
    return res.status(200).send({
      status: "200",
      message: "Observer List",
      observerListDetails,
    });
  } else {
    return res.status(400).send({
      status: "400",
      message: "Failed to retrieve the User List",
    });
  }
};
// ****************************************************************
