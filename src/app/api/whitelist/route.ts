import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizePhone } from '@/lib/phone'

const noStore = { headers: { 'Cache-Control': 'no-store' } }

export const dynamic = 'force-dynamic'

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

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { entries } = body as { entries: Array<{ phone: string; name?: string }> }

    if (!Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({ error: 'entries must be a non-empty array of { phone, name? }' }, { status: 400, ...noStore })
    }

    if (entries.length > 500) {
      return NextResponse.json({ error: 'Max 500 entries per import' }, { status: 400, ...noStore })
    }

    const rows: Array<{ phone_number: string; pm_name: string | null }> = []
    const errors: Array<{ phone: string; error: string }> = []
    let skipped = 0

    for (const entry of entries) {
      const raw = String(entry.phone || '').trim()
      if (!raw) { skipped++; continue }
      const phone = normalizePhone(raw)
      if (!/^\d{8,15}$/.test(phone)) {
        errors.push({ phone: raw, error: 'Invalid format' })
        continue
      }
      rows.push({ phone_number: phone, pm_name: (entry.name || '').trim() || null })
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No valid entries to import', details: errors }, { status: 400, ...noStore })
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('whitelisted_pms')
      .upsert(rows, { onConflict: 'phone_number' })
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500, ...noStore })
    }

    return NextResponse.json({
      imported: data?.length ?? rows.length,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
    }, { status: 200, ...noStore })
  } catch (err) {
    console.error('[Whitelist PUT import]', err)
    return NextResponse.json({ error: 'Failed to import entries' }, { status: 500, ...noStore })
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