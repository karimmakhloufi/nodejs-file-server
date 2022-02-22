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
    cb(null, "files/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage: storage });

const app = express();
const port = 3000;

app.post("/test", (req, res) => {
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
    "SELECT * FROM `potentialUsers` WHERE `email` = ? AND `token` = ?",
    [req.query.email, req.query.token]
  );
  console.log("before rows");
  console.log("rows", rows);
  if (rows.length > 0) {
    const [rows] = await connection.execute(
      "INSERT INTO `users` (email, token) VALUES (?, ?)",
      [req.query.email, req.query.token]
    );
    res.send("Your token is now valid: " + req.query.token);
  }
  res.send("Error confirming your token, contact your instructor");
});

app.get("/getToken", async (req, res) => {
  console.log(req.query.email);
  const domain = req.query.email.split("@")[1];
  if (domain === "wilder.school" || domain === "wildcodeschool.com") {
    const id = uuidv4();

    const [rows] = await connection.execute(
      "SELECT * FROM users WHERE email = ?",
      [req.query.email]
    );

    if (rows.length === 0) {
      try {
        await connection.execute(
          "INSERT INTO potentialUsers (email, token) VALUES (?, ?)",
          [req.query.email, id]
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
          "<p>Copy and paste this link in your browser to confirm your email https://wildstagram.nausicaa.wilders.dev/confirmEmail?email=" +
          req.query.email +
          "&token=" +
          id,
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
    } else {
      res.send("email exists and is already active, contact your instructor");
    }
  } else {
    res.send("enter a wildcodeschool.com email");
  }
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

app.post("/upload", upload.single("fileData"), async (req, res) => {
  console.log("timestamp " + Date.now());
  console.log(req.headers.authorization);
  if (req.headers.authorization.split("Bearer ")[1]) {
    const [rows] = await connection.execute(
      "SELECT * FROM `users` WHERE `token` = ?",
      [req.headers.authorization.split("Bearer ")[1]]
    );

    if (rows.length > 0) {
      console.log(req.file.path);
      fs.readFile(req.file.path, (err, contents) => {
        if (err) {
          console.log("Error: ", err);
          res.status(500).json({ error: err });
        } else {
          res.status(201).json({ status: "success" });
        }
      });
    } else {
      console.log("rows is not > 0");
      res.send("Token error");
    }
  } else {
    console.log("bearer is not here");
    res.send("Token error");
  }
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
