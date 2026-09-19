import { getBackendUrl } from './api';

export const getCleanImageUrl = (url) => {
  if (!url) return '';
  let fileId = '';
  const fileDMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  const idParamMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);

  if (fileDMatch && fileDMatch[1]) {
    fileId = fileDMatch[1];
  } else if (idParamMatch && idParamMatch[1]) {
    fileId = idParamMatch[1];
  }

  if (fileId) {
    return `${getBackendUrl()}/api/image-proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
};

export const getGoogleDrivePreviewUrl = (url) => {
  if (!url) return '';
  let fileId = '';
  const fileDMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  const idParamMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);

  if (fileDMatch && fileDMatch[1]) {
    fileId = fileDMatch[1];
  } else if (idParamMatch && idParamMatch[1]) {
    fileId = idParamMatch[1];
  }

  if (fileId) {
    return `https://drive.google.com/file/d/${fileId}/preview`;
  }
  return url;
};

export const formatDesignTime = (createdAtStr) => {
  if (!createdAtStr) return '';
  try {
    const d = new Date(createdAtStr);
    if (isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch (e) {
    return '';
  }
};

export const GARMENT_CATEGORIES = [
  "T-SHIRT R/N",
  "T-SHIRT COLLAR",
  "LOWER",
  "SWEATSHIRT R/N",
  "SWEATSHIRT HOODIE",
  "SWEATSHIRT COLLAR",
  "WINDCHEATER",
  "JACKET",
  "TRACK SUIT",
  "SHIRT",
  "SWEATSHIRT",
  "T-SHIRT",
  "JOGGER",
  "SANDOW",
  "NIKKER",
  "DROPSHOULDER",
  "TRACK SUIT + SHIRT",
  "TRACK SUIT + T-SHIRT",
  "TRACKSUIT + LOWER",
  "TS - UPPER",
  "TS - LOWER"
];
