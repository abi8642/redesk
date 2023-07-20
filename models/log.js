const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const logsSchema = new Schema({
  date_time: {
    type: Date,
    required: true,
  },
  collection_name: {
    type: String,
    required: true,
  },
  document_id: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  before_change: {
    type: Object,
  },
  after_change: {
    type: Object,
  },
  change_by: {
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
