const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const projectSchema = new Schema(
  {
    project_no: {
      type: String,
      required: true,
    },
    project_name: {
      type: String,
      required: true,
    },
    project_desc: {
      type: String,
      required: true,
    },
    // project_template: {
    //   type: String,
    // },
    // project_label: {
    //   type: String,
    // },
    project_category: {
      type: String,
      required: true,
    },
    project_client: {
      type: String,
      required: true,
    },
    project_start_date: {
      type: String,
      required: true,
    },
    project_end_date: {
      type: String,
      required: true,
    },
    project_completion_date: {
      type: String,
      default: "",
    },
    project_status: {
      type: String,
      enum: ["ACTIVE", "HOLD", "COMPLETED"],
      default: "ACTIVE",
      required: true,
    },
    project_priority: {
      type: String,
      enum: ["HIGH", "MEDIUM", "LOW"],
      default: "MEDIUM",
      required: true,
    },
    organisation: {
      type: mongoose.Schema.Types.ObjectId,
    },
    project_assignee: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    ],
    project_leader: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    project_attachments: [
      {
        title: String,
        url: String,
      },
    ],
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Project", projectSchema);
