const mongoose = require("mongoose");

const organisationSchema = new mongoose.Schema(
  {
    organisation_name: {
      type: String,
      required: true,
      trim: true,
    },
    sub_domain: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    // organisation_email: {
    //   type: String,
    //   required: true,
    //   trim: true,
    // },
    organisation_website: {
      type: String,
    },
    organisation_address: {
      type: String,
    },
    status: {
      type: String,
      default: "pending",
    },
    projectCategories: [
      {
        type: String,
      },
    ],
  },
  { timestamps: true }
);

const Organisation = new mongoose.model("Organisation", organisationSchema);

module.exports = Organisation;
