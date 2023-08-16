const Chat = require("../models/chatModel");
const Message = require("../models/messageModel");
const User = require("../models/user");

exports.searchInChat = async (req, res) => {
  try {
    const searchData = req.query.search;

    if (!searchData) {
      return res.status(500).send({
        status: 500,
        message: "Can not search blank",
      });
    }

    const userQuery = {
      $and: [
        {
          _id: { $ne: req.user.id },
        },
        {
          name: { $regex: searchData, $options: "i" },
        },
        {
          organisation_list: {
            $elemMatch: {
              organisation: req.user.organisation.organisation,
              status: "approved",
            },
          },
        },
      ],
    };

    const chatQuery = {
      isGroupChat: true,
      chatName: { $regex: searchData, $options: "i" },
      users: { $elemMatch: { $eq: req.user.id } },
    };

    let data = {};

    const filterChat = await Chat.find(chatQuery);
    data.groupChats = filterChat;

    const filterUser = await User.find(userQuery, {
      name: 1,
      email: 1,
      pic: 1,
    });
    data.peoples = filterUser;

    return res.status(200).send({
      status: 200,
      message: "Data Fetched",
      data,
    });
  } catch (err) {
    return res.status(500).send({
      status: 500,
      message: "Failed to search in chat " + err,
    });
  }
};

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

    let chatListArray = [];

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
  try {
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

    if (req.body.group_members < 1) {
      return res.status(400).json({
        status: 400,
        message: "Select atleast one member",
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

    let findGroupName = await Chat.find({
      isGroupChat: true,
      chatName: req.body.name,
      users: { $elemMatch: { $in: group_members } },
    });

    if (findGroupName.length > 0) {
      return res.status(400).send({
        status: 400,
        message: "Can not create a group with already exist group name",
      });
    }

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
  try {
    const { chatId, chatName } = req.body;
    let blankFields = [];

    if (!chatId) {
      blankFields.push(" ChatId ");
    }
    if (!chatName) {
      blankFields.push(" Chat Name ");
    }

    if (blankFields.length > 0) {
      return res.status(400).json({
        status: 400,
        message: `${blankFields} required to rename group`,
      });
    }

    let groupData = await Chat.findById(chatId);

    let findGroupName = await Chat.find({
      _id: { $ne: chatId },
      isGroupChat: true,
      chatName: chatName,
      users: { $elemMatch: { $in: groupData.users } },
    });

    if (findGroupName.length > 0) {
      return res.status(400).send({
        status: 400,
        message: "Can not rename a group with already exist group name",
      });
    }

    const updatedChat = await Chat.findByIdAndUpdate(
      chatId,
      {
        chatName: chatName,
      },
      {
        new: true,
      }
    ).populate("users groupAdmin", "name email pic");

    if (!updatedChat) {
      return res.status(400).send({
        status: 400,
        message: "Failed to rename group",
      });
    } else {
      return res.status(200).send({
        status: 200,
        message: "Successfully renamed group",
        updatedChat,
      });
    }
  } catch (err) {
    return res.status(500).send({
      status: 500,
      message: "Failed to rename group" + err,
    });
  }
};

exports.removeFromGroup = async (req, res) => {
  try {
    const { chatId, userId } = req.body;
    let blankFields = [];

    if (!chatId) {
      blankFields.push(" ChatId ");
    }
    if (!userId) {
      blankFields.push(" UserId ");
    }

    if (blankFields.length > 0) {
      return res.status(400).json({
        status: 400,
        message: `${blankFields} required to remove group member`,
      });
    }

    const groupData = await Chat.findOne({
      _id: chatId,
      users: userId,
    });

    if (!groupData) {
      return res.status(200).json({
        status: 200,
        message: "The member you want to remove does not exist in the group",
      });
    }

    const removed = await Chat.findByIdAndUpdate(
      chatId,
      {
        $pull: { users: userId },
      },
      {
        new: true,
      }
    ).populate("users groupAdmin", "name email pic");

    if (!removed) {
      return res.status(400).send({
        status: 400,
        message: "Failed to remove group member",
      });
    } else {
      return res.status(200).send({
        status: 200,
        message: "Successfully removed group member",
        removed,
      });
    }
  } catch (err) {
    return res.status(500).send({
      status: 500,
      message: "Failed to remove group member " + err,
    });
  }
};

exports.addToGroup = async (req, res) => {
  try {
    const { chatId, userId } = req.body;
    let blankFields = [];

    if (!chatId) {
      blankFields.push(" ChatId ");
    }
    if (!userId) {
      blankFields.push(" UserId ");
    }

    if (blankFields.length > 0) {
      return res.status(400).json({
        status: 400,
        message: `${blankFields} required to add group member`,
      });
    }

    const groupData = await Chat.findOne({
      _id: chatId,
      users: userId,
    });

    if (groupData) {
      return res.status(200).json({
        status: 200,
        message: "This member is already exist in the group",
      });
    }

    const memberAdded = await Chat.findByIdAndUpdate(
      chatId,
      {
        $push: { users: userId },
      },
      {
        new: true,
      }
    ).populate("users groupAdmin", "name email pic");

    if (!memberAdded) {
      return res.status(400).send({
        status: 400,
        message: "Failed to add group member",
      });
    } else {
      return res.status(200).send({
        status: 200,
        message: "Successfully added group member",
        memberAdded,
      });
    }
  } catch (err) {
    return res.status(500).send({
      status: 500,
      message: "Failed to add group member " + err,
    });
  }
};
