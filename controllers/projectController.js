const busboy = require("busboy");
const projectModel = require("../models/project");
const User = require("../models/user");
const taskModel = require("../models/task");
const fs = require("fs");
const notification = require("../models/notification");

exports.createProject = async (req, res) => {
  const user = req.user;

  const d = new Date();
  const month = d.getMonth() + 1;
  const year = d.getFullYear();

  try {
    const projectCount = await projectModel.countDocuments({
      createdAt: {
        $gte: new Date(year, month - 1, 1), // Start of the month
        $lt: new Date(year, month, 1), // Start of next month
      },
    });
    // console.log(d.getYear());
    // console.log(projectCount);
    // return;

    const project_no = projectCount + 1;
    const reference_id =
      "RKIT" +
      (d.getYear() - 100) +
      ("0" + month).slice(-2) +
      "" +
      String(project_no).padStart(5, "0");

    // console.log("reference_id", reference_id);
    req.body.project_no = reference_id;
    req.body.created_by = user.id;
    req.body.organisation = user.organisation.organisation;

    projectModel
      .create(req.body)
      .then(async (project) => {
        if (project.project_assignee) {
          if (project.project_assignee.length > 0) {
            for (const eachProjectAssignee of project.project_assignee) {
              const eachProjectAssigneeData = await User.findOne({
                _id: eachProjectAssignee,
              });
              if (
                !eachProjectAssigneeData ||
                eachProjectAssigneeData === null
              ) {
                return res.status(400).send({
                  status: "400",
                  message: "User does not exists",
                });
              }

              const assigneeMail = eachProjectAssigneeData.email;
              const subjects = "Project Created";
              const sendMsgs = `
                Project_Name: <b>${project.project_name}</b><br>
                Project_due_on: <b>${project.project_due_on}</b><br>
                Project_priority: <b>${project.project_priority}</b><br>
                Project_created_by: <b>${user.name}</b>`;
              sendMail(assigneeMail, subjects, sendMsgs);
            }
          }
        }
        if (project) {
          return res
            .status(200)
            .send({ status: "200", message: "Successfully added Project" });
        }
      })
      .catch((err) => {
        console.log(err);
        return res
          .status(500)
          .send({ status: "500", message: "Unable to save user to DB", err });
      });
    // } else {
    //   res.status(401).send({
    //     status: 401,
    //     message: "Only admin can access this",
    //   });
    // }
  } catch (err) {
    console.log(err);
    res.status(500).send({
      status: 500,
      message: "Unable to Create Project",
    });
  }
};

exports.getProjectMembers = (req, res) => {
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
        message: "Failed to retrieve the Project List. Try again later",
      });
    });
};

exports.getProject = (req, res) => {
  const user = req.user;
  let query = {};
  if (user.organisation.role == "admin" || user.organisation.role == "subadmin")
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

  // console.log(query);

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
};

exports.getProjectById = async (req, res) => {
  const user = req.user;
  const projectId = { _id: req.params.id };
  // await projectModel.findOne(
  //   {
  //     project_leader: id,
  //   },
  //   (err, docs) => {
  //     console.log("docs", docs);
  //   }
  // );
  projectModel
    .findOne(projectId)
    .populate("project_leader project_assignee", "name pic")
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
      const tasks = await taskModel.find({ project_id: req.params.id });
      projectDetails.taskList = tasks;

      return res
        .status(200)
        .send({ status: "200", message: "Project Details", projectDetails });
    })
    .catch((err) => {
      console.log("err", err);
      return res.status(500).send({
        status: "500",
        message: "Failed to retrieve the Project List. Try again later",
      });
    });
};

exports.getTaskCountByProject = (req, res) => {
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
        message: "Failed to retrieve the task List. Try again later",
      });
    }
  });
};

exports.getTaskByStatus = (req, res) => {
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
        message: "Failed to retrieve the task List. Try again later",
      });
    }
  });
};

exports.editProject = (req, res) => {
  const user = req.user;

  const condition = {
    _id: req.params.id,
    organisation: user.organisation.organisation,
  };
  projectModel
    .updateMany(condition, req.body)
    .then((docs) => {
      if (!docs) {
        return res
          .status(400)
          .send({ status: "400", message: "Failed to Update" });
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
};

exports.changeProjectStatus = (req, res) => {
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
      update = { project_status: "INACtIVE" };
      break;
    default:
      return res.status(400).send({
        status: 400,
        message: "Invalid Status",
      });
  }

  projectModel
    .updateMany(condition, update)
    .then((docs) => {
      if (!docs) {
        return res
          .status(400)
          .send({ status: "400", message: "Failed to Update" });
      }
      return res.status(200).send({
        status: "200",
        message: "Succesffully Updated Project",
      });
    })
    .catch((err) => {
      return res.status(500).send({
        status: 500,
        message: "Unable to edit project. Try again later",
      });
    });
};

exports.assignProject = async (req, res) => {
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
    return res.status(401).send({
      status: 401,
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
      data.removedUserCount++;
    } else {
      return res.status(500).send({
        status: 500,
        message: "Unable to edit project. Try again later",
      });
    }
  }

  if (project_assignee && project_assignee.length > 0) {
    const updateProject = await projectModel.updateMany(
      { _id: req.params.id },
      { $addToSet: { project_assignee: project_assignee } }
    );

    if (updateProject) {
      data.addedUserCount++;

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
        message: "Unable to edit project. Try again later",
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

  return res.status(200).send({
    status: "200",
    message: "Succesffully Updated Project",
    data,
  });
};

exports.assignTeamLeader = async (req, res) => {
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
      data.removedLeaderCount++;
    } else {
      return res.status(500).send({
        status: 500,
        message: "Unable to edit project. Try again later",
      });
    }
  }
  if (project_leader && project_leader.length > 0) {
    const updateProject = await projectModel.updateMany(
      { _id: req.params.id },
      { $addToSet: { project_leader: project_leader } }
    );

    if (updateProject) {
      data.addedLeaderCount++;
    } else {
      return res.status(500).send({
        status: 500,
        message: "Unable to edit project. Try again later",
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

  return res.status(200).send({
    status: "200",
    message: "Succesffully Updated Project",
    data,
  });
};

exports.addProjectAttachment = async (req, res) => {
  const user = req.user;
  const project = await projectModel.findById(req.params.id);
  if (project.organisation + "" != user.organisation.organisation + "") {
    // console.log(project.organisation == user.organisation);
    // console.log(typeof user.organisation);
    return res.status(401).send({
      status: 401,
      message: "Enter project of your organisation",
    });
  }
  // console.log(req.body);
  // console.log("ADsad");
  let title = req.body.title;

  // if (req.files && req.files.file) {
  // let fileName=
  let dir = `${__dirname}/../public/attachments/${req.params.id}`;

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  // req.files.file.mv(`${dir}/${req.files.file.name}`, (err) => {
  //   console.log(err);
  // });

  const bb = busboy({ headers: req.headers });
  console.log(bb, "bb");
  let filename;
  bb.on("file", (name, file, info) => {
    // let { filename, encoding, mimeType } = info;
    filename = info.filename;
    console.log(info);
    let downloaded = 0;
    // const saveTo = path.join(".", filename);
    const saveTo = `${dir}/${filename}`;
    // console.log(saveTo);
    file.pipe(fs.createWriteStream(saveTo));
    file.on("data", (chunk) => {});
  });
  bb.on("close", () => {
    let path = `/attachments/${req.params.id}/${filename}`;
    if (!title) {
      title = filename;
    }
    projectModel
      .updateMany(
        { _id: req.params.id },
        { $addToSet: { project_attachments: { title: title, url: path } } }
      )
      .then((docs) => {
        if (!docs) {
          return res
            .status(400)
            .send({ status: "400", message: "Failed to Update" });
        }
        return res.status(200).send({
          status: "200",
          message: "Succesffully Updated Project",
          docs,
        });
      });

    // res.writeHead(200, { Connection: "close" });
    // res.end(`That's all folks!`);
  });
  req.pipe(bb);
};

exports.deleteProjectAttachment = async (req, res) => {
  const user = req.user;
  const project = await projectModel.findById(req.params.id);
  if (project.organisation + "" != user.organisation + "") {
    // console.log(project.organisation == user.organisation);
    // console.log(typeof user.organisation);
    return res.status(401).send({
      status: 401,
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
        message: "Unable to delete attachment" + err,
      });
    }
    projectModel
      .updateMany(
        { _id: req.params.id },
        { $pull: { project_attachments: { _id: req.body.attachment_id } } }
      )
      .then((docs) => {
        if (!docs) {
          return res
            .status(400)
            .send({ status: "400", message: "Failed to Update" });
        }
        return res.status(200).send({
          status: "200",
          message: "Succesffully Updated Project",
          docs,
        });
      });
  });
};

exports.projectEfficiency = async (req, res) => {
  const user = req.user;

  taskModel.find({ project_id: req.params.id }, "task_status", (err, docs) => {
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
      let totalTask =
        obj.active + obj.in_progress + obj.qa + obj.completed + obj.confirmed;
      let efficiency = Math.round((obj.confirmed / totalTask) * 100);

      return res.status(200).send({
        status: "200",
        message: "Project Efficiency",
        projectEfficiency: efficiency,
      });
    } else {
      return res.status(500).send({
        status: "500",
        message: "Failed to retrieve the task List. Try again later",
      });
    }
  });
};

exports.totalProjectEfficiency = async (req, res) => {
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
      message: "Failed to retrieve the Project List. Try again later",
    });
  }
};
