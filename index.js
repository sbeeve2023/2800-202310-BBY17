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
    console.log("Connected to MongoDB");
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
  if (!req.session.authenticated) {
    res.render("landing-loggedout");
    return;
  }

  var user = await userCollection.findOne({
    username: req.session.username
  });

  let recipes = [];
  let images = [];
  if (user.recents) {
    recents = user.recents;
    //get the recipes from the database
    for (let i = 0; i < user.recents.length; i++) {
      let recipe = await recipeCollection.findOne({
        _id: new ObjectId(recents[i])
      });
      if(recipe){
        recipes.push(recipe);
        images.push(await getGoogleImage(recipe.name));
      }
    }
  }

  let time = [];
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
    time.push(timeCurrent);
  }
  for(let i = 0; i < time.length; i++){
    if (time[i].length == 0){
      time[i].push("N/A");
    }
  }


  res.render("landing-loggedin", {
    username: req.session.username,
    recipes: recipes,
    images: images,
    time: time,
  });
});


//ChatGPT
app.get("/generate", async (req, res) => {
  if (!req.session.authenticated) {
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

  res.redirect("ai-substitute?recipeID=" + req.query.recipeID);
});

app.get("/ai-substitute", async (req, res) => {
  if(! await validateAI_Substitute(req, res)){
    return;
  }
  //Get recipe from database
  let originalRecipe = await recipeCollection.findOne({_id: new ObjectId(req.query.recipeID)});

  //Get user from database
  let user = await userCollection.findOne({email: req.session.email});

  orName = originalRecipe.name;
  orIngredients = originalRecipe.ingredientArray;
  let orSteps = parseSteps(originalRecipe.steps);

  //Create dietary restrictions string===================
  let restrictionsArray = []
  let dietaryRestrictions = "that meets dietary restrictions:";
  if (user.diet) {
    restrictionsArray = stringToArrayItem(user.diet);
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
  let request = `recipe for ${orName} ${dietaryRestrictions}. based on the orginal recipe made with`;
  for (let i = 0; i < orIngredients.length; i++) {
    request += ` ${orIngredients[i]},`;
  }
  request += ` and the following steps:`;
  for (let i = 0; i < orSteps.length; i++) {
    request += ` ${orSteps[i]},`;
  }
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
    console.log(aiString);
    let aiObject = JSON.parse(aiString);

    //Generate image
    var imageURL = await getGoogleImage(aiObject.name);

    //Add more data to object
    aiObject.restrictions = restrictionsArray;
    aiObject.imageURL = imageURL;
    aiObject.originalRecipeID = req.query.recipeID;
    aiObject.ownerId =  req.session.userId;
    req.session.aiRecipe = aiObject;
    console.log("Recipe in session",req.session.aiRecipe);

    res.render("ai-frame",{recipe: aiObject, imageURL: imageURL, recipeID: req.query.recipeID});
    return;

  } catch (error) { //If error, render error page
    console.error("Error:", error);
    console.log(restrictionsArray);
    res.render("ai-frame", {error: true, orName: orName, restrictions: restrictionsArray, recipeID: req.query.recipeID})
  }
});


//Ai Recipe save
app.post("/airecipe-save", urlencodedParser, async (req, res) => {
  if (!req.session.authenticated) {
    res.redirect("/login");
    return;
  }

  //Save to databse first
  var aiRecipe = req.session.aiRecipe;
  recipeAlreadySaved = await airecipeCollection.findOne({name: aiRecipe.name, ingredients: aiRecipe.ingredients, steps: aiRecipe.steps, ownerId: req.session.userId});
  if(recipeAlreadySaved){
    res.redirect("/ai-substitute?recipeID=" + aiRecipe.originalRecipeID);
    return;
  }
  await airecipeCollection.insertOne(aiRecipe);
  aiRecipeGet = await airecipeCollection.findOne({name: aiRecipe.name, ingredients: aiRecipe.ingredients, steps: aiRecipe.steps, ownerId: req.session.userId});

  //Get the user's bookmarks
 
  var user = await userCollection.findOne({ email: req.session.email });
  if(!user){
    res.redirect("/login");
    return;
  }
  var bookmarks = [];
  if (user.bookmarks) {bookmarks = user.bookmarks;}
  console.log(aiRecipeGet._id);
  console.log(bookmarks);
  console.log("HELLO");
  bookmarks.push(aiRecipeGet._id);
 
  await userCollection.findOneAndUpdate({
    email: req.session.email
  }, {
    "$set": {
      bookmarks: bookmarks
    }
  });


  res.redirect("/ai-recipe?id=" + req.body.id);

});


//Ai Recipe unsave TODO: Does nothing
app.post("/airecipe-unsave", urlencodedParser, async (req, res) => {
  if (!req.session.authenticated) {
    res.redirect("/login");
    return;
  }
  res.redirect("/ai-recipe?id=" + req.body.id);
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
  if (user == null) {
    res.redirect("/login?error=true");
    return;
  }

  //Check if password is correct
  if (await bcrypt.compare(password, user.password)) {
    //Make a cookie
    console.log(user);
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
  let search = req.query.search;
  let time = req.query.time;
  let diet = req.query.diet;
  if (!diet) {
    diet = 0;
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
  let images = [];

  let connection = {};
  
  if (search) {
    connection.name = {
      $regex: new RegExp(search, "i")
    }
  }
  connection.$and = [];
      if (!(time == 0) && time) {
        connection.tags = {
          $regex: new RegExp(time, "i")
        }
      }
      if (Array.isArray(diet)) {
        connection.$and.push({ $and: diet.map(restriction => ({
          search_terms: { $regex: `\\b${restriction}\\b`, $options: 'i' } }))})
        } else if (diet){
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
  if (connection.$and.length == 0) {
    delete connection.$and;
  }
  console.log(connection);
  if (search) {
  await client.connect();
  const database = await client.db(mongodb_database).collection("recipes");
  recipes = await database.find(connection).limit(20).toArray();
  }
  let times = [];
  for (let i = 0; i < recipes.length; i++) {
    timeCurrent = recipes[i].tags;
    timeCurrent = timeCurrent.replaceAll("'", "");
    timeCurrent = timeCurrent.replaceAll("[", "");
    timeCurrent = timeCurrent.replaceAll("]", "");
    timeCurrent = timeCurrent.split(",");
    recipes[i].name = he.decode(recipes[i].name);
    let imageToPush = await getGoogleImage(recipes[i].name);
    images.push(imageToPush)
    for (let i = timeCurrent.length - 1; i >= 0; i--) {
      if (!timeCurrent[i].includes("minutes") && !timeCurrent[i].includes("hours")) {
        timeCurrent.splice(i, 1);
      }
    }
    times.push(timeCurrent);
  }
  for(let i = 0; i < times.length; i++){
    if (times[i].length == 0){
      times[i].push("N/A");
    }
  }
  res.render("search", {
    search: search,
    recipes: recipes,
    session: req.session,
    times: times,
    images: images,
    profile: profile,
    profileDiet: profileDiet
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
  let time = req.query.time;
  let diet = req.query.diet;
  let images = [];
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
    // search = search.toLowerCase();
    // const keywordArray = search.split(',').map(search => search.trim()); // Split the keywords into an array
    if (typeof search === "string"){
      search = search.split(',');
    }
    for (var i = 0; i < search.length; i++){
      search[i].toLowerCase;
    }
    await client.connect();
    const database = await client.db(mongodb_database).collection("recipes");
    var filter = 1;
    if (filter == 1){
      //CG CODE
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
        } else if (diet){
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
        $or: [
          { ingredientArray: { $all: search } },
          {
            $and: [
              { ingredientArray: { $in: search } }
            ]
          }
        ]
      });
      if (connection.$and.length == 0) {
        delete connection.$and;
      }
      recipes = await database.find(connection).project({ tags: 1,
        name: 1,
        ingredientArray: 1,
        servings: 1,
        score: { $size: { $setIntersection: ["$ingredientArray", search] } } })
        .sort({ score: -1 }).limit(10).toArray();
        console.log('Recipes:', recipes);
    // }else {
    //   recipes = await database.find({
    //     $or: [
    //       {ingredientArray: {$all: search}},
    //       {$and: [
    //         { $expr: { $lte: [{ $size: "$ingredientArray" }, search.length] }},
    //         {ingredientArray: {$in: search}}
    //     ]}
    //   ]
      //BK CODE

    } else {
      try {
        recipes = await database
          .find({
            $or: [
              { ingredientArray: { $all: search } },
              {
                $and: [
                  // { $expr: { $lte: [{ $size: "$ingredientArray" }, search.length] } },
                  { ingredientArray: { $in: search } }
                  // {
                  //     $regex: search.map(ingredient => `\\b${ingredient}\\b`).join('|'),
                  //     $options: 'i'
                  //   }
                ]
              }
            ]
          })
          .project({ tags: 1,
                    name: 1,
                    ingredientArray: 1,
                    servings: 1,
            score: { $size: { $setIntersection: ["$ingredientArray", search] } } })
          .sort({ score: -1 })
          .limit(10)
          .toArray();
      
        // console.log('Recipes:', recipes);
      } catch (error) {
        console.log('Error occurred while executing the query:', error);
      }
      
    // for (var i = 0; i < search.length; i++){
    //   recipes.sort(search[i]);
    // }
    // recipes.project({ score: { $size: { $setIntersection: ["$ingredientArray", search] } } }).sort({ score: -1 });
    // ingredientArray: {
      //   $regex: search.map(ingredient => `\\b${ingredient}\\b`).join('|'),
      //   $options: 'i'
      // }
      // ingredientArray: {$regex: new RegExp(search)}
    }
  }
  if (search) {
    recipes.sort((a, b) => b.score - a.score);
    recipes = recipes.slice(0, 10);
  }
  // console.log('Filtered:', recipes);
  //CG CODE
  for (let i = 0; i < recipes.length; i++) {
    recipes[i].name = he.decode(recipes[i].name);
    let apiUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(recipes[i].name)}&searchType=image`;
        await fetch(apiUrl).then((response) => response.json()).then((data) => {
            if (data.items && data.items.length > 0) {
              const imageUrl = encodeURIComponent(data.items[0].link);
              images.push(imageUrl);
            } else {
              console.log("No images found.");
              images.push(encodeURIComponent('https://media.istockphoto.com/id/184276935/photo/empty-plate-on-white.jpg?s=612x612&w=0&k=20&c=ZRYlQdMJIfjoXbbPzygVkg8Hb9uYSDeEpY7dMdoMtdQ='));
            }
          })
          .catch((error) => {
            console.error("An error occurred:", error);
          });
  }
  //BK CODE

  // console.log("res" + recipes);
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
  for(let i = 0; i < times.length; i++){
    if (times[i].length == 0){
      times[i].push("N/A");
    }
  }
console.log(search);

  res.render("searchIngredients", {
    recipes: recipes,
    session: req.session,
    times: times,
    current: search,
    images: images,
    profileDiet: profileDiet
  });
});

//turns using the profile diets on and off in the search pages
app.get("/useDiet", urlencodedParser, async (req, res) => {
  console.log(req.query);
  if (req.query.type == "off") {
    req.session.useDiet = false;
  } else {
    req.session.useDiet = true;
    console.log(req.session.useDiet);
  }
  if (req.query.return == "regular") {
  res.redirect("/search");
  } else {
    res.redirect("/searchIngredients");
  }
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
  
  if (user.bookmarks != undefined) {
    var bookmarkIds = user.bookmarks;
    let recipe =[] ;
    
    for (let i = 0; i < bookmarkIds.length; i++) {
      recipe = await recipeCollection.findOne({
        _id: bookmarkIds[i]
      });
      if (recipe == null) {
        recipe = await airecipeCollection.findOne({
          _id: bookmarkIds[i]
        });
      }
      if(recipe){
      bookmarks.push(recipe);
      imageURL = await getGoogleImage(recipe.name);
      if(imageURL == ""){
        imageURL = encodeURIComponent('https://media.istockphoto.com/id/184276935/photo/empty-plate-on-white.jpg?s=612x612&w=0&k=20&c=ZRYlQdMJIfjoXbbPzygVkg8Hb9uYSDeEpY7dMdoMtdQ=');
      }
      images.push(imageURL);
      }
    }
  }


  let time = [];

    for (let i = 0; i < bookmarks.length; i++) {
      if (bookmarks[i].tags) {
        console.log(bookmarks[i]);
        timeCurrent = bookmarks[i].tags;
        timeCurrent = timeCurrent.replaceAll("'", "");
        timeCurrent = timeCurrent.replaceAll("[", "");
        timeCurrent = timeCurrent.replaceAll("]", "");
        timeCurrent = timeCurrent.split(",");
        for (let i = timeCurrent.length - 1; i >= 0; i--) {
          if (!timeCurrent[i].includes("minutes") && !timeCurrent[i].includes("hours")) {
            timeCurrent.splice(i, 1);
          }
        }
        time.push(timeCurrent);
      } else if (bookmarks[i].make_time) {
        time.push([bookmarks[i].make_time]);
      }
    }
    for (let i = 0; i < time.length; i++) {
      if (time[i].length == 0) {
        time[i].push("N/A");
      }
    }




console.log(bookmarks);
  res.render("profile", {
    session: req.session,
    bookmarks: bookmarks,
    images: images,
    time: time,
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
  res.redirect("/profile");
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
    while (user.recents.length >= 20) {
      recents.shift();
    }    
  }
  //Add to recents
  recents.push(new ObjectId(req.query.id));
  await userCollection.updateOne({email: req.session.email }, { $set: {recents: recents } });
}




  var recipeId = new ObjectId(req.query.id);
  var recipeTime = req.query.time;

  // var recipeId = new ObjectId("645c034dda87e30762932eb4");
  //Query and parse parts of the recipe
  console.log(recipeId);
  var read = await recipeCollection.find({
    _id: recipeId
  }).limit(1).toArray();  
  recipeName = read[0].name;

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
    bookmarked: isBookmarked,
    name: recipeName,
    ingredients: recipeIngList,
    servings: recipeServings,
    steps: recipeSteps,
    searchterms: recipeTerms,
    size: recipeSize,
    time: recipeTime,
    Image: recipeImg,
    authenticated: req.session.authenticated,
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

app.get("/test", async (req, res) => {
  res.render("test", {session: req.session});
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

//Image test for reference
app.get("/test", async (req, res) => {
  const apiKey = 'AIzaSyAwcRjPb6XAQafnNnNF2QP5EeU4kQGRQ4k';
  const searchEngineId = '139666e4b509c4654';
  const searchTerm = 'banana';

  const apiUrl = `https://www.googleapis.com/customsearch/v1?key=AIzaSyAwcRjPb6XAQafnNnNF2QP5EeU4kQGRQ4k&cx=${searchEngineId}&q=${encodeURIComponent(searchTerm)}&searchType=image`;

fetch(apiUrl)
  .then(response => response.json())
  .then(data => {
    if (data.items && data.items.length > 0) {
      const imageUrl = data.items[0].link;
      console.log('Image URL:', imageUrl);
      res.render("test", { url: imageUrl });
    } else {
      console.log('No images found.');
    }
  })
  .catch(error => {
    console.error('An error occurred:', error);
  });
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

 try {
   new ObjectId(req.query.recipeID);
 } catch{
   console.log("Invalid recipe ID");
   res.render("pageNotFound");
   return false;
 }

 //Don't regenerate if recipe is already loaded
 if(req.session.aiRecipe){
   res.render("ai-frame", {recipe: req.session.aiRecipe, recipeID: req.query.recipeID});
   return false;
 }
  //Get recipe from database
  let originalRecipe = await recipeCollection.findOne({_id: new ObjectId(req.query.recipeID)});
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
  var imageFullURL = "";
  let apiUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(searchTerm)}&searchType=image`;
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
  return decodeURIComponent(imageFullURL);
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

