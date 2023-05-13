//Express
const express = require("express");
const session = require("express-session");
require("./utils.js");

const app = express();
app.use(express.json());
app.use(express.urlencoded({
  extended: false
}));
app.use("/public", express.static("./public"));
app.use('/styles', express.static('styles'));
//body parser
const bodyParser = require("body-parser");
var urlencodedParser = bodyParser.urlencoded({
  extended: false
});
//EJS
app.set('view engine', 'ejs');

//tailwind
const tailwindcss = require("tailwindcss");

//Security
const Joi = require("joi");
const bcrypt = require("bcrypt");
const {
  error
} = require("console");
const saltRounds = 12;
const sessionExpireTime = 1000 * 60 * 60 * 24 * 7; // 1 week
require('dotenv').config();

//Mongo 
const MongoStore = require("connect-mongo");
const {
  MongoClient,
  ServerApiVersion
} = require("mongodb");
const {
  ObjectId
} = require('mongodb');
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

const uri = `mongodb+srv://${mongodb_user}:${mongodb_password}@${mongodb_host}/${mongodb_database}`;


//to connect to the database do  await client.connect() and then  await client.db("database_name") to get the database
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
    client.db(mongodb_database).command({
      ping: 1
    });
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("Error connecting to MongoDB: " + error);
  }
}
connectToDatabase();
const database = client.db(mongodb_database);
const userCollection = database.collection("users");
const recipeCollection = database.collection('recipes');
const restrictionsArray = ["vegetarian", "vegan", "gluten-free", "dairy-free", "nut-free",
 "kosher", "halal", "pescatarian", "paleo", "low-sodium", "low-carb", "low-fat",
  "low-sugar", "organic", "raw", "whole30", "keto", "mediterranean", "south-beach",
   "weight-watchers", "fodmap-friendly", "anti-inflammatory",
    "egg-free", "fish-free", "low-fodmap", "pork-free", "red-meat-free",
     "sesame-free", "shellfish-free", "soy-free", "sugar-conscious", "treenut-free",
      "wheat-free", "alcohol-free", "immuno-supportive", "celery-free",
       "crustacean-free", "lupine-free"]


//Enables Cookies in Express
app.use(session({
  secret: node_session_secret,
  store: mongoStore,
  saveUninitialized: true,
  resave: true
}));


//middleware to check if user is logged in
const sessionValidation = (req, res, next) => {
  res.locals.validSession = req.session.authenticated;
  next();
};

// Attach middleware function to the app
app.use(sessionValidation);

////////////////////////////////////////////////////////////////
// APP ROUTES //////////////////////////////////////////////////
////////////////////////////////////////////////////////////////


//Landing Page
app.get("/", async (req, res) => {
  if (!req.session.authenticated) {
    res.render("landing-loggedout");
    return;
  }

  var user = await userCollection.findOne({
    username: req.session.username
  });
  res.render("landing-loggedin", {
    username: req.session.username
  });
});

//Sign Up
app.get("/signup", (req, res) => {
  if (req.session.authenticated) {
    res.redirect("/");
    return;
  }
  res.render("signup", {
    error: req.query.error
  });
});
app.post("/signup-submit", async (req, res) => {
  let fname = req.body.firstname;
  let lname = req.body.lastname;
  let username = req.body.username;
  let email = req.body.email.toLowerCase();
  let password = req.body.password;
  var passwordConfirm = req.body.passwordConfirm;


  //Validate input
  const schema = Joi.object({
    fname: Joi.string().alphanum().max(30).required(),
    lname: Joi.string().alphanum().max(30).required(),
    username: Joi.string().alphanum().max(30).required(),
    email: Joi.string().email().required(),
    password: Joi.string().max(30).required(),
    passwordConfirm: Joi.string().max(30).required()
  });
  const result = schema.validate({
    fname,
    lname,
    username,
    email,
    password,
    passwordConfirm,
  });
  if (result.error != null) {
    console.log(result.error);
    res.redirect("/signup?error=invalid-input");
    return;
  }

  //Check if username is taken
  var userTaken = await userCollection.find({username: { $regex: new RegExp(username, "i")}}).toArray();
  if (userTaken.length != 0) {
    res.redirect("/signup?error=username-taken");
    return;
  }

  //Check if email is taken
  var emailTaken = await userCollection.find({email: email }).toArray();
  if (emailTaken.length != 0) {
    res.redirect("/signup?error=email-taken");
    return;
  }

  //Check if new passwords match
  if (password != passwordConfirm) {
    console.log(password + " | " + passwordConfirm)
    res.redirect("/signup?error=passwords-dont-match");
    return;
  }

  //Save new user to database
  var hashedPassword = await bcrypt.hash(password, saltRounds);
  await userCollection.insertOne({
    firstname: fname,
    lastname: lname,
    username: username,
    email: email,
    password: hashedPassword
  });

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

  if (req.session.authenticated) {
    res.redirect("/");
    return;
  }
  var error = req.query.error != null;
  res.render("login", {
    error: error
  });
});
app.post("/login-submit", async (req, res) => {
  var username = req.body.username.toLowerCase();
  var password = req.body.password;

  //Validate input with Joi
  const schema = Joi.string().alphanum().max(30).required()
  const result = schema.validate(username);
  if (result.error != null) {
    res.redirect("/login?error=true");
    return;
  }
  //Check if user exists
  const findUser = await userCollection.findOne({
    username: { $regex: new RegExp(username, "i")} //Regex with 'i' makes it case insensitive
  });
  if (findUser == null) {
    res.redirect("/login?error=true");
    return;
  }

  //Check if password is correct
  if (await bcrypt.compare(password, findUser.password)) {
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
  } else {
    res.redirect("/login?error=true");
    return;
  }
});


//Search for recipes in the database test
app.get("/search", async (req, res) => {
  let search = req.query.search.toLowerCase();
  let recipes = false;
  if (search) {
    await client.connect();
    const database = await client.db(mongodb_database).collection("recipes");
    recipes = await database.find({
      ingredientArray: {
        "$regex": search
      }
    }).limit(20).toArray();
  }
  let times = [];
  for (let i = 0; i < recipes.length; i++) {
    timeCurrent = recipes[i].tags;
    timeCurrent = timeCurrent.replaceAll("'", "");
    timeCurrent = timeCurrent.replaceAll("[", "");
    timeCurrent = timeCurrent.replaceAll("]", "");
    timeCurrent = timeCurrent.split(",");
    for (let i = timeCurrent.length - 1; i >= 0; i--) {
      if (!timeCurrent[i].includes("minutes") && !timeCurrent[i].includes("hours")) {
        timeCurrent.splice(i, 1);
      }
    }
    times.push(timeCurrent);
  }
  res.render("search", {
    recipes: recipes,
    session: req.session,
    times: times
  });
});
//Required for home page search
app.post("/search", async (req, res) => {
  let search = req.body.search;
  res.redirect("/search?search=" + search);
});


//Search for recipes using a list of ingredients.
app.get("/searchIngredients", async (req, res) => {
  let search = req.query.search.toLowerCase();
  let recipes = false;
  if (search) {
    const keywordArray = search.split(',').map(search => search.trim()); // Split the keywords into an array
    await client.connect();
    const database = await client.db(mongodb_database).collection("recipes");
    recipes = await database.find({
      ingredientArray: {
        $all: keywordArray
      }
    }).limit(5).toArray();
  }
  let times = [];
  for (let i = 0; i < recipes.length; i++) {
    timeCurrent = recipes[i].tags;
    timeCurrent = timeCurrent.replaceAll("'", "");
    timeCurrent = timeCurrent.replaceAll("[", "");
    timeCurrent = timeCurrent.replaceAll("]", "");
    timeCurrent = timeCurrent.split(",");
    for (let i = timeCurrent.length - 1; i >= 0; i--) {
      if (!timeCurrent[i].includes("minutes") && !timeCurrent[i].includes("hours")) {
        timeCurrent.splice(i, 1);
      }
    }
    times.push(timeCurrent);
  }



  res.render("searchIngredients", {
    recipes: recipes,
    session: req.session,
    times: times
  });
});

//Profile
app.get("/profile", async (req, res) => {
  if (!req.session.authenticated) {
    res.redirect("/login");
    return;
  }
  res.render("profile", {
    session: req.session
  });
});
//Update Profile
app.post("/profileUpdate", urlencodedParser, async (req, res) => {
  let email = req.body.email;
  let username = req.body.username;
  await client.connect();
  const database = await client.db(mongodb_database).collection("users");
  database.updateMany({
    email: req.session.email,
    username: req.session.username
  }, {
    $set: {
      username: username,
      email: email
    }
  });
  req.session.username = username;
  req.session.email = email;
  res.send("Profile Updated <a href='/profile'>Go Back</a>")
});
//Change Password
app.get("/change-password", async (req, res) => {
  if (!req.session.authenticated) {
    res.redirect("/login");
    return;
  }
  res.render("change-password", {
    error: req.query.error
  });
});
app.post("/change-password-submit", async (req, res) => {
  if (!req.session.authenticated) {
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
  if (result.error != null) {
    res.redirect("/change-password?error=email-invalid");
    return;
  }
  //Check if user exists
  const findUser = await userCollection.findOne({
    email: email
  });
  if (findUser == null) {
    res.redirect("/change-password?error=email-invalid");
    return;
  }

  //Check if old password is correct
  if (!await bcrypt.compare(oldPassword, findUser.password)) {
    res.redirect("/change-password?error=password-incorrect");
    return;
  }

  //Check that new pasword does not match old password
  if (newPassword == oldPassword) {
    res.redirect("/change-password?error=password-same");
    return;
  }


  //Check if new passwords match
  if (newPassword != newPasswordConfirm) {
    res.redirect("/change-password?error=password-mismatch");
    return;
  }

  //Update password
  var hashedPassword = await bcrypt.hash(newPassword, saltRounds);
  await userCollection.updateOne({
    email: email
  }, {
    $set: {
      password: hashedPassword
    }
  });

  //Confirm Change
  req.session.destroy(() => {
    res.redirect("/changed-password");
  });

});
app.get("/changed-password", (req, res) => {
  res.render("changed-password");
});


//Change the dietary restrictions
app.get("/dietEdit", async (req, res) => {
  if (!req.session.authenticated) {
    res.redirect("/login");
    return;
  }
  var user = await userCollection.findOne({email: req.session.email})
  var diet = user.diet;
  if (diet == undefined){
    diet = []; //If the user has no dietary restrictions, set it to an empty array
  }
  res.render("dietEdit", {
    currentDiet: diet, restrictions: restrictionsArray
  });
});
//Update the dietary restrictions
app.post("/dietUpdate", urlencodedParser, async (req, res) => {
  let diet = req.body.diet;
  console.log(diet, req.session.email, req.session.username);
  await client.connect();
  const database = await client.db(mongodb_database).collection("users");
  database.findOneAndUpdate({
    email: req.session.email,
    username: req.session.username
  }, {
    "$set": {
      diet: diet
    }
  });

  req.session.diet = diet;
  res.redirect("/dietEdit");
});


//Logout
app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/");
});

//Recipe display
app.get("/recipe", async (req, res) => {
  var recipeId = new ObjectId(req.query.id);
  var recipeTime = req.query.time;
  console.log(recipeId);
  // var recipeId = new ObjectId("645c034dda87e30762932eb4");
  //Query and parse parts of the recipe
  var read = await recipeCollection.find({
    _id: recipeId
  }).limit(1).toArray();
  console.log(read);
  recipeName = read[0].name;
  //IngredientsArray
  var recipeIngList = read[0].ingredients_raw_str;
  recipeIngList = recipeIngList.replaceAll("'", "");
  recipeIngList = recipeIngList.replaceAll("[", "");
  recipeIngList = recipeIngList.replaceAll("]", "");
  recipeIngList = recipeIngList.replaceAll("\"", "");
  recipeIngList = recipeIngList.split(",");

  var recipeServings = read[0].servings;
  var recipeSize = read[0].serving_size;
  //Instructions Array
  parsingSteps = read[0].steps;
  parsingSteps = parsingSteps.replaceAll("'", "");
  parsingSteps = parsingSteps.replaceAll("[", "");
  parsingSteps = parsingSteps.replaceAll("]", "");
  parsingSteps = parsingSteps.replaceAll("\"", "");
  var recipeSteps = parsingSteps.split(".,");
  //Search Terms Array
  var parsingTerms = read[0].search_terms;
  parsingTerms = parsingTerms.replaceAll("'", "");
  parsingTerms = parsingTerms.replaceAll("{", "");
  parsingTerms = parsingTerms.replaceAll("}", "");
  parsingTerms = parsingTerms.replaceAll("\"", "");
  var recipeTerms = parsingTerms.split(",");
  console.log(recipeName + "\n" + recipeIngList + "\n" + recipeServings + "\n" + recipeSteps + "\n" + recipeTerms[0]);
  console.log(typeof recipeTerms);

  res.render("recipe", {
    name: recipeName,
    ingredients: recipeIngList,
    servings: recipeServings,
    steps: recipeSteps,
    searchterms: recipeTerms,
    size: recipeSize,
    time: recipeTime
  });
});

//Databsetest path
app.get("/dbtest", async (req, res) => {
  var html = "";
  var read = await recipeCollection.find({}).limit(1).toArray();
  // console.log(read);

  for (let i = 0; i < read.length; i++) {
    html += "<p>" + read[i].name + "<ul>";
    var ing = read[i].ingredientArray;

    for (let g = 0; g < ing.length; g++) {
      html += "<li>" + ing[g] + "</li>";
    }
    html += "</ul>"

    html += "Servings: " + read[i].servings;
    html += "<br>Serving Size: " + read[i].serving_size;
    html += "<ul>"
    var steps = read[i].steps;
    steps = steps.replaceAll("'", "");
    steps = steps.replaceAll("[", "");
    steps = steps.replaceAll("]", "");
    steps = steps.split(",");

    for (let s = 0; s < steps.length; s++) {
      html += "<li>" + steps[s] + "</li>";
    }

    html += "</ul></p>"
  }
  res.send(html);
});

//Ingredient Query test path
app.get("/querytest", async (req, res) => {
  var html = "";
  var read = await recipeCollection.find({
    ingredientArray: {
      $all: ["sugar", "eggs"]
    }
  }).limit(5).toArray();
  console.log(read);
  html += read[0].name + read[1].name + read[2].name;
  res.send(html);
});

//404
app.get("/*", (req, res) => {
  res.send("404, page not found");
});


//Start server
app.listen(port, () => {
  console.log("Server running on port " + port);
});