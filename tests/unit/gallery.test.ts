import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  GALLERY_FOLDER,
  MAX_UPLOAD_BYTES,
  detectImageKind,
  signatureFor,
  thumbUrlFor,
  uploadRejection,
  uploadToCloudinary,
} from "@/lib/cloudinary";
import { buildGalleryDoc, groupByAlbum, toPublicGalleryItem } from "@/lib/gallery";
import { GALLERY_ITEM_SCHEMA, type GalleryItemInput } from "@/lib/validation/gallery";

/**
 * A signed Cloudinary request is the one place the API secret is used, so the
 * signature is checked against a digest computed outside this codebase
 * (`printf '%s' 'folder=…&public_id=…&timestamp=…test-secret' | sha1sum`).
 */
const KNOWN_SIGNATURE = "439541d7ff35a547fa2cf7a8ed2891679989839d";

const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const WEBP = Buffer.concat([
  Buffer.from("RIFF"),
  Buffer.from([0x24, 0x00, 0x00, 0x00]),
  Buffer.from("WEBPVP8 "),
]);

const base: GalleryItemInput = {
  album: "Annual general meeting 2026",
  caption: "Office-bearers elected for the two-year term",
  alt: "Nine people seated at a long table under a banner",
  imageUrl: "https://res.cloudinary.com/yca-sumsilui/image/upload/v1/branch/gallery/agm.jpg",
  takenAt: "2026-04-18",
  order: 3,
};

function input(overrides: Partial<GalleryItemInput> = {}): GalleryItemInput {
  return GALLERY_ITEM_SCHEMA.parse({ ...base, ...overrides });
}

describe("detectImageKind", () => {
  it("names a picture by the bytes it starts with, not by the type it claims", () => {
    expect(detectImageKind(PNG)).toBe("png");
    expect(detectImageKind(JPEG)).toBe("jpeg");
    expect(detectImageKind(WEBP)).toBe("webp");
  });

  it("refuses a file whose name says png while its bytes say text", () => {
    expect(detectImageKind(Buffer.from("pretend this is a png, 89504e47 in text form"))).toBeNull();
    expect(detectImageKind(Buffer.alloc(0))).toBeNull();
  });
});

describe("uploadRejection", () => {
  it("refuses a body over eight megabytes", () => {
    expect(uploadRejection(MAX_UPLOAD_BYTES + 1, "jpeg")).toBe("file_too_large");
    expect(uploadRejection(MAX_UPLOAD_BYTES, "jpeg")).toBeNull();
  });

  it("refuses bytes that are not a picture even when the store is configured", () => {
    expect(uploadRejection(1_024, null)).toBe("not_an_image");
  });

  it("accepts a real picture within the limit", () => {
    expect(uploadRejection(PNG.byteLength, detectImageKind(PNG))).toBeNull();
  });
});

describe("signatureFor", () => {
  it("signs the sorted parameters with the API secret", () => {
    expect(
      signatureFor(
        { timestamp: "1700000000", public_id: "photo-1", folder: "yca-sumsilui/gallery" },
        "test-secret",
      ),
    ).toBe(KNOWN_SIGNATURE);
  });

  it("is the same signature however the parameters were written down", () => {
    const sorted = signatureFor({ folder: "f", timestamp: "1700000000" }, "test-secret");
    const jumbled = signatureFor({ timestamp: "1700000000", folder: "f" }, "test-secret");
    expect(jumbled).toBe(sorted);
  });

  it("leaves an empty parameter out of the string, as the store does", () => {
    expect(signatureFor({ folder: "f", public_id: "", timestamp: "1" }, "s")).toBe(
      signatureFor({ folder: "f", timestamp: "1" }, "s"),
    );
  });

  it("changes when the secret changes", () => {
    const params = { folder: "yca-sumsilui/gallery", public_id: "photo-1", timestamp: "1700000000" };
    expect(signatureFor(params, "test-secret")).not.toBe(signatureFor(params, "another-secret"));
  });
});

describe("thumbUrlFor", () => {
  it("serves the grid a display-size picture instead of the original", () => {
    expect(thumbUrlFor(base.imageUrl)).toBe(
      "https://res.cloudinary.com/yca-sumsilui/image/upload/w_600,h_450,c_fill,g_auto,f_auto,q_auto/v1/branch/gallery/agm.jpg",
    );
  });

  it("leaves an address that is not the image store's alone", () => {
    expect(thumbUrlFor("https://example.com/a.jpg")).toBe("https://example.com/a.jpg");
  });
});

describe("buildGalleryDoc", () => {
  it("keeps a blank date out of the record rather than storing an empty one", () => {
    const doc = buildGalleryDoc(input({ takenAt: "" }), null);
    expect(doc.takenAt).toBeUndefined();
    expect(doc.album).toBe(base.album);
    expect(doc.thumbUrl).toBe(thumbUrlFor(base.imageUrl));
    expect(doc.eventId).toBeNull();
    expect(doc.uploadedById).toBeNull();
  });
});

describe("toPublicGalleryItem", () => {
  it("carries the description a screen reader needs", () => {
    const doc = buildGalleryDoc(input(), null);
    expect(toPublicGalleryItem(doc)).toEqual({
      album: base.album,
      caption: base.caption,
      alt: base.alt,
      imageUrl: base.imageUrl,
      thumbUrl: thumbUrlFor(base.imageUrl),
      takenAt: "2026-04-18",
    });
  });
});

describe("GALLERY_ITEM_SCHEMA", () => {
  it("refuses an address that is not a picture over https", () => {
    for (const imageUrl of ["javascript:alert(1)", "http://example.com/a.jpg", "not-a-url"]) {
      expect(GALLERY_ITEM_SCHEMA.safeParse({ ...base, imageUrl }).success).toBe(false);
    }
  });

  it("refuses a picture with no words about it", () => {
    expect(GALLERY_ITEM_SCHEMA.safeParse({ ...base, alt: "   " }).success).toBe(false);
    expect(GALLERY_ITEM_SCHEMA.safeParse({ ...base, album: "" }).success).toBe(false);
  });
});

describe("uploadToCloudinary", () => {
  const originalFetch = globalThis.fetch;
  const SECRET = "a-secret-nobody-should-see";
  const CDN_URL =
    "https://res.cloudinary.com/yca-sumsilui-test/image/upload/v1700000000/branch/gallery/photo-1.jpg";

  beforeAll(() => {
    process.env.CLOUDINARY_CLOUD_NAME = "yca-sumsilui-test";
    process.env.CLOUDINARY_API_KEY = "123456789012345";
    process.env.CLOUDINARY_API_SECRET = SECRET;
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
    delete process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.CLOUDINARY_API_KEY;
    delete process.env.CLOUDINARY_API_SECRET;
  });

  it("sends the picture and its signature to the store, and never the secret", async () => {
    const seen: { url: string; form: FormData }[] = [];
    globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
      seen.push({ url: String(input), form: init?.body as FormData });
      return { ok: true, json: async () => ({ secure_url: CDN_URL }) } as Response;
    };

    const uploaded = await uploadToCloudinary(PNG, { publicId: "photo-1" });

    expect(seen[0]?.url).toBe("https://api.cloudinary.com/v1_1/yca-sumsilui-test/image/upload");
    const form = seen[0]?.form;
    if (!form) throw new Error("the request never reached the store");
    expect(form.get("folder")).toBe(GALLERY_FOLDER);
    expect(form.get("public_id")).toBe("photo-1");
    expect(form.get("api_key")).toBe("123456789012345");
    // The signature has to cover exactly what was sent, or it proves nothing.
    expect(form.get("signature")).toBe(
      signatureFor(
        {
          folder: String(form.get("folder")),
          public_id: String(form.get("public_id")),
          timestamp: String(form.get("timestamp")),
        },
        SECRET,
      ),
    );
    expect([...form.values()].some((value) => typeof value === "string" && value.includes(SECRET))).toBe(
      false,
    );

    expect(uploaded.url).toBe(CDN_URL);
    expect(uploaded.thumbUrl).toBe(thumbUrlFor(CDN_URL));
    expect(uploaded.publicId).toBe("photo-1");
  });

  it("refuses to try when the store has no key, rather than failing obscurely", async () => {
    delete process.env.CLOUDINARY_API_KEY;
    globalThis.fetch = async () => {
      throw new Error("nothing may leave the server without a key");
    };
    await expect(uploadToCloudinary(PNG)).rejects.toThrow("upload_not_configured");
    process.env.CLOUDINARY_API_KEY = "123456789012345";
  });
});

describe("groupByAlbum", () => {
  it("puts each picture under its own album, in the branch's order", () => {
    const docs = [
      buildGalleryDoc(input({ album: "Easter meeting", order: 1 }), null),
      buildGalleryDoc(input({ album: "AGM", caption: "Second sitting", order: 2 }), null),
      buildGalleryDoc(input({ album: "AGM", caption: "First sitting", order: 1 }), null),
    ];
    expect(groupByAlbum(docs).map((group) => group.album)).toEqual(["Easter meeting", "AGM"]);
    expect(groupByAlbum(docs)[1]?.items.map((item) => item.caption)).toEqual([
      "First sitting",
      "Second sitting",
    ]);
  });

  it("says nothing when there are no pictures", () => {
    expect(groupByAlbum([])).toEqual([]);
  });
});
