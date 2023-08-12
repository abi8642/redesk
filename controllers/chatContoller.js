const Chat = require("../models/chatModel");
const Message = require("../models/messageModel");
const User = require("../models/user");

exports.createSingleChat = async (req, res) => {
  try {
    if (!req.body.userID) {
      return res.status(400).json({
        status: 400,
        message: "UserID is required",
      });
    }
    if (req.body.userID == req.user.id) {
      return res.status(400).json({
        status: 400,
        message: "Select one member",
      });
    }
    let checkUserID = await User.findOne({
      _id: req.body.userID,
      "organisation_list.organisation": req.user.organisation.organisation,
    });

    if (!checkUserID) {
      return res.status(400).json({
        status: 400,
        message: "User Not Found",
      });
    }

    let chatDoc = await Chat.findOne({
      isGroupChat: false,
      $and: [
        { users: { $elemMatch: { $eq: req.body.userID } } },
        { users: { $elemMatch: { $eq: req.user.id } } },
      ],
    });

    if (!chatDoc) {
      var chatData = {
        chatName: "sender",
        isGroupChat: false,
        users: [req.user.id, req.body.userID],
      };

      chatDoc = await Chat.create(chatData);
    }

    const chatDetails = await Chat.findOne({ _id: chatDoc._id }).populate(
      "users",
      "_id name email pic"
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
  } catch (error) {
    return res.status(500).json({
      status: 500,
      message: "Failed to create chat" + error,
    });
  }
};

exports.accessChat = async (req, res) => {
  try {
    if (!req.body.chatID) {
      return res.status(400).json({
        status: 400,
        message: "ChatID is required",
      });
    }
    const chatDetails = await Chat.findOne({
      _id: req.body.chatID,
    })
      .populate("users", "name email pic")
      .populate("latestMessage");

    const unreadMessageCount = await Message.countDocuments({
      chat: chatDetails._id,
      $and: [{ sender: { $ne: req.user.id }, readBy: { $nin: req.user.id } }],
    });

    if (chatDetails) {
      return res.status(200).json({
        status: 200,
        message: "Chat Fetched",
        chat: chatDetails,
        unreadMessageCount,
      });
    } else {
      return res.status(400).json({
        status: 400,
        message: "Chat Not Found",
      });
    }
  } catch (error) {
    return res.status(500).json({
      status: 500,
      message: "Failed to fetch chat data" + error,
    });
  }
};

exports.fetchChats = async (req, res) => {
  try {
    let chatList = await Chat.find({
      users: { $elemMatch: { $eq: req.user.id } },
    })
      .populate("users", "name email pic")
      .populate("groupAdmin", "name email pic")
      .populate("latestMessage")
      .sort({ updatedAt: -1 });

    chatList = await User.populate(chatList, {
      path: "latestMessage.sender latestMessage.readBy",
      select: "name pic email",
    });

    let 
    chatListArray = [];

    for (let chat of chatList) {
      let obj = {};
      let unreadMessageCount = await Message.countDocuments({
        chat: chat._id,
        $and: [{ sender: { $ne: req.user.id }, readBy: { $nin: req.user.id } }],
      });

      chat.unreadMessageCount = unreadMessageCount;
      obj.chat = chat;
      obj.unreadMessageCount = unreadMessageCount;
      chatListArray.push(obj);
    }

    return res.status(200).json({
      status: 200,
      message: "Chat List Fetched",
      chatListArray,
    });
  } catch (error) {
    return res.status(500).json({
      status: 500,
      msg: "Failed to fetch Chat List" + error,
    });
  }
};

exports.createGroupChat = async (req, res) => {
  let blankFields = [];
  if (!req.body.name) {
    blankFields.push(" Group name ");
  }
  if (!req.body.group_members) {
    blankFields.push(" Group members ");
  }

  if (blankFields.length > 0) {
    return res.status(400).json({
      status: 400,
      message: `${blankFields} required to create group chat`,
    });
  }

  for (let userID of req.body.group_members) {
    let checkUserID = await User.findOne({
      _id: userID,
      "organisation_list.organisation": req.user.organisation.organisation,
    });

    if (!checkUserID) {
      return res.status(400).json({
        status: 400,
        msg: "User Not Found",
      });
    }
  }

  let group_members = req.body.group_members;
  group_members.push(req.user.id);

  if (group_members.length <= 2) {
    return res.status(400).send({
      status: 400,
      message: "More than 2 users are required to create group chat",
    });
  }

  try {
    const groupChat = await Chat.create({
      chatName: req.body.name,
      users: group_members,
      isGroupChat: true,
      groupAdmin: req.user.id,
    });

    const fullGroupChat = await Chat.findOne({ _id: groupChat._id }).populate(
      "users groupAdmin",
      "name email pic"
    );

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
