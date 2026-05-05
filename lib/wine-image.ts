/**
 * Searches Open Food Facts by wine name and returns the best available bottle photo URL.
 */
export async function findWineImage(name: string, winery?: string | null): Promise<string | null> {
  if (!name) return null

  const query = [winery, name].filter(Boolean).join(' ')

  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=10&fields=product_name,brands,image_front_url,image_url,selected_images`,
      { next: { revalidate: 3600 } }
    )
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
    // ignore — image is optional
  }

  return null
}
