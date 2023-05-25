# Meal Matcher

# Project Description
Our Team BBY17 is creating a kitchen app to help young adults save on groceries by finding delicious online recipes that utilize their spare ingredients

# Technologies Used
For the frontend we used tailwind, for the backend we used nodejs, joi, bcrypt, and dotenv, as for the database we used mongodb.

# File Contents 
```
|   .env
|   .gitignore
|   connections.js
|   dev.txt
|   index.html
|   index.js
|   package-lock.json
|   package.json
|   Procfile
|   readme.md
|   tailwind.config.js
|   Tree.txt
|   utils.js
|   
+---dist
|       output.css
|       
+---public
|   |   avatar-gene2da1ab92aa0244882177a848c7193aa.jpg
|   |   logo-placeholder.png
|   |   Profile_avatar_placeholder_large.png
|   |   user_profile.html
|   |   
|   +---icons
|   |       close-button.svg
|   |       close-button2.svg
|   |       cracked-egg-icon.svg
|   |       home.svg
|   |       icons8-ingredients-80.svg
|   |       ingredients-for-cooking-svgrepo-com.svg
|   |       ingredients-svgrepo-com.svg
|   |       ingredients-svgrepo-com2.svg
|   |       ingredients-svgrepo-com3.svg
|   |       ingredients.svg
|   |       search-svgrepo-com.svg
|   |       search.svg
|   |       serving.svg
|   |       user.svg
|   |       
|   \---images
|           404.png
|           Cereals-and-Pulses.jpg
|           condiments.jpg
|           cracked-egg-icon.png
|           cracked-egg.jpg
|           dairy.jpg
|           EggGif32.gif
|           EggGifLQ.gif
|           fats_and_oils.jpeg
|           fruits.jpg
|           Landing image.jpg
|           logo_transparent.png
|           logo_transparent2.png
|           logo_transparent_banner.png
|           meat.jpg
|           nuts-seeds.jpeg
|           profile-default.png
|           seafood.jpg
|           spices.webp
|           sugarprod.jpg
|           unknown.png
|           vegetables.jpg
|           
+---scripts
|       search.js
|       
+---styles
|       styles.css
|       
\---views
    |   aboutus.ejs
    |   ai-frame.ejs
    |   ai-recipe.ejs
    |   change-password.ejs
    |   changed-password.ejs
    |   changed-profile.ejs
    |   dietEdit.ejs
    |   easterEgg.ejs
    |   landing-loggedin.ejs
    |   landing-loggedout.ejs
    |   login.ejs
    |   pageNotFound.ejs
    |   privacypolicy.ejs
    |   profile.ejs
    |   recipe.ejs
    |   search.ejs
    |   searchIngredients.ejs
    |   signup.ejs
    |   test.ejs
    |   
    \---templates
            ai-button.ejs
            cat-button.ejs
            desktop-navbar.ejs
            footer.ejs
            header.ejs
            mobile-navbar.ejs
            recipe-card.ejs
```

# How to install and run

1. Clone the repository
2. Go to https://nodejs.org/en/download and download nodejs
3. Open repository location in terminal
4. Run npm install
5. Drag the .env for the api keys (contact us for this file) file into the root directory
6. Confirm that .env is named correctly
7. Run node index.js
8. Open localhost:8000 in your browser

Here is a testing plan we made so you can see our testing history:
https://docs.google.com/spreadsheets/d/1D8YXa3D2G9aIpA3kMWd6M6QgwOZY5xQWTx7-X7WgVRU/edit?usp=sharing



# How to use

1. Create an account or click search by recipe to search by ingredients
2. Once signed in click meal match to find recipes that match your ingredients
3. Click on prep time to sort by prep time, or click on advanced filter to filter by diet
4. Click on a recipe to view the recipe
5. Scroll down to view the ingredients and instructions, along with an ai button to change the recipe to your liking
6. Click on the ai button and select your dietary restrictions and click generate recipe
7. Wait for the ai to generate a recipe and view the new recipe
8. Click on the save button to save the recipe to your profile
9. Click on the profile button to view your saved recipes
10. Click on the edit dietary preference button to edit your profile
11. Click on the change password button to change your password


# Credits, Licenses, and References

- Google Custum Search API
https://developers.google.com/custom-search/v1/overview

- ChatGPT
https://openai.com/blog/introducing-chatgpt-and-whisper-apis

- Tailwind
https://tailwindcss.com/

- NodeJS
https://nodejs.org/en/

- Joi
https://joi.dev/

- Bcrypt
https://www.npmjs.com/package/bcrypt

- Dotenv
https://www.npmjs.com/package/dotenv

- MongoDB
https://www.mongodb.com/

# AI usage 
We used chatgpt to solve bugs and find methods to code our app, a majority of us also used copilot to help us code. 
We did not use ai to clean up our dataset, we used java and manually cleaned.
Our app does use ai to generate recipes based on the user's dietary restrictions.
For the purposes I intended, I encountered very few limitations. At worst it would sometimes fail to return a parseable json file, but after developing a try/catch system for this, it became no big deal. In fact I noticed that limitations traditionally associated with ChatGPT were alleviated through our APi calls. As an example, using normal chatgpt you could not request a recipe for uranium 238 soup without it returning an error and refusing to continue. With our app, no such restriction exists.

# Contact Information
For any questions or concerns please contact us at
- Callum Goss - cgoss3@my.bcit.ca
- Kade Fraser - kfraser67@my.bcit.ca
- Vitor Gaura - vrosaguara@my.bcit.ca
- Blaise Klein - bklein13@my.bcit.ca



