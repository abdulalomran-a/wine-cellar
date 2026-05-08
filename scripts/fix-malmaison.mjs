// Clear the wrong Malmaison image and try alternative sources
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// 1. First, clear the wrong painting image
const { data: cleared } = await supabase
  .from('wines')
  .update({ image_url: null, updated_at: new Date().toISOString() })
  .ilike('winery', '%Malmaison%')
  .select('id, name, vintage, winery, image_url')
console.log('Cleared:', cleared)

// 2. Try Wikipedia article for "Château Malmaison" page image
async function getWikiPageImage(title) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=pageimages&piprop=original&format=json&origin=*`
  const r = await fetch(url, { headers: { 'User-Agent': 'wine-cellar/1.0' } })
  const j = await r.json()
  const pages = j?.query?.pages ?? {}
  for (const p of Object.values(pages)) {
    if (p.original?.source) return p.original.source
  }
  return null
}

const candidates = [
  'Château Malmaison',
  'Château Malmaison (Moulis)',
  'Edmond de Rothschild Heritage',
  'Moulis-en-Médoc',
]

let found = null
for (const c of candidates) {
  const url = await getWikiPageImage(c)
  console.log(`  Wiki page "${c}": ${url ?? 'no image'}`)
  if (url) { found = url; break }
}

if (!found) {
  console.log('\nNo Wikipedia/Commons image available for Château Malmaison.')
  console.log('Options: scan the bottle yourself in the app, or paste a URL.')
} else {
  // verify
  const r = await fetch(found, { method: 'GET', headers: { Range: 'bytes=0-1023' } })
  const ct = r.headers.get('content-type') || ''
  console.log(`Verify: status=${r.status} ct=${ct}`)
  try { await r.arrayBuffer() } catch {}

  if ((r.ok || r.status === 206) && ct.startsWith('image/')) {
    const { data } = await supabase
      .from('wines')
      .update({ image_url: found, updated_at: new Date().toISOString() })
      .ilike('winery', '%Malmaison%')
      .select('id, name, vintage, winery')
    console.log('Updated:', data)
  }
}
