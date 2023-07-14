const User = require("../models/user");
const jwt = require("jsonwebtoken");
const { sendMail } = require("../services/sendEmail");
const config = require("../config/config");
const Organisation = require("../models/organisation");
const Project = require("../models/project");
const Task = require("../models/task");
const xlsx = require("xlsx");

exports.createOrganisation = async (req, res) => {
  const { email, name } = req.body;

  try {
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
    if (orgsExistOrNot) {
      let user = new User({
        name: name,
        email: email,
        organisation_list: [
          {
            organisation: orgsExistOrNot._id,
            priority: 1,
            role: "user",
          },
        ],
        status: "approved",
      });
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
              `Please click on the link to set up your account for ${
                email.split("@")[1]
              } at Redesk. Click the link to verify your account. https://dev.redesk.in/registerOrgs?token=${emailToken}&email=${email}`
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
    console.log(err);
    return res.status(400).send({
      status: "400",
      message: "Something went wrong" + err,
    });
  }
};

// After register user will get a link on the mail. Using the link and "createOrganisationfromEmail" api to create an organization and add the user as an admin to the organization
exports.createOrganisationfromEmail = async (req, res) => {
  const { token, organisation_name } = req.body;
  if (token) {
    jwt.verify(token, process.env.ACCOUNT_ACTIVATION, async (err, decoded) => {
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
          },
        ],
      });
      await user.save();

      return res.status(201).send({
        status: "201",
        message: "Successfully added User to  Organisation",
      });
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

  try {
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
          `Please click on the link to set up your account for ${organisation.organisation_name} at Redesk http://dev.redesk.in/signup?token=${emailToken}&email=${email}`
        );

        return res.status(201).send({
          status: "201",
          message: "Successfully sent invitation",
        });
      }
    );
  } catch (err) {
    console.log(err);
    return res.status(500).send({
      status: "500",
      message: "Unable to send invitation. Try again later",
      err,
    });
  }
};

exports.sendInviteFromCSV = async (req, res) => {
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
                      `Please click on the link to set up your account for ${organisation.organisation_name} at Redesk http://dev.redesk.in/signup?token=${emailToken}&email=${email}`
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
            await User.updateOne(
              { _id: findUser._id },
              {
                $push: {
                  organisation_list: {
                    organisation: decoded.organisationId,
                    role: config.user_role[decoded.role],
                    priority: 1,
                  },
                },
              }
            );

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
              },
            ],
          });
          user.save();
          // console.log("insert user");

          return res.status(201).send({
            status: "201",
            message: "Successfully added the User to Organisation",
          });
        }
      }
    );
  } catch (err) {
    console.log(err);
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
    "organisation_list.organisation": user.organisation.organisation,
    "organisation_list.role": { $ne: "client" },
  });
  const clientCount = await User.countDocuments({
    "organisation_list.organisation": user.organisation.organisation,
    "organisation_list.role": "client",
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

    const newCategory = await Organisation.findOneAndUpdate(
      { _id: user.organisation.organisation },
      { $addToSet: { projectCategories: name } },
      { new: true }
    );
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

    // const newCategory = await Organisation.findOne(
    //   { _id: user.organisation },
    //   { $addToSet: { projectCategories: name } }
    // );

    // const newCategory = await Organisation.findOneAndUpdate(
    //   { _id: user.organisation.organisation },
    //   {
    //     $set: {
    //       projectCategories: {
    //         $map: {
    //           input: "$projectCategories",
    //           as: "category",
    //           in: {
    //             $cond: {
    //               if: { $eq: ["$$category", oldName] },
    //               then: newName,
    //               else: "$$category",
    //             },
    //           },
    //         },
    //       },
    //     },
    //   }
    // );
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
                    if: { $eq: ["$$category", oldName] },
                    then: newName,
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

    return res.status(201).send({
      status: "201",
      message: "Category created successfully",
      data: newCategory,
    });
  } catch (err) {
    console.log("err", err);
    return res.status(400).send({
      status: "400",
      message: "Something went wrong",
      error: err,
    });
  }
};
