const API = "https://api.linkedin.com";

export function getLinkedInToken(): string {
  const t = process.env.LINKEDIN_ACCESS_TOKEN;
  if (!t) throw new Error("LINKEDIN_ACCESS_TOKEN is not set in .env.local.");
  return t;
}

export interface LinkedInIdentity {
  name?: string;
  sub?: string;
  urn?: string;
}

/** Read-only: confirm the token is valid and return the member identity. */
export async function verifyLinkedIn(): Promise<LinkedInIdentity> {
  const token = getLinkedInToken();
  const res = await fetch(`${API}/v2/userinfo`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`userinfo failed: ${res.status} ${await res.text()}`);
  }
  const me = (await res.json()) as { name?: string; sub?: string };
  return {
    name: me.name,
    sub: me.sub,
    urn: me.sub ? `urn:li:person:${me.sub}` : undefined,
  };
}

/**
 * Publish a plain-text post to the member's personal feed (w_member_social).
 * Returns the created post id.
 */
export async function postText(
  text: string,
  visibility: "PUBLIC" | "CONNECTIONS" = "PUBLIC"
): Promise<string> {
  const token = getLinkedInToken();
  const author = process.env.LINKEDIN_PERSON_URN;
  if (!author) {
    throw new Error("LINKEDIN_PERSON_URN is not set in .env.local.");
  }
  const res = await fetch(`${API}/v2/ugcPosts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      author,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text },
          shareMediaCategory: "NONE",
        },
      },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": visibility },
    }),
  });
  if (!res.ok) {
    throw new Error(`post failed: ${res.status} ${await res.text()}`);
  }
  return res.headers.get("x-restli-id") || "posted";
}
/**
 * Publish a post WITH an image to the member's feed (w_member_social).
 * Flow: registerUpload -> upload bytes -> create ugcPost (IMAGE). Returns post id.
 */
export async function postImage(
  text: string,
  image: Uint8Array,
  altText = "",
  visibility: "PUBLIC" | "CONNECTIONS" = "PUBLIC"
): Promise<string> {
  const token = getLinkedInToken();
  const author = process.env.LINKEDIN_PERSON_URN;
  if (!author) {
    throw new Error("LINKEDIN_PERSON_URN is not set in .env.local.");
  }

  // 1) Register the upload to get an upload URL + asset URN.
  const reg = await fetch(`${API}/v2/assets?action=registerUpload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      registerUploadRequest: {
        recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
        owner: author,
        serviceRelationships: [
          {
            relationshipType: "OWNER",
            identifier: "urn:li:userGeneratedContent",
          },
        ],
      },
    }),
  });
  if (!reg.ok) {
    throw new Error(`registerUpload failed: ${reg.status} ${await reg.text()}`);
  }
  const regJson = (await reg.json()) as {
    value?: {
      asset?: string;
      uploadMechanism?: Record<string, { uploadUrl?: string }>;
    };
  };
  const asset = regJson.value?.asset;
  const uploadUrl =
    regJson.value?.uploadMechanism?.[
      "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
    ]?.uploadUrl;
  if (!asset || !uploadUrl) {
    throw new Error("registerUpload response missing asset/uploadUrl");
  }

  // 2) Upload the image bytes to the returned URL.
  const up = await fetch(uploadUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: image as unknown as BodyInit,
  });
  if (!up.ok) {
    throw new Error(`image upload failed: ${up.status} ${await up.text()}`);
  }

  // 3) Create the post referencing the uploaded asset.
  const res = await fetch(`${API}/v2/ugcPosts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      author,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text },
          shareMediaCategory: "IMAGE",
          media: [
            {
              status: "READY",
              media: asset,
              description: { text: altText },
              title: { text: "" },
            },
          ],
        },
      },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": visibility },
    }),
  });
  if (!res.ok) {
    throw new Error(`image post failed: ${res.status} ${await res.text()}`);
  }
  return res.headers.get("x-restli-id") || asset;
}
