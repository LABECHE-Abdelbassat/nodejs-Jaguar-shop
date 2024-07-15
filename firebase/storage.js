const sharp = require("sharp");
const {
  getStorage,
  ref,
  getDownloadURL,
  uploadBytesResumable,
  deleteObject,
} = require("firebase/storage");

const app = require("./config");

const storage = getStorage(app);

const uploadImage = async (folder, bufferArray, image) => {
  const buffer = await sharp(bufferArray).webp({ quality: 40 }).toBuffer();

  const storageRef = ref(storage, `uploads/${folder}/${image}`);
  const snapshot = await uploadBytesResumable(storageRef, buffer, {
    contentType: "image/webp",
  });

  const url = await getDownloadURL(snapshot.ref);
  return url;
};

const uploadImageToFirebase = async (folder, req) => {
  if (req.file)
    req.body.image = await uploadImage(folder, req.file.buffer, req.body.image);
};
const uploadImageCoverToFirebase = async (folder, req) => {
  if (req.files.imageCover)
    req.body.imageCover = await uploadImage(
      folder,
      req.files.imageCover[0].buffer,
      req.body.imageCover
    );
};
const uploadImagesToFirebase = async (folder, req) => {
  if (req.files.images) {
    const { images } = req.body;
    req.body.images = [];

    await Promise.all(
      req.files.images.map(async (img, index) => {
        // Save image into our db
        req.body.images.push(
          await uploadImage(folder, img.buffer, images[index])
        );
      })
    );
  }
};

const deleteImageFromFirebase = async (folder, url) => {
  const desertRef = ref(
    storage,
    `uploads/${folder}/${url.split("/")[7].split("%2F")[2].split("?")[0]}`
  );

  await deleteObject(desertRef);
};

module.exports = {
  uploadImageToFirebase,
  uploadImageCoverToFirebase,
  uploadImagesToFirebase,
  deleteImageFromFirebase,
};
