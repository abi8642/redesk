const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
  {
    task_name: {
      type: String,
      required: true,
    },
    task_no: {
      type: String,
      required: true,
    },
    task_description: {
      type: String,
      required: true,
    },
    task_status: {
      type: Number,
      // enum: ["ACTIVE", "HOLD", "COMPLETED"],
      default: 1,
      required: true,
    },
    task_assignee: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      ],
    },
    project_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    organisation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organisation",
      required: true,
    },
    task_due_on: {
      type: String,
      required: true,
    },
    task_labels: {
      type: String,
      enum: [
        "NEW",
        "FIXED",
        "ASSIGNED",
        "WORKS FOR ME",
        "VERIFIED",
        "IN PROGRESS",
        "WONT FIX",
        "COMPLETED",
        "CONFIRMED",
        "APPROVED BY CLIENT",
        "OPEN",
        "RE-OPEN",
        "PENDING RE-TEST",
        "RE-TEST",
        "CLOSED",
      ],
      required: true,
    },
    task_time_estimation: {
      type: Number,
    },
    task_priority: {
      type: String,
      enum: ["HIGH", "MEDIUM", "LOW"],
      required: true,
      default: "MEDIUM",
    },
    task_attachments: [
      {
        type: "String",
      },
    ],
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    comments: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        comment: {
          type: String,
        },
        file: {
          type: String,
        },
        contentType: {
          type: String,
        },
        type: {
          type: String,
          enum: ["comment", "attachment"],
          default: "comment",
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Task", taskSchema);
