import pg from "pg";

const { Pool } = pg;

function getPoolConfig() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required.");
  }

  const useSsl = !connectionString.includes("localhost");

  return {
    connectionString,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
  };
}

export const pool = new Pool(getPoolConfig());

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS uploaded_images (
      id BIGSERIAL PRIMARY KEY,
      mime_type TEXT NOT NULL,
      file_name TEXT NOT NULL,
      image_data BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS pages (
      id BIGSERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS page_blocks (
      id BIGSERIAL PRIMARY KEY,
      page_id BIGINT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
      block_type TEXT NOT NULL CHECK (block_type IN ('text', 'image')),
      content TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_page_blocks_page_id_sort_order
    ON page_blocks(page_id, sort_order, id);
  `);

  const legacyTableCheck = await pool.query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'page_items'
    ) AS exists;
  `);

  if (legacyTableCheck.rows[0].exists) {
    const currentBlocks = await pool.query("SELECT COUNT(*)::INT AS count FROM page_blocks");
    if (currentBlocks.rows[0].count === 0) {
      const legacyPages = await pool.query(`
        SELECT page_key, MIN(created_at) AS created_first
        FROM page_items
        GROUP BY page_key
        ORDER BY created_first ASC;
      `);

      for (let i = 0; i < legacyPages.rows.length; i += 1) {
        const legacyPage = legacyPages.rows[i];
        const pageTitle = legacyPage.page_key.replace(/-/g, " ");
        const pageInsert = await pool.query(
          `
            INSERT INTO pages (title, sort_order)
            VALUES ($1, $2)
            RETURNING id;
          `,
          [pageTitle || `Page ${i + 1}`, i + 1]
        );

        const pageId = pageInsert.rows[0].id;
        const legacyItems = await pool.query(
          `
            SELECT content, created_at
            FROM page_items
            WHERE page_key = $1
            ORDER BY created_at ASC, id ASC;
          `,
          [legacyPage.page_key]
        );

        for (let j = 0; j < legacyItems.rows.length; j += 1) {
          const item = legacyItems.rows[j];
          await pool.query(
            `
              INSERT INTO page_blocks (page_id, block_type, content, sort_order, created_at, updated_at)
              VALUES ($1, 'text', $2, $3, $4, $4);
            `,
            [pageId, item.content, j + 1, item.created_at]
          );
        }
      }
    }
  }

  const { rows } = await pool.query("SELECT COUNT(*)::INT AS count FROM pages");
  if (rows[0].count === 0) {
    await pool.query(`
      INSERT INTO pages (title, sort_order)
      VALUES
        ('Page 1', 1),
        ('Page 2', 2),
        ('Page 3', 3),
        ('The End', 4);
    `);
  }
}
