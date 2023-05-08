const express = require("express");
const session = require("express-session");
const app = express();

var port = process.env.PORT || 8000;
app.use("/public", express.static("./public"));

app.use(session({
    secret: "secret",
    resave: true,
    saveUninitialized: true
  })
);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.get("/*", (req, res) => {
  res.send("404, page not found");
});

app.listen(port, () => {
  console.log("Server running on port " + port);
});
