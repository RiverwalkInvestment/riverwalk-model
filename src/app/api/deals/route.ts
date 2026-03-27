import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const deals = await prisma.deal.findMany({
    where: { userId: (session.user as { id: string }).id },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, name: true, data: true, createdAt: true, updatedAt: true },
  })

  return NextResponse.json(deals.map(d => ({
    ...d,
    data: safeParseJSON(d.data, {}),
  })))
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  let body: { name?: unknown } = {}
  try { body = await req.json() } catch { /* use defaults */ }
  const name = String(body.name || 'Nueva operación').slice(0, 200)

  const deal = await prisma.deal.create({
    data: { userId: (session.user as { id: string }).id, name },
  })

  return NextResponse.json({ ...deal, data: {}, photos: [], plans: [] }, { status: 201 })
}

function safeParseJSON(str: string, fallback: unknown) {
  try { return JSON.parse(str) } catch { return fallback }
}
