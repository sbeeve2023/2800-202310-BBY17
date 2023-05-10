const express = require("express");
const session = require("express-session");
require("./utils.js");

const MongoStore = require("connect-mongo");
const bcrypt = require("bcrypt");
const app = express();
require('dotenv').config();
app.use(express.json());
const saltRounds = 12;
const { MongoClient, ServerApiVersion } = require("mongodb");

const mongodb_user = process.env.MONGODB_USER;
const mongodb_password = process.env.MONGODB_PASSWORD;
const mongodb_host = process.env.MONGODB_HOST;
const mongodb_session_secret = process.env.MONGODB_SECRET;
const mongodb_database = process.env.MONGODB_DATABASE;

const node_session_secret = process.env.NODE_SESSION_SECRET;

var {database} = include('connections');

const recipeCollection = database.db(mongodb_database).collection('recipes');

//to connect to the database do  await client.connect() and then  await client.db("database_name") to get the database
const uri = `mongodb+srv://${mongodb_user}:${mongodb_password}@${mongodb_host}/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

var mongoStore = MongoStore.create({
  mongoUrl: `mongodb+srv://${mongodb_user}:${mongodb_password}@${mongodb_host}/?retryWrites=true&w=majority`,
  crypto: {
    secret: mongodb_session_secret,
  },
});

MongoClient.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('Connected to MongoDB successfully!');
  })
  .catch((error) => {
    console.log('Error connecting to MongoDB:', error);
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

app.get("/dbtest", async (req, res) => {
  var html = "";
  var read = await recipeCollection.find({}).limit(10).toArray();
  console.log(read);

  for (let i = 0; i < read.length; i++){
    html += "<p>" + read[i].name + "<ul>";
    var ing = JSON.parse(read[i].ingredients)

    for (let j = 0; j < ing.length; j++){
      console.log();
      html += "<li>" + ing[j]; + "</li>";
    }

    html += "</ul></p>"
  }
  res.send(html);
});

app.get("/*", (req, res) => {
  res.send("404, page not found");
});

app.listen(port, () => {
  console.log("Server running on port " + port);
});
