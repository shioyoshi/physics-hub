import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "./config";

export async function uploadImage(file: File, path: string): Promise<string> {
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new Error("ファイルサイズが5MBを超えています。大きなファイルはギガファイル便をご利用ください。");
  }
  const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    throw new Error("画像ファイル（JPEG, PNG, GIF, WebP）のみアップロード可能です。");
  }
  const fileName = `${Date.now()}_${file.name}`;
  const storageRef = ref(storage, `${path}/${fileName}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export async function uploadInventoryImage(file: File, itemId: string): Promise<string> {
  return uploadImage(file, `inventory/${itemId}`);
}

export async function uploadMessageImage(file: File, channelId: string): Promise<string> {
  return uploadImage(file, `messages/${channelId}`);
}
