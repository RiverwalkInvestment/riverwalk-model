'use client'

import { useState, useEffect } from 'react'
import { signOut } from 'next-auth/react'
import Image from 'next/image'
import Link from 'next/link'

interface Deal {
  id: string
  name: string
  data: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

interface Props {
  user: { id?: string; name?: string | null; email?: string | null }
}

export default function DashboardClient({ user }: Props) {
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDeals()
  }, [])

  async function fetchDeals() {
    const res = await fetch('/api/deals')
    if (res.ok) {
      const data = await res.json()
      setDeals(data)
    }
    setLoading(false)
  }

  async function createDeal() {
    const res = await fetch('/api/deals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Nueva operación' }),
    })
    if (res.ok) {
      const deal = await res.json()
      window.location.href = `/deal/${deal.id}`
    }
  }

  async function deleteDeal(id: string, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('¿Eliminar esta operación?')) return
    await fetch(`/api/deals/${id}`, { method: 'DELETE' })
    setDeals(prev => prev.filter(d => d.id !== id))
  }

  function formatDate(str: string) {
    return new Date(str).toLocaleDateString('es-ES', {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <Image
            src="/logo-dark.png"
            alt="Riverwalk"
            width={130}
            height={21}
          />
          <span className="topbar-sep" />
          <span className="dashboard-title">Deal Modeler</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 11, color: 'var(--text-d)' }}>
            {user.name || user.email}
          </span>
          <button
            className="btn"
            onClick={() => signOut({ callbackUrl: '/auth/login' })}
          >
            Salir
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, color: 'var(--text-d)', fontSize: 12 }}>
          Cargando...
        </div>
      ) : (
        <div className="deal-grid">
          <div
            className="deal-card deal-card-new"
            onClick={createDeal}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && createDeal()}
          >
            + Nueva operación
          </div>

          {deals.map(deal => {
            const d = deal.data as Record<string, string>
            const addr = [d.dealAddress, d.dealMunicipio].filter(Boolean).join(' · ')
            return (
              <Link
                key={deal.id}
                href={`/deal/${deal.id}`}
                className="deal-card"
                style={{ textDecoration: 'none' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div className="deal-card-name">{deal.name}</div>
                  <button
                    onClick={e => deleteDeal(deal.id, e)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text-d)', fontSize: 14, padding: '0 2px',
                      lineHeight: 1,
                    }}
                    title="Eliminar"
                    aria-label="Eliminar operación"
                  >
                    ×
                  </button>
                </div>
                {addr && (
                  <div className="deal-card-meta" style={{ marginTop: 4 }}>{addr}</div>
                )}
                <div className="deal-card-meta" style={{ marginTop: 8 }}>
                  Actualizado {formatDate(deal.updatedAt)}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
