"use client";

import { createClient } from "@/lib/supabase/client";
import { MARKETPLACE_MEDIA_BUCKET } from "@/lib/media";

const MAX_EDGE = 1800;
const JPEG_QUALITY = 0.82;

async function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Unable to compress image."));
        return;
      }

      resolve(blob);
    }, type, quality);
  });
}

async function compressImageFile(file: File) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Unable to prepare the browser image compressor.");
  }

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await canvasToBlob(canvas, "image/jpeg", JPEG_QUALITY);
  const fileName = file.name.replace(/\.[a-z0-9]+$/i, "") || "buyerboard-photo";

  return new File([blob], `${fileName}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

export async function uploadCompressedImages(input: { files: File[]; folder: string }) {
  if (input.files.length === 0) {
    return [] as string[];
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Sign in required.");
  }

  const uploadedUrls: string[] = [];

  for (const file of input.files.slice(0, 6)) {
    const compressed = await compressImageFile(file);
    const path = `${user.id}/${input.folder}/${crypto.randomUUID()}.jpg`;

    const { error: uploadError } = await supabase.storage.from(MARKETPLACE_MEDIA_BUCKET).upload(path, compressed, {
      contentType: "image/jpeg",
      upsert: false,
    });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data } = supabase.storage.from(MARKETPLACE_MEDIA_BUCKET).getPublicUrl(path);
    uploadedUrls.push(data.publicUrl);
  }

  return uploadedUrls;
}
