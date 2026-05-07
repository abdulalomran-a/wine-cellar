import { NextRequest, NextResponse } from 'next/server'
import { fetchVivinoData } from '@/lib/vivino'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { name, winery, vintage } = await req.json()
    if (!name) return NextResponse.json({ error: 'No wine name provided' }, { status: 400 })

    const vivino = await fetchVivinoData(name, winery, vintage)

    return NextResponse.json({
      vivino_rating: vivino?.rating ?? null,
      vivino_price: vivino?.price ?? null,
      vivino_url: vivino?.url ?? null,
      vivino_wine_name: vivino?.wine_name ?? null,
    })
  } catch (err) {
    console.error('vivino-lookup error:', err)
    return NextResponse.json({ error: 'Failed to fetch Vivino data' }, { status: 500 })
  }
}
