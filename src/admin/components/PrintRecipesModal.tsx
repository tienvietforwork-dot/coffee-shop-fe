import { useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { App, Button, Empty, Input, Modal, Table } from 'antd'
import { FilePdfOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { coreApi } from '@/api/core'
import type { Recipe } from '@/api/types'
import { BREW_METHOD, dateTime } from '@/lib/format'

/** A4 landscape (297 × 210 mm) holds exactly 4 × 2 A7 cards (74 × 105 mm). */
const PER_SHEET = 8

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

function cardHtml(r: Recipe) {
  const meta = [BREW_METHOD.find((b) => b.value === r.brewMethod)?.label ?? r.brewMethod, r.brewTimeMin && `${r.brewTimeMin} phút`].filter(Boolean).join(' · ')
  return `<section class="card"><div class="fit">
    <header><h1>${esc(r.coffeeName)}</h1>${meta ? `<div class="meta">${esc(meta)}</div>` : ''}</header>
    <h2>Nguyên liệu</h2>
    <table>${r.materials.map((m) => `<tr><td>${esc(m.materialName)}${m.note ? ` <i>(${esc(m.note)})</i>` : ''}</td><td class="q">${esc(m.quantity)} ${esc(m.unit)}</td></tr>`).join('')}</table>
    <h2>Cách pha</h2>
    <ol>${r.steps.map((s) => `<li>${esc(s.instruction)}</li>`).join('')}</ol>
    <footer>Cập nhật ${esc(dateTime(r.updatedAt))}</footer>
  </div></section>`
}

/** A4 sheets of A7 cards with dashed cut lines; the same document drives the preview and the PDF. */
function sheetsHtml(recipes: Recipe[]) {
  const sheets: string[] = []
  for (let i = 0; i < recipes.length; i += PER_SHEET) {
    sheets.push(`<div class="sheet">${recipes.slice(i, i + PER_SHEET).map(cardHtml).join('')}</div>`)
  }
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; }
    html, body { margin: 0; font-family: 'Segoe UI', Arial, sans-serif; color: #2b1d14; }
    body { background: #e9e3dc; padding: 12px; display: flex; flex-direction: column; align-items: center; gap: 12px; }
    .sheet { width: 297mm; height: 210mm; background: #fff; display: grid; justify-content: center;
             grid-template-columns: repeat(4, 74mm); grid-template-rows: repeat(2, 105mm); box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18); }
    .card { width: 74mm; height: 105mm; padding: 5mm 5mm 4mm; border-right: 0.3mm dashed #b9a99a; border-bottom: 0.3mm dashed #b9a99a; overflow: hidden; }
    .card:nth-child(4n + 1) { border-left: 0.3mm dashed #b9a99a; }
    .card:nth-child(-n + 4) { border-top: 0.3mm dashed #b9a99a; }
    .fit { height: 100%; display: flex; flex-direction: column; font-size: 8pt; line-height: 1.35; overflow: hidden; }
    header { border-bottom: 1.5px solid #6b4226; padding-bottom: 1.2mm; margin-bottom: 1.5mm; }
    h1 { font-size: 1.55em; margin: 0; line-height: 1.15; }
    .meta { color: #7a5b45; font-size: 0.95em; margin-top: 0.6mm; }
    h2 { font-size: 0.85em; text-transform: uppercase; letter-spacing: 0.06em; color: #8b5e3c; margin: 1.6mm 0 0.6mm; }
    table { width: 100%; border-collapse: collapse; font-size: 1em; }
    td { padding: 0.35mm 0; border-bottom: 0.5px dotted #cdb9a6; vertical-align: top; }
    td.q { text-align: right; white-space: nowrap; font-weight: 600; padding-left: 2mm; }
    i { color: #7a5b45; }
    ol { margin: 0; padding-left: 1.35em; }
    li { margin-bottom: 0.5mm; }
    footer { margin-top: auto; padding-top: 1mm; font-size: 0.8em; color: #9a8573; text-align: right; }
  </style></head><body>${sheets.join('')}</body></html>`
}

/** Shrinks a card's font until its content fits the fixed A7 size. */
function fitCards(doc: Document) {
  doc.querySelectorAll<HTMLElement>('.fit').forEach((el) => {
    let size = 8
    el.style.fontSize = `${size}pt`
    while (el.scrollHeight > el.clientHeight && size > 5) {
      size -= 0.25
      el.style.fontSize = `${size}pt`
    }
  })
}

/** Scales the A4 sheets down so a whole sheet is visible in the preview pane. */
function zoomToFit(frame: HTMLIFrameElement) {
  const doc = frame.contentDocument!
  const sheet = doc.querySelector<HTMLElement>('.sheet')
  if (!sheet) return
  doc.body.style.zoom = '1'
  doc.body.style.zoom = String(Math.min(1, (frame.clientWidth - 30) / sheet.offsetWidth))
}

async function downloadPdf(doc: Document) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')])
  const zoom = doc.body.style.zoom
  doc.body.style.zoom = '1'
  try {
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const sheets = [...doc.querySelectorAll<HTMLElement>('.sheet')]
    for (const [i, sheet] of sheets.entries()) {
      const canvas = await html2canvas(sheet, { scale: 3, backgroundColor: '#ffffff', logging: false })
      if (i > 0) pdf.addPage()
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 297, 210)
    }
    pdf.save(`cong-thuc-${dayjs().format('YYYYMMDD-HHmm')}.pdf`)
  } finally {
    doc.body.style.zoom = zoom
  }
}

export function PrintRecipesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { message } = App.useApp()
  const { data = [], isLoading } = useQuery({ queryKey: ['recipes', 'active'], queryFn: coreApi.activeRecipes, enabled: open })
  const [selected, setSelected] = useState<number[]>([])
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const frame = useRef<HTMLIFrameElement>(null)

  // latest change first, both in the list and on the sheets
  const sorted = useMemo(() => [...data].sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')), [data])
  const rows = useMemo(() => sorted.filter((r) => !q || r.coffeeName.toLowerCase().includes(q.toLowerCase())), [sorted, q])
  const picked = useMemo(() => sorted.filter((r) => selected.includes(r.id)), [sorted, selected])
  const html = useMemo(() => sheetsHtml(picked), [picked])
  const sheetCount = Math.ceil(picked.length / PER_SHEET)

  const exportPdf = async () => {
    const doc = frame.current?.contentDocument
    if (!doc) return
    setBusy(true)
    try {
      await downloadPdf(doc)
    } catch {
      message.error('Không tạo được file PDF')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onCancel={onClose} width={1120} title="In công thức — A4, mỗi tờ 8 thẻ A7" destroyOnHidden
      footer={(
        <Button type="primary" icon={<FilePdfOutlined />} disabled={!picked.length} loading={busy} onClick={exportPdf}>
          Tải PDF{picked.length ? ` · ${picked.length} công thức / ${sheetCount} tờ A4` : ''}
        </Button>
      )}>
      <div className="a-print-recipes">
        <div>
          <Input.Search allowClear placeholder="Tìm món" onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 10 }} />
          <Table rowKey="id" size="small" loading={isLoading} dataSource={rows} pagination={false} scroll={{ y: 420 }}
            rowSelection={{ selectedRowKeys: selected, onChange: (keys) => setSelected(keys as number[]) }}
            onRow={(r) => ({ onClick: () => setSelected((s) => (s.includes(r.id) ? s.filter((x) => x !== r.id) : [...s, r.id])), style: { cursor: 'pointer' } })}
            columns={[
              { title: 'Món', dataIndex: 'coffeeName', render: (v) => <b>{v}</b> },
              {
                title: 'Sửa lần cuối', dataIndex: 'updatedAt', width: 150,
                render: (v, r) => <>{dateTime(v)}{r.updatedBy && <div className="a-muted small">{r.updatedBy}</div>}</>,
              },
            ]} />
        </div>
        <div className="a-print-preview">
          {picked.length
            ? <iframe ref={frame} title="Xem trước" srcDoc={html} onLoad={(e) => { fitCards(e.currentTarget.contentDocument!); zoomToFit(e.currentTarget) }} />
            : <Empty description="Chọn công thức để xem trước" />}
        </div>
      </div>
    </Modal>
  )
}
