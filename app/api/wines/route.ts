import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { findWineImage } from '@/lib/wine-image'

export async function GET() {
  const { data, error } = await supabase
    .from('wines')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()

  if (!body.image_url && body.name) {
    body.image_url = await findWineImage(body.name, body.winery)
  }

  const { data, error } = await supabase
    .from('wines')
    .insert([{ ...body, updated_at: new Date().toISOString() }])
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
