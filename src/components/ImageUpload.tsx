'use client'
import { useState, useRef } from 'react'

interface Props {
  dealId: string
  images: string[]
  onImagesChange: (images: string[]) => void
  min: number
  max: number
  label: string
}

export default function ImageUpload({ dealId, images, onImagesChange, min, max, label }: Props) {
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function uploadFile(file: File): Promise<void> {
    if (images.length >= max) return
    const formData = new FormData()
    formData.append('file', file)
    formData.append('dealId', dealId)
    const res = await fetch('/api/upload', { method: 'POST', body: formData })
    if (res.ok) {
      const { url } = (await res.json()) as { url: string }
      onImagesChange([...images, url])
    }
  }

  async function handleFiles(files: FileList) {
    setUploading(true)
    for (let i = 0; i < files.length && images.length + i < max; i++) {
      await uploadFile(files[i])
    }
    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  function removeImage(index: number) {
    onImagesChange(images.filter((_, i) => i !== index))
  }

  const countColor = images.length >= min ? 'var(--green, #22c55e)' : 'var(--amber, #f59e0b)'

  return (
    <div style={{ marginBottom: 24 }}>
      <div className="idivider">
        {label}&nbsp;&nbsp;
        <span style={{ color: countColor, fontVariantNumeric: 'tabular-nums' }}>
          {images.length}/{max}
        </span>
      </div>

      {images.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 8,
            marginBottom: 8,
          }}
        >
          {images.map((url, i) => (
            <div
              key={url}
              style={{
                position: 'relative',
                aspectRatio: '4/3',
                borderRadius: 6,
                overflow: 'hidden',
                background: 'var(--d2)',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`${label} ${i + 1}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <button
                onClick={() => removeImage(i)}
                aria-label={`Eliminar imagen ${i + 1}`}
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  background: 'rgba(0,0,0,0.6)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '50%',
                  width: 22,
                  height: 22,
                  cursor: 'pointer',
                  fontSize: 14,
                  lineHeight: '22px',
                  textAlign: 'center',
                  padding: 0,
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {images.length < max && (
        <div
          role="button"
          tabIndex={0}
          aria-label={`Subir ${label.toLowerCase()}`}
          onClick={() => inputRef.current?.click()}
          onKeyDown={e => e.key === 'Enter' && inputRef.current?.click()}
          onDragOver={e => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => {
            e.preventDefault()
            setDragOver(false)
            if (e.dataTransfer.files) handleFiles(e.dataTransfer.files)
          }}
          style={{
            border: `2px dashed ${dragOver ? 'var(--gold)' : 'var(--line)'}`,
            borderRadius: 8,
            padding: '16px 12px',
            textAlign: 'center',
            cursor: 'pointer',
            color: 'var(--text-d)',
            fontSize: 13,
            background: dragOver ? 'var(--d2)' : 'transparent',
            transition: 'border-color 0.15s, background 0.15s',
          }}
        >
          {uploading
            ? 'Subiendo…'
            : `Añadir ${label.toLowerCase()} · arrastra o haz clic (máx. ${max})`}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        style={{ display: 'none' }}
        onChange={e => e.target.files && handleFiles(e.target.files)}
      />
    </div>
  )
}
