import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { findWineImage } from '@/lib/wine-image'

export async function POST() {
  // Fetch all wines missing an image
  const { data: wines, error } = await supabase
    .from('wines')
    .select('id, name, winery')
    .or('image_url.is.null,image_url.eq.')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!wines?.length) return NextResponse.json({ updated: 0, total: 0 })

  let updated = 0

  for (const wine of wines) {
    const image_url = await findWineImage(wine.name, wine.winery)
    if (image_url) {
      await supabase
        .from('wines')
        .update({ image_url, updated_at: new Date().toISOString() })
        .eq('id', wine.id)
      updated++
    }
  }

  return NextResponse.json({ updated, total: wines.length })
}
