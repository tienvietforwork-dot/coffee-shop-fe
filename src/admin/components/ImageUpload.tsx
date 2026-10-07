import { useState } from 'react'
import { App, Button, Input, Spin, Upload } from 'antd'
import { CameraOutlined, DeleteOutlined, SwapOutlined } from '@ant-design/icons'
import { coreApi } from '@/api/core'
import { errorMessage } from '@/api/client'
import { imageSrc } from '@/lib/format'

const MAX_SIDE = 1200
/** Same cap as app-core (spring.servlet.multipart.max-file-size). */
const MAX_BYTES = 3 * 1024 * 1024
const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

/** Downscales to MAX_SIDE and re-encodes as WebP (JPEG fallback) so photos stay a few hundred KB. */
async function compress(file: File): Promise<Blob> {
  if (file.type === 'image/gif') return file // keep animation
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const encode = (type: string) => new Promise<Blob | null>((ok) => canvas.toBlob(ok, type, 0.85))
  const blob = (await encode('image/webp')) ?? (await encode('image/jpeg'))
  return blob && blob.size < file.size ? blob : file
}

/** Form value: an uploaded image (images.id + its API path) or just an external link. */
export interface ImageValue { id?: number; url?: string }

/** Square image picker: drop/pick a file (stored in the DB) or paste an external URL. */
export function ImageUpload({ value, onChange }: { value?: ImageValue; onChange?: (v: ImageValue | undefined) => void }) {
  const { message } = App.useApp()
  const [busy, setBusy] = useState(false)

  const upload = async (file: File) => {
    if (!TYPES.includes(file.type)) {
      message.error('Chỉ nhận ảnh JPG, PNG, WEBP hoặc GIF')
      return Upload.LIST_IGNORE
    }
    setBusy(true)
    try {
      const blob = await compress(file)
      if (blob.size > MAX_BYTES) {
        message.error('Ảnh vượt quá 3MB')
      } else {
        const { id, url } = await coreApi.uploadImage(blob)
        onChange?.({ id, url })
      }
    } catch (e) {
      message.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
    return Upload.LIST_IGNORE
  }

  return (
    <div className="a-image-upload">
      <Spin spinning={busy} tip="Đang tải ảnh…">
        {value?.url ? (
          <div className="a-image-box has-image">
            <img src={imageSrc(value.url)} alt="" />
            <div className="a-image-box-overlay">
              <Upload accept={TYPES.join(',')} showUploadList={false} beforeUpload={upload}>
                <Button size="small" icon={<SwapOutlined />}>Đổi ảnh</Button>
              </Upload>
              <Button size="small" danger icon={<DeleteOutlined />} onClick={() => onChange?.(undefined)}>Xóa</Button>
            </div>
          </div>
        ) : (
          <Upload.Dragger className="a-image-box" accept={TYPES.join(',')} showUploadList={false} beforeUpload={upload}>
            <CameraOutlined className="a-image-box-icon" />
            <div className="a-image-box-text">Kéo thả hoặc bấm để chọn ảnh</div>
            <div className="a-image-box-hint">JPG · PNG · WEBP · GIF<br />Tối đa 3MB · ảnh lớn tự nén</div>
          </Upload.Dragger>
        )}
      </Spin>
      {!value?.id && (
        <Input size="small" allowClear placeholder="hoặc dán link ảnh https://…" value={value?.url}
          onChange={(e) => onChange?.(e.target.value ? { url: e.target.value } : undefined)} style={{ marginTop: 8 }} />
      )}
    </div>
  )
}
