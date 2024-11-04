const mongoose = require("mongoose");

// 5. créer un modèle User dans la BDD
const User = mongoose.model("User", {
  email: String,
  account: {
    username: String,
    avatar: Object,
    newsletter: Boolean,
    token: String,
    hash: String,
    salt: String,
  },
});

module.exports = User;
