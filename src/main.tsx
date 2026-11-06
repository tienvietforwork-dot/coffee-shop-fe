import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { DEFAULT_IMAGE } from './lib/format'

// ảnh lỗi (link hỏng, file bị xóa…) → ảnh mặc định, một lần cho mỗi ảnh
window.addEventListener('error', (e) => {
  const img = e.target
  if (img instanceof HTMLImageElement && !img.dataset.fallback && !img.src.endsWith(DEFAULT_IMAGE)) {
    img.dataset.fallback = '1'
    img.src = DEFAULT_IMAGE
  }
}, true)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
