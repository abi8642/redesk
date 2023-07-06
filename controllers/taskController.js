const TaskModel = require("../models/task");
const ProjectModel = require("../models/project");
const Notification = require("../models/notification");
const jwt = require("jsonwebtoken");
const config = require("../config/config");
const project = require("../models/project");
const { validationResult } = require("express-validator");
const User = require("../models/user");
const notification = require("../models/notification");
const mongoose = require("mongoose");
const { ObjectId } = require("mongodb");

//create task
exports.createTask = (req, res) => {
  let payload = req.body;
  let user = req.user;
  // const validationErrors = validationResult(req);
  // if (!validationErrors.isEmpty()) {
  //   return res.status(422).json({
  //     status: 422,
  //     msg: "err",
  //     validationErrors: validationErrors.array({ onlyFirstError: true }),
  //   });
  // }

  // console.log(req.io);

  //attach project list to user socket
  // req.io.join
  // console.log(req.io);
  // projectList.forEach((project) => req.io.join("project:" + project._id));
  // req.io.to()

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
              console.log("task", task);
              // payload.task_assignee.forEach((element) => {
              //   Notification.create({
              //     notification: "New Task assigned",
              //     status: "UNREAD",
              //     send_by: user.id,
              //     send_to: element,
              //   });
              // });

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
                // task,
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
};

//task list
exports.getTask = async (req, res) => {
  const user = req.user;
  // console.log("user: ", user);
  let query = {};
  if (user.organisation.role == "admin" || user.organisation.role == "subadmin")
    query = { organisation: user.organisation.organisation };
  else
    query = {
      $and: [
        {
          $or: [{ task_assignee: user.id }, { created_by: user.id }],
        },
        { organisation: user.organisation.organisation },
      ],
    };

  // console.log("query", query);

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
};

exports.getTaskByProject = (req, res) => {
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
          message: "Failed to retrieve the task List. Try again later",
        });
      }
    });
};

exports.getTaskArray = async (req, res) => {
  const user = req.user;
  const id = req.params.id;
  // let query = {};
  // if (id) {
  //   query = { project_id: id, organisation: user.organisation };
  // } else {
  //   query = { organisation: user.organisation };
  // }

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

  TaskModel.find(query)
    .populate(
      "project_id project_assignee task_assignee",
      "project_name name pic"
    )
    .exec((err, docs) => {
      let taskArr = [
        {
          title: "Pending",
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
};

exports.deleteTask = async (req, res) => {
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

  // await TaskModel.findOneAndDelete(task_id, (err, docs) => {
  //   if (!err) {
  //     return res
  //       .status(200)
  //       .send({ status: "200", message: "Task Deleted Successfully" });
  //   } else {
  //     return res.status(500).send({
  //       status: "500",
  //       message: "Failed to Delete the task. Try again later",
  //     });
  //   }
  // });
};

exports.getTaskByUser = (req, res) => {
  const user = req.user;
  TaskModel.find({ task_assignee: { $in: [user._id] } })
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
          message: "Failed to retrieve the task List. Try again later",
        });
      }
    });
};

exports.getTaskById = (req, res) => {
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
          message: "Failed to retrieve the task . Try again later",
        });
      }
    });
};

//task edit
exports.editTask = (req, res) => {
  const user = req.user;
  const condition = { _id: req.params.id, organisation: user.organisation };

  TaskModel.updateOne(condition, req.body)
    .then((docs) => {
      if (!docs) {
        return res.status(400).send({
          status: "400",
          message: "Failed to Update. Try again later",
        });
      }
      return res
        .status(200)
        .send({ status: "200", message: "Succesffully Updated Task" });
    })
    .catch((err) => {
      return res.status(500).send({
        status: 500,
        message: "Failed to update. Try again later",
      });
    });
};

exports.closeTask = async (req, res) => {
  try {
    const _id = req.params.id;
    const result = await TaskModel.findByIdAndUpdate(_id, {
      $set: { task_labels: "FIXED" },
    });

    if (result.task_labels === "FIXED") {
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
      message: "Failed to update. Try again later",
    });
  }
};

exports.changeTaskStatus = (req, res) => {
  const user = req.user;
  const condition = {
    $and: [
      { _id: req.params.id },
      { organisation: user.organisation.organisation },
    ],
  };
  const status = parseInt(req.body.status);

  if (status > 6 || status < 1) {
    return res
      .status(400)
      .send({ status: "400", message: "Failed to Update Task" });
  }

  try {
    if (status === 6) {
      if (
        user.organisation.role === "admin" ||
        user.organisation.role === "team_lead" ||
        user.organisation.role === "subadmin"
      ) {
        TaskModel.findOneAndUpdate(condition, { task_status: status })
          .then((docs) => {
            if (!docs) {
              return res
                .status(400)
                .send({ status: "400", message: "Failed to Update Task" });
            }
            return res
              .status(200)
              .send({ status: "200", message: "Succesffully Updated Task" });
          })
          .catch((err) => {
            return res
              .status(400)
              .send({ status: "400", message: "Something went wrong" });
          });
      } else {
        return res.status(400).send({
          status: "400",
          message: "Not Authorized to Change the status to CONFIRMED",
        });
      }
    }

    TaskModel.findOneAndUpdate(condition, { task_status: status })
      .then((docs) => {
        if (!docs) {
          return res
            .status(400)
            .send({ status: "400", message: "Failed to Update Task" });
        }
        return res
          .status(200)
          .send({ status: "200", message: "Succesffully Updated Task" });
      })
      .catch((err) => {
        return res
          .status(400)
          .send({ status: "400", message: "Something went wrong" });
      });
  } catch (err) {
    return res
      .status(500)
      .send({ status: "500", message: "Something went wrong" });
  }
};

// task reminder route
exports.reminderTask = async (req, res) => {
  const _id = req.params.id;
  try {
    const result = await TaskModel.findById(_id);
    // const decode_token = jwt.verify(req.cookies.token, process.env.SECRET);

    result.task_assignee.forEach((element) => {
      if (user._id != element) {
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

  obj.user = user._id;

  if (req.files && req.files.file) {
    obj.type = "attachment";
    obj.contentType = req.files.file.mimetype;

    req.files.file.mv(
      `${__dirname}/../public/images/${req.files.file.name}`,
      (err) => {
        console.log(err);
      }
    );
    obj.file = `/images/${req.files.file.name}`;
  }

  try {
    TaskModel.findByIdAndUpdate(
      { _id: id },
      // { $push: { comments: { comment: obj, user: user._id } } },
      { $push: { comments: obj } },
      { new: true }
    )
      // .populate("comments.user", "name")
      .exec((err, docs) => {
        if (!err) {
          return res
            .status(200)
            .send({ status: 200, message: "Comment Added" });
        } else {
          return res
            .status(500)
            .send({ status: 500, message: "Failed to add comment" });
        }
      });
  } catch (error) {
    return res
      .status(500)
      .send({ status: 500, message: "Failed to add comment" });
  }
};

exports.getTaskCount = async (req, res) => {
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
        message: "Failed to retrieve the task List. Try again later",
      });
    }
  });
};
