const express = require("express");
const session = require("express-session");

const MongoStore = require("connect-mongo");
const bcrypt = require("bcrypt");
const app = express();
app.use(express.json());
const saltRounds = 12;
const { MongoClient } = require("mongodb");

const mongodb_user = process.env.MONGODB_USER;
const mongodb_password = process.env.MONGODB_PASSWORD;
const mongodb_host = process.env.MONGODB_HOST;
const mongodb_session_secret = process.env.MONGODB_SECRET;
const mongodb_database = process.env.MONGODB_DATABASE;

const node_session_secret = process.env.NODE_SESSION_SECRET;

//to connect to the database do  await client.connect() and then  await client.db("database_name") to get the database
const uri = mongodb_database;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

var mongoStore = MongoStore.create({
  mongoUrl: `mongodb+srv://${mongodb_user}:${mongodb_password}@${mongodb_host}/sessions`,
  crypto: {
    secret: mongodb_session_secret,
  },
});
app.use(session({
  secret: "secret",
  resave: true,
  saveUninitialized: true
})
);

var port = process.env.PORT || 8000;
app.use("/public", express.static("./public"));

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.get("/*", (req, res) => {
  res.send("404, page not found");
});

app.listen(port, () => {
  console.log("Server running on port " + port);
});
