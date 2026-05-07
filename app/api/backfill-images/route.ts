import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { findWineImage } from '@/lib/wine-image'

export async function POST() {
  // Fetch all wines so we can also fix wrong images already saved
  const { data: wines, error } = await supabase
    .from('wines')
    .select('id, name, winery, image_url')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!wines?.length) return NextResponse.json({ updated: 0, cleared: 0, total: 0 })

  let updated = 0
  let cleared = 0

  for (const wine of wines) {
    const image_url = await findWineImage(wine.name, wine.winery)

    if (image_url) {
      // Found a correct wine image — save it
      await supabase
        .from('wines')
        .update({ image_url, updated_at: new Date().toISOString() })
        .eq('id', wine.id)
      updated++
    } else if (wine.image_url?.includes('openfoodfacts.org')) {
      // Wrong food product image from previous search — clear it
      await supabase
        .from('wines')
        .update({ image_url: null, updated_at: new Date().toISOString() })
        .eq('id', wine.id)
      cleared++
    }
    // If no image found and current image isn't from OFF (user-set), leave it alone
  }

  return NextResponse.json({ updated, cleared, total: wines.length })
}
