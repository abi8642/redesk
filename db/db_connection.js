require("dotenv").config();
const mongoose = require("mongoose");
// const User = require("../models/user");

mongoose.set("strictQuery", false);
mongoose.set("useCreateIndex", true);

const dbHost = process.env.DB_HOST;
const dbPort = process.env.DB_PORT;
const dbName = process.env.DB_NAME;
const dbUser = process.env.DB_USER;
const dbPassword = process.env.DB_PASSWORD;
const uri = `mongodb://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbName}`;

db_conn().catch((e) => {
  console.log("DB not connected" + e);
});

async function db_conn() {
  await mongoose.connect(uri, {
    useUnifiedTopology: true,
    useNewUrlParser: true,
    useFindAndModify: false,
  });
}
