import { useState } from 'react'
import { Button, Form, Input } from 'antd'
import { HolderOutlined, MinusCircleOutlined, PlusOutlined } from '@ant-design/icons'
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors,
  type DragEndEvent, type DragOverEvent, type DragStartEvent, type UniqueIdentifier,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { restrictToFirstScrollableAncestor, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { CSS } from '@dnd-kit/utilities'

/** Form.List of step texts reorderable by dragging the handle; neighbours slide aside to preview the drop. */
export function SortableSteps({ name }: { name: string }) {
  const form = Form.useFormInstance()
  const [active, setActive] = useState<number | null>(null)
  const [over, setOver] = useState<number | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  return (
    <Form.List name={name}>
      {(fields, { add, remove, move }) => {
        const ids = fields.map((f) => f.key as UniqueIdentifier)
        const indexOf = (id: UniqueIdentifier) => ids.indexOf(id)
        // order the list will have if dropped now — keeps step numbers right while dragging
        const projected = active !== null && over !== null ? arrayMove(fields.map((_, i) => i), active, over) : null
        const numberOf = (i: number) => (projected ? projected.indexOf(i) : i) + 1
        const reset = () => { setActive(null); setOver(null) }

        return (
          <>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis, restrictToFirstScrollableAncestor]}
              onDragStart={(e: DragStartEvent) => { setActive(indexOf(e.active.id)); setOver(indexOf(e.active.id)) }}
              onDragOver={(e: DragOverEvent) => e.over && setOver(indexOf(e.over.id))}
              onDragEnd={(e: DragEndEvent) => {
                if (e.over && e.active.id !== e.over.id) move(indexOf(e.active.id), indexOf(e.over.id))
                reset()
              }}
              onDragCancel={reset}>
              <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                {fields.map((f, i) => (
                  <StepRow key={f.key} id={f.key} no={numberOf(i)} fieldName={f.name} onRemove={() => remove(f.name)} />
                ))}
              </SortableContext>
              <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' }}>
                {active !== null && (
                  <div className="a-step-row a-step-overlay">
                    <span className="a-step-handle"><HolderOutlined /></span>
                    <b className="a-step-no">{numberOf(active)}.</b>
                    <div className="a-step-overlay-text">{form.getFieldValue([name, active]) || <span className="a-muted">Mô tả thao tác</span>}</div>
                  </div>
                )}
              </DragOverlay>
            </DndContext>
            <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add('')}>Thêm bước</Button>
          </>
        )
      }}
    </Form.List>
  )
}

function StepRow({ id, no, fieldName, onRemove }: { id: number; no: number; fieldName: number; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`a-step-row${isDragging ? ' is-placeholder' : ''}`}>
      <span ref={setActivatorNodeRef} className="a-step-handle" {...attributes} {...listeners}><HolderOutlined /></span>
      <b className="a-step-no">{no}.</b>
      <Form.Item name={fieldName} style={{ flex: 1, marginBottom: 0 }}><Input.TextArea autoSize placeholder="Mô tả thao tác" /></Form.Item>
      <Button size="small" type="text" icon={<MinusCircleOutlined />} onClick={onRemove} />
    </div>
  )
}
