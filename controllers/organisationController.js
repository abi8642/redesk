const User = require("../models/user");
const jwt = require("jsonwebtoken");
const { sendMail } = require("../services/sendEmail");
const config = require("../config/config");
const Organisation = require("../models/organisation");
const crypto = require("crypto");
const uuidv1 = require("uuid/v1");
const nodemailer = require("nodemailer");
const Project = require("../models/project");
const Task = require("../models/task");
const xlsx = require("xlsx");
const transporter = nodemailer.createTransport({
  host: "mail.apptimates.com",
  port: 587,
  auth: {
    user: "invite@apptimates.com",
    pass: "1234567", // naturally, replace both with your real credentials or an application-specific password
  },
});

// user: "subhadev1289@gmail.com",
// pass: "yzchxkbxrizezpet",

exports.createOrganisation = async (req, res) => {
  // Check whether email already exists
  const {
    // sub_domain,
    organisation_name,
    organisation_email,
    organisation_website,
    organisation_address,
    email,
    name,
    password,
  } = req.body;

  // const result = await User.findOne({
  //   email: req.body.email,
  //   sub_domain: sub_domain,
  // });
  // if (result) {
  //   return res.status(400).send({
  //     status: "400",
  //     message: "Email already exists",
  //   });
  // }
  // console.log(req.body);
  try {
    const emailExistsOrNot = await User.findOne({ email: email });
    if (emailExistsOrNot) {
      return res.status(400).send({
        status: "400",
        message: "Email already exists",
      });
    }

    let sub_domain = email.split("@")[1];
    // if (
    //   sub_domain == "gmail.com" ||
    //   sub_domain == "yahoo.com" ||
    //   sub_domain == "hotmail.com" ||
    //   sub_domain == "outlook.com" ||
    //   sub_domain == "live.com"
    // ) {
    //   return res.status(400).send({
    //     status: "400",
    //     message: "Invalid Email",
    //   });
    // }

    if (!sub_domain) {
      return res.status(400).send({
        status: "400",
        message: "Invalid Email",
      });
    }
    const orgsExistOrNot = await Organisation.findOne({
      sub_domain: sub_domain,
    });
    if (orgsExistOrNot) {
      // console.log(orgsExistOrNot, "asdasdas");
      let user = new User({
        name: name,
        email: email,
        // password: password,
        organisation_list: [
          {
            organisation: orgsExistOrNot._id,
            priority: 1,
            role: "user",
          },
        ],
        status: "approved",
        // role: "user",
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
          // organisation: {
          //   id: orgsExistOrNot._id,
          //   sub_domain: orgsExistOrNot.sub_domain,
          //   organisation_name: orgsExistOrNot.organisation_name,
          // },
        });
      });
    } else {
      // console.log(orgsExistOrNot, "asdasdas21");
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

          // transporter.sendMail({
          //   from: "invite@apptimates.com",
          //   to: email,
          //   subject: "Please set up your account for Redesk",
          //   text: `Please click on the link to set up your account for ${
          //     email.split("@")[1]
          //   } at Redesk. Click the link to verify your account. https://redesk.in/registerOrgs?token=${emailToken}&email=${email}&name=${name}`,
          // });
          try {
            sendMail(
              email,
              "Please set up your account for Redesk",
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

  // Organisation.findOne({ sub_domain }, (err, org) => {
  //   if (err || org) {
  //     // console.log(err);
  //     return res
  //       .status(400)
  //       .send({ status: "400", message: "Company subdomain already exists" });
  //   }

  // If email don't exist, create user
  //   req.body.status = "pending";
  //   req.body.role = "admin";
  //   const organisation = new Organisation(req.body);
  //   organisation.save((err, organisation) => {
  //     if (err) {
  //       return res.status(400).send({
  //         status: "500",
  //         message: "Unable to signup. Try again later",
  //         err,
  //       });
  //     }

  //     req.body.organisation = organisation._id;
  //     console.log(organisation);
  //     const user = new User(req.body);
  //     user.save((err, user) => {
  //       if (err) {
  //         return res.status(400).send({
  //           status: "500",
  //           message: "Unable to signup. Try again later",
  //           err,
  //         });
  //       }

  //       console.log(user);

  //       jwt.sign(
  //         { _id: user._id, organisation: organisation._id },
  //         process.env.ACCOUNT_ACTIVATION,
  //         {
  //           expiresIn: "1d",
  //         },
  //         (err, emailToken) => {
  //           if (err) {
  //             return res.status(400).send({
  //               status: "500",
  //               message: "Unable to signup. Try again later",
  //               err,
  //             });
  //           }

  //           transporter.sendMail({
  //             from: "invite@apptimates.com",
  //             to: user.email,
  //             subject: "Please set up your account for Redesk",
  //             text: `Please click on the link to set up your account for ${organisation.organisation_name} at Redesk Click the link to verify your account. https://redesk.in/verified?token=${emailToken}`,
  //           });

  //           return res.status(201).send({
  //             status: "201",
  //             message: "Successfully added Organisation",
  //             organisation: {
  //               id: organisation._id,
  //               sub_domain: organisation.sub_domain,
  //               organisation_name: organisation.organisation_name,
  //             },
  //           });
  //         }
  //       );
  //     });
  //   });
  // });
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

// **********************************************************
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
// **********************************************************

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
  // console.log("user = " + user);

  const { email } = req.body;

  try {
    const organisation = await Organisation.findOne({
      _id: user.organisation.organisation,
    });

    // console.log("organisation", organisation);

    jwt.sign(
      { organisationId: organisation._id, email },
      process.env.INVITE_KEY,
      {
        expiresIn: "1d",
      },
      (err, emailToken) => {
        if (err) {
          return res.status(400).send({
            status: "400",
            message: "Unable to signup. Try again later",
            err,
          });
        }
        transporter.sendMail({
          from: "invite@apptimates.com",
          to: email,
          subject: "Please set up your account for Redesk",
          text: `Please click on the link to set up your account for ${organisation.organisation_name} at Redesk http://dev.redesk.in/signup?token=${emailToken}&email=${email}`,
        });

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

  const workbook = xlsx.readFile(file.tempFilePath); // Step 2
  let workbook_sheet = workbook.SheetNames; // Step 3
  let workbook_response = xlsx.utils.sheet_to_json(
    // Step 4
    workbook.Sheets[workbook_sheet[0]]
  );

  let promises = [];

  for (let i = 0; i < workbook_response.length; i++) {
    const { email } = workbook_response[i];
    if (!email) {
      console.log("NO email found");
      continue;
    }
    const organisation = await Organisation.findOne({ _id: user.organisation });
    jwt.sign(
      { _id: organisation._id, email },
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
        console.log(email);
        promises.push(
          new Promise((resolve, reject) => {
            transporter.sendMail(
              {
                from: "invite@apptimates.com",
                to: email,
                subject: "Please set up your account for Redesk",
                text: `Please click on the link to set up your account for ${organisation.organisation_name} at Redesk http://redesk.in/signup?token=${emailToken}&email=${email}`,
              },
              (err, info) => {
                if (err) {
                  reject(err);
                } else {
                  resolve(info);
                }
              }
            );
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
};

exports.verifyEmailInvite = async (req, res) => {
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
            // console.log("value", value);
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
                    role: "user",
                    priority: 1,
                  },
                },
              }
            );
            // console.log("Update Organization List");

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
                role: "user",
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

// let final_arr = [],
//   promises = [];
// for (let i = 0; i < email_arr.length; i++) {
//   let pass = Math.random().toString(36).slice(2, 10);

//   const mailOptions = {
//     from: "subhadev1289@gmail.com",
//     to: email_arr[i].email,
//     subject: "Your Account is up for Redesk",
//     text: `Your password is ${pass}`,
//   };

//   let salt = uuidv1();
//   let encry_password = "";
//   try {
//     encry_password = crypto
//       .createHmac("sha256", salt)
//       .update(pass + "")
//       .digest("hex");
//   } catch (e) {
//     console.log(e);
//     encry_password = "";
//   }
//   final_arr.push({
//     firstName: email_arr[i].firstName,
//     lastName: email_arr[i].lastName,
//     email: email_arr[i].email,
//     salt: salt,
//     encry_password: encry_password,
//     organisation: organisation_id,
//   });

//   promises.push(
//     new Promise(function (resolve, reject) {
//       transporter.sendMail(mailOptions, function (err, info) {
//         if (err) {
//           reject(err);
//         } else resolve(info);
//       });
//     })
//   );
// }
// console.log(final_arr);
// const user = await User.insertMany(final_arr, { upsert: true });
// console.log(user);
// const mailOptions2 = {
//   from: "user@gmail.com",
//   to: "test1@gmail.com",
//   subject: "LOL due",
//   text: "Dudes, we really need your money.",
// };

// Promise.all(promises)
//   .then((r) => {
//     return res.status(201).send({
//       status: "201",
//       message: "Invite Sent",
//       data: r,
//     });
//   })
//   .catch((err) =>
//     res.status(201).send({
//       status: "500",
//       message: "Something went wrong",
//       error: err,
//     })
//   );
// };

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
  // const projectId = { project_id: req.params.id };
  const user = req.user;
  console.log("req.user = " + req.user);
  const projectCount = await Project.countDocuments({
    organisation: user.organisation,
  });
  const taskCount = await Task.countDocuments({
    organisation: user.organisation,
  });
  const userCount = await User.countDocuments({
    organisation: user.organisation,
    role: { $ne: "client" },
  });
  const clientCount = await User.countDocuments({
    organisation: user.organisation,
    role: "client",
  });

  // const projectList = await project.find({ organisation: user.organisation });
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
      { _id: user.organisation },
      { $addToSet: { projectCategories: name } }
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
      { _id: user.organisation },
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

    const newCategory = await Organisation.findOneAndUpdate(
      { _id: user.organisation },
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
      }
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
