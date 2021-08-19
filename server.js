const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "files/");
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});
const upload = multer({ storage: storage });

const app = express();
const port = 3000;

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.post("/upload", upload.single("fileData"), (req, res, next) => {
  fs.readFile(req.file.path, (err, contents) => {
    if (err) {
      console.log("Error: ", err);
      res.send("error");
    } else {
      console.log("File contents ", contents);
      res.send("okay");
    }
  });
});

app.get("/list", (req, res) => {
  fs.readdir("files", (err, files) => {
    if (err) {
      console.log(err);
      res.writeHead(400, { "Content-Type": "application/json" });
      res.write(JSON.stringify(err.message));
      res.end();
    } else {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.write(JSON.stringify(files));
      res.end();
    }
  });
});
app.get("/files/:filename", (req, res) => {
  let file = path.join(__dirname + "/files", req.params.filename);
  console.log("file", file);
  fs.readFile(file, (err, content) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text" });
      res.write("File Not Found!");
      res.end();
    } else {
      res.writeHead(200, { "Content-Type": "application/octet-stream" });
      res.write(content);
      res.end();
    }
  });
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
