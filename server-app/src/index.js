import "dotenv/config";
import cors from "cors";
import express from "express";
import multer from "multer";
import { initDb, pool } from "./db.js";

const app = express();
const port = Number(process.env.PORT || 4000);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
      return;
    }
    cb(new Error("Only image files are allowed"));
  },
});

app.use(
  cors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : true,
  })
);
app.set("trust proxy", 1);
app.use(express.json());

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false });
  }
});

app.post("/api/uploads", upload.single("image"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "image file is required" });
    return;
  }

  const insertResult = await pool.query(
    `
      INSERT INTO uploaded_images (mime_type, file_name, image_data)
      VALUES ($1, $2, $3)
      RETURNING id;
    `,
    [req.file.mimetype, req.file.originalname || "image", req.file.buffer]
  );

  const imageId = insertResult.rows[0].id;
  const publicBaseUrl = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`;
  const normalizedBase = publicBaseUrl.replace(/\/$/, "");
  const url = `${normalizedBase}/api/uploads/${imageId}`;
  res.status(201).json({ url });
});

app.get("/api/uploads/:imageId", async (req, res) => {
  const imageId = Number(req.params.imageId);

  if (!Number.isInteger(imageId) || imageId <= 0) {
    res.status(400).json({ error: "invalid image id" });
    return;
  }

  const { rows } = await pool.query(
    `
      SELECT mime_type AS "mimeType", file_name AS "fileName", image_data AS "imageData"
      FROM uploaded_images
      WHERE id = $1
    `,
    [imageId]
  );

  if (!rows[0]) {
    res.status(404).json({ error: "image not found" });
    return;
  }

  const image = rows[0];
  res.setHeader("Content-Type", image.mimeType);
  res.setHeader("Content-Disposition", `inline; filename="${image.fileName}"`);
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.send(image.imageData);
});

app.get("/api/pages", async (_req, res) => {
  const { rows } = await pool.query(
    `
      SELECT id, title, sort_order AS "sortOrder", created_at AS "createdAt", updated_at AS "updatedAt"
      FROM pages
      ORDER BY sort_order ASC, id ASC
    `
  );

  res.json(rows);
});

app.post("/api/pages", async (req, res) => {
  const title = String(req.body?.title ?? "").trim();

  const orderResult = await pool.query("SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM pages");
  const nextOrder = Number(orderResult.rows[0].max_order) + 1;

  const { rows } = await pool.query(
    `
      INSERT INTO pages (title, sort_order)
      VALUES ($1, $2)
      RETURNING id, title, sort_order AS "sortOrder", created_at AS "createdAt", updated_at AS "updatedAt"
    `,
    [title, nextOrder]
  );

  res.status(201).json(rows[0]);
});

app.put("/api/pages/:pageId", async (req, res) => {
  const pageId = Number(req.params.pageId);
  const hasTitle = Object.prototype.hasOwnProperty.call(req.body || {}, "title");
  const title = hasTitle ? String(req.body?.title ?? "").trim() : null;
  const sortOrder = Number(req.body?.sortOrder);

  if (!Number.isInteger(pageId) || pageId <= 0) {
    res.status(400).json({ error: "invalid page id" });
    return;
  }

  const effectiveSortOrder = Number.isInteger(sortOrder) ? sortOrder : null;

  const { rows } = await pool.query(
    `
      UPDATE pages
      SET title = COALESCE($1, title),
          sort_order = COALESCE($2, sort_order),
          updated_at = NOW()
      WHERE id = $3
      RETURNING id, title, sort_order AS "sortOrder", created_at AS "createdAt", updated_at AS "updatedAt"
    `,
    [title, effectiveSortOrder, pageId]
  );

  if (!rows[0]) {
    res.status(404).json({ error: "page not found" });
    return;
  }

  res.json(rows[0]);
});

app.delete("/api/pages/:pageId", async (req, res) => {
  const pageId = Number(req.params.pageId);

  if (!Number.isInteger(pageId) || pageId <= 0) {
    res.status(400).json({ error: "invalid page id" });
    return;
  }

  const { rowCount } = await pool.query("DELETE FROM pages WHERE id = $1", [pageId]);
  if (!rowCount) {
    res.status(404).json({ error: "page not found" });
    return;
  }

  res.status(204).send();
});

app.get("/api/pages/:pageId/blocks", async (req, res) => {
  const pageId = Number(req.params.pageId);
  if (!Number.isInteger(pageId) || pageId <= 0) {
    res.status(400).json({ error: "invalid page id" });
    return;
  }

  const { rows } = await pool.query(
    `
      SELECT id, page_id AS "pageId", block_type AS "blockType", content, sort_order AS "sortOrder", created_at AS "createdAt", updated_at AS "updatedAt"
      FROM page_blocks
      WHERE page_id = $1
      ORDER BY sort_order ASC, id ASC
    `,
    [pageId]
  );

  res.json(rows);
});

app.post("/api/pages/:pageId/blocks", async (req, res) => {
  const pageId = Number(req.params.pageId);
  const blockType = String(req.body?.blockType || "").trim();
  const content = String(req.body?.content || "").trim();

  if (!Number.isInteger(pageId) || pageId <= 0) {
    res.status(400).json({ error: "invalid page id" });
    return;
  }

  if (!["text", "image"].includes(blockType)) {
    res.status(400).json({ error: "blockType must be 'text' or 'image'" });
    return;
  }

  if (!content) {
    res.status(400).json({ error: "content is required" });
    return;
  }

  const orderResult = await pool.query(
    "SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM page_blocks WHERE page_id = $1",
    [pageId]
  );
  const nextOrder = Number(orderResult.rows[0].max_order) + 1;

  const { rows } = await pool.query(
    `
      INSERT INTO page_blocks (page_id, block_type, content, sort_order)
      VALUES ($1, $2, $3, $4)
      RETURNING id, page_id AS "pageId", block_type AS "blockType", content, sort_order AS "sortOrder", created_at AS "createdAt", updated_at AS "updatedAt"
    `,
    [pageId, blockType, content, nextOrder]
  );

  res.status(201).json(rows[0]);
});

app.put("/api/pages/:pageId/blocks/:blockId", async (req, res) => {
  const pageId = Number(req.params.pageId);
  const blockId = Number(req.params.blockId);
  const blockType = String(req.body?.blockType || "").trim();
  const content = String(req.body?.content || "").trim();
  const sortOrder = Number(req.body?.sortOrder);

  if (!Number.isInteger(pageId) || pageId <= 0 || !Number.isInteger(blockId) || blockId <= 0) {
    res.status(400).json({ error: "invalid id" });
    return;
  }

  if (!["text", "image"].includes(blockType)) {
    res.status(400).json({ error: "blockType must be 'text' or 'image'" });
    return;
  }

  if (!content) {
    res.status(400).json({ error: "content is required" });
    return;
  }

  const effectiveSortOrder = Number.isInteger(sortOrder) ? sortOrder : null;

  const { rows } = await pool.query(
    `
      UPDATE page_blocks
      SET block_type = $1,
          content = $2,
          sort_order = COALESCE($3, sort_order),
          updated_at = NOW()
      WHERE id = $4 AND page_id = $5
      RETURNING id, page_id AS "pageId", block_type AS "blockType", content, sort_order AS "sortOrder", created_at AS "createdAt", updated_at AS "updatedAt"
    `,
    [blockType, content, effectiveSortOrder, blockId, pageId]
  );

  if (!rows[0]) {
    res.status(404).json({ error: "block not found" });
    return;
  }

  res.json(rows[0]);
});

app.delete("/api/pages/:pageId/blocks/:blockId", async (req, res) => {
  const pageId = Number(req.params.pageId);
  const blockId = Number(req.params.blockId);

  if (!Number.isInteger(pageId) || pageId <= 0 || !Number.isInteger(blockId) || blockId <= 0) {
    res.status(400).json({ error: "invalid id" });
    return;
  }

  const { rowCount } = await pool.query(
    "DELETE FROM page_blocks WHERE id = $1 AND page_id = $2",
    [blockId, pageId]
  );

  if (!rowCount) {
    res.status(404).json({ error: "block not found" });
    return;
  }

  res.status(204).send();
});

app.use((err, _req, res, _next) => {
  console.error(err);
  if (err instanceof multer.MulterError) {
    res.status(400).json({ error: err.message });
    return;
  }
  if (err?.message === "Only image files are allowed") {
    res.status(400).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: "internal server error" });
});

initDb()
  .then(() => {
    app.listen(port, () => {
      console.log(`API listening on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
  });
