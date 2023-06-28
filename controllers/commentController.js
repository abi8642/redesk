const Comment = require("../models/comment");
const path = require("path");

exports.createComment = async (req, res) => {
  const file = req.files.file;
  const filePath = path.join(__dirname, "../files/");

  try {
    //move the file to files folder
    file.mv(filePath + file.name, async (err) => {
      if (err) {
        return res.send(err);
      }

      const comment = new Comment({
        comment: req.body.comment,
        posted_by: req.body.posted_by,
        project_id: req.body.project_id,
        task_id: req.body.task_id,
        attached_file_name: file.name,
      });
      const result = await comment.save();

      return res.send({
        status: 201,
        message: "Comment create successfully",
        result,
      });
    });
  } catch (err) {
    return res.status(500).send({
      status: 500,
      message: "Unable to post comment. Try again later",
    });
  }
};

exports.getComment = async (req, res) => {
  try {
    const task_id = req.params.task_id;
    const result = await Comment.find({ task_id }).select({
      _id: 0,
      task_id: 0,
      createdAt: 0,
      updatedAt: 0,
      __v: 0,
    });

    const comments = [];

    result.forEach((ele) => {
      // create image url
      // console.log(process.env.PORT);
      let url = "http://localhost:8001/image/" + ele.attached_file_name;
      // let url =
      //   "http://localhost:" +
      //   process.env.PORT +
      //   "/image/" +
      //   ele.attached_file_name;

      const obj = {
        Comment: ele.comment,
        posted_by: ele.posted_by,
        attached_file_name: ele.attached_file_name,
        attached_file_url: url,
      };

      //push each comment to the comments array
      comments.push(obj);
    });
    res.status(200).send({
      status: 200,
      task_id: task_id,
      project_d: result[0].project_id,
      comments,
    });
  } catch (err) {
    res.status(500).send({
      status: 500,
      Message: "Unable to get comment. Try agin later",
    });
  }
};
