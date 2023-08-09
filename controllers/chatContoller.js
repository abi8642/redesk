const Chat = require("../models/chatModel");
const Message = require("../models/messageModel");
const User = require("../models/user");

exports.createSingleChat = async (req, res) => {
  try {
    if (req.body.userID && typeof req.body.userID === "String") {
      var chatData = {
        chatName: "sender",
        isGroupChat: false,
        users: [req.user.id, req.body.userID],
      };

      const createdChat = await Chat.create(chatData);
      const chatDetails = await Chat.findOne({ _id: createdChat._id }).populate(
        "users",
        "-password"
      );

      if (chatDetails) {
        return res.status(200).json({
          status: 200,
          message: "Chat Fetched",
          chat: chatDetails,
        });
      } else {
        return res.status(400).json({
          status: 400,
          message: "Chat Not Found",
        });
      }
    }

    return res.status(400).json({
      status: 400,
      msg: "UserID is required",
    });
  } catch (error) {
    return res.status(500).json({
      status: 500,
      msg: "Failed to create chat" + error,
    });
  }
};

exports.accessChat = async (req, res) => {
  try {
    if (req.body.chatID && typeof req.body.chatID === "String") {
      const chatDetails = await Chat.findOne({
        _id: req.body.chatID,
      })
        .populate("users", "-password")
        .populate("latestMessage");

      if (chatDetails) {
        return res.status(200).json({
          status: 200,
          message: "Chat Fetched",
          chat: chatDetails,
        });
      } else {
        return res.status(400).json({
          status: 400,
          message: "Chat Not Found",
        });
      }
    }

    return res.status(400).json({
      status: 400,
      msg: "ChatID is required",
    });
  } catch (error) {
    return res.status(500).json({
      status: 500,
      msg: "Failed to fetch chat data" + error,
    });
  }
};

exports.fetchChats = async (req, res) => {
  try {
    Chat.find({ users: { $elemMatch: { $eq: req.user.id } } })
      .populate("users", "-password")
      .populate("groupAdmin", "-password")
      .populate("latestMessage")
      .sort({ updatedAt: -1 })
      .then(async (results) => {
        results = await User.populate(results, {
          path: "latestMessage.sender",
          select: "name pic email",
        });
        return res.status(200).json({
          status: 200,
          message: "Chat List Fetched",
          results,
        });
      });
  } catch (error) {
    return res.status(500).json({
      status: 500,
      msg: "Failed to fetch Chat List" + error,
    });
  }
};

exports.createGroupChat = async (req, res) => {
  if (!req.body.users || !req.body.name) {
    return res.status(400).send({ message: "Please Fill all the feilds" });
  }

  var users = JSON.parse(req.body.users);

  if (users.length < 2) {
    return res
      .status(400)
      .send("More than 2 users are required to form a group chat");
  }

  users.push(req.user);

  try {
    const groupChat = await Chat.create({
      chatName: req.body.name,
      users: users,
      isGroupChat: true,
      groupAdmin: req.user,
    });

    const fullGroupChat = await Chat.findOne({ _id: groupChat._id })
      .populate("users", "-password")
      .populate("groupAdmin", "-password");

    res.status(200).json(fullGroupChat);
  } catch (error) {
    res.status(400).json({ message: error });
    throw new Error(error.message);
  }
};

exports.renameGroup = async (req, res) => {
  const { chatId, chatName } = req.body;

  const updatedChat = await Chat.findByIdAndUpdate(
    chatId,
    {
      chatName: chatName,
    },
    {
      new: true,
    }
  )
    .populate("users", "-password")
    .populate("groupAdmin", "-password");

  if (!updatedChat) {
    res.status(404);
    throw new Error("Chat Not Found");
  } else {
    res.json(updatedChat);
  }
};

exports.removeFromGroup = async (req, res) => {
  const { chatId, userId } = req.body;

  // check if the requester is admin

  const removed = await Chat.findByIdAndUpdate(
    chatId,
    {
      $pull: { users: userId },
    },
    {
      new: true,
    }
  )
    .populate("users", "-password")
    .populate("groupAdmin", "-password");

  if (!removed) {
    res.status(404);
    throw new Error("Chat Not Found");
  } else {
    res.json(removed);
  }
};

exports.addToGroup = async (req, res) => {
  const { chatId, userId } = req.body;

  // check if the requester is admin

  const added = await Chat.findByIdAndUpdate(
    chatId,
    {
      $push: { users: userId },
    },
    {
      new: true,
    }
  )
    .populate("users", "-password")
    .populate("groupAdmin", "-password");

  if (!added) {
    res.status(404);
    throw new Error("Chat Not Found");
  } else {
    res.json(added);
  }
};
