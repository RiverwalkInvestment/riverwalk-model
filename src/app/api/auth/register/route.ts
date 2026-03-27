import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, email, password } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'Email y contraseña requeridos.' }, { status: 400 })
    }

    const sanitizedEmail = String(email).toLowerCase().trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitizedEmail)) {
      return NextResponse.json({ error: 'Email inválido.' }, { status: 400 })
    }

    if (String(password).length < 8) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres.' }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({ where: { email: sanitizedEmail } })
    if (existing) {
      return NextResponse.json({ error: 'Ya existe una cuenta con ese email.' }, { status: 409 })
    }

    const hashed = await bcrypt.hash(String(password), 12)

    await prisma.user.create({
      data: {
        name: name ? String(name).trim().slice(0, 100) : null,
        email: sanitizedEmail,
        password: hashed,
      },
    })

    return NextResponse.json({ ok: true }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 })
  }
}
