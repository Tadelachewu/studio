import { type Provider, type Product } from '@/lib/types';

const BASE_URL = process.env.API_BASE_URL || 'https://breezy-falcons-know.loca.lt
';

async function fetchFromApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  try {
    const url = `${BASE_URL}${endpoint}`;
    console.log(`[API] Fetching from: ${url}`);
    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[API] Error fetching ${endpoint}: ${response.status} ${response.statusText} - ${errorText}`);
      throw new Error(`Failed to fetch data from ${endpoint}`);
    }

    const data = await response.json();
    console.log(`[API] Successfully fetched data from: ${endpoint}`);
    return data as T;
  } catch (error) {
    console.error(`[API] Network or fetch error for ${endpoint}:`, error);
    throw error;
  }
}

export async function getProviders(): Promise<Provider[]> {
  return fetchFromApi<Provider[]>('/api/providers');
}

export async function getProducts(providerId?: string): Promise<Product[]> {
    if (!providerId) {
        return fetchFromApi<Product[]>('/api/products');
    }
  return fetchFromApi<Product[]>(`/api/products?providerId=${providerId}`);
}
