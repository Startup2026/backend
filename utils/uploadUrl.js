const getUploadedFileUrl = (file) => {
  if (!file) return null;
  if (file.location) return file.location;
  if (file.url) return file.url;
  return null;
};

module.exports = { getUploadedFileUrl };
