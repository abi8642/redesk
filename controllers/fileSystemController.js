const File = require("../models/FileSystem");
const Folder = require("../models/FolderSystem");
const fs = require("fs");
const busboy = require("busboy");
const os = require("os");
var path = require("path");

exports.createFolder = async (req, res) => {
  try {
    const user = req.user;
    const { folderName, parent } = req.body;

    let parentList = [];
    if (parent) {
      const parentFolder = await Folder.findOne({
        _id: parent,
        $or: [{ owner: user._id }, { accessTo: user._id }],
        // owner: "646ca9e9a4d0ed9412fb94e5",
      });
      if (!parentFolder) {
        return res.status(400).json({ msg: "Parent Folder Issue Auth" });
      }
      if (parentFolder)
        parentList = [...parentFolder.parentList, parentFolder._id];
    }

    const folder = await Folder.create({
      folderName,
      parent: parent ? parent : null,
      parentList: parent ? parentList : [],
      //   owner: req.user._id,
      owner: user._id,
    });

    return res.status(201).json({ folder });
  } catch (err) {}
};

exports.folderList = async (req, res) => {
  const user = req.user;
  try {
    let query = {};
    if (!req.query.parentId) {
      query = {
        parent: null,
        $or: [{ owner: user._id }, { accessTo: user._id }],
      };
    } else {
      query = {
        parent: req.query.parentId,
        $or: [{ owner: user._id }, { accessTo: user._id }],
      };
    }
    const folders = await Folder.find(query);

    return res.status(200).json({ folders });
  } catch (err) {
    return res.status(400).json({ msg: "not found" });
  }
};

exports.fileList = async (req, res) => {
  const user = req.user;
  try {
    let query = {};
    if (!req.query.parentId) {
      query = {
        parent: null,
        $or: [{ owner: user._id }, { accessTo: user._id }],
      };
    } else {
      query = {
        parent: req.query.parentId,
        $or: [{ owner: user._id }, { accessTo: user._id }],
      };
    }
    const files = await File.find(query);

    return res.status(200).json({ files });
  } catch (err) {
    return res.status(400).json({ msg: "not found" });
  }
};

exports.uploadFile = async (req, res) => {
  const user = req.user;
  const { parent } = req.body;
  try {
    let parentList = [];
    if (parent) {
      const parentFolder = await Folder.findOne({
        _id: parent,
        // owner: "646ca9e9a4d0ed9412fb94e5",
      });

      if (!parentFolder)
        return res.status(400).json({ msg: "parent not found" });
      parentList = [...parentFolder.parentList, parentFolder._id];
    }

    const bb = busboy({ headers: req.headers });
    // console.log(bb);
    let filename = "";
    bb.on("file", (name, file, info) => {
      const { encoding, mimeType } = info;
      filename = info.filename;
      // console.log(info);
      // return;
      // console.log(name);
      let downloaded = 0;
      const saveTo = `${__dirname}/../public/images/${filename}`;
      console.log(saveTo);
      file.pipe(fs.createWriteStream(saveTo));
      file.on("data", (chunk) => {
        // downloaded += chunk.length;
        // console.log(chunk.length);
        // process.stdout.write(
        //   `Downloaded ${(downloaded / 1000000).toFixed(2)} MB of ${filename}\r`
        // );
      });
    });
    bb.on("close", async () => {
      const file = await File.create({
        fileName: filename,
        parent: parent ? parent : null,
        parentList: parent ? parentList : [],
        url: `/images/${filename}`,
        owner: user._id,
      });
      if (!file) return res.status(400).json({ msg: "file not created" });

      return res.status(201).json({ file });

      // res.writeHead(200, { Connection: "close" });
      // res.end(`That's all folks!`);
    });
    req.pipe(bb);
    return;
  } catch (err) {
    return res.status(400).json({ msg: "not found" + err });
  }

  // req.files.file.mv(
  //   `${__dirname}/../public/images/${req.files.file.name}`,
  //   (err) => {
  //     console.log(err);
  //   }
  // );
};

exports.requestFile = async (req, res) => {
  const user = req.user;
  const { fileId } = req.body;
  try {
    const file = await File.findOne({
      _id: fileId,
      $or: [{ owner: user._id }, { accessTo: user._id }],
    });
    console.log(fileId);
    if (!file) return res.status(400).json({ msg: "file not found" });
    return res.status(200).download(`${__dirname}/../public/${file.url}`);
  } catch (err) {
    return res.status(400).json({ msg: "not found" });
  }
};

exports.giveAccess = async (req, res) => {
  const user = req.user;
  const { type, userId, typeId } = req.body;

  try {
    if (type == "file") {
      const file = await File.findOneAndUpdate(
        { _id: typeId, owner: user._id },
        {
          $addToSet: { accessTo: userId },
        },
        { new: true }
      );
      if (!file) return res.status(400).json({ msg: "file not found" });
      return res.status(200).json({ file });
    }
    if (type == "folder") {
      const folder = await Folder.findOneAndUpdate(
        { _id: typeId, owner: user._id },
        {
          $addToSet: { accessTo: userId },
        },
        { new: true }
      );
      if (!folder) return res.status(400).json({ msg: "folder not found" });
      return res.status(200).json({ folder });
    }
  } catch (err) {
    return res.status(400).json({ msg: "not found" });
  }
};
