require("dotenv").config();
const mysql = require("mysql2/promise");
const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

let connection;

const createConnectionToDB = async () => {
  connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    database: process.env.MYSQL_DB,
    password: process.env.MYSQL_PASSWORD,
  });
};

createConnectionToDB();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    console.log("token", req.headers.authorization);
    console.log("file", file);
    cb(null, "files/");
  },
  filename: function (req, file, cb) {
    console.log("token", req.headers.authorization);
    console.log("filename", Date.now() + file.originalname);
    cb(null, file.originalname);
  },
});
const upload = multer({ storage: storage });

const app = express();
const port = 3000;

const verifyToken = async (req, res, next) => {
  console.log(req.headers.authorization);
  if (req.headers.authorization.split("Bearer ")[1]) {
    console.log("bearer is here");
    const [rows] = await connection.execute(
      "SELECT * FROM `users` WHERE `token` = ? AND `isVerified` = ?",
      [req.headers.authorization.split("Bearer ")[1], true]
    );

    console.log(rows);

    if (rows.length > 0) {
      console.log("rows.length is > 0");
      next(req, res);
    } else {
      console.log("rows is not > 0");
      res.send("Token error");
    }
  } else {
    console.log("bearer is not here");
    res.send("Token error");
  }
};

app.post("/test", verifyToken, (req, res) => {
  res.status(201).json({ status: "success" });
});

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.get("/confirmEmail", async (req, res) => {
  console.log("email", req.query.email);
  console.log("token", req.query.token);

  console.log("before select");
  const [rows] = await connection.execute(
    "SELECT * FROM `users` WHERE `email` = ? AND `token` = ? AND `isVerified` = ?",
    [req.query.email, req.query.token, false]
  );
  console.log("before rows");
  console.log("rows", rows);
  if (rows.length > 0) {
    const [rows] = await connection.execute(
      "UPDATE `users` SET isVerified = ? WHERE `email` = ?",
      [true, req.query.email]
    );
    res.send("Your token is now valid: " + req.query.token);
  }
  res.send("Error confirming your token, contact your instructor");
});

app.get("/getToken", async (req, res) => {
  console.log(req.query.email);
  const id = uuidv4();
  try {
    await connection.execute(
      "INSERT INTO users (email, token, isVerified) VALUES (?, ?, ?)",
      [req.query.email, id, false]
    );
  } catch (err) {
    console.log("error while inserting data in db", err);
  }

  const msg = {
    to: req.query.email, // Change to your recipient
    from: "noreply@wildcodeschool.com", // Change to your verified sender
    subject: "Confirm your email",
    text:
      "copy and paste this link in your browser https://wildstagram.nausicaa.wilders.dev/confirmEmail?email=" +
      req.query.email +
      "&token=" +
      id,
    html:
      "<p>Click this link to confirm your email <a clicktracking='off' https://wildstagram.nausicaa.wilders.dev/confirmEmail?email=" +
      req.query.email +
      "&token=" +
      id +
      ">Clickme</a>",
  };

  sgMail
    .send(msg)
    .then((response) => {
      console.log(response[0].statusCode);
      console.log(response[0].headers);
    })
    .catch((error) => {
      console.error(error);
    });

  res.send("check you email to confirm");
});

app.get("/createToken", (req, res) => {
  res.set("Content-Type", "text/html");
  res.send(
    Buffer.from(`
      <form action="/getToken" method="get">
      <div>
        <label for="email">Enter your wildcodeschool email: </label>
        <input type="text" name="email" id="email" required>
      </div>
      <div>
        <input type="submit" value="Get Token!">
      </div>
    </form>`)
  );
});

app.post("/upload", verifyToken, upload.single("fileData"), (req, res) => {
  fs.readFile(req.file.path, (err, contents) => {
    if (err) {
      console.log("Error: ", err);
      res.status(500).json({ error: err });
    } else {
      console.log("File contents ", contents);
      console.log("filename", req.file.path);
      console.log("file uploaded by", req.headers.authorization);
      res.status(201).json({ status: "success" });
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
