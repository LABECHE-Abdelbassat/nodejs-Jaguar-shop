const express = require("express");
const expressAsyncHandler = require("express-async-handler");

const {
  getCategoryValidator,
  createCategoryValidator,
  updateCategoryValidator,
  deleteCategoryValidator,
} = require("../utils/validators/categoryValidator");

const {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  uploadCategoryImage,
  resizeImage,
} = require("../services/categoryService");

const authService = require("../services/authService");
const CategoryModel = require("../models/categoryModel");
const {
  deleteImageFromFirebase,
  uploadImageToFirebase,
} = require("../firebase/storage");
const ApiError = require("../utils/apiError");

const subcategoriesRoute = require("./subCategoryRoute");

const router = express.Router();

// Nested route
router.use("/:categoryId/subcategories", subcategoriesRoute);

router
  .route("/")
  .get(getCategories)
  .post(
    authService.protect,
    authService.allowedTo("admin", "manager"),
    uploadCategoryImage,
    resizeImage,
    createCategoryValidator,
    expressAsyncHandler(async (req, res) => {
      const category = new CategoryModel(req.body);

      if (req.file) {
        await uploadImageToFirebase("categories", req);
        category.image = req.body.image;
      }
      await category.save();
      res.status(201).json({ data: category });
    })
  );
router
  .route("/:id")
  .get(getCategoryValidator, getCategory)
  .put(
    authService.protect,
    authService.allowedTo("admin", "manager"),
    uploadCategoryImage,
    resizeImage,
    updateCategoryValidator,
    expressAsyncHandler(async (req, res, next) => {
      const category = await CategoryModel.findById(req.params.id);

      if (!category) {
        return next(
          new ApiError(`No document for this id ${req.params.id}`, 404)
        );
      }
      const coverImage = category.image;

      if (req.file) await uploadImageToFirebase("categories", req);

      // Update category properties
      Object.entries(req.body).forEach(([key, value]) => {
        category[key] = value;
      });
      // Trigger "save" event when update document
      await category.save();
      if (req.file && coverImage)
        await deleteImageFromFirebase("categories", coverImage);
      res.status(200).json({ data: category });
    })
  )
  .delete(
    authService.protect,
    authService.allowedTo("admin"),
    deleteCategoryValidator,
    expressAsyncHandler(async (req, res, next) => {
      const { id } = req.params;
      const document = await CategoryModel.findByIdAndDelete(id);
      await deleteImageFromFirebase("categories", document.image);

      if (!document) {
        return next(new ApiError(`No document for this id ${id}`, 404));
      }

      // Trigger "remove" event when update document
      document.remove();
      res.status(204).send();
    })
  );

module.exports = router;
