/**
 * Browser-side: scales an image to 1200px wide before upload so requests stay
 * well under the hosting body-size limit. Uses WebP where the browser can encode
 * it (keeps transparency), otherwise JPEG on white. The server normalises to .webp.
 */
export async function shrinkImage(file: File, width = 1200): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = Math.round(bitmap.height * (width / bitmap.width));
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    const base = file.name.replace(/\.[^.]+$/, "");

    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const webp = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.9));
    if (webp && webp.type === "image/webp") return new File([webp], `${base}.webp`, { type: "image/webp" });

    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const jpeg = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.92));
    return jpeg ? new File([jpeg], `${base}.jpg`, { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}
