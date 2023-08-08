const projectModel = require("../models/project");
const User = require("../models/user");
const taskModel = require("../models/task");
const Log = require("../models/log");
const fs = require("fs");
const Notification = require("../models/notification");
const { sendMail } = require("../services/sendEmail");
const { sendPushNotification } = require("../services/configPushNotification");
const { createLog } = require("../controllers/logController");

exports.createProject = async (req, res) => {
  try {
    const user = req.user;

    const d = new Date();
    const month = d.getMonth() + 1;
    const year = d.getFullYear();

    const projectCount = await projectModel.countDocuments({
      createdAt: {
        $gte: new Date(year, month - 1, 1), // Start of the month
        $lt: new Date(year, month, 1), // Start of next month
      },
    });

    const project_no = projectCount + 1;
    const reference_id =
      "RKIT" +
      (d.getYear() - 100) +
      ("0" + month).slice(-2) +
      "" +
      String(project_no).padStart(5, "0");

    req.body.project_no = reference_id;
    req.body.created_by = user.id;
    req.body.organisation = user.organisation.organisation;

    projectModel
      .create(req.body)
      .then(async (project) => {
        let log = {
          date_time: new Date(),
          log_type: 1,
          log_heading: "Project Created",
          log_message: `New project ${project.project_name} created by ${user.name}\nStatus: ${project.project_status} Priority: ${project.project_priority}`,
          request: req.body,
          response: project,
          log_for: {
            id: "" + project._id,
            name: project.project_name,
          },
          log_by: user.id,
          organisation_id: user.organisation.organisation,
        };

        await createLog(res, log);

        let sendTo = [];
        let sendToAdmin = [];
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

        if (project.project_assignee) {
          if (project.project_assignee.length > 0) {
            for (const eachProjectAssignee of project.project_assignee) {
              const eachProjectAssigneeData = await User.findOne({
                _id: eachProjectAssignee,
              });

              if (
                eachProjectAssigneeData &&
                eachProjectAssigneeData.notification_subscription
              ) {
                sendTo.push(eachProjectAssignee);
                const message = {
                  notification: {
                    title: "New Project Assigned",
                    body: `
                You are assigned on project "${project.project_name}" by ${user.name}\nStatus: ${project.project_status} Priority: ${project.project_priority}`,
                  },
                  token: eachProjectAssigneeData.notification_subscription,
                };

                await sendPushNotification(message);
              }

              const assigneeMail = eachProjectAssigneeData.email;
              const subjects = "You are assign on a project";
              const sendMsgs = `
                Project_Name: <b>${project.project_name}</b><br>
                Project_due_on: <b>${project.project_end_date}</b><br>
                Project_priority: <b>${project.project_priority}</b><br>
                Project_created_by: <b>${user.name}</b>`;
              sendMail(assigneeMail, subjects, sendMsgs);
            }
          }
        }

        if (project.project_leader) {
          if (project.project_leader.length > 0) {
            for (const eachProjectLeader of project.project_leader) {
              const eachProjectLeaderData = await User.findOne({
                _id: eachProjectLeader,
              });

              if (eachProjectLeader + "" !== "" + user.id) {
                if (
                  eachProjectLeaderData &&
                  eachProjectLeaderData.notification_subscription
                ) {
                  sendTo.push(eachProjectLeader);
                  const message = {
                    notification: {
                      title: "New Project Assigned",
                      body: `
                You are assigned as a Leader on project "${project.project_name}" by ${user.name}\nStatus: ${project.project_status} Priority: ${project.project_priority}`,
                    },
                    token: eachProjectLeaderData.notification_subscription,
                  };

                  await sendPushNotification(message);
                }
              }

              const assigneeMail = eachProjectLeaderData.email;
              const subjects = "You are assign on a project";
              const sendMsgs = `
                Project_Name: <b>${project.project_name}</b><br>
                Project_due_on: <b>${project.project_end_date}</b><br>
                Project_priority: <b>${project.project_priority}</b><br>
                Project_created_by: <b>${user.name}</b><br>
                Role:<b>${user.organisation.role}</b>
                `;
              sendMail(assigneeMail, subjects, sendMsgs);
            }
          }
        }

        if (project.project_client) {
          const eachProjectClientData = await User.findOne({
            _id: project.project_client,
          });

          if (
            eachProjectClientData &&
            eachProjectClientData.notification_subscription
          ) {
            sendTo.push(project.project_client);
            const message = {
              notification: {
                title: "New Project Assigned",
                body: `
                You are assigned as a Client on project "${project.project_name}" by ${user.name}\nStatus: ${project.project_status} Priority: ${project.project_priority}`,
              },
              token: eachProjectClientData.notification_subscription,
            };

            await sendPushNotification(message);
          }

          const assigneeMail = eachProjectClientData.email;
          const subjects = "New Project Assigned";
          const sendMsgs = `
                Project_Name: <b>${project.project_name}</b><br>
                Project_due_on: <b>${project.project_end_date}</b><br>
                Project_priority: <b>${project.project_priority}</b><br>
                Project_created_by: <b>${user.name}</b><br>
                Role:<b>${user.organisation.role}</b>
                `;
          sendMail(assigneeMail, subjects, sendMsgs);
        }

        if (totalUserList) {
          for (let singleUser of totalUserList) {
            if (singleUser._id + "" != "" + user.id) {
              sendToAdmin.push(singleUser._id);

              if (singleUser.notification_subscription) {
                const message = {
                  notification: {
                    title: "New Project Created",
                    body: `
                    New project ${project.project_name} created by ${user.name}\nStatus: ${project.project_status} Priority: ${project.project_priority}`,
                  },
                  token: singleUser.notification_subscription,
                };

                await sendPushNotification(message);
              }

              const assigneeMail = singleUser.email;
              const subjects = "New Project Created";
              const sendMsgs = `
                Project_Name: <b>${project.project_name}</b><br>
                Project_due_on: <b>${project.project_end_date}</b><br>
                Project_priority: <b>${project.project_priority}</b><br>
                Project_created_by: <b>${user.name}</b>`;
              sendMail(assigneeMail, subjects, sendMsgs);
            }
          }
        }

        if (sendTo.length > 0) {
          await Notification.create({
            title: "New Project Assigned",
            message: `
            You are assigned on a project "${project.project_name}" by ${user.name}\nStatus: ${project.project_status} Priority: ${project.project_priority}`,
            status: "UNREAD",
            send_by: user.id,
            send_to: sendTo,
          });
        }
        if (sendToAdmin.length > 0) {
          await Notification.create({
            title: "New Project created",
            message: `
            New project ${project.project_name} created by ${user.name}\nStatus: ${project.project_status} Priority: ${project.project_priority}`,
            status: "UNREAD",
            send_by: user.id,
            send_to: sendToAdmin,
          });
        }

        if (project) {
          return res
            .status(200)
            .send({ status: "200", message: "Project Created Successfully" });
        }
      })
      .catch((err) => {
        return res
          .status(500)
          .send({ status: "500", message: "Unable to Create Project" + err });
      });
  } catch (err) {
    res.status(500).send({
      status: 500,
      message: "Unable to Create Project" + err,
    });
  }
};

exports.getProjectMembers = (req, res) => {
  try {
    const user = req.user;
    const projectId = { _id: req.params.id };

    if (!projectId) {
      return res.status(400).send({
        status: "400",
        message: "Project Id is required",
      });
    }
    projectModel
      .findOne({
        _id: req.params.id,
        organisation: user.organisation.organisation,
      })
      .populate("project_leader project_assignee", "name pic email")
      .then(async (docs) => {
        if (docs.length == 0) {
          //get Task Details
          return res.status(400).send({
            status: "400",
            message: "No project found",
          });
        }
        let members = [];
        members.push(...docs.project_leader);
        members.push(...docs.project_assignee);

        return res
          .status(200)
          .send({ status: "200", message: "Project Member List", members });
      })
      .catch((err) => {
        return res.status(500).send({
          status: "500",
          message:
            "Failed to retrieve the Project Member List. Try again later",
        });
      });
  } catch (err) {
    return res.status(500).send({
      status: "500",
      message: "Failed to retrieve the Project Member List. Try again later",
    });
  }
};

exports.getProject = (req, res) => {
  try {
    const user = req.user;
    let query = {};
    if (
      user.organisation.role == "admin" ||
      user.organisation.role == "subadmin"
    )
      query = { organisation: user.organisation.organisation };
    else
      query = {
        $and: [
          {
            $or: [
              { project_assignee: user.id },
              { project_leader: user.id },
              { created_by: user.id },
            ],
          },
          { organisation: user.organisation.organisation },
        ],
      };

    projectModel
      .find(query)
      .populate("project_leader project_assignee", "name pic")
      .exec((err, docs) => {
        if (!err) {
          return res
            .status(200)
            .send({ status: "200", message: "Project List", docs });
        } else {
          return res.status(500).send({
            status: "500",
            message: "Failed to retrieve the Project List. Try again later",
            err,
          });
        }
      });
  } catch (err) {
    return res.status(500).send({
      status: "500",
      message: "Failed to retrieve data. Try again later",
    });
  }
};

exports.getProjectById = async (req, res) => {
  try {
    const user = req.user;
    const projectId = { _id: req.params.id };

    projectModel
      .findOne(projectId)
      .populate("project_leader project_assignee", "_id name pic")
      .then(async (docs) => {
        if (docs.length == 0) {
          //get Task Details
          return res.status(400).send({
            status: "400",
            message: "No project found",
          });
        }
        const projectDetails = {
          project: docs,
        };
        const tasks = await taskModel
          .find({ project_id: req.params.id })
          .populate("task_assignee", "_id name pic");
        projectDetails.taskList = tasks;

        return res
          .status(200)
          .send({ status: "200", message: "Project Details", projectDetails });
      })
      .catch((err) => {
        console.log("err", err);
        return res.status(500).send({
          status: "500",
          message: "Failed to retrieve the Project details. Try again later",
        });
      });
  } catch (err) {
    return res.status(500).send({
      status: "500",
      message: "Failed to retrieve data. Try again later",
    });
  }
};

exports.getTaskCountByProject = (req, res) => {
  try {
    const projectId = { project_id: req.params.id };
    taskModel.find(projectId, "task_status", (err, docs) => {
      if (!err) {
        let obj = {
          active: 0,
          in_progress: 0,
          qa: 0,
          completed: 0,
          backlogs: 0,
          confirmed: 0,
        };
        for (var i = 0; i < docs.length; i++) {
          switch (docs[i].task_status + "") {
            case "1":
              obj.active = obj.active + 1;
              break;
            case "2":
              obj.in_progress = obj.in_progress + 1;
              break;
            case "3":
              obj.qa = obj.qa + 1;
              break;
            case "4":
              obj.completed = obj.completed + 1;
              break;
            case "5":
              obj.backlogs = obj.backlogs + 1;
              break;
            case "5":
              obj.confirmed = obj.confirmed + 1;
              break;
          }
          // obj[docs[i].task_status] = obj[docs[i].task_status] + 1;
        }

        return res
          .status(200)
          .send({ status: "200", message: "Task Count", taskCount: obj });
      } else {
        return res.status(500).send({
          status: "500",
          message: "Failed to retrieve data. Try again later",
        });
      }
    });
  } catch (err) {
    return res.status(500).send({
      status: "500",
      message: "Failed to retrieve the Project List. Try again later",
    });
  }
};

exports.getTaskByStatus = (req, res) => {
  try {
    const projectId = req.query.project_id;
    const taskStatus = req.query.task_status;

    let blankFields = [];

    if (!projectId) {
      blankFields.push("project_id");
    }
    if (!taskStatus) {
      blankFields.push("task_status");
    }
    if (blankFields.length > 0) {
      return res.status(400).send({
        status: "400",
        message: `${blankFields} is required`,
      });
    }
    const condition = { project_id: projectId, task_status: taskStatus };

    taskModel.find(condition, (err, docs) => {
      if (!err) {
        return res
          .status(200)
          .send({ status: "200", message: "Task List", docs });
      } else {
        return res.status(500).send({
          status: "500",
          message: "Failed to retrieve data. Try again later",
        });
      }
    });
  } catch (err) {
    return res.status(500).send({
      status: "500",
      message: "Failed to retrieve data. Try again later",
    });
  }
};

exports.editProject = async (req, res) => {
  try {
    const user = req.user;

    const condition = {
      _id: req.params.id,
      organisation: user.organisation.organisation,
    };

    let filterFields = {
      _id: 0,
    };

    let fields = [];

    if (req.body.project_no) {
      fields.push(" project_no ");
    }
    if (req.body.created_by) {
      fields.push(" created_by ");
    }
    if (req.body.organisation) {
      fields.push(" organisation ");
    }

    if (fields.length > 0) {
      return res.status(400).send({
        status: "400",
        message: `[${fields}] can not be updated`,
      });
    }

    if (req.body.project_name && typeof req.body.project_name === "string") {
      filterFields.project_name = 1;
    }
    if (req.body.project_desc && typeof req.body.project_desc === "string") {
      filterFields.project_desc = 1;
    }
    if (
      req.body.project_assignee &&
      typeof req.body.project_assignee.length > 0
    ) {
      filterFields.project_assignee = 1;
    }
    if (req.body.project_leader && typeof req.body.project_leader.length > 0) {
      filterFields.project_leader = 1;
    }
    if (
      req.body.project_category &&
      typeof req.body.project_category === "string"
    ) {
      filterFields.project_category = 1;
    }
    if (
      req.body.project_client &&
      typeof req.body.project_client === "string"
    ) {
      filterFields.project_client = 1;
    }
    if (
      req.body.project_start_date &&
      typeof req.body.project_start_date === "number"
    ) {
      filterFields.project_start_date = 1;
    }
    if (
      req.body.project_end_date &&
      typeof req.body.project_end_date === "string"
    ) {
      filterFields.project_end_date = 1;
    }
    if (
      req.body.project_completion_date &&
      typeof req.body.project_completion_date === "string"
    ) {
      filterFields.project_completion_date = 1;
    }
    if (
      req.body.project_status &&
      typeof req.body.project_status === "string"
    ) {
      filterFields.project_status = 1;
    }
    if (
      req.body.project_priority &&
      typeof req.body.project_priority === "string"
    ) {
      filterFields.project_priority = 1;
    }
    if (req.body.project_attachments) {
      filterFields.project_attachments = 1;
    }

    const getProject = await projectModel.findOne(condition, filterFields);

    projectModel
      .findByIdAndUpdate(condition, req.body, { new: true })
      .then(async (docs) => {
        if (!docs) {
          return res
            .status(400)
            .send({ status: "400", message: "Failed to Update" });
        }

        let log = {
          date_time: new Date(),
          log_type: 2,
          log_heading: "Project Updated",
          log_message: `Project ${docs.project_name} is Updated by ${user.name}`,
          before_update: getProject,
          request: req.body,
          response: docs,
          log_for: {
            id: "" + docs._id,
            name: docs.project_name,
          },
          log_by: user.id,
          organisation_id: user.organisation.organisation,
        };

        await Log.create(log);

        let sendTo = [];
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

        if (docs.project_assignee) {
          if (docs.project_assignee.length > 0) {
            for (const eachProjectAssignee of docs.project_assignee) {
              const eachProjectAssigneeData = await User.findOne({
                _id: eachProjectAssignee,
              });

              if (
                eachProjectAssigneeData &&
                eachProjectAssigneeData.notification_subscription
              ) {
                sendTo.push(eachProjectAssignee);
                const message = {
                  notification: {
                    title: "Project Updated",
                    body: `Project ${docs.project_name} is Updated by ${user.name}. Check it now.`,
                  },
                  token: eachProjectAssigneeData.notification_subscription,
                };
                await sendPushNotification(message);
              }

              const assigneeMail = eachProjectAssigneeData.email;
              const subjects = "Project Updated";
              const sendMsgs = `
                Project_Name: <b>${docs.project_name}</b><br>
                Project_due_on: <b>${docs.project_end_date}</b><br>
                Project_priority: <b>${docs.project_priority}</b><br>
                Project_created_by: <b>${user.name}</b>`;
              sendMail(assigneeMail, subjects, sendMsgs);
            }
          }
        }

        if (docs.project_leader) {
          if (docs.project_leader.length > 0) {
            for (const eachProjectLeader of docs.project_leader) {
              const eachProjectLeaderData = await User.findOne({
                _id: eachProjectLeader,
              });

              if (eachProjectLeader + "" !== "" + user.id) {
                if (
                  eachProjectLeaderData &&
                  eachProjectLeaderData.notification_subscription
                ) {
                  sendTo.push(eachProjectLeader);
                  const message = {
                    notification: {
                      title: "Project Updated",
                      body: `Project ${docs.project_name} is Updated by ${user.name}. Check it now.`,
                    },
                    token: eachProjectLeaderData.notification_subscription,
                  };

                  await sendPushNotification(message);
                }
              }

              const assigneeMail = eachProjectLeaderData.email;
              const subjects = "Project Updated";
              const sendMsgs = `
                Project_Name: <b>${docs.project_name}</b><br>
                Project_due_on: <b>${docs.project_end_date}</b><br>
                Project_priority: <b>${docs.project_priority}</b><br>
                Project_created_by: <b>${user.name}</b><br>
                Role:<b>${user.organisation.role}</b>
                `;
              sendMail(assigneeMail, subjects, sendMsgs);
            }
          }
        }

        if (docs.project_client) {
          const eachProjectClientData = await User.findOne({
            _id: docs.project_client,
          });

          if (
            eachProjectClientData &&
            eachProjectClientData.notification_subscription
          ) {
            sendTo.push(docs.project_client);
            const message = {
              notification: {
                title: "Project Updated",
                body: `Project ${docs.project_name} is Updated by ${user.name}. Check it now.`,
              },
              token: eachProjectClientData.notification_subscription,
            };

            await sendPushNotification(message);
          }

          const assigneeMail = eachProjectClientData.email;
          const subjects = "Project Updated";
          const sendMsgs = `
            Project_Name: <b>${docs.project_name}</b><br>
            Project_due_on: <b>${docs.project_end_date}</b><br>
            Project_priority: <b>${docs.project_priority}</b><br>
            Project_created_by: <b>${user.name}</b><br>
            Role:<b>${user.organisation.role}</b>`;
          sendMail(assigneeMail, subjects, sendMsgs);
        }

        if (totalUserList) {
          for (let singleUser of totalUserList) {
            if (singleUser._id + "" != "" + user.id) {
              if (singleUser.notification_subscription) {
                sendTo.push(singleUser._id);
                const message = {
                  notification: {
                    title: "Project Updated",
                    body: `Project ${docs.project_name} is Updated by ${user.name}. Check it now.`,
                  },
                  token: singleUser.notification_subscription,
                };

                await sendPushNotification(message);
              }

              const assigneeMail = singleUser.email;
              const subjects = "Project Updated";
              const sendMsgs = `
                Project_Name: <b>${docs.project_name}</b><br>
                Project_due_on: <b>${docs.project_end_date}</b><br>
                Project_priority: <b>${docs.project_priority}</b><br>
                Project_created_by: <b>${user.name}</b>`;
              sendMail(assigneeMail, subjects, sendMsgs);
            }
          }
        }

        if (sendTo.length > 0) {
          await Notification.create({
            title: "Project Updated",
            message: `Project ${docs.project_name} is Updated by ${user.name}. Check it now.`,
            status: "UNREAD",
            send_by: user.id,
            send_to: sendTo,
          });
        }

        return res.status(200).send({
          status: "200",
          message: "Succesffully Updated Project",
          docs,
        });
      })
      .catch((err) => {
        return res.status(500).send({
          status: 500,
          message: "Unable to edit project. Try again later",
        });
      });
  } catch (err) {
    return res.status(500).send({
      status: "500",
      message: "Failed to edit project. Try again later",
    });
  }
};

exports.changeProjectStatus = async (req, res) => {
  try {
    const user = req.user;

    const condition = {
      _id: req.params.id,
      organisation: user.organisation.organisation,
    };
    const status = req.body.status;

    if (!status || typeof status !== "number") {
      return res.status(400).send({
        status: 400,
        message: "Status Must Be a Valid Integer",
      });
    }

    const getProject = await projectModel.findOne(condition, {
      _id: 0,
      project_status: 1,
    });

    let update = {};
    switch (status) {
      case 1:
        update = { project_status: "ACTIVE" };
        break;
      case 2:
        update = { project_status: "HOLD" };
        break;
      case 3:
        update = { project_status: "COMPLETED" };
        break;
      case 4:
        update = { project_status: "INACTIVE" };
        break;
      default:
        return res.status(400).send({
          status: 400,
          message: "Invalid Status",
        });
    }

    projectModel
      .findByIdAndUpdate(condition, update, { new: true })
      .then(async (docs) => {
        if (!docs) {
          return res
            .status(400)
            .send({ status: "400", message: "Failed to Update" });
        }

        let log = {
          date_time: new Date(),
          log_type: 2,
          log_heading: "Project Status Changed",
          log_message: `Project ${docs.project_name}'s status changes from ${getProject.project_status} to ${docs.project_status} by ${user.name}`,
          before_update: getProject.project_status,
          request: update.project_status,
          response: docs,
          log_for: {
            id: "" + docs._id,
            name: docs.project_name,
          },
          log_by: user.id,
          organisation_id: user.organisation.organisation,
        };

        await Log.create(log);

        let sendTo = [];
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

        if (docs.project_assignee) {
          if (docs.project_assignee.length > 0) {
            for (const eachProjectAssignee of docs.project_assignee) {
              const eachProjectAssigneeData = await User.findOne({
                _id: eachProjectAssignee,
              });
              if (
                eachProjectAssigneeData &&
                eachProjectAssigneeData.notification_subscription
              ) {
                sendTo.push(eachProjectAssignee);
                const message = {
                  notification: {
                    title: "Project Status Changed",
                    body: `Project ${docs.project_name} status changes from ${getProject.project_status} to ${docs.project_status} by ${user.name}`,
                  },
                  token: eachProjectAssigneeData.notification_subscription,
                };
                await sendPushNotification(message);
              }

              const assigneeMail = eachProjectAssigneeData.email;
              const subjects = "Project Status Changed";
              const sendMsgs = `Project ${docs.project_name} status changes from ${getProject.project_status} to ${docs.project_status} by ${user.name}`;
              sendMail(assigneeMail, subjects, sendMsgs);
            }
          }
        }

        if (docs.project_leader) {
          if (docs.project_leader.length > 0) {
            for (const eachProjectLeader of docs.project_leader) {
              const eachProjectLeaderData = await User.findOne({
                _id: eachProjectLeader,
              });

              if (eachProjectLeader + "" !== "" + user.id) {
                if (
                  eachProjectLeaderData &&
                  eachProjectLeaderData.notification_subscription
                ) {
                  sendTo.push(eachProjectLeader);
                  const message = {
                    notification: {
                      title: "Project Status Changed",
                      body: `Project ${docs.project_name} status changes from ${getProject.project_status} to ${docs.project_status} by ${user.name}`,
                    },
                    token: eachProjectLeaderData.notification_subscription,
                  };

                  await sendPushNotification(message);
                }
              }

              const assigneeMail = eachProjectLeaderData.email;
              const subjects = "Project Status Changed";
              const sendMsgs = `Project ${docs.project_name} status changes from ${getProject.project_status} to ${docs.project_status} by ${user.name}`;
              sendMail(assigneeMail, subjects, sendMsgs);
            }
          }
        }

        if (docs.project_client) {
          const eachProjectClientData = await User.findOne({
            _id: docs.project_client,
          });

          if (
            eachProjectClientData &&
            eachProjectClientData.notification_subscription
          ) {
            sendTo.push(docs.project_client);
            const message = {
              notification: {
                title: "Project Status Changed",
                body: `Project ${docs.project_name} status changes from ${getProject.project_status} to ${docs.project_status} by ${user.name}`,
              },
              token: eachProjectClientData.notification_subscription,
            };

            await sendPushNotification(message);
          }

          const assigneeMail = eachProjectClientData.email;
          const subjects = "Project Status Changed";
          const sendMsgs = `Project ${docs.project_name} status changes from ${getProject.project_status} to ${docs.project_status} by ${user.name}`;

          sendMail(assigneeMail, subjects, sendMsgs);
        }

        if (totalUserList) {
          for (let singleUser of totalUserList) {
            if (singleUser._id + "" != "" + user.id) {
              if (singleUser.notification_subscription) {
                sendTo.push(singleUser._id);
                const message = {
                  notification: {
                    title: "Project Status Changed",
                    body: `Project ${docs.project_name} status changes from ${getProject.project_status} to ${docs.project_status} by ${user.name}`,
                  },
                  token: singleUser.notification_subscription,
                };

                await sendPushNotification(message);
              }

              const assigneeMail = singleUser.email;
              const subjects = "Project Status Changed";
              const sendMsgs = `Project ${docs.project_name} status changes from ${getProject.project_status} to ${docs.project_status} by ${user.name}`;
              sendMail(assigneeMail, subjects, sendMsgs);
            }
          }
        }

        if (sendTo.length > 0) {
          await Notification.create({
            title: "Project Status Changed",
            message: `Project ${docs.project_name} status changes from ${getProject.project_status} to ${docs.project_status} by ${user.name}`,
            status: "UNREAD",
            send_by: user.id,
            send_to: sendTo,
          });
        }

        return res.status(200).send({
          status: "200",
          message: "Project Status changed Succesffully ",
        });
      })
      .catch((err) => {
        return res.status(500).send({
          status: 500,
          message: "Unable to change status. Try again later" + err,
        });
      });
  } catch (err) {
    return res.status(500).send({
      status: "500",
      message: "Failed to change status. Try again later" + err,
    });
  }
};

exports.assignProject = async (req, res) => {
  try {
    const user = req.user;
    const project_assignee = req.body.project_assignee;
    const remove_assignee = req.body.remove_assignee;

    if (
      user.organisation.role != "admin" &&
      user.organisation.role != "team_leader" &&
      user.organisation.role != "subadmin"
    ) {
      return res.status(401).send({
        status: 401,
        message: "Only admin and project leader can access this",
      });
    }
    const project = await projectModel.findById(req.params.id);

    if (project.organisation != user.organisation.organisation) {
      return res.status(400).send({
        status: 400,
        message: "Enter project of yours organisation",
      });
    }

    let data = {
      removedUserCount: 0,
      addedUserCount: 0,
    };

    if (remove_assignee && remove_assignee.length > 0) {
      const updateProject = await projectModel.updateMany(
        { _id: req.params.id },
        { $pull: { project_assignee: { $in: remove_assignee } } }
      );
      if (updateProject) {
        data.removedUserCount = remove_assignee.length;

        for (const eachProjectAssignee of remove_assignee) {
          const eachProjectAssigneeData = await User.findOne({
            _id: eachProjectAssignee,
          });

          if (
            eachProjectAssigneeData &&
            eachProjectAssigneeData.notification_subscription
          ) {
            const message = {
              notification: {
                title: "Removed From Project",
                body: `
                You are removed from project "${project.project_name}" by ${user.name}`,
              },
              token: eachProjectAssigneeData.notification_subscription,
            };

            await sendPushNotification(message);
          }

          const assigneeMail = eachProjectAssigneeData.email;
          const subjects = "Removed From Project";
          const sendMsgs = `You are removed from project "${project.project_name}" by ${user.name}`;
          sendMail(assigneeMail, subjects, sendMsgs);
        }
      } else {
        return res.status(500).send({
          status: 500,
          message: "Unable to remove member. Try again later",
        });
      }
    }

    if (project_assignee && project_assignee.length > 0) {
      const updateProject = await projectModel.updateMany(
        { _id: req.params.id },
        { $addToSet: { project_assignee: project_assignee } }
      );

      if (updateProject) {
        data.addedUserCount = project_assignee.length;

        for (const eachProjectAssignee of project_assignee) {
          const eachProjectAssigneeData = await User.findOne({
            _id: eachProjectAssignee,
          });

          if (
            eachProjectAssigneeData &&
            eachProjectAssigneeData.notification_subscription
          ) {
            const message = {
              notification: {
                title: "New Project Assigned",
                body: `
                You are assigned on project "${project.project_name}" by ${user.name}`,
              },
              token: eachProjectAssigneeData.notification_subscription,
            };

            await sendPushNotification(message);
          }

          const assigneeMail = eachProjectAssigneeData.email;
          const subjects = "You are assign on a project";
          const sendMsgs = `
                Project_Name: <b>${project.project_name}</b><br>
                Project_due_on: <b>${project.project_end_date}</b><br>
                Project_priority: <b>${project.project_priority}</b><br>
                Project_created_by: <b>${user.name}</b>`;
          sendMail(assigneeMail, subjects, sendMsgs);
        }

        //!NOTIFICATION FOR TASK CREATION

        // req.io
        //   .to(`project:${req.body.project_id}`)
        //   .emit("message", "New assignee added");

        // await notification.create({
        //   title: "New Assignee Added",
        //   message: "New Assignee Added",
        //   status: "UNREAD",
        //   users: project_assignee,
        // });

        //!NOTIFICATION FOR TASK CREATION END
      } else {
        return res.status(500).send({
          status: 500,
          message: "Unable to assign member. Try again later",
        });
      }
    }

    if (
      (!project_assignee || project_assignee.length === 0) &&
      (!remove_assignee || remove_assignee.length === 0)
    ) {
      return res.status(400).send({
        status: 400,
        message: "Please select atleast one user",
      });
    }

    const updatedProject = await projectModel.findOne(
      { _id: req.params.id },
      { project_assignee: 1, _id: 1, project_name: 1 }
    );

    let log = {
      date_time: new Date(),
      log_type: 2,
      log_heading: "Project Assignee Updated",
      log_message: `Update Project ${docs.project_name}'s Assignee by ${user.name}`,
      before_update: project.project_assignee,
      request: req.body,
      response: updatedProject.project_assignee,
      log_for: {
        id: "" + docs._id,
        name: docs.project_name,
      },
      log_by: user.id,
      organisation_id: user.organisation.organisation,
    };

    await Log.create(log);

    return res.status(200).send({
      status: "200",
      message: "Succesffully Updated Project",
      data,
    });
  } catch (err) {
    return res.status(500).send({
      status: "500",
      message: "Failed to update project. Try again later" + err,
    });
  }
};

exports.assignTeamLeader = async (req, res) => {
  try {
    const user = req.user;
    const project_leader = req.body.project_leader;
    const remove_leader = req.body.remove_leader;

    const project = await projectModel.findById(req.params.id);
    if (project.organisation != user.organisation.organisation) {
      return res.status(401).send({
        status: 401,
        message: "Enter project of yours organisation",
      });
    }

    let data = {
      removedLeaderCount: 0,
      addedLeaderCount: 0,
    };
    if (remove_leader && remove_leader.length > 0) {
      const updateProject = await projectModel.updateMany(
        { _id: req.params.id },
        { $pull: { project_leader: { $in: remove_leader } } }
      );
      if (updateProject) {
        data.removedLeaderCount = remove_leader.length;

        for (const eachProjectLeader of remove_leader) {
          const eachProjectLeaderData = await User.findOne({
            _id: eachProjectLeader,
          });

          if (
            eachProjectLeaderData &&
            eachProjectLeaderData.notification_subscription
          ) {
            const message = {
              notification: {
                title: "Removed From Project",
                body: `
                You are removed from project "${project.project_name}" by ${user.name}`,
              },
              token: eachProjectLeaderData.notification_subscription,
            };

            await sendPushNotification(message);
          }

          const assigneeMail = eachProjectLeaderData.email;
          const subjects = "Removed From Project";
          const sendMsgs = `You are removed from project "${project.project_name}" by ${user.name}`;
          sendMail(assigneeMail, subjects, sendMsgs);
        }
      } else {
        return res.status(500).send({
          status: 500,
          message: "Unable to remove team leader. Try again later",
        });
      }
    }
    if (project_leader && project_leader.length > 0) {
      const updateProject = await projectModel.updateMany(
        { _id: req.params.id },
        { $addToSet: { project_leader: project_leader } }
      );

      if (updateProject) {
        data.addedLeaderCount = project_leader.length;

        for (const eachProjectLeader of project_leader) {
          const eachProjectLeaderData = await User.findOne({
            _id: eachProjectLeader,
          });

          if (
            eachProjectLeaderData &&
            eachProjectLeaderData.notification_subscription
          ) {
            const message = {
              notification: {
                title: "New Project Assigned",
                body: `
                You are assigned on project "${project.project_name}" by ${user.name}`,
              },
              token: eachProjectLeaderData.notification_subscription,
            };

            await sendPushNotification(message);
          }

          const assigneeMail = eachProjectLeaderData.email;
          const subjects = "You are assign on a project";
          const sendMsgs = `
                Project_Name: <b>${project.project_name}</b><br>
                Project_due_on: <b>${project.project_end_date}</b><br>
                Project_priority: <b>${project.project_priority}</b><br>
                Project_created_by: <b>${user.name}</b>`;
          sendMail(assigneeMail, subjects, sendMsgs);
        }
      } else {
        return res.status(500).send({
          status: 500,
          message: "Unable to assign team leader. Try again later",
        });
      }
    }
    if (
      (!project_leader || project_leader.length === 0) &&
      (!remove_leader || remove_leader.length === 0)
    ) {
      return res.status(400).send({
        status: 400,
        message: "Please select atleast one user",
      });
    }

    const updatedProject = await projectModel.findOne(
      { _id: req.params.id },
      { project_leader: 1, _id: 1, project_name: 1 }
    );

    let log = {
      date_time: new Date(),
      log_type: 2,
      log_heading: "Project Leader Updated",
      log_message: `Update Project ${docs.project_name}'s Leader by ${user.name}`,
      before_update: project.project_leader,
      request: req.body,
      response: updatedProject.project_leader,
      log_for: {
        id: "" + docs._id,
        name: docs.project_name,
      },
      log_by: user.id,
      organisation_id: user.organisation.organisation,
    };

    await Log.create(log);

    return res.status(200).send({
      status: "200",
      message: "Succesffully Updated Project",
      data,
    });
  } catch (err) {
    return res.status(500).send({
      status: "500",
      message: "Failed to update project. Try again later" + err,
    });
  }
};

exports.addProjectAttachment = async (req, res) => {
  try {
    const user = req.user;
    const projectId = req.params.id;
    const project = await projectModel.findById(projectId);

    if (
      !project ||
      project.organisation.toString() !==
        user.organisation.organisation.toString()
    ) {
      return res.status(401).json({
        status: 401,
        message: "Enter project of your organisation",
      });
    }

    // Check if a file was uploaded
    if (!req.files || !req.files.file) {
      return res.status(400).json({
        status: 400,
        message: "No file uploaded.",
      });
    }

    // Handle the file upload
    const uploadedFile = req.files.file;
    const dir = `${__dirname}/../public/attachments/${projectId}`;
    const filePath = `${dir}/${uploadedFile.name}`;

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    uploadedFile.mv(filePath, (err) => {
      if (err) {
        return res.status(500).json({
          status: 500,
          message: "Failed to upload file.",
        });
      }

      // Use the filePath to create the URL for the attachment
      const url = `/attachments/${projectId}/${uploadedFile.name}`;

      // Get the title from the request body or use the original filename as the title
      const title = req.body.title || uploadedFile.name;

      // Update the project with the attachment details
      projectModel
        .findByIdAndUpdate(
          { _id: projectId },
          { $addToSet: { project_attachments: { title, url } } },
          { new: true }
        )
        .then(async (docs) => {
          if (!docs) {
            return res.status(400).json({
              status: 400,
              message: "Failed to Update",
            });
          }

          let log = {
            date_time: new Date(),
            log_type: 2,
            log_heading: "New Attachment Added",
            log_message: `New Attachment added on Project ${docs.project_name} by ${user.name}`,
            request: uploadedFile,
            response: { fileUrl: url },
            log_for: {
              id: "" + docs._id,
              name: docs.project_name,
            },
            log_by: user.id,
            organisation_id: user.organisation.organisation,
          };

          await Log.create(log);

          return res.status(200).json({
            status: 200,
            message: "Successfully Updated Project",
            docs,
          });
        })
        .catch((error) => {
          return res.status(500).json({
            status: 500,
            message: "Failed to update project.",
          });
        });
    });
  } catch (error) {
    return res.status(500).json({
      status: 500,
      message: "Failed to find project.",
    });
  }
};

exports.deleteProjectAttachment = async (req, res) => {
  try {
    const user = req.user;
    const project = await projectModel.findById(req.params.id);
    if (project.organisation + "" != user.organisation.organisation + "") {
      return res.status(400).send({
        status: 400,
        message: "Enter project of your organisation",
      });
    }
    const attachment = project.project_attachments.find(
      (attachment) => attachment._id == req.body.attachment_id
    );

    if (!attachment) {
      return res.status(404).send({
        status: 404,
        message: "No attachment found",
      });
    }
    const path = `${__dirname}/../public${attachment.url}`;
    fs.unlink(path, (err) => {
      if (err) {
        return res.status(500).send({
          status: 500,
          message: "Unable to delete attachment",
        });
      }
      projectModel
        .findByIdAndUpdate(
          { _id: req.params.id },
          { $pull: { project_attachments: { _id: req.body.attachment_id } } },
          { new: true }
        )
        .then(async (docs) => {
          if (!docs) {
            return res
              .status(400)
              .send({ status: "400", message: "Failed to Update" });
          }

          let log = {
            date_time: new Date(),
            log_type: 2,
            log_heading: "One Attachment Deleted",
            log_message: `One Attachment deleted from Project ${docs.project_name} by ${user.name}`,
            request: req.body,
            response: { message: "Requested attachment deleted" },
            log_for: {
              id: "" + docs._id,
              name: docs.project_name,
            },
            log_by: user.id,
            organisation_id: user.organisation.organisation,
          };

          await Log.create(log);

          return res.status(200).send({
            status: "200",
            message: "Succesffully Updated Project",
            docs,
          });
        });
    });
  } catch (err) {
    return res.status(500).send({
      status: "500",
      message: "Failed to delete project attachment. Try again later",
    });
  }
};

exports.projectEfficiency = async (req, res) => {
  try {
    taskModel.find(
      { project_id: req.params.id },
      "task_status",
      (err, docs) => {
        if (!err) {
          let obj = {
            active: 0,
            in_progress: 0,
            qa: 0,
            completed: 0,
            backlogs: 0,
            confirmed: 0,
          };
          for (var i = 0; i < docs.length; i++) {
            switch (docs[i].task_status + "") {
              case "1":
                obj.active = obj.active + 1;
                break;
              case "2":
                obj.in_progress = obj.in_progress + 1;
                break;
              case "3":
                obj.qa = obj.qa + 1;
                break;
              case "4":
                obj.completed = obj.completed + 1;
                break;
              case "5":
                obj.backlogs = obj.backlogs + 1;
                break;
              case "6":
                obj.confirmed = obj.confirmed + 1;
                break;
            }
          }
          let totalTask = obj.active + obj.in_progress + obj.qa + obj.completed;
          let efficiency = Math.round((obj.completed / totalTask) * 100);

          return res.status(200).send({
            status: "200",
            message: "Project Efficiency",
            projectEfficiency: efficiency,
          });
        } else {
          return res.status(500).send({
            status: "500",
            message: "Failed to calculate efficiency. Try again later",
          });
        }
      }
    );
  } catch (err) {
    return res.status(500).send({
      status: "500",
      message: "Failed to calculate efficiency. Try again later",
    });
  }
};

exports.totalProjectEfficiency = async (req, res) => {
  try {
    const user = req.user;

    const getProjectList = projectModel.find({
      organisation: user.organisation.organisation,
    });
    if (getProjectList.length > 0) {
      let obj = {
        active: 0,
        completed: 0,
        hold: 0,
        inactive: 0,
      };
      for (var i = 0; i < getProjectList.length; i++) {
        switch (getProjectList[i].project_status) {
          case "ACTIVE":
            obj.active = obj.active + 1;
            break;
          case "HOLD":
            obj.hold = obj.hold + 1;
            break;
          case "COMPLETED":
            obj.completed = obj.completed + 1;
            break;
          case "INACTIVE":
            obj.inactive = obj.inactive + 1;
            break;
        }
      }

      let totalProject = obj.active + obj.hold + obj.completed;
      let efficiency = Math.round((obj.completed / totalProject) * 100);

      return res.status(200).send({
        status: "200",
        message: "Total Project Efficiency",
        projectEfficiency: efficiency,
      });
    } else {
      return res.status(500).send({
        status: "500",
        message: "Failed to calculate efficiency. Try again later",
      });
    }
  } catch (err) {
    return res.status(500).send({
      status: "500",
      message: "Failed to calculate efficiency. Try again later",
    });
  }
};
