// Add category + spirit_type columns. Backfill existing rows as 'wine'.
import pg from 'pg'

const { Client } = pg
const client = new Client({
  connectionString: 'postgresql://postgres:Najlaalomran%401998@db.wvnhkasaihkdvyulzjix.supabase.co:5432/postgres',
})

await client.connect()

const sql = `
ALTER TABLE wines
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'wine',
  ADD COLUMN IF NOT EXISTS spirit_type text;

-- Make sure all existing rows are wine
UPDATE wines SET category = 'wine' WHERE category IS NULL OR category = '';

CREATE INDEX IF NOT EXISTS wines_category_idx ON wines(category);
`

await client.query(sql)
const r = await client.query(`SELECT category, COUNT(*) FROM wines GROUP BY category`)
console.log('Category counts:', r.rows)
await client.end()
console.log('Done.')
