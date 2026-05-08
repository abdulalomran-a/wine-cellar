// Find bottle/chateau photos on Wikimedia Commons (hotlinkable, free)
// Run with: set -a; source .env.local; set +a; node scripts/add-bottle-images.mjs

import { createClient } from '@supabase/supabase-js'

const WINES = [
  { match: 'Phélan Ségur', searches: ['Château Phélan Ségur', 'Phelan Segur'] },
  { match: 'Malmaison', searches: ['Château Malmaison Moulis', 'Chateau Malmaison Bordeaux'] },
  { match: 'Léoville Barton', searches: ['Château Léoville Barton', 'Leoville Barton'] },
]

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

/** Search Wikimedia Commons for files matching the query and return up to N image URLs */
async function searchCommons(query) {
  // Step 1: search File: namespace (ns=6)
  const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srnamespace=6&srlimit=10&format=json&origin=*`
  const r = await fetch(searchUrl, { headers: { 'User-Agent': 'wine-cellar-script/1.0' } })
  const j = await r.json()
  const titles = (j?.query?.search ?? []).map(s => s.title) // "File:Foo.jpg"
  if (!titles.length) return []

  // Step 2: get image info (URL) for those titles in one batch
  const titlesParam = titles.join('|')
  const infoUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(titlesParam)}&prop=imageinfo&iiprop=url|mime|size&format=json&origin=*`
  const r2 = await fetch(infoUrl, { headers: { 'User-Agent': 'wine-cellar-script/1.0' } })
  const j2 = await r2.json()
  const pages = j2?.query?.pages ?? {}

  const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp']
  const imgs = []
  for (const p of Object.values(pages)) {
    const ii = p.imageinfo?.[0]
    if (!ii) continue
    if (!ALLOWED_MIME.includes(ii.mime)) continue
    // Strip query string (Wikimedia adds tracking utm_* params)
    const cleanUrl = ii.url.split('?')[0]
    imgs.push({ title: p.title, url: cleanUrl, width: ii.width, height: ii.height })
  }
  return imgs
}

async function verify(url) {
  try {
    const r = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'Mozilla/5.0', Range: 'bytes=0-1023' },
    })
    const ct = r.headers.get('content-type') || ''
    const ok = (r.ok || r.status === 206) && ct.startsWith('image/')
    try { await r.arrayBuffer() } catch {}
    return ok
  } catch {
    return false
  }
}

for (const w of WINES) {
  console.log(`\n=== ${w.match} ===`)

  let url = null
  let foundFrom = null
  for (const q of w.searches) {
    const results = await searchCommons(q)
    console.log(`  query "${q}" → ${results.length} results`)
    for (const r of results.slice(0, 5)) console.log(`    - ${r.title} (${r.width}x${r.height})`)
    // Pick the first image that looks plausible (skip tiny ones, prefer .jpg)
    // Try each result in order until one verifies — bottle photos preferred over chateau buildings
    const sorted = [...results].sort((a, b) => {
      const aBottle = /bottle|jahrgang|vintage|\d{4}/i.test(a.title) ? 1 : 0
      const bBottle = /bottle|jahrgang|vintage|\d{4}/i.test(b.title) ? 1 : 0
      return bBottle - aBottle
    })
    for (const candidate of sorted.slice(0, 5)) {
      if (await verify(candidate.url)) {
        url = candidate.url
        foundFrom = candidate.title
        break
      }
      await new Promise(r => setTimeout(r, 500)) // small delay between verify calls
    }
    if (url) break
  }

  if (!url) {
    console.log(`  ✗ no working image found`)
    continue
  }
  console.log(`  ✓ Using: ${foundFrom}`)
  console.log(`    URL: ${url}`)

  const lastWord = w.match.split(' ').pop()
  let { data, error } = await supabase
    .from('wines')
    .update({ image_url: url, updated_at: new Date().toISOString() })
    .ilike('winery', `%${lastWord}%`)
    .select('id, name, vintage, winery')

  if (error) { console.log(`  DB error: ${error.message}`); continue }
  if (!data?.length) {
    const r2 = await supabase
      .from('wines')
      .update({ image_url: url, updated_at: new Date().toISOString() })
      .ilike('name', `%${lastWord}%`)
      .select('id, name, vintage, winery')
    data = r2.data
  }

  console.log(`  Updated ${data?.length ?? 0} row(s):`)
  data?.forEach(d => console.log(`    - ${d.winery ?? ''} | ${d.name} ${d.vintage ?? ''}`))
}

console.log('\nDone.')
