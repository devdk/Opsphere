/**
 * Public image hosting for Instagram publishing.
 *
 * The Graph API ingests media by PUBLIC URL, but this app runs on localhost,
 * so rendered PNGs are pushed to Cloudinary first (free tier, unsigned upload
 * preset — no API secret needed). See PHASE1-SETUP.md.
 */

export function isImageHostConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_UPLOAD_PRESET
  );
}

/** Upload PNG bytes; returns a public https URL. */
export async function uploadPublicImage(
  bytes: Buffer,
  filename: string
): Promise<string> {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  const preset = process.env.CLOUDINARY_UPLOAD_PRESET;
  if (!cloud || !preset) {
    throw new Error(
      "CLOUDINARY_CLOUD_NAME / CLOUDINARY_UPLOAD_PRESET are not set in .env.local. " +
        "Instagram needs a public image URL — see PHASE1-SETUP.md."
    );
  }

  const form = new FormData();
  form.append(
    "file",
    new Blob([new Uint8Array(bytes)], { type: "image/png" }),
    filename
  );
  form.append("upload_preset", preset);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloud}/image/upload`,
    { method: "POST", body: form }
  );
  const json = (await res.json()) as {
    secure_url?: string;
    error?: { message?: string };
  };
  if (!res.ok || !json.secure_url) {
    throw new Error(
      `Cloudinary upload failed (${res.status}): ${json.error?.message || "no secure_url in response"}`
    );
  }
  return json.secure_url;
}
