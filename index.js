require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const fileUpload = require("express-fileupload");
const path = require("path");
const routers = require("./routes/router");
const User = require("./models/user");
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

//make a authentication for the files
// app.use("/files:id", express.static(path.join(__dirname, "/public/attachments/")));

// app.use("/file/:id", express.static(path.join(__dirname, "/public/attachments/")));
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
  console.log("clint connected " + socket.id);

  socket.on("userJoin", (id) => {
    socket.join(id);
    console.log("user joined room " + id);
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

  // socket.emit("message", "hello from server");
  socket.on("join", (data) => {
    socket.join(data.im);
    console.log("user joined room " + data.im);
  });

  socket.on("sendComment", (data) => {
    data.time = new Date().toDateString();

    socket.broadcast.emit("getComment", data);
  });
  // socket.on("upload", (file, callback) => {
  //   console.log(file); // <Buffer 25 50 44 ...>

  //   // save the content to the disk, for example
  //   writeFile("/tmp", file, (err) => {
  //     callback({ message: err ? "failure" : "success" });
  //   });
  // });

  // socket to get the all user from the database
  socket.on("userList", (data) => {
    // console.log("userList called");
    console.log(data);
    // io.emit("userList", "aasda");
  });

  io.on("userList", (data) => {
    console.log(data);
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
    // console.log(data); // <Buffer 25 50 44 ...>
    //broadcast the file to all the users in the room
    // socket.emit("add image", file);
    // socket.broadcast.emit("add image", file);
    // save the content to the disk, for example

    if (!data.receiver_id) return console.log("chat.receiver_id not defined");

    data.receiver_id.forEach((user) => {
      if (user._id == data.sender_id) return;

      socket.in(user._id).emit("add image", data.file);
    });
    writeFile("/data", data.file, (err) => {
      callback({ message: err ? "failure" : "success" });
    });
  });
  socket.on("send message", () => {
    socket.emit("message", "Hi Subha");
  });
  socket.on("new message", (newMessageRecieved) => {
    console.log("mesaage", newMessageRecieved);

    // socket.emit("message", "Hi Subha");
    var chat = newMessageRecieved.chat;
    // console.log(chat);
    if (!chat) return console.log("chat not defined");
    if (!chat.users) return console.log("chat.users not defined");

    chat.users.forEach((user) => {
      if (user._id == newMessageRecieved.sender._id) return;
      console.log("new Message was", newMessageRecieved.sender._id, user._id);
      socket.in(user._id).emit("message recieved", newMessageRecieved);
    });

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
