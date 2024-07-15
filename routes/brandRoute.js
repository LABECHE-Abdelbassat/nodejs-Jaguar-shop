const express = require("express");
const expressAsyncHandler = require("express-async-handler");

const {
  getBrandValidator,
  createBrandValidator,
  updateBrandValidator,
  deleteBrandValidator,
} = require("../utils/validators/brandValidator");

const authService = require("../services/authService");
const BrandModel = require("../models/brandModel");

const {
  getBrands,
  getBrand,
  deleteBrand,
  uploadBrandImage,
  resizeImage,
} = require("../services/brandService");
const {
  deleteImageFromFirebase,
  uploadImageToFirebase,
} = require("../firebase/storage");
const ApiError = require("../utils/apiError");

const router = express.Router();

router
  .route("/")
  .get(getBrands)
  .post(
    authService.protect,
    authService.allowedTo("admin", "manager"),
    uploadBrandImage,
    resizeImage,
    createBrandValidator,
    expressAsyncHandler(async (req, res) => {
      const brand = new BrandModel(req.body);

      if (req.file) {
        await uploadImageToFirebase("brands", req);
        brand.image = req.body.image;
      }
      await brand.save();
      res.status(201).json({ data: brand });
    })
  );
router
  .route("/:id")
  .get(getBrandValidator, getBrand)
  .put(
    authService.protect,
    authService.allowedTo("admin", "manager"),
    uploadBrandImage,
    resizeImage,
    updateBrandValidator,
    expressAsyncHandler(async (req, res, next) => {
      const brand = await BrandModel.findById(req.params.id);

      if (!brand) {
        return next(
          new ApiError(`No document for this id ${req.params.id}`, 404)
        );
      }
      const coverImage = brand.image;

      if (req.file) await uploadImageToFirebase("brands", req);

      // Update brand properties
      Object.entries(req.body).forEach(([key, value]) => {
        brand[key] = value;
      });
      // Trigger "save" event when update document
      await brand.save();
      if (req.file && coverImage)
        await deleteImageFromFirebase("brands", coverImage);
      res.status(200).json({ data: brand });
    })
  )
  .delete(
    authService.protect,
    authService.allowedTo("admin"),
    deleteBrandValidator,
    expressAsyncHandler(async (req, res, next) => {
      const { id } = req.params;
      const document = await BrandModel.findByIdAndDelete(id);
      await deleteImageFromFirebase("brands", document.image);

      if (!document) {
        return next(new ApiError(`No document for this id ${id}`, 404));
      }

      // Trigger "remove" event when update document
      document.remove();
      res.status(204).send();
    })
  );

module.exports = router;
