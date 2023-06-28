const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
  {
    comment: {
      type: String,
      require: true,
      trim: true,
    },
    posted_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      require: true,
    },
    project_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "projects",
      require: true,
    },
    task_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "tasks",
      require: true,
    },
    attached_file_name: {
      type: String,
    },
  },
  { timestamps: true }
);

const Comment = mongoose.model("Comment", commentSchema);

module.exports = Comment;
