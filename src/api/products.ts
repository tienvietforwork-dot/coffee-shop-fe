import apiClient from './client'
import type { Product, ProductMaterial } from '@/types'

export type ProductPayload = Omit<Product, 'id' | 'categoryName'>

export async function getProducts(): Promise<Product[]> {
  const { data } = await apiClient.get<Product[]>('/products')
  return data
}

export async function createProduct(payload: ProductPayload): Promise<Product> {
  const { data } = await apiClient.post<Product>('/products', payload)
  return data
}

export async function updateProduct(id: number, payload: ProductPayload): Promise<Product> {
  const { data } = await apiClient.put<Product>(`/products/${id}`, payload)
  return data
}

export async function deleteProduct(id: number): Promise<void> {
  await apiClient.delete(`/products/${id}`)
}

export async function getProductMaterials(productId: number): Promise<ProductMaterial[]> {
  const { data } = await apiClient.get<ProductMaterial[]>(`/products/${productId}/materials`)
  return data
}

export async function setProductMaterials(
  productId: number,
  materials: Array<{ materialId: number; quantity: number }>,
): Promise<ProductMaterial[]> {
  const { data } = await apiClient.put<ProductMaterial[]>(
    `/products/${productId}/materials`,
    { materials },
  )
  return data
}
