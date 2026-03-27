import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import DealClient from './DealClient'

function safeParseJSON(str: string, fallback: unknown) {
  try { return JSON.parse(str) } catch { return fallback }
}

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/login')

  const { id } = await params
  const deal = await prisma.deal.findFirst({
    where: { id, userId: (session.user as { id: string }).id },
  })
  if (!deal) redirect('/dashboard')

  return (
    <DealClient
      dealId={id}
      initialData={safeParseJSON(deal.data, {}) as Record<string, unknown>}
      initialName={deal.name}
      initialPhotos={safeParseJSON(deal.photos, []) as string[]}
      initialPlans={safeParseJSON(deal.plans, []) as string[]}
    />
  )
}
