const express = require("express");
const router = express.Router();
const User = require("../Models/User");
const fileUpload = require("express-fileupload");
const cloudinary = require("cloudinary").v2;
// Package de cryptage
const uid2 = require("uid2");
const SHA256 = require("crypto-js/sha256");
const encBase64 = require("crypto-js/enc-base64");
const convertToBase64 = require("../utils/convertToBase64");

// configuration de cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

// Je crée une route signup pour les inscriptions
router.post("/user/signup", fileUpload(), async (req, res) => {
  try {
    const body = {
      username: req.body.username,
      email: req.body.email,
      password: req.body.password,
      newsletter: req.body.newsletter,
    };
    const salt = uid2(16);
    const hash = SHA256(body.password + salt).toString(encBase64);
    const token = uid2(32);

    // vérifier avant d'enregistrer user que l'email n'existe pas
    const existingUser = await User.findOne({ email: req.body.email });

    if (existingUser) {
      return res.status(400).json({ message: "This email already exists" });
    }
    // vérifier qu'on a toutes les informations
    if (!body.username || !body.email || !body.password) {
      return res.status(400).json({ error: "Missing parameters" });
    }
    const newUser = new User({
      email: body.email,
      account: {
        username: body.username,
        avatar: {},
      },
      newsletter: body.newsletter,
      token: token,
      hash: hash,
      salt: salt,
    });

    // si le nouvel utilisateur a envoyé 1 avatar, on le stocke sur cloudinary et on enregistre le résultat dans la clé avatar de la clé account
    if (req.files.avatar) {
      const convertedAvatar = convertToBase64(req.files.avatar); // convertit le buffer en base64
      const result = await cloudinary.uploader.upload(convertedAvatar, {
        folder: `vinted/users/${newUser._id}`,
      });
      //on ajoute l'image convertie et sauvegardée sur cloudinary dans la clé avatar de notre nouvel utilisateur
      newUser.avatar = result;
    }

    await newUser.save();
    res.status(201).json({
      _id: newUser._id,
      token: newUser.token,
      account: {
        username: newUser.account.username,
        avatar: newUser.account.avatar.url,
      },
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
});

//Je crée une route Login pour se connecter
router.post("/user/login", async (req, res) => {
  try {
    const body2 = {
      email: req.body.email,
      password: req.body.password,
    };
    // trouver à quel utilisateur correspond l'email
    const user = await User.findOne({ email: req.body.email });

    if (!user) {
      // vérifie que l'email utilisaateur existe
      return res.status(400).json({ message: "Invalid email" });
    }
    // je génère un hash avec le mdp du body  et le salt de l'utilisateur
    const hash2 = SHA256(body2.password + user.salt).toString(encBase64);

    // je compare  hash2 et hash
    if (hash2 !== user.hash) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    res.status(200).json({
      _id: user._id,
      token: user.token,
      account: user.account,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
});
module.exports = router;

//     }
// }
