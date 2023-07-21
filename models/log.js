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
  document_data: {
    type: Object,
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
  log_by: {
    type: Object,
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
