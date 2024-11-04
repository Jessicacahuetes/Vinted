// 1. import des packages
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

// nodem// 2. création du serveur
const app = express();
app.use(cors());
// 3. middleware pour récup les body
app.use(express.json());
// 4. se connecter à la BDD
mongoose.connect(process.env.MONGODB_URI);

// 5. import de mes routers
const userRouter = require("./routes/user");
const offerRouter = require("./routes/offer");

// import de mes routes
app.use(offerRouter);

// Je crée une route d'accueil
app.get("/", (req, res) => {
  res.status(200).json({ message: "welcome to Vinted" });
});
// utilisation de mes routers
app.use(userRouter);

// une route poubelle en cas de fausse route
app.all("*", (req, res) => {
  res.status(404).json({ message: "all route" });
});

// je fais tourner mon server sur le port 3000
app.listen(process.env.PORT, () => {
  console.log("Server Started 👗 ");
});
