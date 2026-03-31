import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB

// Validate actual file content via magic bytes (not just the claimed MIME type)
function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
  if (buffer.length < 12) return false
  if (mimeType === 'image/jpeg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  }
  if (mimeType === 'image/png') {
    return (
      buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e &&
      buffer[3] === 0x47 && buffer[4] === 0x0d && buffer[5] === 0x0a &&
      buffer[6] === 0x1a && buffer[7] === 0x0a
    )
  }
  if (mimeType === 'image/webp') {
    return (
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
    )
  }
  return false
}

// Local filesystem save — only works when running with Node.js (dev / self-hosted)
async function saveLocal(buffer: Buffer, dealId: string, filename: string): Promise<string> {
  const { writeFile, mkdir } = await import('fs/promises')
  const { join } = await import('path')
  const dir = join(process.cwd(), 'public', 'uploads', dealId)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, filename), buffer)
  return `/uploads/${dealId}/${filename}`
}

// Vercel Blob save — requires BLOB_READ_WRITE_TOKEN in env
async function saveBlob(buffer: Buffer, dealId: string, filename: string, mimeType: string): Promise<string> {
  const { put } = await import('@vercel/blob')
  const blob = await put(`uploads/${dealId}/${filename}`, buffer, {
    access: 'public',
    contentType: mimeType,
    addRandomSuffix: false,
  })
  return blob.url
}

// Accepts local /uploads/ paths (dev) and https:// URLs (production blob storage)
export function isAllowedImageUrl(url: string): boolean {
  if (/^\/uploads\/[a-zA-Z0-9_-]{1,100}\/[a-zA-Z0-9_-]{1,200}\.[a-z]{3,4}$/.test(url)) return true
  try { return new URL(url).protocol === 'https:' } catch { return false }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const userId = (session.user as { id: string }).id

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Cuerpo de solicitud inválido' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  const dealId = formData.get('dealId') as string | null

  if (!file || !dealId) {
    return NextResponse.json({ error: 'Faltan parámetros: file y dealId son obligatorios' }, { status: 400 })
  }

  // Sanitize dealId — only alphanumeric, hyphens, underscores
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(dealId)) {
    return NextResponse.json({ error: 'ID de deal inválido' }, { status: 400 })
  }

  // Verify deal ownership — prevents uploading to another user's deal
  const deal = await prisma.deal.findFirst({ where: { id: dealId, userId } })
  if (!deal) {
    return NextResponse.json({ error: 'Deal no encontrado' }, { status: 404 })
  }

  // Validate claimed MIME type
  const ext = ALLOWED_TYPES[file.type]
  if (!ext) {
    return NextResponse.json(
      { error: 'Tipo de archivo no permitido. Solo se aceptan JPEG, PNG y WebP.' },
      { status: 400 },
    )
  }

  // Validate file size
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'El archivo supera el límite de 5 MB' }, { status: 400 })
  }

  // Read buffer once for magic byte check and upload
  const buffer = Buffer.from(await file.arrayBuffer())

  // Validate magic bytes — ensures the file content matches the claimed type
  if (!validateMagicBytes(buffer, file.type)) {
    return NextResponse.json(
      { error: 'El contenido del archivo no coincide con el tipo declarado.' },
      { status: 400 },
    )
  }

  const filename = `${randomUUID()}.${ext}`

  try {
    let url: string
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      // Production: Vercel Blob storage
      url = await saveBlob(buffer, dealId, filename, file.type)
    } else {
      // Development: local filesystem (public/uploads/)
      url = await saveLocal(buffer, dealId, filename)
    }
    return NextResponse.json({ url })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[upload] save error', msg)
    return NextResponse.json({ error: `Error al guardar el archivo: ${msg}` }, { status: 500 })
  }
}
