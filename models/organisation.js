const mongoose = require("mongoose");
const crypto = require("crypto");
const uuidv1 = require("uuid/v1");

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

// organisationSchema
//   .virtual("password")
//   .set(function (password) {
//     this._password = password;
//     this.salt = uuidv1();
//     this.encry_password = this.securePassword(password);
//   })
//   .get(function () {
//     return this._password;
//   });

// organisationSchema.methods = {
//   authenticate: function (plainpassword) {
//     return this.securePassword(plainpassword) === this.encry_password;
//   },
//   securePassword: function (plainpassword) {
//     if (!plainpassword) return "";
//     try {
//       return crypto
//         .createHmac("sha256", this.salt)
//         .update(plainpassword)
//         .digest("hex");
//     } catch (err) {
//       return "";
//     }
//   },
// };

const Organisation = new mongoose.model("Organisation", organisationSchema);

module.exports = Organisation;
