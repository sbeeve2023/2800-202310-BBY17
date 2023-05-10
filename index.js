
//Express
const express = require("express");
const session = require("express-session");
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use("/public", express.static("./public"));
//EJS
app.set('view engine', 'ejs');

//Security
const Joi = require("joi");
const bcrypt = require("bcrypt");
const { error } = require("console");
const saltRounds = 12;
const sessionExpireTime = 1000 * 60 * 60 * 24 * 7; // 1 week
require('dotenv').config();

//Mongo 
const MongoStore = require("connect-mongo");
const { MongoClient, ServerApiVersion } = require("mongodb");
var port = process.env.PORT || 8000;
//ENV Variables
const mongodb_user = process.env.MONGODB_USER;
const mongodb_password = process.env.MONGODB_PASSWORD;
const mongodb_host = process.env.MONGODB_HOST;
const mongodb_session_secret = process.env.MONGODB_SECRET;
const mongodb_database = process.env.MONGODB_DATABASE;
const node_session_secret = process.env.NODE_SESSION_SECRET;

//Session Store for Mongo
var mongoStore = MongoStore.create({
  mongoUrl: `mongodb+srv://${mongodb_user}:${mongodb_password}@${mongodb_host}/sessions`,
  crypto: {
    secret: mongodb_session_secret,
  },
});

//to connect to the database do  await client.connect() and then  await client.db("database_name") to get the database
const uri = `mongodb+srv://${mongodb_user}:${mongodb_password}@${mongodb_host}/${mongodb_database}`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

//Connect to Database, start server, and set up user collection.
async function connectToDatabase() {
  try {
    await client.connect();
    client.db(mongodb_database).command({ ping: 1 });
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("Error connecting to MongoDB: " + error);
  }
}
connectToDatabase();
const database = client.db(mongodb_database);
const userCollection = database.collection("users");

//Enables Cookies in Express
app.use(session({
  secret: node_session_secret,
  store: mongoStore,
  saveUninitialized: true,
  resave: true
})
);

////////////////////////////////////////////////////////////////
// APP ROUTES //////////////////////////////////////////////////
////////////////////////////////////////////////////////////////


//Landing Page
app.get("/", async (req, res) => {
  if(!req.session.authenticated){
    res.render("landing-loggedout");
    return;
  }

  var user = await userCollection.findOne({username: req.session.username});
  res.render("landing-loggedin", {username: user.username});
});


//Sign Up
app.get("/signup", (req, res) => {
  if(req.session.authenticated){
    res.redirect("/");
    return;
  }
  res.render("signup");
});
app.post("/signup-submit", async (req, res) => {
  let fname = req.body.firstname;
  let lname = req.body.lastname;
  let username = req.body.username;
  let email = req.body.email;
  let password = req.body.password;

  //Validate input
  const schema = Joi.object({
    fname: Joi.string().alphanum().max(30).required(),
    lname: Joi.string().alphanum().max(30).required(),
    username: Joi.string().alphanum().max(30).required(),
    email: Joi.string().email().required(),
    password: Joi.string().max(30).required(),
  });
  const result = schema.validate({fname, lname, username, email, password});

  //Check if username or email is taken
  var userTaken = await userCollection.find({username: username}).toArray();
  var emailTaken = await userCollection.find({email: email}).toArray();
  if(result.error != null || userTaken.length != 0 || emailTaken.length != 0){
    res.redirect("/signup");
    return;
  }

  //Save new user to database
  var hashedPassword = await bcrypt.hash(password, saltRounds);
  await userCollection.insertOne({firstname: fname, lastname: lname, username: username, email: email, password: hashedPassword});

  //Make a cookie
  req.session.authenticated = true;
  req.session.firstname = fname;
  req.session.lastname = lname;
  req.session.username = username;
  req.session.email = email;
  req.session.cookie.maxAge = sessionExpireTime;

  res.redirect("/");

});


//Login
app.get("/login", (req, res) => {
  if(req.session.authenticated){
    res.redirect("/");
    return;
  }
  var error = req.query.error != null;
  res.render("login", {error: error});
});
app.post("/login-submit", async (req, res) => {
  var username = req.body.username;
  var password = req.body.password;

  //Validate input with Joi
  const schema = Joi.string().alphanum().max(30).required()
  const result = schema.validate(username);
  if(result.error != null){
    res.redirect("/login?error=true");
    return;
  }
  //Check if user exists
  const findUser = await userCollection.findOne({username: username});
  if(findUser == null){
    res.redirect("/login?error=true");
    return;
  }

  //Check if password is correct
  if(await bcrypt.compare(password, findUser.password)){
    //Make a cookie
    console.log(findUser);
    req.session.authenticated = true;
    req.session.firstname = findUser.firstname;
    req.session.lastname = findUser.lastname;
    req.session.username = findUser.username;
    req.session.email = findUser.email;
    req.session.cookie.maxAge = sessionExpireTime;
    res.redirect("/");
    return;
  }else{
    res.redirect("/login?error=true");
    return;
  }
});

//Profile
app.get("/profile", async (req, res) => {
  if(!req.session.authenticated){
    res.redirect("/login");
    return;
  }
  res.render("profile", {session: req.session});
});

//Change Password
app.get("/change-password", async (req, res) => {
  if(!req.session.authenticated){
    res.redirect("/login");
    return;
  }
  res.render("change-password", {error: req.query.error});
});
app.post("/change-password-submit", async (req, res) => {
  if(!req.session.authenticated){
    res.redirect("/login");
    return;
  }
  var email = req.body.email;
  var oldPassword = req.body.oldPassword;
  var newPassword = req.body.newPassword;
  var newPasswordConfirm = req.body.newPasswordConfirm;

  //Validate input with Joi
  const schema = Joi.string().email().required();
  const result = schema.validate(email);
  if(result.error != null){
    res.redirect("/change-password?error=email-invalid");
    return;
  }
  //Check if user exists
  const findUser = await userCollection.findOne({email: email});
  if(findUser == null){
    res.redirect("/change-password?error=email-invalid");
    return;
  }

  //Check if old password is correct
  if(!await bcrypt.compare(oldPassword, findUser.password)){
    res.redirect("/change-password?error=password-incorrect");
    return;
  }

   //Check that new pasword does not match old password
   if(newPassword == oldPassword){
    res.redirect("/change-password?error=password-same");
    return;
   }

  //Check if new passwords match
  if(newPassword != newPasswordConfirm){
    res.redirect("/change-password?error=password-mismatch");
    return;
  }

  //Update password
  var hashedPassword = await bcrypt.hash(newPassword, saltRounds);
  await userCollection.updateOne({email: email}, {$set: {password: hashedPassword}});

  //Confirm Change
  req.session.destroy(()=>{
    res.redirect("/changed-password");
  });
 
});
  app.get("/changed-password", (req, res) => {
  res.render("changed-password");
});


//Logout
app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/");
});


//404
app.get("/*", (req, res) => {
  res.send("404, page not found");
});


//Start server
app.listen(port, () => {
  console.log("Server running on port " + port);
});
