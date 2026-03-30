import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { Session } from 'next-auth'

function safeParseJSON(str: string, fallback: unknown) {
  try { return JSON.parse(str) } catch { return fallback }
}

async function getOwnedDeal(session: Session | null, id: string) {
  if (!session) return null
  return prisma.deal.findFirst({ where: { id, userId: (session.user as { id: string }).id } })
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  const deal = await getOwnedDeal(session, id)
  if (!deal) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json({
    ...deal,
    data: safeParseJSON(deal.data, {}),
    photos: safeParseJSON(deal.photos, []),
    plans: safeParseJSON(deal.plans, []),
  })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  const deal = await getOwnedDeal(session, id)
  if (!deal) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  const updates: Record<string, string> = {}

  if (body.name !== undefined) updates.name = String(body.name).slice(0, 200)
  if (body.data !== undefined && typeof body.data === 'object') {
    updates.data = JSON.stringify(body.data)
  }
  if (body.photos !== undefined && Array.isArray(body.photos)) {
    const validated = (body.photos as unknown[])
      .slice(0, 6)
      .filter((p) => { try { return new URL(String(p)).protocol === 'https:' } catch { return false } })
      .map((p) => String(p))
    updates.photos = JSON.stringify(validated)
  }
  if (body.plans !== undefined && Array.isArray(body.plans)) {
    const validated = (body.plans as unknown[])
      .slice(0, 6)
      .filter((p) => { try { return new URL(String(p)).protocol === 'https:' } catch { return false } })
      .map((p) => String(p))
    updates.plans = JSON.stringify(validated)
  }

  const updated = await prisma.deal.update({ where: { id }, data: updates })
  return NextResponse.json({
    ...updated,
    data: safeParseJSON(updated.data, {}),
    photos: safeParseJSON(updated.photos, []),
    plans: safeParseJSON(updated.plans, []),
  })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  const deal = await getOwnedDeal(session, id)
  if (!deal) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  await prisma.deal.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
