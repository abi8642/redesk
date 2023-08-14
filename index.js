require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const fileUpload = require("express-fileupload");
const path = require("path");
const routers = require("./routes/router");
const User = require("./models/user");
const { sendPushNotification } = require("./services/configPushNotification");
const { writeFile } = require("fs");
const project = require("./models/project");
require("./db/db_connection");

const app = express();

// MiddleWare
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookieParser());
app.use(cors());
app.use(fileUpload());
app.use("/image", express.static(path.join(__dirname, "/files")));
app.use(express.static("public"));

// Basic Testing Purposes
app.get("/", (req, res) => {
  return res.json({ message: "Hello World!" });
});

// PORT
const port = process.env.PORT;

// Starting the server
const server = app.listen(port, () => {
  console.log(`app is running at ${port}`);
});

//socket.io connection
const io = require("socket.io")(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT"],
  },
});
io.on("connection", (socket) => {
  socket.on("userJoin", (id) => {
    socket.join(id);
  });

  socket.on("joinproject", async (data) => {
    const projectList = await project.find(
      {
        $or: [
          { project_assignee: { $in: [data.id] } },
          { project_leader: { $in: [data.id] } },
        ],
      },
      "_id"
    );
    //attach project list to user socket
    // req.io.join
    // console.log(req.io);
    console.log(data);
    console.log(projectList);
    projectList.forEach((project) => socket.join("project:" + project._id));
  });

  socket.on("join", (data) => {
    socket.join(data.im);
    console.log("user joined room " + data.im);
  });

  socket.on("sendComment", (data) => {
    data.time = new Date().toDateString();

    socket.broadcast.emit("getComment", data);
  });

  // socket to get the all user from the database
  socket.on("userList", (data) => {
    console.log("userList event", data);
  });

  // socket to get the all project from the database
  socket.on("projectList", () => {
    // console.log("projectList called");
    io.emit("projectList");
  });

  socket.on("taskAssign", (data) => {
    socket.broadcast.emit("taskAssign", data);
  });

  socket.on("taskEdit", (data) => {
    socket.broadcast.emit("taskEdit", data);
  });

  //Chat Sockets
  socket.on("setup", (userData) => {
    socket.join(userData._id);
    socket.emit("connected");
  });

  socket.on("join chat", (room) => {
    socket.join(room);
    console.log("User Joined Room: " + room);
  });

  socket.on("typing", (room) => {
    // console.log("typing");
    socket.in(room).emit("typing");
  });

  socket.on("stop typing", (room) => socket.in(room).emit("stop typing"));

  socket.on("upload", (data, callback) => {
    if (!data.receiver_id) return console.log("chat.receiver_id not defined");

    data.receiver_id.forEach((user) => {
      if (user._id == data.sender_id) return;

      socket.in(user._id).emit("add image", data.file);
    });
    writeFile("/data", data.file, (err) => {
      callback({ message: err ? "failure" : "success" });
    });
  });

  socket.on("new message", (newMessageRecieved) => {
    try {
      let chat = newMessageRecieved.chat;
      if (!chat) return console.log("chat not defined");
      if (!chat.users) return console.log("chat.users not defined");

      chat.users.forEach(async (user) => {
        if (user._id == newMessageRecieved.sender._id) return;
        const userData = await User.findById(user._id);
        const message = {
          notification: {
            title: "New Message Received",
            body: `${user.name} Send You a Message`,
          },
          token: userData.notification_subscription,
        };

        await sendPushNotification(message);
        socket.in(user._id).emit("message recieved", newMessageRecieved);
      });
    } catch (err) {
      return err;
    }

    socket.off("setup", () => {
      console.log("USER DISCONNECTED");
      socket.leave(userData._id);
    });
  });
});

// Use Routes

//set io to req.io to use in
app.use((req, res, next) => {
  req.io = io;

  next();
});
// app.set("socketIo", io);
app.use("/api", routers);
