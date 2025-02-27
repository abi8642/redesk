const User = require("../models/user");
const jwt = require("jsonwebtoken");
const { sendMail } = require("../services/sendEmail");
const config = require("../config/config");
const Organisation = require("../models/organisation");
const Project = require("../models/project");
const Task = require("../models/task");
const xlsx = require("xlsx");
const Log = require("../models/log");
const { sendPushNotification } = require("../services/configPushNotification");

exports.createOrganisation = async (req, res) => {
  try {
    const { email, name } = req.body;

    // Check whether email already exists
    const emailExistsOrNot = await User.findOne({ email: email });
    if (emailExistsOrNot) {
      return res.status(400).send({
        status: "400",
        message: "Email already exists",
      });
    }

    let sub_domain = email.split("@")[1];

    if (!sub_domain) {
      return res.status(400).send({
        status: "400",
        message: "Invalid Email",
      });
    }
    // Check whether the organization already exists
    const orgsExistOrNot = await Organisation.findOne({
      sub_domain: sub_domain,
    });
    if (orgsExistOrNot != null) {
      let user = new User({
        name: name,
        email: email,
        organisation_list: [
          {
            organisation: orgsExistOrNot._id,
            priority: 1,
            role: "user",
            status: "approved",
          },
        ],
      });
      user.save(async (err, userDoc) => {
        if (err) {
          return res.status(400).send({
            status: "500",
            message: "Unable to signup. Try again later",
            err,
          });
        }

        let log = {
          date_time: new Date(),
          log_type: 1,
          log_heading: "New User Joined",
          log_message: `${name} joined as User in our organization`,
          request: req.body,
          response: userDoc,
          log_for: {
            id: "" + userDoc._id,
            name: userDoc.name,
          },
          log_by: userDoc._id,
          organisation_id: orgsExistOrNot._id,
        };

        await Log.create(log);

        const totalUserList = await User.find({
          "organisation_list.organisation": orgsExistOrNot._id,
        });
        if (totalUserList) {
          if (totalUserList.length > 0) {
            for (let singleUser of totalUserList) {
              if (singleUser && singleUser.notification_subscription) {
                const message = {
                  notification: {
                    title: "New user Joined",
                    body: `${name} added as User in our organization`,
                  },
                  token: singleUser.notification_subscription,
                };
                await sendPushNotification(message);
              }
            }
          }
        }

        return res.status(201).send({
          status: "201",
          message: "Successfully added User to  Organisation",
        });
      });
    } else {
      jwt.sign(
        { email, name },
        process.env.ACCOUNT_ACTIVATION,
        {
          expiresIn: "1d",
        },
        async (err, emailToken) => {
          if (err) {
            return res.status(400).send({
              status: "500",
              message: "Unable to signup. Try again later",
              err,
            });
          }

          try {
            sendMail(
              email,
              "Set up your account",
              `Please click on the below link to set up your account for ${
                email.split("@")[1]
              } at Redesk. <br><br>
              https://dev.redesk.in/registerOrgs?token=${emailToken}&email=${email}`
            );
            return res.status(201).send({
              status: "201",
              message: "Successfully Sent Mail",
            });
          } catch (err) {
            return res.status(400).send({
              status: "500",
              message: "Unable to signup. Try again later",
              err,
            });
          }
        }
      );
    }
  } catch (err) {
    return res.status(400).send({
      status: "400",
      message: "Something went wrong" + err,
    });
  }
};

// After register organization user will get a link on the mail. Using the link and "createOrganisationfromEmail" api to create an organization and add the user as an admin to the organization
exports.createOrganisationfromEmail = async (req, res) => {
  try {
    const { token, organisation_name } = req.body;
    if (token) {
      jwt.verify(
        token,
        process.env.ACCOUNT_ACTIVATION,
        async (err, decoded) => {
          if (err) {
            return res.status(401).send({
              status: "401",
              message: "Expired link. Signup again",
            });
          }

          const { email, name } = decoded;
          User.findOne({ email }, async (err, user) => {
            if (user) {
              return res.status(401).send({
                status: "401",
                message: "User already exist",
              });
            }
          });

          const orgs = new Organisation({
            organisation_name,
            sub_domain: email.split("@")[1],
          });
          await orgs.save();

          const user = new User({
            email,
            name,
            organisation_list: [
              {
                organisation: orgs._id,
                role: "admin",
                priority: 1,
                status: "approved",
              },
            ],
          });
          await user.save();

          return res.status(201).send({
            status: "201",
            message: "Successfully added User to  Organisation",
          });
        }
      );
    }
  } catch (err) {
    return res.status(500).send({
      status: "500",
      message: "Something went wrong",
    });
  }
};

// exports.verifyOrganisation = (req, res) => {
//   const { token } = req.query;
//   if (token) {
//     jwt.verify(token, process.env.ACCOUNT_ACTIVATION, (err, decoded) => {
//       if (err) {
//         return res.status(401).send({
//           status: "401",
//           message: "Expired link. Signup again",
//         });
//       }

//       // console.log("decoded", decoded);
//       const { _id, organisation } = decoded;
//       User.findOne({ _id, organisation }, async (err, user) => {
//         if (err || !user) {
//           return res.status(401).send({
//             status: "401",
//             message: "User with this email does not exist",
//           });
//         }
//         if (user.status === "approved") {
//           return res.status(401).json({
//             status: "401",
//             message: "User already verified",
//           });
//         }
//         user.status = "approved";
//         await Organisation.findOneAndUpdate(
//           { _id: user.organisation },
//           { status: "approved" }
//         );
//         user.save((err, user) => {
//           if (err) {
//             return res.status(401).json({
//               status: "401",
//               message: "Something went wrong. Try again later",
//             });
//           }
//           return res.status(200).json({
//             status: "200",
//             message: "User verified successfully",
//             data: user.email,
//           });
//         });
//       });
//     });
//   } else {
//     return res.status(401).send({
//       status: "401",
//       message: "Something went wrong. Try again later",
//     });
//   }
// };

exports.checkSubDomain = (req, res) => {
  const { sub_domain } = req.body;
  Organisation.findOne({ sub_domain }, (err, subdomain) => {
    if (err || subdomain) {
      // console.log(err);
      return res
        .status(400)
        .send({ status: "400", message: "Subdomain already exists" });
    }
    return res.status(201).send({
      status: "201",
      message: "Subdomain is available",
    });
  });
};

exports.sendInviteFromOrganisation = async (req, res) => {
  try {
    const user = req.user;
    let { email, role } = req.body;
    let blankFields = [];

    if (!email || email === "" || typeof email !== "string") {
      blankFields.push("Email");
    }
    if (!role || typeof role !== "number") {
      role = 6;
    }
    if (blankFields.length > 0) {
      return res.status(400).send({
        status: "400",
        message: `${blankFields} is required`,
      });
    }
    if (role < 2 || role > 6) {
      return res.status(400).send({
        status: "400",
        message: `role must be between 2 and 6, inclusive`,
      });
    }

    const organisation = await Organisation.findOne({
      _id: user.organisation.organisation,
    });

    jwt.sign(
      { organisationId: organisation._id, email, role },
      process.env.INVITE_KEY,
      {
        expiresIn: "1d",
      },
      (err, emailToken) => {
        if (err) {
          return res.status(400).send({
            status: "400",
            message: "Unable to signup. Try again later",
          });
        }
        sendMail(
          email,
          "Please set up your account for Redesk",
          `Please click on the below link to set up your account for ${organisation.organisation_name} at Redesk. <br><br> 
          http://dev.redesk.in/signup?token=${emailToken}&email=${email}`
        );

        return res.status(201).send({
          status: "201",
          message: "Successfully sent invitation",
        });
      }
    );
  } catch (err) {
    return res.status(500).send({
      status: "500",
      message: "Unable to send invitation. Try again later" + err,
    });
  }
};

exports.sendInviteFromCSV = async (req, res) => {
  try {
    const user = req.user;

    let file = req.files.file;

    if (file) {
      file.mv(
        "D:/rechargekit/redesk-v2-api/files/" + file.name,
        async function (err) {
          if (err) {
            res.send(err);
          } else {
            const workbook = xlsx.readFile(
              "D:/rechargekit/redesk-v2-api/files/" + file.name
            ); // Step 2
            let workbook_sheet = workbook.SheetNames; // Step 3
            let workbook_response = xlsx.utils.sheet_to_json(
              // Step 4
              workbook.Sheets[workbook_sheet[0]]
            );
            let promises = [];

            for (let i = 0; i < workbook_response.length; i++) {
              let { email, role } = workbook_response[i];
              if (!email) {
                console.log("NO email found");
                continue;
              }
              if (!role) {
                role = 6;
              }
              const organisation = await Organisation.findOne({
                _id: user.organisation.organisation,
              });
              jwt.sign(
                { organisationId: organisation._id, email, role },
                process.env.INVITE_KEY,
                {
                  expiresIn: "1d",
                },
                (err, emailToken) => {
                  if (err) {
                    return res.status(400).send({
                      status: "500",
                      message: "Unable to signup. Try again later",
                      err,
                    });
                  }

                  promises.push(
                    new Promise((resolve, reject) => {
                      sendMail(
                        email,
                        "Please set up your account for Redesk",
                        `Please click on the below link to set up your account for ${organisation.organisation_name} at Redesk. <br><br>
                        http://dev.redesk.in/signup?token=${emailToken}&email=${email}`
                      )
                        .then((info) => {
                          resolve(info);
                        })
                        .catch((err) => {
                          reject(err);
                        });
                    })
                  );
                }
              );
            }
            Promise.all(promises)
              .then((data) => {
                return res.status(201).send({
                  status: "201",
                  message: "Successfully sent invites",
                });
              })
              .catch((err) => {
                return res.status(400).send({
                  status: "400",
                  message: "Unable to send invites",
                });
              });
          }
        }
      );
    }
  } catch (err) {
    return res.status(500).send({
      status: "500",
      message: "Something went wrong",
    });
  }

  // const workbook = xlsx.readFile(file.data); // Step 2
  // let workbook_sheet = workbook.SheetNames; // Step 3
  // let workbook_response = xlsx.utils.sheet_to_json(
  //   // Step 4
  //   workbook.Sheets[workbook_sheet[0]]
  // );
};

exports.verifyInvitation = async (req, res) => {
  const { email, name } = req.body;
  let blankFields = [];
  try {
    if (!email || email === "" || typeof email !== "string") {
      blankFields.push("Email");
    }
    if (!name || name === "" || typeof name !== "string") {
      blankFields.push("Name");
    }
    if (
      !req.headers.authorization ||
      !req.headers.authorization.startsWith("Bearer") ||
      !req.headers.authorization.split(" ")[1]
    ) {
      blankFields.push("Token");
    }
    if (blankFields.length > 0) {
      return res.status(400).send({
        status: "400",
        message: `${blankFields} is required`,
      });
    }

    jwt.verify(
      req.headers.authorization.split(" ")[1],
      process.env.INVITE_KEY,
      async (err, decoded) => {
        if (err) {
          return res
            .status(400)
            .send({ status: "400", message: "Invalid Token" });
        }

        const findUser = await User.findOne({ email: req.body.email });
        const findOrganisation = await Organisation.findOne({
          _id: decoded.organisationId,
        });

        if (findUser) {
          let existOrNot = false;
          for (const value of findUser.organisation_list) {
            if (value.organisation == decoded.organisationId) {
              existOrNot = true;
              break;
            }
          }

          if (existOrNot) {
            return res.status(400).send({
              status: "400",
              message: "You are already exist on the organization",
            });
          } else {
            const userDoc = await User.findByIdAndUpdate(
              { _id: findUser._id },
              {
                $push: {
                  organisation_list: {
                    organisation: decoded.organisationId,
                    role: config.user_role[decoded.role],
                    priority: 1,
                    status: "approved",
                  },
                },
              },
              { new: true }
            );

            const totalUserList = await User.find({
              "organisation_list.organisation": decoded.organisationId,
            });
            if (totalUserList) {
              if (totalUserList.length > 0) {
                for (let singleUser of totalUserList) {
                  if (singleUser && singleUser.notification_subscription) {
                    const message = {
                      notification: {
                        title: "New user Joined",
                        body: `
                       ${name} added as User to our organization`,
                      },
                      token: singleUser.notification_subscription,
                    };

                    await sendPushNotification(message);
                  }
                }
              }
            }

            let log = {
              date_time: new Date(),
              log_type: 1,
              log_heading: "New User Joined",
              log_message: `${name} joined as User in our organization`,
              request: req.body,
              response: userDoc,
              log_for: {
                id: "" + userDoc._id,
                name: userDoc.name,
              },
              log_by: userDoc._id,
              organisation_id: decoded.organisationId,
            };

            await Log.create(log);

            return res.status(201).send({
              status: "201",
              message: "Successfully added User the to Organisation",
            });
          }
        } else {
          const user = new User({
            email,
            name,
            organisation_list: [
              {
                organisation: decoded.organisationId,
                role: config.user_role[decoded.role],
                priority: 1,
                status: "approved",
              },
            ],
          });
          const userDoc = await user.save();

          const totalUserList = await User.find({
            "organisation_list.organisation": decoded.organisationId,
          });
          if (totalUserList) {
            if (totalUserList.length > 0) {
              for (let singleUser of totalUserList) {
                if (singleUser && singleUser.notification_subscription) {
                  const message = {
                    notification: {
                      title: "New user Joined",
                      body: `
                     ${name} added as User to our organization`,
                    },
                    token: singleUser.notification_subscription,
                  };

                  await sendPushNotification(message);
                }
              }
            }
          }

          let log = {
            date_time: new Date(),
            log_type: 1,
            log_heading: "New User Joined",
            log_message: `${name} joined as User in our organization`,
            request: req.body,
            response: userDoc,
            log_for: {
              id: "" + userDoc._id,
              name: userDoc.name,
            },
            log_by: userDoc._id,
            organisation_id: decoded.organisationId,
          };

          await Log.create(log);

          return res.status(201).send({
            status: "201",
            message: "Successfully added the User to Organisation",
          });
        }
      }
    );
  } catch (err) {
    return res.status(500).send({
      status: "500",
      message: "Unable to add the User to Organisation",
      err,
    });
  }
};

//organisation list
exports.getOrganisationList = (req, res) => {
  Organisation.find({ status: "approved" }, (err, orgs) => {
    if (orgs) {
      // console.log(err);
      return res
        .status(201)
        .send({ status: "201", message: "orgs list", data: orgs });
    }
    return res.status(400).send({
      status: "400",
      message: "Orgs is not available",
    });
  });
};

exports.getDashboardDetails = async (req, res) => {
  const user = req.user;

  const projectCount = await Project.countDocuments({
    organisation: user.organisation.organisation,
  });
  const taskCount = await Task.find({
    task_status: { $nin: [6] },
  }).countDocuments({
    organisation: user.organisation.organisation,
  });
  const userCount = await User.countDocuments({
    organisation_list: {
      $elemMatch: {
        role: { $ne: "client" },
        status: "approved",
        organisation: user.organisation.organisation,
      },
    },
  });
  const clientCount = await User.countDocuments({
    organisation_list: {
      $elemMatch: {
        role: "client",
        status: "approved",
        organisation: user.organisation.organisation,
      },
    },
  });

  return res.status(200).send({
    status: "200",
    message: "Dashboard details",
    data: {
      projectCount,
      taskCount,
      userCount,
      clientCount,
    },
  });
};

exports.createCategory = async (req, res) => {
  try {
    const user = req.user;
    const { name } = req.body;

    const getOrganization = await Organisation.findOne(
      {
        _id: user.organisation.organisation,
      },
      {
        projectCategories: 1,
      }
    );

    if (getOrganization.projectCategories.length > 0) {
      let categoryExists = false;
      for (let category of getOrganization.projectCategories) {
        if (name.toUpperCase().trim() === category) {
          categoryExists = true;
          break;
        }
      }
      if (categoryExists) {
        return res.status(400).send({
          status: "400",
          message: "Category already exists",
        });
      }
    }

    const newCategory = await Organisation.findOneAndUpdate(
      { _id: user.organisation.organisation },
      { $addToSet: { projectCategories: name.toUpperCase().trim() } },
      { new: true }
    );

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
                  title: "New Category Created",
                  body: `New category ${name.toUpperCase().trim()} created by ${
                    user.name
                  }`,
                },
                token: singleUser.notification_subscription,
              };

              await sendPushNotification(message);
            }
          }
        }
      }
    }

    let log = {
      date_time: new Date(),
      log_type: 1,
      log_heading: "New Category Added",
      log_message: `New category ${name.toUpperCase().trim()} created by ${
        user.name
      }`,
      request: req.body,
      response: newCategory,
      log_for: {
        id: "" + newCategory._id,
        name: newCategory.organisation_name,
      },
      log_by: user.id,
      organisation_id: user.organisation.organisation,
    };

    await Log.create(log);

    return res.status(201).send({
      status: "201",
      message: "Category created successfully",
      data: newCategory,
    });
  } catch (err) {
    return res.status(400).send({
      status: "400",
      message: "Something went wrong",
      error: err,
    });
  }
};

exports.allCategories = async (req, res) => {
  try {
    const user = req.user;
    const categories = await Organisation.findOne(
      { _id: user.organisation.organisation },
      { projectCategories: 1 }
    );

    return res.status(201).send({
      status: "201",
      message: "Categories fetched successfully",
      data: categories.projectCategories,
    });
  } catch (err) {
    return res.status(400).send({
      status: "400",
      message: "Something went wrong",
      error: err,
    });
  }
};

exports.editCategory = async (req, res) => {
  try {
    const user = req.user;
    const { oldName, newName } = req.body;
    const getOrganization = await Organisation.findOne(
      {
        _id: user.organisation.organisation,
      },
      {
        projectCategories: 1,
      }
    );

    if (getOrganization.projectCategories.length > 0) {
      let categoryExists = false;
      for (let category of getOrganization.projectCategories) {
        if (oldName.toUpperCase().trim() === category) {
          categoryExists = true;
          break;
        }
      }
      if (!categoryExists) {
        return res.status(400).send({
          status: "400",
          message: `[${oldName}] Category does not exists`,
        });
      }
    }
    const newCategory = await Organisation.findOneAndUpdate(
      { _id: user.organisation.organisation },
      [
        {
          $set: {
            projectCategories: {
              $map: {
                input: "$projectCategories",
                as: "category",
                in: {
                  $cond: {
                    if: { $eq: ["$$category", oldName.toUpperCase().trim()] },
                    then: newName.toUpperCase().trim(),
                    else: "$$category",
                  },
                },
              },
            },
          },
        },
      ],
      { new: true }
    );

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
                  title: "Category Updated",
                  body: `Category updated from ${oldName
                    .toUpperCase()
                    .trim()} to ${oldName.toUpperCase().trim()} by ${
                    user.name
                  }`,
                },
                token: singleUser.notification_subscription,
              };

              await sendPushNotification(message);
            }
          }
        }
      }
    }

    let log = {
      date_time: new Date(),
      log_type: 2,
      log_heading: "Category Updated",
      log_message: `Category updated from ${oldName
        .toUpperCase()
        .trim()} to ${oldName.toUpperCase().trim()} by ${user.name}`,
      before_update: { categoryName: oldName },
      request: req.body,
      response: { categoryName: newName },
      log_for: {
        id: "" + newCategory._id,
        name: newCategory.organisation_name,
      },
      log_by: user.id,
      organisation_id: user.organisation.organisation,
    };

    await Log.create(log);

    return res.status(201).send({
      status: "201",
      message: "Category created successfully",
      data: newCategory,
    });
  } catch (err) {
    return res.status(400).send({
      status: "400",
      message: "Something went wrong" + err,
    });
  }
};
