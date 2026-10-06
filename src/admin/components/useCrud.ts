import { App } from 'antd'
import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { errorMessage } from '@/api/client'

/** Mutation that shows a toast and refreshes the given queries on success. */
export function useAction<TVars, TRes = unknown>(fn: (v: TVars) => Promise<TRes>, invalidate: QueryKey[], okText = 'Đã lưu') {
  const qc = useQueryClient()
  const { message } = App.useApp()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      if (okText) message.success(okText)
      invalidate.forEach((k) => qc.invalidateQueries({ queryKey: k }))
    },
    onError: (e) => message.error(errorMessage(e)),
  })
}
