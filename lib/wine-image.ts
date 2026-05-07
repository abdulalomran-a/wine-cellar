export async function findWineImage(name: string, winery?: string | null): Promise<string | null> {
  if (!name) return null

  const attempts = [
    [winery, name].filter(Boolean).join(' '),
    name,
  ].filter((v, i, a) => a.indexOf(v) === i) // dedupe

  for (const query of attempts) {
    // Try OFF v2 search with wine category filter
    const img = await searchOFF(query, true) ?? await searchOFF(query, false)
    if (img) return img
  }

  return null
}

async function searchOFF(query: string, wineCategory: boolean): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      q: query,
      fields: 'image_front_url,image_url,selected_images',
      page_size: '10',
    })
    if (wineCategory) params.set('categories_tags_en', 'wines')

    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/search?${params}`,
      { signal: AbortSignal.timeout(5000) }
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
    // timeout or network error — ignore
  }
  return null
}
