export async function findWineImage(name: string, winery?: string | null): Promise<string | null> {
  if (!name) return null

  const queries = [
    [winery, name].filter(Boolean).join(' '),
    name,
  ].filter((v, i, a) => a.indexOf(v) === i)

  for (const query of queries) {
    const img = await searchOFFWinesOnly(query)
    if (img) return img
  }

  return null
}

async function searchOFFWinesOnly(query: string): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      q: query,
      categories_tags_en: 'wines',  // strict wine category — no fallback to general
      fields: 'image_front_url,image_url,selected_images',
      page_size: '10',
    })

    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/search?${params}`,
      { signal: AbortSignal.timeout(6000) }
    )
    if (!res.ok) return null
    const data = await res.json()

    for (const p of data.products ?? []) {
      const img =
        p.selected_images?.front?.display?.en ||
        p.selected_images?.front?.display?.fr ||
        p.image_front_url ||
        p.image_url ||
        null
      if (img) return img
    }
  } catch {
    // timeout or network error
  }
  return null
}
