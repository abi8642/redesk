const Chat = require("../models/chatModel");
const Message = require("../models/messageModel");
const User = require("../models/user");

exports.allMessages = async (req, res) => {
  try {
    if (!req.params.chatId) {
      res.status(400).json({
        status: 400,
        message: "Chat ID is required",
      });
    }

    await Message.updateMany(
      { chat: req.params.chatId, sender: { $ne: req.user.id } },
      { $addToSet: { readBy: req.user.id } }
    );

    const messages = await Message.find({ chat: req.params.chatId })
      .populate("sender", "name pic email")
      .populate("chat");

    return res.status(200).json({
      status: 200,
      message: "Chat message fetched",
      messages,
    });
  } catch (error) {
    res.status(400).json({
      status: 400,
      message: "Failed to get chat message" + error,
    });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    let { content, chatId, contentType } = req.body;

    let blankFields = [];

    if (!contentType) {
      blankFields.push(" contentType ");
    }
    if (!content) {
      blankFields.push(" content ");
    }
    if (!chatId) {
      blankFields.push(" chatId ");
    }

    if (blankFields.length > 0) {
      return res.status(400).send({
        status: 400,
        message: `${blankFields} cannot be blank`,
      });
    }

    var newMessage = {
      sender: req.user.id,
      content: content,
      chat: chatId,
      contentType: contentType,
    };

    if (req.file) {
      if (req.files !== null && req.files.file) {
        newMessage.contentType = mimeType;
        newMessage.file = `/images/${req.files.file.name}`;

        await req.files.file.mv(
          `${__dirname}/../public/images/${req.files.file.name}`,
          (err) => {
            if (err) {
              return res.status(400).send({
                status: 400,
                message: "Failed Send File" + err,
              });
            }
          }
        );
      }
    }

    var message = await Message.create(newMessage);

    await Chat.findByIdAndUpdate(chatId, { latestMessage: message._id });
    message = await message.populate("sender", "name pic email").execPopulate();
    message = await message.populate("chat").execPopulate();
    message = await User.populate(message, {
      path: "chat.users",
      select: "name pic email",
    });

    return res.status(200).json({
      status: 200,
      message: "Message sent successfully",
      message,
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: "Failed to send message" + error,
    });
  }
};
