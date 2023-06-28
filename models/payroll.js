const mongoose = require("mongoose");

const payrollSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
    },
    month: {
      type: String,
      required: true,
    },
    payment_medium: {
      type: String,
      required: true,
    },
    payment_date: {
      type: String,
      required: true,
    },
    payment_amount: [
      {
        monthly_ctc: {
          type: Number,
          required: true,
          min: 0,
        },
        monthly_deduction: {
          type: Number,
          required: true,
          default: 0,
          min: 0,
        },
        monthly_bonus: {
          type: Number,
          required: true,
          default: 0,
          min: 0,
        },
      },
    ],
    payment_status: {
      type: String,
      enum: ["PROCESSING", "COMPLETED", "INITIALIZED", "PENDING"],
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payroll", payrollSchema);
