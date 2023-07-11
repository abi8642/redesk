const nodemailer = require("nodemailer");

exports.sendMail = (userMail, subject, text) => {
  const transporter = nodemailer.createTransport({
    host: "mail.apptimates.com",
    port: 587,
    auth: {
      user: "invite@apptimates.com",
      pass: "1234567",
    },
  });

  // const obj = {
  //   message: "To reset your password click on the link",
  //   link: sendUrl,
  // };

  const mailOptions = {
    from: "invite@apptimates.com",
    to: userMail,
    subject: subject,
    html: text,
  };
  // console.log("mailOptions", mailOptions);

  return new Promise((resolve, reject) => {
    transporter.sendMail(mailOptions, (err, info) => {
      if (err) {
        return reject(err);
      } else {
        return resolve(true);
      }
    });
  });
};
