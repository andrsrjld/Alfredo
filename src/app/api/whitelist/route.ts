import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const noStore = { headers: { 'Cache-Control': 'no-store' } }

export async function GET() {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('whitelisted_pms')
      .select('*')
      .order('pm_name', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500, ...noStore })
    }
    return NextResponse.json(data, noStore)
  } catch (err) {
    console.error('[Whitelist GET]', err)
    return NextResponse.json({ error: 'Failed to fetch whitelist' }, { status: 500, ...noStore })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phone_number, pm_name } = body as { phone_number: string; pm_name?: string }

    if (!phone_number || !/^\d+$/.test(phone_number)) {
      return NextResponse.json({ error: 'Invalid phone number format. Use international format without + (e.g. 628123456789).' }, { status: 400, ...noStore })
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('whitelisted_pms')
      .upsert({ phone_number, pm_name: pm_name || null }, { onConflict: 'phone_number' })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500, ...noStore })
    }
    return NextResponse.json(data, { status: 201, ...noStore })
  } catch (err) {
    console.error('[Whitelist POST]', err)
    return NextResponse.json({ error: 'Failed to add entry' }, { status: 500, ...noStore })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const phone_number = searchParams.get('phone_number')

    if (!phone_number) {
      return NextResponse.json({ error: 'phone_number query parameter required' }, { status: 400, ...noStore })
    }

    const supabase = createAdminClient()
    const { error } = await supabase
      .from('whitelisted_pms')
      .delete()
      .eq('phone_number', phone_number)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500, ...noStore })
    }
    return NextResponse.json({ ok: true }, noStore)
  } catch (err) {
    console.error('[Whitelist DELETE]', err)
    return NextResponse.json({ error: 'Failed to delete entry' }, { status: 500, ...noStore })
  }
}