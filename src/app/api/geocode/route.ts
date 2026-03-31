import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  // 20 geocoding calls per user per hour
  const userId = (session.user as { id?: string }).id ?? session.user?.email ?? 'unknown'
  if (!checkRateLimit(`geocode:${userId}`, 20, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Límite de uso alcanzado. Inténtalo más tarde.' }, { status: 429 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Servicio no configurado' }, { status: 503 })

  let body: { address?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  const address = (body.address ?? '').trim().slice(0, 200)
  if (!address) return NextResponse.json({ error: 'Dirección vacía' }, { status: 400 })

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{
          role: 'user',
          content: `¿Cuál es el código postal y municipio de "${address}" en España? Responde SOLO con este JSON sin texto extra: {"cp":"28014","municipio":"Madrid"}`,
        }],
      }),
    })

    const data = await res.json() as { content?: { type: string; text?: string }[] }
    // Web search responses have multiple blocks; collect all text and find JSON in it
    const text = (data.content ?? []).filter(b => b.type === 'text' && b.text).map(b => b.text).join('')
    const match = text.match(/\{[^}]+\}/)
    if (!match) return NextResponse.json({ error: 'Sin resultado' }, { status: 422 })

    const parsed = JSON.parse(match[0]) as { cp?: string; municipio?: string }
    return NextResponse.json({ cp: parsed.cp ?? null, municipio: parsed.municipio ?? null })
  } catch (err) {
    console.error('[geocode]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
