const Chat = require("../models/chatModel");
const Message = require("../models/messageModel");
const User = require("../models/user");
exports.allMessages = async (req, res) => {
  try {
    const messages = await Message.find({ chat: req.params.chatId })
      .populate("sender", "name pic email")
      .populate("chat");

    return res.json(messages);
  } catch (error) {
    res.status(400).json({ message: error });
    throw new Error(error.message);
  }
};

exports.sendMessage = async (req, res) => {
  let { content, chatId, contentType } = req.body;

  // if (!content || !chatId) {
  //   console.log("Invalid data passed into request");
  //   return res.sendStatus(400);
  // }
  console.log(req.body);

  var newMessage = {
    sender: req.user._id,
    content: content,
    chat: chatId,
    contentType: contentType,
  };
  chatId = JSON.parse(chatId);
  newMessage.chat = chatId;
  const bb = busboy({ headers: req.headers });
  let filename;
  bb.on("file", (name, file, info) => {
    let { encoding, mimeType } = info;
    filename = info.filename;
    // console.log("file", info);
    newMessage.contentType = mimeType;
    let downloaded = 0;
    // const saveTo = path.join(".", filename);
    const saveTo = `${__dirname}/../public/images/${filename}`;
    // console.log(saveTo);
    newMessage.file = `/images/${filename}`;
    file.pipe(fs.createWriteStream(saveTo));
    file.on("data", (chunk) => {});
  });

  // chatId = JSON.parse(chatId);
  // newMessage.chat = chatId;
  // newMessage.contentType = req.files.file.mimetype;
  // if (req.files && req.files.file) {
  // newMessage.file = req.files.file.data;

  // req.files.file.mv(
  //   `${__dirname}/../public/images/${req.files.file.name}`,
  //   (err) => {
  //     console.log(err);
  //   }
  // );
  // newMessage.file = `/images/${req.files.file.name}`;
  // }

  // console.log(newMessage);
  bb.on("close", async () => {
    try {
      var message = await Message.create(newMessage);

      message = await message
        .populate("sender", "name pic email")
        .execPopulate();
      message = await message.populate("chat").execPopulate();
      // console.log(message);
      message = await User.populate(message, {
        path: "chat.users",
        select: "name pic email",
      });

      // console.log(message);
      await Chat.findByIdAndUpdate(chatId, { latestMessage: message });

      return res.json(message);
    } catch (error) {
      console.log(error);
      res.status(400).json({ message: error });
      throw new Error(error.message);
    }
  });
};
