const User = require("../Models/User");

const isAuthenticated = async (req, res, next) => {
  console.log("on est dans le middleware");
  try {
    if (!req.headers.authorization) {
      // si le token n'existe pas (Est-ce que le token existe?)
      return res.status(401).json({ message: "Unauthorized (missing token)" });
    }
    // Extraction du token (sans le préfixe "Bearer ")
    const token = req.headers.authorization.replace("Bearer ", "");

    //Est-ce que le token correspond à qqn ?
    const user = await User.findOne({ token: token });

    if (!user) {
      // si le token ne correspond pas (si user n'existe pas)
      return res.status(401).json({ message: "Unauthorized" });
    }
    // je rajoute une clé à req puis je fais next
    req.user = user; // Ajout de l'utilisateur à req pour utilisation ultérieure
    next();
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: error.message });
  }
};

module.exports = isAuthenticated;
