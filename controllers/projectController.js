const busboy = require("busboy");
const projectModel = require("../models/project");
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
      .then((project) => {
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
  // console.log(user);
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
  const condition = { project_id: projectId, task_status: taskStatus };

  if (!projectId || !taskStatus) {
    return res.status(400).send({
      status: "400",
      message: "Project Id and Task Status is required",
    });
  }

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
  if (
    user.role == "admin" ||
    user.role == "team_leader" ||
    user.role == "subadmin"
  ) {
    const condition = { _id: req.params.id, organisation: user.organisation };
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
  } else {
    res.status(401).send({
      status: 401,
      message: "Only admin can access this",
    });
  }
};

exports.deleteProject = async (req, res) => {
  const user = req.user;
  const project_id = { _id: req.params.id, organisation: user.organisation };

  const docs1 = await user.find({
    role: "admin",
    organisation: user.organisation,
  });
  const docs = await projectModel
    .findOne({
      _id: req.params.id,
      organisation: user.organisation,
    })
    .populate("project_leader project_assignee", "name pic");
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
      message: "You are not allowed to delete this Projecct",
    });
  }
  await docs.remove();
  return res
    .status(200)
    .send({ status: "200", message: "Project Deleted Successfully" });
};

exports.changeProjectStatus = (req, res) => {
  const user = req.user;
  if (
    user.role == "admin" ||
    user.role == "team_leader" ||
    user.role == "subadmin"
  ) {
    const condition = { _id: req.params.id, organisation: user.organisation };
    const status = req.body.status;

    if (!status) {
      return res.status(400).send({
        status: 400,
        message: "Status is required",
      });
    }
    let update = {};
    if (status == 1) {
      update = { project_status: "ACTIVE" };
    } else if (status == 2) {
      update = { project_status: "HOLD" };
    } else if (status == 3) {
      update = {
        project_status: "COMPLETED",
        project_completion_date: Date.now(),
      };
    } else {
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
          docs,
        });
      })
      .catch((err) => {
        return res.status(500).send({
          status: 500,
          message: "Unable to edit project. Try again later",
        });
      });
  } else {
    res.status(401).send({
      status: 401,
      message: "Only admin can access this",
    });
  }
};

exports.assignProject = async (req, res) => {
  const user = req.user;
  const project_assignee = req.body.project_assignee;
  const remove_assignee = req.body.remove_assignee;
  console.log(user.role);

  if (
    user.role != "admin" &&
    user.role != "team_leader" &&
    user.role != "subadmin"
  ) {
    return res.status(401).send({
      status: 401,
      message: "Only admin and project leader can access this",
    });
  }
  const project = await projectModel.findById(req.params.id);
  if (project.organisation != user.organisation) {
    return res.status(401).send({
      status: 401,
      message: "Enter project of yours organisation",
    });
  }

  if (project_assignee && project_assignee.length > 0) {
    projectModel
      .updateMany(
        { _id: req.params.id },
        { $addToSet: { project_assignee: project_assignee } }
      )
      .then(async (docs) => {
        if (!docs) {
          return res
            .status(400)
            .send({ status: "400", message: "Failed to Update" });
        }

        //!NOTIFICATION FOR TASK CREATION

        req.io
          .to(`project:${req.body.project_id}`)
          .emit("message", "New assignee added");

        await notification.create({
          title: "New Assignee Added",
          message: "New Assignee Added",
          status: "UNREAD",
          users: project_assignee,
        });

        //!NOTIFICATION FOR TASK CREATION END

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
  } else if (remove_assignee && remove_assignee.length > 0) {
    projectModel
      .updateMany(
        { _id: req.params.id },
        { $pull: { project_assignee: { $in: remove_assignee } } }
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
      })
      .catch((err) => {
        return res.status(500).send({
          status: 500,
          message: "Unable to edit project. Try again later",
        });
      });
  } else {
    return res.status(400).send({
      status: 400,
      message: "Please select atleast one user",
    });
  }

  // if (user.role == "team_leader") {
  //   const condition = { _id: req.params.id };

  //   //push into array
  //   projectModel
  //   projectModel
  //     .updateMany(condition, req.body)
  //     .then((docs) => {
  //       if (!docs) {
  //         return res
  //           .status(400)
  //           .send({ status: "400", message: "Failed to Update" });
  //       }
  //       return res.status(200).send({
  //         status: "200",
  //         message: "Succesffully Updated Project",
  //         docs,
  //       });
  //     })
  //     .catch((err) => {
  //       return res.status(500).send({
  //         status: 500,
  //         message: "Unable to edit project. Try again later",
  //       });
  //     });
  // } else {
  //   res.status(401).send({
  //     status: 401,
  //     message: "Only admin can access this",
  //   });
  // }
};

exports.assignTeamLeader = async (req, res) => {
  const user = req.user;
  const project_leader = req.body.project_leader;
  const remove_leader = req.body.remove_leader;
  // console.log(user.role);

  if (user.role != "admin" || user.role != "subadmin") {
    return res.status(401).send({
      status: 401,
      message: "Only admin  can access this",
    });
  }
  const project = await projectModel.findById(req.params.id);
  if (project.organisation != user.organisation) {
    return res.status(401).send({
      status: 401,
      message: "Enter project of yours organisation",
    });
  }

  if (project_leader && project_leader.length > 0) {
    projectModel
      .updateMany(
        { _id: req.params.id },
        { $addToSet: { project_leader: project_leader } }
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
      })
      .catch((err) => {
        return res.status(500).send({
          status: 500,
          message: "Unable to edit project. Try again later",
        });
      });
  } else if (remove_leader && remove_leader.length > 0) {
    projectModel
      .updateMany(
        { _id: req.params.id },
        { $pull: { project_leader: { $in: remove_leader } } }
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
      })
      .catch((err) => {
        return res.status(500).send({
          status: 500,
          message: "Unable to edit project. Try again later",
        });
      });
  } else {
    return res.status(400).send({
      status: 400,
      message: "Please select atleast one user",
    });
  }
};

exports.addProjectAttachment = async (req, res) => {
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
  // console.log(req.body);
  // console.log("ADsad");
  let title = req.body.title;

  // if (req.files && req.files.file) {
  // let fileName=
  var dir = `${__dirname}/../public/attachments/${req.params.id}`;

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  // req.files.file.mv(`${dir}/${req.files.file.name}`, (err) => {
  //   console.log(err);
  // });

  const bb = busboy({ headers: req.headers });
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
