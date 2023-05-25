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

//he
const he = require('he');

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
const apiKey = process.env.G_API_KEY;
const searchEngineId = process.env.SEARCH_ENGINE_ID;

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
  } catch (error) {
    console.error("Error connecting to MongoDB: " + error);
  }
}
connectToDatabase();
const database = client.db(mongodb_database);
const userCollection = database.collection("users");
const recipeCollection = database.collection('recipes');
const airecipeCollection = database.collection('ai-recipes');
const restrictionsArray = ["vegetarian", "vegan", "gluten-free", "dairy-free", "low-sodium", "low-carb", "low-fat"]
const spiceCat = ["salt", "black pepper", "garlic", "cinnamon", "paprika", "parsley", "chili powder", "nutmeg", "cumin", "cayenne pepper", "oregano", "kosher salt", "cilantro", "ginger"]
const fruitCat = ["lemon juice", "raisins", "orange juice", "lime juice", "lemon", "banana", "avocado", "apple", "coconut", "pineapple", "dried cranberry", "blueberry", "lime", "strawberry"]
const meatCat = ["bacon", "ground beef", "chicken breast", "ham", "shrimp", "chicken drumstick"]
const veggieCat = [ "onion", "tomato", "celery", "carrot", "green onion", "green pepper", "red bell pepper", "potato", "zucchini", "mushroom", "black beans", "cucumber", "shallot", "lettuce"]
const dairyCat = [ "butter", "egg", "milk", "parmesan cheese", "sour cream", "cheddar cheese", "cream", "cream cheese", "mozzarella cheese", "margarine", "buttermilk", "condensed milk"]
const nutCat = [ "flour", "pecans", "walnuts", "nuts", "peanut butter", "sesame seeds", "almonds", "tortillas", "rice", "pine nuts", "oats"]
const condCat = [ "olive oil", "baking powder", "baking soda", "vegetable oil", "soy sauce", "mayonnaise", "worcestershire sauce", "dijon mustard", "tomato sauce", "ketchup", "vinegar", "tabasco sauce"]
const sweetCat = [ "sugar", "brown sugar", "honey", "powdered sugar", "chocolate chips", "caster sugar", "molasses"]
const otherCat = [ "chicken broth", "vanilla", "cornstarch", "chicken stock", "breadcrumbs", "white wine", "shortening", "cream of mushroom soup", "black olives", "beef broth", "cream of chicken soup", "vegetable broth"]


//Enables Cookies in Express
app.use(session({
  secret: node_session_secret,
  store: mongoStore,
  saveUninitialized: true,
  resave: true
}));


//middleware to check if user is logged in and pass info to ejs
const sessionValidation = (req, res, next) => {
  res.locals.validSession = req.session.authenticated;
  res.locals.username = req.session.username;
  res.locals.firstname = req.session.firstname;
  res.locals.easterEgg = req.session.easterEgg;
  next();
};

// Attach middleware function to the app
app.use(sessionValidation);

////////////////////////////////////////////////////////////////
// APP ROUTES //////////////////////////////////////////////////
////////////////////////////////////////////////////////////////


//Landing Page
app.get("/", async (req, res) => {
  var user = await getValidUser(req);
  if (user == null) {
    res.render("landing-loggedout");
    return;
  }

  let recipes = [];
  let images = [];
  if (user.recents) {
    recents = user.recents;
    //get the recipes from the database
    for (let i = 0; i < user.recents.length; i++) {
      let recipe = await recipeCollection.findOne({
        _id: new ObjectId(recents[i])
      });
      if (recipe == null) {
        recipe = await airecipeCollection.findOne({
          _id: new ObjectId(recents[i])
        });
      }
      if(recipe){
        recipes.push(recipe);
        images.push(await getGoogleImage(recipe.name));
      }
    }
  }

  let times = getRecipeTimes(recipes);
  
  res.render("landing-loggedin", {
    username: req.session.username,
    recipes: recipes,
    images: images,
    times: times
  });
});


//ChatGPT
app.get("/generate", async (req, res) => {
  var user = await getValidUser(req);
  if (!isValid(user)) {
    res.redirect("/login");
    return;
  }

  //Remove any previous recipe from session
  if(req.session.aiRecipe){
    req.session.aiRecipe = undefined;
  }

  //Redirect if no recipe is specified
  if (req.query.recipeID == undefined) {
    res.redirect("/");
    return;
  }

  //Get the user restrictions
  var diet = false;
  if (req.query.diet) {
    diet = true;
  }


  //Validate Notes
  var notes = req.query.notes;
  const schema = Joi.string().regex(/[$\(\)<>{}]/, { invert: true }).max(100)
  const result = schema.validate(notes);
  if(result.error){
    notes = "none";
  }
  //Update the user's aipreferences
  req.session.aiPreferences = {
    diet: diet,
    notes: notes || "none",
  };
  res.redirect("ai-substitute?recipeID=" + req.query.recipeID);
});

app.get("/ai-recipe", async (req, res) => {
    try {
      var recipeId = new ObjectId(req.query.id);
    } catch {
      res.redirect("/404");
      return;
    }

    //Check if user is logged in and if the recipe is already bookmarked
    var bookmarked = await isBookmarked(req, recipeId);
    addToRecents(req, recipeId);

    //Query and parse parts of the recipe
    var recipe = await airecipeCollection.findOne({_id: recipeId});

    //Check if recipe exists
    if (recipe == null){
      res.redirect("/404");
      return;
    }
  
    res.render("ai-recipe", {recipe: recipe, enableUi: true, bookmarked: bookmarked, id: req.query.id});
  });

app.get("/ai-substitute", async (req, res) => {
  if(! await validateAI_Substitute(req, res)){
    return;
  }
  //Get recipe from database
  try{
    var originalRecipe = await recipeCollection.findOne({_id: new ObjectId(req.query.recipeID)});
  }catch{
    res.redirect("/404");
    return;
  }

  //Get user from database
  var diet = (req.session.aiPreferences.diet ? req.session.aiPreferences.diet : []);
  var notes = (req.session.aiPreferences.notes ? req.session.aiPreferences.notes : "none");
  console.log(notes);
  orName = originalRecipe.name;
  orIngredients = originalRecipe.ingredientArray;
  let orSteps = parseSteps(originalRecipe.steps);

  //Create dietary restrictions string===================
  let restrictionsArray = []
  let dietaryRestrictions = "that meets dietary restrictions:";
  if (diet) {
    restrictionsArray = stringToArrayItem(diet);
    //Add each restriction to the string
    for (let i = 0; i < restrictionsArray.length; i++) {
      dietaryRestrictions += ` ${restrictionsArray[i]},`;
    }
  } else {
    //If no restrictions, add none
    dietaryRestrictions += ` none`;
  }

  //Create request string

  //Uses full original recipe
  let request = `recipe for ${orName}`;
  if(restrictionsArray.length > 0){
    request += ` ${dietaryRestrictions}. `;
  }
  request += 'based on the orginal recipe made with'
  for (let i = 0; i < orIngredients.length; i++) {
    request += ` ${orIngredients[i]},`;
  }
  request += ` and the following steps:`;
  for (let i = 0; i < orSteps.length; i++) {
    request += ` ${orSteps[i]},`;
  }
  request += ` with the following notes: ${notes}.`;
  request += ` formatted as a JSON object with keys: name (string), ingredients (array of strings), serving_size (string), steps (array of strings), make_time (string).`;

  //Send request to ChatGPT
  try {
    const response = await fetch(chatgpt_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${chatgpt_key}`
      },
      body: JSON.stringify({
        "model": "gpt-3.5-turbo",
        "messages": [{
          "role": "user",
          "content": request
        }]
      })
    });
    const data = await response.json();
    let aiString = data.choices[0].message.content;
    let aiObject = JSON.parse(aiString);

    //Generate image
    var imageURL = await getGoogleImage(aiObject.name);

    //Add more data to object
    aiObject.restrictions = restrictionsArray;
    aiObject.imageURL = imageURL;
    aiObject.originalRecipeID = req.query.recipeID;
    aiObject.ownerId =  req.session.userId;
    aiObject.ai = true;
    req.session.aiRecipe = aiObject;

    res.render("ai-frame",{recipe: aiObject, imageURL: imageURL, recipeID: req.query.recipeID, authenticated: req.session.authenticated, id: req.query.recipeID, restrictions: restrictionsArray, notes: notes});
    return;

  } catch (error) { //If error, render error page
    console.error("Error:", error);
    res.render("ai-frame", {error: true, orName: orName, restrictions: restrictionsArray, recipeID: req.query.recipeID, authenticated: req.session.authenticated, id: req.query.recipeID, notes: notes});
  }
});

//Ai Recipe save
app.post("/airecipe-save", urlencodedParser, async (req, res) => {
  var user = await getValidUser(req);
  if (!isValid(user)) {
    res.redirect("/login");
    return;
  }

  //Save to databse first
  var aiRecipe = req.session.aiRecipe;

  recipeAlreadySaved = await airecipeCollection.findOne({name: aiRecipe.name, ingredients: aiRecipe.ingredients, steps: aiRecipe.steps, ownerId: req.session.userId});
  if(recipeAlreadySaved){
    res.redirect("/recipe?id=" + recipeAlreadySaved._id);
    return;
  }
  await airecipeCollection.insertOne(aiRecipe);
  let aiRecipeGet = await airecipeCollection.findOne({name: aiRecipe.name, ingredients: aiRecipe.ingredients, steps: aiRecipe.steps, ownerId: req.session.userId});

  //Get the user's bookmarks
  var bookmarks = [];
  if (user.bookmarks) {bookmarks = user.bookmarks;}
  bookmarks.push(aiRecipeGet._id);
 
  await userCollection.findOneAndUpdate({
    email: req.session.email
  }, {
    "$set": {
      bookmarks: bookmarks
    }
  });


  res.redirect("/ai-recipe?id=" + aiRecipeGet._id);

});

//Ai Recipe unsave
app.post("/airecipe-unsave", urlencodedParser, async (req, res) => {
  var user = await getValidUser(req);
  if (!isValid(user)) {
    res.render("landing-loggedout");
    return;
  }
 
  //Return if recipe is already removed
  var newBookmarks = arrayWithout(user.bookmarks, req.body.id);
  if(newBookmarks.length == user.bookmarks.length){
    res.redirect("/recipe?id=" + req.body.id);
    return;
  }

  //Remove from user's bookmarks
  await userCollection.findOneAndUpdate({
    email: req.session.email
  }, {
    "$set": {
      bookmarks: newBookmarks
    }
  });

  //Remove from database
  await airecipeCollection.deleteOne({_id: new ObjectId(req.body.id)});

  res.redirect("/profile");

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

  var user = await userCollection.findOne({email: email });

  //Make a cookie
  req.session.authenticated = true;
  req.session.userId = user._id;
  req.session.firstname = fname;
  req.session.lastname = lname;
  req.session.username = username;
  req.session.email = email;
  req.session.easterEgg = false;
  req.session.cookie.maxAge = sessionExpireTime;
  req.session.useDiet = true;

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
  const user = await userCollection.findOne({
    username: { $regex: new RegExp(username, "i")} //Regex with 'i' makes it case insensitive
  });
  if (isValid(user)) {
    res.redirect("/login?error=true");
    return;
  }

  //Check if password is correct
  if (await bcrypt.compare(password, user.password)) {
    //Make a cookie
    req.session.authenticated = true;
    req.session.userId = user._id;
    req.session.firstname = user.firstname;
    req.session.lastname = user.lastname;
    req.session.username = user.username;
    req.session.email = user.email;
    req.session.easterEgg = user.easterEgg;
    req.session.cookie.maxAge = sessionExpireTime;
    req.session.useDiet = true;
    res.redirect("/");
    return;
  } else {
    res.redirect("/login?error=true");
    return;
  }
});

//Search for recipes in the database test
app.get("/search", async (req, res) => {
  //gets all the search parameters from the url
  let search = req.query.search;
  let time = req.query.time;
  let diet = req.query.diet;

  //gets the users profile diet if they are signed in
  if (req.session.authenticated) {
    await client.connect();
    let profile = await client
      .db(mongodb_database)
      .collection("users")
      .findOne({ username: req.session.username });
    var profileDiet = profile.diet;
  } else {
    var profile = false;
    var profileDiet = false;
  }
  //sets up the default values for the search
  let recipes = false;
  let images = [];
  let connection = {};

  //if there is a search term it will search for it
  if (search) {
    connection.name = {
      $regex: new RegExp(search, "i"),
    };
  }
  connection.$and = [];
  
  //if there is a time it will search for it
  if (!(time == 0) && time) {
    connection.tags = {
      $regex: new RegExp(time, "i"),
    };
  }
  
  //if there is a diet it will search for it
  if (Array.isArray(diet)) {
    connection.$and.push({
      $and: diet.map((restriction) => ({
        search_terms: { $regex: `\\b${restriction}\\b`, $options: "i" },
      })),
    });
  } else if (diet) {
    connection.$and.push({
      search_terms: { $regex: new RegExp(diet, "i") },
    });
  }
  
  //if there is a profile diet it will search for it
  if (Array.isArray(profileDiet) && req.session.useDiet) {
    connection.$and.push({
      $and: profileDiet.map((restriction) => ({
        search_terms: { $regex: `\\b${restriction}\\b`, $options: "i" },
      })),
    });
  } else if (profileDiet && req.session.useDiet) {
    connection.$and.push({
      search_terms: { $regex: new RegExp(profileDiet, "i") },
    });
  }
 
  //if there is no search term it will delete the $and
  if (connection.$and.length == 0) {
    delete connection.$and;
  }
  
  //if there a search term it will search for it
  if (search) {
    await client.connect();
    const database = await client.db(mongodb_database).collection("recipes");
    recipes = await database.find(connection).limit(20).toArray();
  }
  
  //gets the times from the search terms in the recipes
  let times = getRecipeTimes(recipes);
  
  //gets the images from google for each recipe 
  for (let i = 0; i < recipes.length; i++) {
    images.push(await getGoogleImage(recipes[i].name));
  }

  //if the diet is null it will set it to null for the checkboxes
  if (!diet) {
    diet = "null";
  }
  
  //renders the search page with all the information
  res.render("search", {
    search: search,
    recipes: recipes,
    session: req.session,
    times: times,
    images: images,
    profile: profile,
    profileDiet: profileDiet,
    restrictions: restrictionsArray,
    diet: diet,
    time: time,
  });
});

//Search for recipes using a list of ingredients.
app.get("/searchIngredients", async (req, res) => {
  let search = req.query.search;
  let time = req.query.time;
  let diet = req.query.diet;
  let images = [];
  if (!diet) {
    diet = "null";
  }
  if (!time) {
    time = 0;
  }
  if (req.session.authenticated) {
    await client.connect();
    let profile = await client.db(mongodb_database).collection("users").findOne({username: req.session.username });
    var profileDiet = profile.diet;
  } else {
    var profile = false;
    var profileDiet = false;
  }
  let recipes = false;
  if (search != undefined) {
    if (typeof search === "string"){
      search = search.split(',');
    }
    for (var i = 0; i < search.length; i++){
      search[i].toLowerCase;
    }
    await client.connect();
    const database = await client.db(mongodb_database).collection("recipes");
      var connection = {};
      connection.$and = [];
      if (!(time == 0) && time) {
        connection.tags = {
          $regex: new RegExp(time, "i")
        }
      }
      if (Array.isArray(diet)) {
        connection.$and.push({ $and: diet.map(restriction => ({
          search_terms: { $regex: `\\b${restriction}\\b`, $options: 'i' } }))})
        } else if (!(diet == "null")){
          connection.$and.push({
          search_terms: {$regex: new RegExp(diet, "i")}
          })
        }
      if (Array.isArray(profileDiet) && req.session.useDiet) {
        connection.$and.push({ $and: profileDiet.map(restriction => ({
          search_terms: { $regex: `\\b${restriction}\\b`, $options: 'i' }
        }))
      })
      } else if (profileDiet && req.session.useDiet){
          connection.$and.push({
          search_terms: {$regex: new RegExp(profileDiet, "i")}
          })
        }
      connection.$and.push({
        ingredients_raw_str: {  $regex: new RegExp(`\\b(${search.map(term => `\\b${term}\\b`).join('|')})\\b`, 'i')} 
      });
      if (connection.$and.length == 0) {
        delete connection.$and;
      }
      //Final query, scores recipes by number of matching ingredients, then sorts by score.
      recipes = await database.find(connection).project({ tags: 1,
        name: 1,
        ingredientArray: 1,
        servings: 1,
        score: {
          $reduce: {
            input: {
              $map: {
                input: search, as: "term", in: {
                  $cond: {
                    if: { $regexMatch: { input: "$ingredients_raw_str", regex: `${"$" + "$term"}`, options: "i" } }, then: 1, else: 0
                  }
                }
              }
            },
            initialValue: 0, in: { $add: ["$$value", "$$this"] }
          }
        }
      })
        .sort({ "score": -1 })
        .limit(20000).toArray();
  }
  //Sorts the recipes by score after it has been set to an array
  if (search) {
    recipes.sort((a, b) => b.score - a.score);
    recipes = recipes.slice(0, 10);
  }
  //Finds a relevent image to display for each recipe.
  for (let i = 0; i < recipes.length; i++) {
    recipes[i].name = he.decode(recipes[i].name);
    images.push(await getGoogleImage(recipes[i].name));
  }
  //BK CODE
  let times = getRecipeTimes(recipes);
  res.render("searchIngredients", {
    recipes: recipes,
    session: req.session,
    times: times,
    current: search,
    images: images,
    profileDiet: profileDiet,
    spiceCat: spiceCat,
    fruitCat: fruitCat,
    veggieCat: veggieCat,
    meatCat: meatCat,
    dairyCat: dairyCat,
    nutCat: nutCat,
    condCat: condCat,
    sweetCat: sweetCat,
    otherCat: otherCat,
    restrictions: restrictionsArray,
    diet: diet,
    time: time
  });
});

//turns using the profile diets on
app.post("/useDiet", urlencodedParser, async (req, res) => {
    //sets the use diet to true so when searching it will use the profile diets
    req.session.useDiet = true;
    //sends a success message
    res.send("success");
});

//turns the profile diets off
app.post("/dontUseDiet", urlencodedParser, async (req, res) => {
  //sets the use diet to false so when searching it will not use the profile diets
    req.session.useDiet = false;
    //sends a success message
    res.send("success");
});

//Profile
app.get("/profile", async (req, res) => { 
  if (!req.session.authenticated) {
    res.redirect("/login");
    return;
  }
  user = await userCollection.findOne({email: req.session.email});
  let images = [];
  
  let bookmarks = [];
  let aiBookmarksCount = 0;
  
  if (user.bookmarks != undefined) {
    var bookmarkIds = user.bookmarks;
    let recipe =[] ;
    
    for (let i = 0; i < bookmarkIds.length; i++) {
      let aiFlag = false;
      recipe = await recipeCollection.findOne({
        _id: bookmarkIds[i]
      });
      if (recipe == null) {
        aiFlag = true;
        recipe = await airecipeCollection.findOne({
          _id: bookmarkIds[i]
        });
      }
      if(recipe){
      if (aiFlag) {aiBookmarksCount++;}
      bookmarks.push(recipe);
      imageURL = await getGoogleImage(recipe.name);
      if(imageURL == ""){
        imageURL = encodeURIComponent('https://media.istockphoto.com/id/184276935/photo/empty-plate-on-white.jpg?s=612x612&w=0&k=20&c=ZRYlQdMJIfjoXbbPzygVkg8Hb9uYSDeEpY7dMdoMtdQ=');
      }
      images.push(imageURL);
      }
    }
  }


  let times = getRecipeTimes(bookmarks);

  res.render("profile", {
    session: req.session,
    bookmarks: bookmarks,
    images: images,
    times: times,
    aiCount: aiBookmarksCount,
    error: req.query.error
  });
});

//Update Profile
app.post("/profileUpdate", urlencodedParser, async (req, res) => {
  //gets the inputted email and username
  let email = req.body.email;
  let username = req.body.username;
  //sets up connection to database
  await client.connect();
  const database = await client.db(mongodb_database).collection("users");
  //checks if the email or username is already taken
  let emailList = await database.find({ email: email }).toArray();
  let usernameList = await database.find({ username: username }).toArray();
  //gets the current user
  let curUser = await database.find({ email: req.session.email, username: req.session.username}).toArray();
  //if the email or username is already taken, redirect to profile with error
  if (emailList.length > 0 ) {
    console.log("email" + emailList[0]._id, curUser[0]._id);
    if (!(emailList[0]._id.toString() == curUser[0]._id.toString())) {
      res.redirect("/profile?error=Email or Username already taken");
      return;
    }
  } 
  if (usernameList.length > 0) {
    console.log("username" + usernameList[0]._id, curUser[0]._id);
    if (!(usernameList[0]._id.toString() == curUser[0]._id.toString())) {
      res.redirect("/profile?error=Email or Username already taken");
      return;
    }
  } 
  //updates the user's email and username if they are not taken
  database.updateMany({
    email: req.session.email,
    username: req.session.username
  }, {
    $set: {
      username: username,
      email: email
    }
  });
  //updates the session variables
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
  res.redirect("/profile");
});

//Logout
app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/");
});

//Recipe display
app.get("/recipe", async (req, res) => {
  try{
    var recipeId = new ObjectId(req.query.id);
  }catch{

    res.redirect("/404");
    return;
  }

//Check if user is logged in and if the recipe is already bookmarked
var bookmarked = false;
var restrictions = [];
if (req.session.authenticated) {
 user = await getValidUser(req);
  if(isValid(user.diet) && user.diet.length > 0){
    restrictions = user.diet;
  }else{
    restrictions = ["none"];
  }
 bookmarked = await isBookmarked(req, req.query.id);
 addToRecents(req, req.query.id);
}


  var recipeTime = req.query.time;

  //Query and parse parts of the recipe
  var read = await recipeCollection.find({
    _id: recipeId
  }).limit(1).toArray();  

  //Check if recipe is ai generated
  if(read.length == 0){
    aiRecipe = await airecipeCollection.findOne({_id: recipeId});
    if (aiRecipe == null){
      res.redirect("/404");
      return;
    }
    res.redirect("/ai-recipe?id=" + req.query.id);
    return;
  }



  let recipeName = read[0].name;

  //Generate image
  var imageURL = await getGoogleImage(recipeName);
  let recipeImg = req.query.img || imageURL;

  //IngredientsArray
  var recipeIngList = read[0].ingredients_raw_str;
  recipeIngList = recipeIngList.replaceAll("[", "");
  recipeIngList = recipeIngList.replaceAll("]", "");
  recipeIngList = recipeIngList.split("\",\"");
  for (var i = 0; i < recipeIngList.length; i++){
    recipeIngList[i] = recipeIngList[i].replaceAll("\"", "");
  }
  var recipeServings = read[0].servings;
  var recipeSize = read[0].serving_size;
  //Instructions Array
  var recipeSteps = parseSteps(read[0].steps);
  //Search Terms Array
  var parsingTerms = read[0].search_terms;
  parsingTerms = parsingTerms.replaceAll("'", "");
  parsingTerms = parsingTerms.replaceAll("{", "");
  parsingTerms = parsingTerms.replaceAll("}", "");
  parsingTerms = parsingTerms.replaceAll("\"", "");
  var recipeTerms = parsingTerms.split(",");

  res.render("recipe", {
    id: req.query.id,
    bookmarked: bookmarked,
    name: recipeName,
    ingredients: recipeIngList,
    servings: recipeServings,
    steps: recipeSteps,
    searchterms: recipeTerms,
    size: recipeSize,
    time: recipeTime,
    Image: recipeImg,
    authenticated: req.session.authenticated,
    restrictions: restrictions
  });
});

//Recipe save
app.post("/recipe-save", urlencodedParser, async (req, res) => {
  if (!req.session.authenticated) {
    res.redirect("/login");
    return;
  }
  var user = await userCollection.findOne({ email: req.session.email });
  //Get the user's bookmarks
  var bookmarked = await isBookmarked(req, req.body.id);
  var bookmarks = [];
  if (user.bookmarks) {
    bookmarks = user.bookmarks;
  }

  //Return if the recipe is already bookmarked
  if(bookmarked){
    res.redirect("/recipe?id=" + req.body.id);
    return;
  }

  //Save the recipe
  try{
  var recipeId = new ObjectId(req.body.id);
  }
  catch{
    res.redirect("/404");
    return;
  }
  bookmarks.push(recipeId);
 
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
  var user = await userCollection.findOne({ email: req.session.email });
  if(!user || !user.bookmarks){
    res.redirect("/login");
    return;
  }


  //Return if the recipe is already removed
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

//create easteregg check on profile
app.post("/add-egg", async (req, res) => {
  if (!req.session.authenticated) {
    res.redirect("/login");
    return;
  }
  var user = await userCollection.findOne({ email: req.session.email });
  if(!user){
    res.redirect("/login");
    return;
  } else {
    await userCollection.findOneAndUpdate({
      email: req.session.email
    }, {
      "$set": {
        easterEgg: true
      }
    });

    req.session.easterEgg = true;

  res.redirect("/profile");
}});

//remove easteregg check on profile
app.post("/remove-egg", async (req, res) => {
  if (!req.session.authenticated) {
    res.redirect("/login");
    return;
  }
  var user = await userCollection.findOne({ email: req.session.email });
  if(!user){
    res.redirect("/login");
    return;
  } else {
    await userCollection.findOneAndUpdate({
      email: req.session.email
    }, {
      "$set": {
        easterEgg: false
      }
    });

    req.session.easterEgg = false;

  res.redirect("/profile");
}});

app.get("/aboutus", async (req, res) => {
  res.render("aboutus", {session: req.session});
});

app.get("/privacypolicy", async (req, res) => {
  res.render("privacypolicy", {session: req.session});
});

//Databsetest path
app.get("/dbtest", async (req, res) => {
  var html = "";
  var read = await recipeCollection.find({}).limit(1).toArray();

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
  html += read[0].name + read[1].name + read[2].name;
  res.send(html);
});

//404
app.get("/*", (req, res) => {
  res.render("pageNotFound");
});

//Start server
app.listen(port, () => {
  console.log("Server running on port " + port);
});

////////////////////////////////////////////////////////////////
// Routing Functions ///////////////////////////////////////////
////////////////////////////////////////////////////////////////

//Validate /ai-substitute
async function validateAI_Substitute(req, res){
  //Only allow access if user is logged in
  if (!req.session.authenticated) {
   res.redirect("/login");
   return false;
 }
 //Redirect if no recipe is specified
 if (req.query.recipeID == undefined) {
   res.redirect("/");
   return false;
 }

 //Don't regenerate if recipe is already loaded

 var user = getValidUser(req);
 if(req.session.aiRecipe){
   res.render("ai-frame", {recipe: req.session.aiRecipe, recipeID: req.query.recipeID, notes: req.session.notes, authenticated: req.session.authenticated, restrictions: user.diet || [], id: req.session.aiRecipe.originalRecipeID});
   return false;
 }
  //Get recipe from database
  try{
  var originalRecipe = await recipeCollection.findOne({_id: new ObjectId(req.query.recipeID)});
  } catch{
    res.render("pageNotFound");
    return false;
  }
    
  if(originalRecipe == null){ //throw error if recipe doesn't exist
    res.render("ai-frame", {error: true, recipeID: req.query.recipeID});
    return;
  }

 return true;
}

////////////////////////////////////////////////////////////////
// Support Functions ///////////////////////////////////////////
////////////////////////////////////////////////////////////////

//Get image from Google Custom Search API
async function getGoogleImage(searchTerm) {
  //sets the visibility of variable
  var imageFullURL = "";
  //sets the url for the api
  let apiUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(searchTerm)}&searchType=image`;
  //fetches the data from the api, if it cant find one it will use a default image
  await fetch(apiUrl).then((response) => response.json()).then((data) => {
      if (data.items && data.items.length > 0) {
        imageFullURL = encodeURIComponent(data.items[0].link);
      } else {
        imageFullURL= encodeURIComponent("https://media.istockphoto.com/id/184276935/photo/empty-plate-on-white.jpg?s=612x612&w=0&k=20&c=ZRYlQdMJIfjoXbbPzygVkg8Hb9uYSDeEpY7dMdoMtdQ=");
      }
    })
    .catch((error) => {
      console.error("An error occurred:", error);
      
    });
  //returns the url
  return imageFullURL;
}

//Parse steps from our beautiful dataset
function parseSteps(stepsToParse){
  let parsingSteps = stepsToParse;
  parsingSteps = parsingSteps.replaceAll("[", "");
  parsingSteps = parsingSteps.replaceAll("]", "");
  parsingSteps = parsingSteps.replaceAll("\"", "");
  steps = parsingSteps.split("', '");
  for (var i = 0; i < steps.length; i++) {
    steps[i] = steps[i].replaceAll("'", "");
  }
  return steps;
}

//fix an array that might be a string
function stringToArrayItem(potentialString){
  if(!Array.isArray(potentialString)){
    return [potentialString];
  }
  return potentialString;
}

//Check if recipe is bookmarked
async function isBookmarked(req, id){
  var bookmarked = false;
    var user = await userCollection.findOne({email: req.session.email});
    //Check if bookmarked
    if (user && user.bookmarks && user.bookmarks != undefined) {
      for (let i = 0; i < user.bookmarks.length && bookmarked == false; i++) {
        if (user.bookmarks[i].toString() == id) {
          bookmarked = true;
        }
      }
    }
    return bookmarked;
}

//add to recent
async function addToRecents(req, recipeId){
  
//Add to recent recipes
let recents = [];
var user = await getValidUser(req)
if(user){
if (user.recents) {
  recents = user.recents;
  //Remove from recents if already there
  for (let i = 0; i < recents.length; i++) {
    if (recents[i].toString() == recipeId.toString()) {
      recents.splice(i, 1);
    }
  }
  
  //Make sure recents is not too long
  while (user.recents.length >= 20) {
    recents.shift();
  }    
}
//Add to recents
recents.push(recipeId);
await userCollection.updateOne({email: req.session.email }, { $set: {recents: recents } });
return isBookmarked(req, recipeId);
}

}

//remove an item from an array
function arrayWithout(array, string){
  var newArray = [];
  for (let i = 0; i < array.length; i++) {
    if (array[i].toString() != string) {
      newArray.push(array[i]);
    }
  }
  return newArray;
}

//parses the times from the tags
function getRecipeTimes(recipeArray){
  //sets up the array
  let times = [];
  //loops through the times and turns them into arrays, then removes the ones that arent times
  for (let i = 0; i < recipeArray.length; i++) {
      if (recipeArray[i].tags) {
        timeCurrent = recipeArray[i].tags;
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
      } else if (recipeArray[i].make_time) {
        times.push(recipeArray[i].make_time);
      }else {
        times.push([]);
      }

    }
  //loops through the times and adds N/A if there are no times
  for (let i = 0; i < times.length; i++) {
    if (times[i].length == 0) {
      times[i].push("N/A");
    }
  }
  return times;
}

//Get a valid user from a request
async function getValidUser(req) {
  if (isValid(req.session) && req.session.authenticated && req.session.email) {
    return await userCollection.findOne({email: req.session.email});
  }
  return null;
}

//Check if a thing is defined
function isValid(thing){
  if(thing == undefined || thing == null){
    return false;
  }
  return true;
}