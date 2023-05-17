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

//ChatGPT Variables
const chatgpt_key = process.env.CHATGPT_KEY;
const chatgpt_url = process.env.CHATGPT_URL;

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
  res.locals.username = req.session.username;
  res.locals.firstname = req.session.firstname;
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

  let recipes = [];
  if (user.recents) {
    recents = user.recents;
    //get the recipes from the database
    for (let i = 0; i < user.recents.length; i++) {
      let recipe = await recipeCollection.findOne({
        _id: new ObjectId(recents[i])
      });
      recipes.push(recipe);
    }
  }


  res.render("landing-loggedin", {
    username: req.session.username,
    recipes: recipes
  });
});

app.get("/ai", async (req, res) => {



  if(req.query.chat == undefined){
    tempText = `{
      "name": "Vegan Nut-Free Peanut Butter Cookies",
      "ingredients": [
        "1/2 cup unsweetened applesauce",
        "1/2 cup creamy peanut butter",
        "1/4 cup coconut oil, melted",
        "1/2 cup maple syrup",
        "1 teaspoon vanilla extract",
        "1 3/4 cups all-purpose flour",
        "1/2 teaspoon baking soda",
        "1/4 teaspoon salt",
        "2 tablespoons granulated sugar, for rolling"
      ],
      "serving_size": "Makes 16 cookies",
      "steps": [
        "Preheat the oven to 350°F (175°C) and line a baking sheet with parchment paper.",
        "In a large mixing bowl, combine the unsweetened applesauce, creamy peanut butter, melted coconut oil, maple syrup, and vanilla extract. Stir until well combined.",
        "In a separate bowl, whisk together the all-purpose flour, baking soda, and salt.",
        "Gradually add the dry ingredients to the wet ingredients, stirring until a thick dough forms.",
        "Roll the dough into small balls, about 1 inch in diameter.",
        "Roll each ball in granulated sugar to coat the exterior.",
        "Place the coated balls onto the prepared baking sheet, spacing them about 2 inches apart.",
        "Using a fork, gently press down on each ball to create a crisscross pattern.",
        "Bake for 10-12 minutes, or until the cookies are lightly golden around the edges.",
        "Remove from the oven and let the cookies cool on the baking sheet for 5 minutes.",
        "Transfer the cookies to a wire rack to cool completely before serving."
      ]
    }
    `
    let tempObject = JSON.parse(tempText);
    let name = tempObject.name;
    let ingredients = tempObject.ingredients;
    let serving_size = tempObject.serving_size;
    let steps = tempObject.steps;
    res.render("ai", {name: name,
       ingredients: ingredients,
        serving_size: serving_size,
         steps: steps});
    return;
  }

  /*

  recipe for peanut butter cookies that meets dietary
  restrictions: nut-free, vegan. formatted as a JSON
  object with keys: name, ingredients, serving_size, steps.
  
  */
  
  let dietaryRestrictions = `that meets dietary restrictions: none`;
  let recipeName= req.query.chat;

  let request = `recipe for ${recipeName} ${dietaryRestrictions}. 
  formatted as a JSON object with keys: name (string), ingredients (array of strings), serving_size (string), steps (array of strings), cook_time (string).
  `;

  try{
    const response = await fetch(chatgpt_url,{
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${chatgpt_key}`
      },
      body: JSON.stringify({"model": "gpt-3.5-turbo",
      "messages": [{"role": "user", "content": request}]
    })
    });



    const data = await response.json();
   

    let aiString = data.choices[0].message.content;
    console.log(aiString);
    let aiObject = JSON.parse(aiString);
    console.log(aiObject);
    let name = aiObject.name || recipeName;
    let ingredients = aiObject.ingredients || ["error"];
    let servings = aiObject.serving_size || "error";
    let steps = aiObject.steps || ["error"];
    let time = aiObject.cook_time || "error";

    res.render("ai", {name: name,
      ingredients: ingredients,
      servings: servings,
      steps: steps,
      time: time});
    return;
  } catch (error) {console.error("Error:", error);}

  res.send("error: " + error);
 
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
  let search = req.query.search;
  let recipes = false;
  if (search) {
    search = search.toLowerCase();
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
  let search = req.query.search;
  console.log("Search: " + search);
  let recipes = false;
  if (search != undefined) {
    // search = search.toLowerCase();
    // const keywordArray = search.split(',').map(search => search.trim()); // Split the keywords into an array
    for (var i = 0; i < search.length; i++){
      search[i].toLowerCase;
    }
    await client.connect();
    const database = await client.db(mongodb_database).collection("recipes");
    recipes = await database.find({
      ingredientArray: {
        $in: search
      }
    }).limit(5).toArray();
  }
  console.log("res" + recipes);
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
  user = await userCollection.findOne({email: req.session.email});
  
  let bookmarks = [];
  if (user.bookmarks != undefined) {
    var bookmarkIds = user.bookmarks;
    
    for (let i = 0; i < bookmarkIds.length; i++) {
      let recipe = await recipeCollection.findOne({
        _id: bookmarkIds[i]
      });
      bookmarks.push(recipe);
    }
  }
console.log(bookmarks);
  res.render("profile", {
    session: req.session,
    bookmarks: bookmarks
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

//Check if user is logged in and if the recipe is already bookmarked
var isBookmarked = false;

if (req.session.authenticated) {
  var user = await userCollection.findOne({email: req.session.email});
  //Display Bookmarks
  if (user.bookmarks) {
    for (let i = 0; i < user.bookmarks.length && isBookmarked == false; i++) {
      if (user.bookmarks[i].toString() == req.query.id) {
        isBookmarked = true;
       
      }
    }
  }
  //Add to recent recipes
  let recents = [];
  if (user.recents) {
    recents = user.recents;
    //Remove from recents if already there
    for (let i = 0; i < recents.length; i++) {
      if (recents[i].toString() == req.query.id) {
        recents.splice(i, 1);
      }
    }
    //Make sure recents is not too long
    while (user.recents.length >= 10) {
      recents.shift();
    }    
  }
  //Add to recents
  recents.push(new ObjectId(req.query.id));
  await userCollection.updateOne({email: req.session.email }, { $set: {recents: recents } });
}


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

  console.log(isBookmarked);
  res.render("recipe", {
    id: req.query.id,
    bookmarked: isBookmarked,
    name: recipeName,
    ingredients: recipeIngList,
    servings: recipeServings,
    steps: recipeSteps,
    searchterms: recipeTerms,
    size: recipeSize,
    time: recipeTime
  });
});

//Recipe save
app.post("/recipe-save", urlencodedParser, async (req, res) => {
  if (!req.session.authenticated) {
    res.redirect("/login");
    return;
  }

  //Get the user's bookmarks
  var bookmarks;
  var user = await userCollection.findOne({ email: req.session.email });
  if(!user){
    res.redirect("/login");
    return;
  }
  if (!user.bookmarks) {
    bookmarks = [];
  } else {
    bookmarks = user.bookmarks;
  }

  //Return if the recipe is already bookmarked
  for (let i = 0; i < bookmarks.length; i++) {
    if (bookmarks[i].toString() == req.body.id) {
      res.redirect("/recipe?id=" + req.body.id);
      return;
    }
  }


  //Save the recipe
  var recipeId = new ObjectId(req.body.id);
  bookmarks.push(recipeId);
 
  console.log(req.session);
  await userCollection.findOneAndUpdate({
    email: req.session.email
  }, {
    "$set": {
      bookmarks: bookmarks
    }
  });


  res.redirect("/recipe?id=" + req.body.id);

});

//Recipe unsave
app.post("/recipe-unsave", urlencodedParser, async (req, res) => {
  if (!req.session.authenticated) {
    res.redirect("/login");
    return;
  }

  //Get the user's bookmarks
  var bookmarks;
  var user = await userCollection.findOne({ email: req.session.email });
  if(!user || !user.bookmarks){
    res.redirect("/login");
    return;
  }


  //Return if the recipe is already bookmarked
  var newBookmarks = [];
  for (let i = 0; i < user.bookmarks.length; i++) {
    if (user.bookmarks[i].toString() != req.body.id) {
      newBookmarks.push(user.bookmarks[i]);
    }
  }
  if(newBookmarks.length == user.bookmarks.length){
    res.redirect("/recipe?id=" + req.body.id);
    return;
  }

 
  await userCollection.findOneAndUpdate({
    email: req.session.email
  }, {
    "$set": {
      bookmarks: newBookmarks
    }
  });
  res.redirect("/recipe?id=" + req.body.id);

});

//Easter Egg
app.get("/easter-egg", async (req, res) => {
  res.render("easterEgg", {session: req.session});
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