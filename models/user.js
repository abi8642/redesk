const mongoose = require("mongoose");
const crypto = require("crypto");
const uuidv1 = require("uuid/v1");

const userSchema = new mongoose.Schema(
  {
    // firstName: {
    //   type: String,
    //   required: true,
    //   trim: true,
    // },
    // lastName: {
    //   type: String,
    //   required: true,
    //   trim: true,
    // },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
    },
    otp: {
      type: Number,
    },
    pic: {
      type: "String",
      required: true,
      default:
        "https://icon-library.com/images/anonymous-avatar-icon/anonymous-avatar-icon-25.jpg",
    },

    encry_password: {
      type: String,
      // required: true,
    },
    salt: String,
    // role: {
    //   type: String,
    //   default: "user",
    //   enum: ["user", "admin", "team_leader", "client", "observer", "subadmin"],
    // },
    status: {
      type: String,
      default: "approved",
    },
    organisation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organisation",
    },
    organisation_list: [
      {
        priority: { type: Number },
        organisation: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Organisation",
        },
        role: {
          type: String,
          default: "user",
          enum: [
            "user",
            "admin",
            "team_leader",
            "client",
            "observer",
            "subadmin",
          ],
        },
      },
    ],
    phone: {
      type: String,
      // required: true,
    },
  },
  { timestamps: true }
);

userSchema
  .virtual("password")
  .set(function (password) {
    this._password = password;
    this.salt = uuidv1();
    this.encry_password = this.securePassword(password);
  })
  .get(function () {
    return this._password;
  });
// userSchema.virtual("name").set(function () {
//   return `asass`;
// });

userSchema.methods = {
  authenticate: function (plainpassword) {
    return this.securePassword(plainpassword) === this.encry_password;
  },
  securePassword: function (plainpassword) {
    if (!plainpassword) return "";
    try {
      return crypto
        .createHmac("sha256", this.salt)
        .update(plainpassword)
        .digest("hex");
    } catch (err) {
      return "";
    }
  },
};

const User = new mongoose.model("User", userSchema);

module.exports = User;
