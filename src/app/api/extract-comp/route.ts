import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Servicio no configurado' }, { status: 503 })

  let body: { url?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  const url = (body.url ?? '').trim().slice(0, 500)
  if (!url) return NextResponse.json({ error: 'URL vacía' }, { status: 400 })

  // Basic URL validation
  try { new URL(url) } catch { return NextResponse.json({ error: 'URL inválida' }, { status: 400 }) }

  const prompt = `Analiza este anuncio inmobiliario y extrae exactamente estos datos en JSON sin ningún texto extra:
URL: ${url}

Devuelve SOLO este JSON (sin markdown, sin explicación):
{
  "precio": número entero en euros (sin puntos ni símbolos),
  "m2": número entero de metros cuadrados útiles,
  "descripcion": string corto descriptivo del piso (máximo 60 caracteres, incluye calle/zona si aparece),
  "planta": string o null,
  "habitaciones": número o null
}

Si no puedes extraer el precio o los m², devuelve los campos como null. No inventes datos.`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'tools-2024-04-04',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await res.json() as { content?: { type: string; text?: string }[] }
    const textBlock = (data.content ?? []).find(b => b.type === 'text')
    const raw = textBlock?.text ?? ''
    const cleaned = raw.replace(/```json|```/g, '').trim()

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/)
      if (!match) return NextResponse.json({ error: 'Sin resultado' }, { status: 422 })
      parsed = JSON.parse(match[0])
    }

    return NextResponse.json({
      precio: typeof parsed.precio === 'number' ? parsed.precio : null,
      m2: typeof parsed.m2 === 'number' ? parsed.m2 : null,
      descripcion: typeof parsed.descripcion === 'string' ? parsed.descripcion.slice(0, 80) : null,
      planta: typeof parsed.planta === 'string' ? parsed.planta : null,
      habitaciones: typeof parsed.habitaciones === 'number' ? parsed.habitaciones : null,
    })
  } catch (err) {
    console.error('[extract-comp]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
