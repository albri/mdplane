'use client'

import { useQuery } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import type {
  SearchResponse,
  SearchResult,
  SearchHighlight,
  Error as ApiErrorResponse,
} from '@mdplane/shared'
import { CAPABILITY_ROUTES } from '@mdplane/shared'
import { capabilityProxyRoute } from '@/lib/capability/proxy-route'

export type { SearchResult, SearchHighlight }

// Extended search data type that includes pagination info
export interface SearchData {
  results: SearchResult[]
  total: number
  hasMore: boolean
  cursor?: string
}

export interface SearchOptions {
  type?: 'task' | 'claim' | 'response' | 'blocked' | 'answer' | 'renew' | 'cancel' | 'comment' | 'vote'
  status?: 'pending' | 'claimed' | 'completed' | 'cancelled'
  limit?: number
}

// API response wrapper that includes error handling
type SearchApiResponse = SearchResponse | ApiErrorResponse

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

// Fetch search results
async function fetchSearchResults(
  readKey: string,
  query: string,
  options?: SearchOptions
): Promise<SearchData> {
  const params = new URLSearchParams()
  params.set('q', query)
  if (options?.type) params.set('type', options.type)
  if (options?.status) params.set('status', options.status)
  if (options?.limit) params.set('limit', options.limit.toString())

  const response = await fetch(
    `${capabilityProxyRoute(CAPABILITY_ROUTES.readSearch(readKey))}?${params.toString()}`
  )
  const data: SearchApiResponse = await response.json()

  if (!response.ok || !data.ok) {
    const errorData = data as ApiErrorResponse
    throw new Error(errorData.error?.message || 'Failed to search')
  }

  // Map generated response to our SearchData interface
  return {
    results: data.data?.results ?? [],
    total: data.data?.total ?? 0,
    hasMore: data.pagination?.hasMore ?? false,
    cursor: data.pagination?.cursor,
  }
}

/**
 * Hook for searching within a workspace via capability URL
 * Uses debouncing to avoid excessive API calls
 */
export function useSearch(
  readKey: string,
  query: string,
  options?: SearchOptions
) {
  // Debounce the query to avoid excessive API calls
  const debouncedQuery = useDebounce(query, 300)

  return useQuery({
    queryKey: ['search', readKey, debouncedQuery, options],
    queryFn: () => fetchSearchResults(readKey, debouncedQuery, options),
    enabled: !!readKey && debouncedQuery.length > 0,
    staleTime: 1000 * 30, // 30 seconds
  })
}

