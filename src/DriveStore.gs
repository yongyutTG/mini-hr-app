/**
 * ============================================================
 * Drive Store — upload images, get public URL
 * ============================================================
 */

/**
 * Upload base64-encoded image to Drive
 * @param {string} base64 - base64 string (no data: prefix)
 * @param {string} filename - desired filename
 * @param {string} subfolder - 'selfies'|'id-cards'|'daily-photos'|'evidence'
 * @returns {string} public URL
 */
function uploadImage(base64, filename, subfolder) {
  if (!base64) throw new Error('missing_base64');

  // Strip data URI prefix if present
  const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, '');

  const folderId = getProp('DRIVE_FOLDER_ID');
  const rootFolder = DriveApp.getFolderById(folderId);

  // Get or create subfolder
  let targetFolder = rootFolder;
  if (subfolder) {
    const sub = getOrCreateSubfolder(rootFolder, subfolder);
    targetFolder = sub;
  }

  // Decode and create blob
  const blob = Utilities.newBlob(
    Utilities.base64Decode(cleanBase64),
    'image/jpeg',
    filename
  );

  // Upload
  const file = targetFolder.createFile(blob);

  // Set permission: anyone with link can view
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  // Return view URL
  const fileId = file.getId();
  return 'https://drive.google.com/uc?id=' + fileId;
}

function getOrCreateSubfolder(parent, name) {
  const folders = parent.getFoldersByName(name);
  if (folders.hasNext()) return folders.next();
  return parent.createFolder(name);
}

/**
 * Delete file from Drive (for cleanup)
 */
function deleteImage(url) {
  try {
    const match = url.match(/id=([a-zA-Z0-9_-]+)/);
    if (!match) return false;
    const fileId = match[1];
    DriveApp.getFileById(fileId).setTrashed(true);
    return true;
  } catch (err) {
    logWarn('deleteImage', err.message, { url });
    return false;
  }
}
