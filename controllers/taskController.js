const TaskModel = require("../models/task");
const Log = require("../models/log");
const ProjectModel = require("../models/project");
const Notification = require("../models/notification");
const jwt = require("jsonwebtoken");
const config = require("../config/config");
const project = require("../models/project");
const { validationResult } = require("express-validator");
const User = require("../models/user");
const notification = require("../models/notification");
const { sendMail } = require("../services/sendEmail");
const task = require("../models/task");
const { sendPushNotification } = require("../services/configPushNotification");

//create task
exports.createTask = async (req, res) => {
  try {
    let payload = req.body;
    let user = req.user;

    // create task_no
    const d = new Date();
    const month = d.getMonth() + 1;
    const year = d.getFullYear();
    TaskModel.countDocuments(
      {
        createdAt: {
          $gte: new Date(year, month - 1, 1), // Start of the month
          $lt: new Date(year, month, 1), // Start of next month
        },
      },
      (err, result) => {
        if (err) {
          return res.status(500).send({
            status: "500",
            message: "Unable to create task.",
          });
        } else {
          const taskNo = result + 1;
          const reference_id =
            "TASK" +
            (d.getYear() - 100) +
            ("0" + month).slice(-2) +
            "" +
            String(taskNo).padStart(5, "0");

          payload.task_no = reference_id;
          payload.organisation = user.organisation.organisation;
          payload.created_by = user.id;
          TaskModel.create(payload)
            .then(async (task) => {
              if (task) {
                const projectDetails = await ProjectModel.findOne({
                  _id: task.project_id,
                });

                const logs = {};
                logs.date_time = new Date();
                logs.collection_name = "tasks";
                logs.document_data = {
                  id: task._id,
                  name: task.task_name,
                };
                logs.message = "New Task Created";
                logs.after_change = task;
                logs.log_by = {
                  id: user.id,
                  name: user.name,
                };
                logs.organisation_id = user.organisation.organisation;
                await Log.create(logs);

                if (task.task_assignee) {
                  if (task.task_assignee.length > 0) {
                    Notification.create({
                      title: "New Task assigned",
                      message: `
                          Task_Name: <b>${task.task_name}</b><br>
                          Task_due_on: <b>${task.task_due_on}</b><br>
                          Task_priority: <b>${task.task_priority}</b><br>
                          Task_created_by:<b>${user.name}</b>`,
                      status: "UNREAD",
                      send_by: user.id,
                      send_to: task.task_assignee,
                    });

                    for (const eachTaskAssignee of task.task_assignee) {
                      const eachTaskAssigneeData = await User.findOne({
                        _id: eachTaskAssignee,
                      });
                      if (
                        !eachTaskAssigneeData ||
                        eachTaskAssigneeData === null
                      ) {
                        return res.status(400).send({
                          status: "400",
                          message: "User does not exists",
                        });
                      }

                      // req.io
                      //   .to(eachTaskAssigneeData._id)
                      //   .emit("task_assigned", "Success");

                      if (eachTaskAssigneeData.notification_subscription) {
                        let notifyMsg = {
                          title: "New task assigned",
                          body: `
                            You are assigned on task "${task.task_name}" of ${projectDetails.project_name} project`,
                        };

                        await sendPushNotification(
                          eachTaskAssigneeData.notification_subscription,
                          notifyMsg
                        );
                      }

                      const assigneeMail = eachTaskAssigneeData.email;
                      const subjects = "Task Created";
                      const sendMsgs = `
                        Task_Name: <b>${task.task_name}</b><br>
                        Task_due_on: <b>${task.task_due_on}</b><br>
                        Task_priority: <b>${task.task_priority}</b><br>
                        Task_created_by:<b>${user.name}</b>`;
                      sendMail(assigneeMail, subjects, sendMsgs);
                    }
                  }
                }

                // const tasks=TaskM

                //!NOTIFICATION FOR TASK CREATION

                // req.io
                //   .to(`project:${req.body.project_id}`)
                //   .emit("message", "New task created");

                // const getProjectMembers = await ProjectModel.findOne({
                //   _id: payload.project_id,
                //   organisation: user.organisation,
                // })
                //   .populate("project_leader project_assignee", "name pic")
                //   .lean();

                // let members = [];
                // members.push(...getProjectMembers.project_leader);
                // members.push(...getProjectMembers.project_assignee);

                // await notification.create({
                //   title: "New Task Created",
                //   message: "New Task assigned",
                //   status: "UNREAD",
                //   users: members,
                // });

                //!NOTIFICATION FOR TASK CREATION END

                return res.status(201).send({
                  status: "201",
                  message: "Successfully added Task",
                });
              }
            })
            .catch((err) => {
              console.log("err", err);
              return res.status(500).send({
                status: "500",
                message: "Unable to create task. Try again later",
              });
            });
        }
      }
    );
  } catch (err) {
    return res.status(500).send({
      status: "500",
      message: "Unable to create task. Try again later",
    });
  }
};

//task list
exports.getTask = async (req, res) => {
  try {
    const user = req.user;
    let query = {
      $and: [
        {
          $or: [{ task_assignee: user.id }, { created_by: user.id }],
        },
        { organisation: user.organisation.organisation },
      ],
    };
    if (
      user.organisation.role == "admin" ||
      user.organisation.role == "subadmin"
    )
      query = { organisation: user.organisation.organisation };

    if (user.organisation.role == "team_leader") {
      const project = await ProjectModel.find({ project_leader: user.id });

      const project_id = project.map((item) => item._id);

      query = {
        project_id: { $in: project_id },
        organisation: user.organisation,
      };
    }

    TaskModel.find(query)
      .populate("project_id task_assignee", "project_name name pic")
      .exec((err, docs) => {
        if (!err) {
          return res
            .status(200)
            .send({ status: "200", message: "Task List", docs });
        } else {
          return res.status(500).send({
            status: "500",
            message: "Failed to retrieve the task List. Try again later",
          });
        }
      });
  } catch (err) {
    return res.status(500).send({
      status: "500",
      message: "Failed to retrieve the task List. Try again later",
    });
  }
};

exports.getTaskByProject = (req, res) => {
  try {
    const projectId = { project_id: req.params.id };
    if (!projectId) {
      return res.status(500).send({
        status: "500",
        message: "Failed to retrieve the task List. Try again later",
      });
    }
    TaskModel.find(projectId)
      .populate("project_id task_assignee ", "project_name name pic")
      .exec((err, docs) => {
        if (!err) {
          return res
            .status(200)
            .send({ status: "200", message: "Task List", docs });
        } else {
          return res.status(500).send({
            status: "500",
            message:
              "Failed to retrieve the task List of a project. Try again later",
          });
        }
      });
  } catch (err) {
    return res.status(500).send({
      status: "500",
      message: "Failed to retrieve the task List of a project. Try again later",
    });
  }
};

// Get all task list by task status
exports.getTaskArray = async (req, res) => {
  try {
    const user = req.user;
    const id = req.params.id;
    const startDate = new Date(req.body.fromdate);
    const endDate = new Date(req.body.todate);
    endDate.setDate(endDate.getDate() + 1);

    let query = {
      $and: [
        {
          $or: [{ task_assignee: user.id }, { created_by: user.id }],
        },
        { organisation: user.organisation.organisation },
        // { project_id: id ? id : {} },
      ],
    };
    if (
      user.organisation.role == "admin" ||
      user.organisation.role == "subadmin"
    ) {
      query = {
        organisation: user.organisation.organisation,
        // project_id: id ? id : {},
      };
    }

    if (user.organisation.role == "team_leader") {
      const project = await ProjectModel.find({ project_leader: user.id });

      const project_id = project.map((item) => item._id);

      query = {
        project_id: { $in: project_id },
        organisation: user.organisation.organisation,
      };
    }

    TaskModel.find({
      $and: [
        query,
        { createdAt: { $gte: startDate } },
        { createdAt: { $lte: endDate } },
      ],
    })
      .populate(
        "project_id project_assignee task_assignee",
        "project_name name pic"
      )
      .exec((err, docs) => {
        let taskArr = [
          {
            title: "Active",
            count: 0,
            array: [],
          },
          {
            title: "InProcess",
            count: 0,
            array: [],
          },
          {
            title: "Testing",
            count: 0,
            array: [],
          },
          {
            title: "COMPLETED",
            count: 0,
            array: [],
          },
          {
            title: "Backlogs",
            count: 0,
            array: [],
          },
          {
            title: "Confirmed",
            count: 0,
            array: [],
          },
        ];
        if (docs && docs.length > 0)
          docs.forEach((element) => {
            switch (element.task_status + "") {
              case "1":
                taskArr[0].count += 1;
                taskArr[0].array.push(element);
                break;
              case "2":
                taskArr[1].count += 1;
                taskArr[1].array.push(element);
                break;
              case "3":
                taskArr[2].count += 1;
                taskArr[2].array.push(element);
                break;
              case "4":
                taskArr[3].count += 1;
                taskArr[3].array.push(element);
                break;
              case "5":
                taskArr[4].count += 1;
                taskArr[4].array.push(element);
                break;
              case "6":
                taskArr[5].count += 1;
                taskArr[5].array.push(element);
                break;
            }
          });

        if (!err) {
          return res
            .status(200)
            .send({ status: "200", message: "Tasks in Array", taskArr });
        } else {
          return res.status(500).send({
            status: "500",
            message: "Failed to retrieve the task List. Try again later",
          });
        }
      });
  } catch (err) {
    return res.status(500).send({
      status: "500",
      message: "Failed to retrieve the task List. Try again later",
    });
  }
};

exports.deleteTask = async (req, res) => {
  try {
    const user = req.user;
    const task_id = { _id: req.params.id, organisation: user.organisation };
    const task = await TaskModel.findOne(task_id, "project_id");
    if (!task) {
      return res.status(500).send({
        status: "500",
        message: "Failed to retrieve the task List. Try again later",
      });
    }
    const docs1 = await User.find({
      role: "admin",
      organisation: user.organisation,
    });
    const docs = await ProjectModel.findOne({
      _id: task.project_id,
      organisation: user.organisation,
    }).populate("project_leader project_assignee", "name pic");
    let members = [];
    if (!docs)
      return res.status(500).send({
        status: "500",
        message: "Failed to retrieve the task List. Try again later",
      });

    // console.log(docs1);
    members.push(...docs.project_leader);

    members.push(...docs.project_assignee);
    members.push(...docs1);

    let isUserOfSameProj = members.find((item) => {
      // console.log(item._id, user._id);
      return item._id + "" == user._id + "";
    });
    // console.log(members, isUserOfSameProj);
    if (!isUserOfSameProj) {
      return res.status(500).send({
        status: "500",
        message: "You are not allowed to delete this task",
      });
    }
    await task.remove();
    return res
      .status(200)
      .send({ status: "200", message: "Task Deleted Successfully" });
  } catch (err) {
    return res.status(500).send({
      status: "500",
      message: "Failed to delete task. Try again later",
    });
  }
};

exports.getTaskByUser = (req, res) => {
  try {
    const user = req.user;
    TaskModel.find({ task_assignee: { $in: [user.id] } })
      .populate(
        "project_id project_assignee task_assignee ",
        "project_name name pic"
      )
      .exec((err, docs) => {
        if (!err) {
          return res
            .status(200)
            .send({ status: "200", message: "Task List By User", docs });
        } else {
          return res.status(500).send({
            status: "500",
            message:
              "Failed to retrieve the task List of a user. Try again later",
          });
        }
      });
  } catch (err) {
    return res.status(500).send({
      status: "500",
      message: "Failed to retrieve the task List of a user. Try again later",
    });
  }
};

exports.getTaskById = (req, res) => {
  try {
    const task_id = { _id: req.params.id };
    TaskModel.findOne(task_id)
      .populate(
        "project_id comments.user created_by project_id.created_by task_assignee project_assignee",
        "project_name project_desc project_status project_priority project_assignee project_leader project_start_date project_end_date name pic created_by"
      )
      .exec((err, docs) => {
        if (!err) {
          return res.status(200).send({ status: "200", message: "Task", docs });
        } else {
          return res.status(500).send({
            status: "500",
            message: "Failed to retrieve the task details. Try again later",
          });
        }
      });
  } catch (err) {
    return res.status(500).send({
      status: "500",
      message: "Failed to retrieve the task details. Try again later",
    });
  }
};

exports.editTask = async (req, res) => {
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

    if (req.body.task_no) {
      fields.push(" task_no ");
    }
    if (req.body.project_id) {
      fields.push(" project_id ");
    }
    if (req.body.organisation_id) {
      fields.push(" organisation_id ");
    }

    if (fields.length > 0) {
      return res.status(400).send({
        status: "400",
        message: `[${fields}] can not be updated`,
      });
    }

    if (req.body.task_name && typeof req.body.task_name === "string") {
      filterFields.task_name = 1;
    }
    if (
      req.body.task_description &&
      typeof req.body.task_description === "string"
    ) {
      filterFields.task_description = 1;
    }
    if (req.body.task_assignee && typeof req.body.task_assignee.length > 0) {
      filterFields.task_assignee = 1;
    }
    if (req.body.task_due_on && typeof req.body.task_due_on === "string") {
      filterFields.task_due_on = 1;
    }
    if (req.body.task_labels && typeof req.body.task_labels === "string") {
      filterFields.task_labels = 1;
    }
    if (
      req.body.task_time_estimation &&
      typeof req.body.task_time_estimation === "number"
    ) {
      filterFields.task_time_estimation = 1;
    }
    if (req.body.task_priority && typeof req.body.task_priority === "string") {
      filterFields.task_priority = 1;
    }
    if (req.body.task_attachments) {
      filterFields.task_attachments = 1;
    }

    const getTask = await TaskModel.findOne(condition, filterFields);

    TaskModel.findOneAndUpdate(condition, req.body, { new: true })
      .then(async (docs) => {
        if (!docs) {
          return res.status(400).send({
            status: "400",
            message: "Failed to Update. Try again later",
          });
        }
        const logs = {};
        logs.date_time = new Date();
        logs.collection_name = "tasks";
        logs.document_data = {
          id: docs._id,
          name: docs.task_name,
        };
        logs.message = "Task Updated";
        logs.before_change = getTask;
        logs.after_change = req.body;
        logs.log_by = {
          id: user.id,
          name: user.name,
        };
        logs.organisation_id = user.organisation.organisation;
        await Log.create(logs);

        if (docs.task_assignee) {
          Notification.create({
            title: "New Task assigned",
            message: `
              Task_Name: <b>${task.task_name}</b><br>
              Task_due_on: <b>${task.task_due_on}</b><br>
              Task_priority: <b>${task.task_priority}</b><br>
              Task_created_by:<b>${user.name}</b>`,
            status: "UNREAD",
            send_by: user.id,
            send_to: docs.task_assignee,
          });

          //   for (const eachTaskAssignee of task.task_assignee) {
          //     const eachTaskAssigneeData = await User.findOne({
          //       _id: eachTaskAssignee,
          //     });
          //     if (!eachTaskAssigneeData || eachTaskAssigneeData === null) {
          //       return res.status(400).send({
          //         status: "400",
          //         message: "User does not exists",
          //       });
          //     }

          //     req.io
          //       .to(eachTaskAssigneeData._id)
          //       .emit("task_assigned", "Success");
          //   }
        }

        return res
          .status(200)
          .send({ status: "200", message: "Succesffully Updated Task" });
      })
      .catch((err) => {
        console.log("error", err);
        return res.status(500).send({
          status: 500,
          message: "Failed to update. Try again later",
        });
      });
  } catch (err) {
    return res.status(500).send({
      status: "500",
      message: "Failed to update task. Try again later",
    });
  }
};

exports.closeTask = async (req, res) => {
  try {
    const user = req.user;
    const _id = req.params.id;
    const getTask = await TaskModel.findOne(condition, {
      task_labels: 1,
      _id: 1,
      task_name: 1,
    });
    const result = await TaskModel.findByIdAndUpdate(_id, {
      $set: { task_labels: "FIXED" },
    });

    if (result.task_labels === "FIXED") {
      const logs = {};
      logs.date_time = new Date();
      logs.collection_name = "tasks";
      logs.document_data = {
        id: getTask._id,
        name: getTask.task_name,
      };
      logs.message = "Task Closed";
      logs.before_change = getTask.task_labels;
      logs.after_change = result.task_labels;
      logs.log_by = {
        id: user.id,
        name: user.name,
      };
      logs.organisation_id = user.organisation.organisation;
      await Log.create(logs);

      return res.status(200).send({
        status: 200,
        message: "Task Completed",
      });
    }

    return res.status(400).send({
      status: 400,
      message: "Failed to update. Try again later",
    });
  } catch (error) {
    return res.status(500).send({
      status: 500,
      message: "Failed to close task. Try again later",
    });
  }
};

exports.changeTaskStatus = async (req, res) => {
  try {
    const user = req.user;
    const condition = {
      $and: [
        { _id: req.params.id },
        { organisation: user.organisation.organisation },
      ],
    };

    const getTask = await TaskModel.findOne(condition, {
      task_status: 1,
      _id: 1,
      task_name: 1,
    });

    const status = parseInt(req.body.status);
    if (status > 6 || status < 1) {
      return res
        .status(400)
        .send({ status: "400", message: "Failed to Update Task" });
    }

    let allOk = false;
    let docs;
    if (status === 6) {
      if (
        user.organisation.role === "admin" ||
        user.organisation.role === "team_lead" ||
        user.organisation.role === "subadmin"
      ) {
        docs = await TaskModel.findOneAndUpdate(condition, {
          task_status: status,
        });
        if (docs) {
          allOk = true;
        }
      } else {
        return res.status(400).send({
          status: "400",
          message: "Not Authorized to Change the status to CONFIRMED",
        });
      }
    } else {
      docs = await TaskModel.findOneAndUpdate(condition, {
        task_status: status,
      });

      if (docs) {
        allOk = true;
      }
    }

    if (allOk) {
      const logs = {};
      logs.date_time = new Date();
      logs.collection_name = "tasks";
      logs.document_data = {
        id: getTask._id,
        name: getTask.task_name,
      };
      logs.message = "Task Status Changed";
      logs.before_change = config.task_status[getTask.task_status];
      logs.after_change = config.task_status[status];
      logs.log_by = {
        id: user.id,
        name: user.name,
      };
      logs.organisation_id = user.organisation.organisation;
      await Log.create(logs);

      let sendTo = [];

      if (docs.task_assignee) {
        for (let assignee of docs.task_assignee) {
          const eachTaskAssigneeData = User.findOne({ _id: assignee });

          if (assignee != user.id) {
            sendTo.push(assignee);
            if (eachTaskAssigneeData.notification_subscription) {
              let notifyMsg = {
                title: "Task Status Changed",
                body: `
                  ${task.task_name} of ${
                  projectDetails.project_name
                } project's status changed from ${
                  config.task_status[getTask.task_status]
                } to ${config.task_status[status]}`,
              };

              await sendPushNotification(
                eachTaskAssigneeData.notification_subscription,
                notifyMsg
              );
            }
          }
        }
      }

      if (sendTo.length > 0) {
        await Notification.create({
          title: "Task Status Changed",
          message: `${docs.task_name}'s status changed from ${
            config.task_status[getTask.task_status]
          } to ${config.task_status[status]}`,
          status: "UNREAD",
          send_by: user.id,
          send_to: sendTo,
        });
      }

      return res
        .status(200)
        .send({ status: "200", message: "Succesffully Updated Task" });
    } else {
      return res
        .status(500)
        .send({ status: "500", message: "Something went wrong" });
    }
  } catch (err) {
    console.log(err, "err");
    return res
      .status(500)
      .send({ status: "500", message: "Something went wrong" });
  }
};

// task reminder route
exports.reminderTask = async (req, res) => {
  try {
    const user = req.user;
    const _id = req.params.id;
    const result = await TaskModel.findById(_id);

    if (result.task_status === 4 || result.task_status === 6) {
      return res.status(400).send({
        status: 400,
        message: "This Task is already completed",
      });
    }

    result.task_assignee.forEach((element) => {
      if (user.id != element) {
        Notification.create({
          notification: "Please complete the task immediately",
          status: "UNREAD",
          send_by: user._id,
          send_to: element,
        });
      }
    });

    return res.status(200).send({
      status: 200,
      message: "Notification send",
    });
  } catch (err) {
    return res.status(500).send({
      status: 500,
      message: "Try again later",
    });
  }
};

exports.addTaskComment = async (req, res) => {
  try {
    const user = req.user;
    const validationErrors = validationResult(req);
    if (!validationErrors.isEmpty()) {
      return res.status(422).json({
        status: 422,
        msg: "err",
        validationErrors: validationErrors.array({ onlyFirstError: true }),
      });
    }

    const { id, comment } = req.body;
    let obj = {};
    if (comment) obj.comment = comment;

    obj.user = user.id;
    if (req.files !== null && req.files.file) {
      obj.type = "attachment";
      obj.contentType = req.files.file.mimetype;

      await req.files.file.mv(
        `${__dirname}/../public/images/${req.files.file.name}`,
        (err) => {
          if (err) console.log(err);
        }
      );
      obj.file = `/images/${req.files.file.name}`;
    }
    TaskModel.findByIdAndUpdate(
      { _id: id },
      { $push: { comments: obj } },
      { new: true },
      async (err, docs) => {
        if (!err) {
          const logs = {};
          logs.date_time = new Date();
          logs.collection_name = "tasks";
          logs.document_data = {
            id: docs._id,
            name: docs.task_name,
          };
          logs.message = "Comment Added on Task";
          logs.after_change = obj;
          logs.log_by = {
            id: user.id,
            name: user.name,
          };
          logs.organisation_id = user.organisation.organisation;
          await Log.create(logs);

          return res
            .status(200)
            .send({ status: 200, message: "Comment Added" });
        } else {
          return res
            .status(500)
            .send({ status: 500, message: "Failed to add comment" });
        }
      }
    );
  } catch (error) {
    return res
      .status(500)
      .send({ status: 500, message: "Failed to add comment" });
  }
};

exports.getTaskCount = async (req, res) => {
  try {
    const user = req.user;

    let query = {};
    query = {
      $and: [
        {
          $or: [{ task_assignee: user.id }, { created_by: user.id }],
        },
        { organisation: user.organisation.organisation },
      ],
    };
    if (
      user.organisation.role == "admin" ||
      user.organisation.role == "subadmin"
    ) {
      query = { organisation: user.organisation.organisation };
    }

    if (user.organisation.role == "team_leader") {
      const project_list = await ProjectModel.find({ project_leader: user.id });

      const project_id_list = project_list.map((item) => item._id);
      query = {
        project_id: { $in: project_id_list },
        organisation: user.organisation.organisation,
      };
    }

    TaskModel.find(query, (err, docs) => {
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
          // obj[docs[i].task_status] = obj[docs[i].task_status] + 1;
        }

        return res
          .status(200)
          .send({ status: "200", message: "Task Count", taskCount: obj });
      } else {
        return res.status(500).send({
          status: "500",
          message: "Failed to retrieve the task count. Try again later",
        });
      }
    });
  } catch (err) {
    return res.status(500).send({
      status: "500",
      message: "Failed to retrieve the task count. Try again later",
    });
  }
};
