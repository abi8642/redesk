const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const logsSchema = new Schema({
  date_time: {
    type: Date,
    required: true,
  },
  log_type: {
    type: String,
    required: true,
  },
  log_message: {
    type: String,
    required: true,
  },
  before_update: {
    type: Object,
    default: null,
  },
  request: {
    type: Object,
  },
  response: {
    type: Object,
  },
  log_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  organisation_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Organisation",
    required: true,
  },
});

const Log = new mongoose.model("Logs", logsSchema);
module.exports = Log;
