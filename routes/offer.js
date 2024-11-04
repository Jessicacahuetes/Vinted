const express = require("express");
const fileUpload = require("express-fileupload");
const cloudinary = require("cloudinary").v2; // ATTENTION AU .v2

//import de mon middleware
const isAuthenticated = require("../middlewares/isAuthenticated");
const convertToBase64 = require("../utils/convertToBase64");
const Offer = require("../Models/Offer");

const router = express.Router();

// configuration de cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

//Route pour publier une annonce
router.post(
  "/offer/publish",
  isAuthenticated,
  fileUpload(),
  async (req, res) => {
    try {
      const offer = {
        title: req.body.title,
        description: req.body.description,
        price: req.body.price,
        condition: req.body.condition,
        city: req.body.city,
        brand: req.body.brand,
        size: req.body.size,
        color: req.body.color,
        picture: req.files.picture,
      };
      // s'assurer que tous les params soient bien complets (qu'ils existent)
      if (!offer.title || !offer.price || !offer.brand || !offer.price) {
        return res.status(400).json({ message: "Missing informations" });
      }
      // dans ce cas je peux créer la nouvelle offre
      const newOffer = new Offer({
        product_name: offer.title,
        product_description: offer.description,
        product_price: offer.price,
        product_details: [
          { MARQUE: offer.brand },
          { TAILLE: offer.size },
          { ÉTAT: offer.condition },
          { COULEUR: offer.color },
          { EMPLACEMENT: offer.city },
        ],
        product_image: offer.picture,
        owner: req.user,
      });
      // Sauvegarder de l'image sur Cloudinary
      const convertedPicture = convertToBase64(req.files.picture); // convertit le buffer en base64
      const result = await cloudinary.uploader.upload(convertedPicture, {
        folder: `/vinted/offers/${newOffer._id}`,
      });
      //on ajoute l'image convertie et sauvegardée sur cloudinary dans la clé product image de notre nouvelle offre
      newOffer.product_image = result;
      await newOffer.save(); // sauvegarde l'annonce dans notre BDD
      res.status(201).json({ message: `${newOffer}` });
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ error: error.message });
    }
  }
);

// nouvelle route en get pour récupérer un tableau avec l'ensembles des annonces et le nombre total d'annonce.

router.get("/offers", async (req, res) => {
  try {
    // j'extrais les requêtes pour pouvoir construire les filtres // la page affichera toujours la page 1 par défaut si elle n'est pas renseignée.
    const { title, priceMin, priceMax, sort, page = 1 } = req.query;
    // lorsqu'il n'y a pas de filtre tous les produits sont affichés. on va donc construire un filtre avec une regexp insensible à la casse.
    const limit = 5; //  je fixe l'affichage à 5 articles par page.
    const filter = {}; // objet qui va recevoir les filtres choisis, que l'on va construire.
    if (title) {
      // si le paramètre title existe alors
      filter.product_name = new RegExp(title, "i");
    }
    if (priceMin || priceMax) {
      // si priceMin et ou priceMax existent alors on les ajoute dans l'objet filtre
      filter.product_price = {};
      if (priceMin) {
        filter.product_price.$gte = Number(priceMin);
      }
      if (priceMax) {
        filter.product_price.$lte = Number(priceMax);
      }
    }
    // avant d'afficher les résultats il faut les trier.
    const pickedSort = {};
    if (sort === "price-desc") {
      pickedSort.product_price = -1;
    } else if (sort === "price-asc") {
      pickedSort.product_price = 1;
    }

    const offers = await Offer.find(filter)
      .sort(pickedSort)
      .limit(limit)
      .skip((page - 1) * Number(limit))
      .populate("owner", "account")
      .select("product_name product_price");
    //console.log(offers);
    const totalCount = await Offer.countDocuments(filter);

    res.json({ count: totalCount, offers: offers });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: error.message });
  }
});

// route pour avoir les détails d'une annonce en fonction de son id.

router.get("/offers/:id", async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id).populate(
      "owner",
      "account"
    );
    res.status(200).json(offer);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: error.message });
  }
});

// route pour permettre aux créateurs des annonces de pouvoir les modifier

router.put("/offers/:id", isAuthenticated, async (req, res) => {
  try {
    // verifier que l'annonce existe
    const offerToUpdate = await Offer.findById(req.params.id);
    if (!offerToUpdate) {
      return res.status(404)({ message: "Bad request" });
    }
    // on recupère notre requête pour modifier l'offre
    const { title, description, price, condition, city, brand, size, color } =
      req.body;

    //on modifie le titre
    if (title) {
      offerToUpdate.product_name = title;
    }
    if (description) {
      offerToUpdate.product_description = description;
    }
    if (price) {
      offerToUpdate.product_price = price;
    }
    // on doit remplacer chaque valeur de chaque objet du tableau product_details par les valeurs de la requête.
    const updatedDetails = offerToUpdate.product_details;
    for (const detail of updatedDetails) {
      if (detail.MARQUE && brand) {
        detail.MARQUE = brand;
      }
      if (detail.TAILLE && size) {
        detail.TAILLE = size;
      }
      if (detail.ÉTAT && condition) {
        detail.ÉTAT = condition;
      }
      if (detail.COULEUR && color) {
        detail.COULEUR = color;
      }
      if (detail.EMPLACEMENT && city) {
        detail.EMPLACEMENT = city;
      }
    }
    // Dans son modèle product_details est décrite comme étant de type Array. Or on stocke à l'intérieur un tableau d'objet. Lorsque l'on modifie un élément qui n'est pas explicitement prévu dans le modèle, le .save() ne suffit pas à sauvegardr les mofications. On doit le notifier de la sorte avant la sauvegarde afin qu'elle soit bien prise en compte. (Voir pour aller plus loin => Schemas, Models & markModified)
    offerToUpdate.markModified("product_details");

    // si on reçoit une nouvelle photo il faut la mettre à jour
    if (req.files && req.files.picture) {
      // On supprime l'ancienne
      await cloudinary.uploader.destroy(offerToUpdate.product_image);
      // On upload la nouvelle
      const result = await cloudinary.uploader.upload(
        convertToBase64(req.files.picture),
        {
          folder: `/vinted/offers/${offerToUpdate._id}`,
        }
      );
      // On remplace la clef product_image et le premier élément du tableau product_pictures
      offerToUpdate.product_image = result;
      offerToUpdate.product_pictures[0] = result;
    }
    // Sauvegarde de l'offre
    await offerToUpdate.save();
    res.status(200).json("Offer modified succesfully !");
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
