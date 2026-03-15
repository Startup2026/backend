const multer = require("multer");
const path = require("path");
const { randomUUID } = require("crypto");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const awsRegion = process.env.AWS_REGION || process.env.S3_REGION;
const awsBucketName =
  process.env.AWS_S3_BUCKET_NAME || process.env.AWS_BUCKET_NAME || process.env.S3_BUCKET_NAME;
const awsBucketFolder = process.env.AWS_S3_BUCKET_FOLDER || "";

const s3ClientConfig = {
  region: awsRegion,
};

if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  s3ClientConfig.credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  };
}

const s3Client = new S3Client(s3ClientConfig);

const storage = multer.memoryStorage();
const baseUploader = multer({ storage });

const buildS3Key = (file) => {
  const ext = path.extname(file.originalname || "") || "";
  const fileName = `file-${randomUUID()}${ext}`;
  return awsBucketFolder
    ? `${awsBucketFolder.replace(/\/$/, "")}/${fileName}`
    : fileName;
};

const buildS3Url = (key) => `https://${awsBucketName}.s3.${awsRegion}.amazonaws.com/${key}`;

const gatherMulterFiles = (req) => {
  const files = [];

  if (req.file) files.push(req.file);

  if (Array.isArray(req.files)) {
    files.push(...req.files);
  } else if (req.files && typeof req.files === "object") {
    Object.values(req.files).forEach((value) => {
      if (Array.isArray(value)) files.push(...value);
    });
  }

  return files;
};

const uploadParsedFilesToS3 = async (req) => {
  if (!awsRegion || !awsBucketName) {
    throw new Error("AWS S3 configuration is missing. Set AWS_REGION and AWS_S3_BUCKET_NAME in environment variables.");
  }

  const files = gatherMulterFiles(req);
  if (!files.length) return;

  await Promise.all(
    files.map(async (file) => {
      const key = buildS3Key(file);

      await s3Client.send(
        new PutObjectCommand({
          Bucket: awsBucketName,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        })
      );

      // Normalize fields used by existing controllers.
      file.filename = key;
      file.key = key;
      file.location = buildS3Url(key);
      file.url = file.location;
    })
  );
};

const withS3Upload = (multerMiddleware) => async (req, res, next) => {
  multerMiddleware(req, res, async (err) => {
    if (err) return next(err);

    try {
      await uploadParsedFilesToS3(req);
      return next();
    } catch (uploadErr) {
      return next(uploadErr);
    }
  });
};

module.exports = {
  single: (fieldName) => withS3Upload(baseUploader.single(fieldName)),
  array: (fieldName, maxCount) => withS3Upload(baseUploader.array(fieldName, maxCount)),
  fields: (fieldsConfig) => withS3Upload(baseUploader.fields(fieldsConfig)),
  any: () => withS3Upload(baseUploader.any()),
  none: () => withS3Upload(baseUploader.none()),
};