import { App, Form, Input, Modal } from 'antd'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '@/api/auth'
import { errorMessage } from '@/api/client'

export function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form] = Form.useForm()
  const { message } = App.useApp()
  const save = useMutation({
    mutationFn: (v: { currentPassword: string; newPassword: string }) => authApi.changePassword(v.currentPassword, v.newPassword),
    onSuccess: () => { message.success('Đã đổi mật khẩu'); onClose() },
    onError: (e) => message.error(errorMessage(e)),
  })
  return (
    <Modal open={open} title="Đổi mật khẩu" okText="Lưu" onOk={() => form.submit()} confirmLoading={save.isPending}
      onCancel={onClose} destroyOnHidden>
      <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)} preserve={false}>
        <Form.Item name="currentPassword" label="Mật khẩu hiện tại" rules={[{ required: true }]}><Input.Password /></Form.Item>
        <Form.Item name="newPassword" label="Mật khẩu mới" rules={[{ required: true, min: 6, message: 'Tối thiểu 6 ký tự' }]}><Input.Password /></Form.Item>
        <Form.Item name="confirm" label="Nhập lại mật khẩu mới" dependencies={['newPassword']}
          rules={[{ required: true }, ({ getFieldValue }) => ({
            validator: (_, v) => (v === getFieldValue('newPassword') ? Promise.resolve() : Promise.reject(new Error('Mật khẩu không khớp'))),
          })]}>
          <Input.Password />
        </Form.Item>
      </Form>
    </Modal>
  )
}
