const Payroll = require("../models/payroll");

exports.createPayroll = async (req, res) => {
  const user = req.user;
  if (user.role == "admin") {
    const payload = req.body;

    const payloadObj = {
      user_id: payload.user_id,
      month: payload.month,
      payment_medium: payload.payment_medium,
      payment_date: payload.payment_date,
      payment_amount: {
        monthly_ctc: payload.monthly_ctc,
        monthly_deduction: payload.monthly_deduction,
        monthly_bonus: payload.monthly_bonus,
      },
      payment_status: payload.payment_status,
    };

    payloadObj.grossSalary =
      payloadObj.payment_amount.monthly_ctc +
      payloadObj.payment_amount.monthly_bonus -
      payloadObj.payment_amount.monthly_deduction;

    console.log(payloadObj);
    return res.status(201).send({
      status: 201,
      message: "Payroll created",
    });
  } else {
    return res.status(401).send({
      status: 401,
      message: "Restricted access",
    });
  }
};
