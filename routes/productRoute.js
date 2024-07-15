const express = require("express");
const expressAsyncHandler = require("express-async-handler");

const {
  getProductValidator,
  createProductValidator,
  updateProductValidator,
  deleteProductValidator,
} = require("../utils/validators/productValidator");

const {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  uploadProductImages,
  resizeProductImages,
} = require("../services/productService");
const authService = require("../services/authService");
const reviewsRoute = require("./reviewRoute");
const ProductModel = require("../models/productModel");

const {
  deleteImageFromFirebase,
  uploadImageToFirebase,
  uploadImageCoverToFirebase,
  uploadImagesToFirebase,
} = require("../firebase/storage");
const ApiError = require("../utils/apiError");

const router = express.Router();

// POST   /products/jkshjhsdjh2332n/reviews
// GET    /products/jkshjhsdjh2332n/reviews
// GET    /products/jkshjhsdjh2332n/reviews/87487sfww3
router.use("/:productId/reviews", reviewsRoute);

router
  .route("/")
  .get(getProducts)
  .post(
    authService.protect,
    authService.allowedTo("admin", "manager"),
    uploadProductImages,
    resizeProductImages,
    createProductValidator,
    expressAsyncHandler(async (req, res) => {
      const product = new ProductModel(req.body);

      if (req.files.imageCover) {
        await uploadImageCoverToFirebase("products", req);
        product.imageCover = req.body.imageCover;
      }

      if (req.files.images) {
        await uploadImagesToFirebase("products", req);
        product.images = req.body.images;
      }
      await product.save();
      res.status(201).json({ data: product });
    })
  );
router
  .route("/:id")
  .get(getProductValidator, getProduct)
  .put(
    authService.protect,
    authService.allowedTo("admin", "manager"),
    uploadProductImages,
    resizeProductImages,
    updateProductValidator,
    expressAsyncHandler(async (req, res, next) => {
      const product = await ProductModel.findById(req.params.id);

      if (!product) {
        return next(
          new ApiError(`No document for this id ${req.params.id}`, 404)
        );
      }
      const image = product.imageCover;
      const productImages = product.images;

      if (req.files.imageCover) {
        await uploadImageCoverToFirebase("products", req);
      }

      if (req.files.images) {
        await uploadImagesToFirebase("products", req);
      }
      // Update brand properties
      Object.entries(req.body).forEach(([key, value]) => {
        product[key] = value;
      });
      // Trigger "save" event when update document
      await product.save();
      if (req.files.imageCover && image) {
        await deleteImageFromFirebase("products", image);

        if (productImages) {
          productImages.forEach(async (img) => {
            await deleteImageFromFirebase("products", img);
          });
          if (!req.body.images) {
            product.images = [];
          }
          await product.save();
        }
      } else if (req.files.images && productImages) {
        productImages.forEach(async (img) => {
          await deleteImageFromFirebase("products", img);
        });
      }

      res.status(200).json({ data: product });
    })
  )
  .delete(
    authService.protect,
    authService.allowedTo("admin"),
    deleteProductValidator,
    expressAsyncHandler(async (req, res, next) => {
      const { id } = req.params;
      const document = await ProductModel.findByIdAndDelete(id);
      await deleteImageFromFirebase("products", document.imageCover);
      document.images.forEach(async (img) => {
        await deleteImageFromFirebase("products", img);
      });
      if (!document) {
        return next(new ApiError(`No document for this id ${id}`, 404));
      }

      // Trigger "remove" event when update document
      document.remove();
      res.status(204).send();
    })
  );

module.exports = router;
