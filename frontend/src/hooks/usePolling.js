import { useState, useEffect, useRef, useCallback } from 'react'

export function usePolling(fetcher, interval = 5000, deps = []) {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)

  const fetch = useCallback(async () => {
    try {
      const d = await fetcher()
      setData(d)
      setError(null)
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, deps)

  useEffect(() => {
    fetch()
    const id = setInterval(fetch, interval)
    return () => clearInterval(id)
  }, [fetch, interval])

  return { data, loading, error, refetch: fetch }
}

export function useLiveStream(onEvent) {
  const [connected, setConnected] = useState(false)
  const esRef = useRef(null)

  useEffect(() => {
    const BASE = import.meta.env.VITE_API_URL || ''
    const url = `${BASE}/v1/stream?authorization=Bearer demo_key_fraudshield_2024`

    // SSE with auth header workaround via fetch
    let active = true
    let reader = null

    async function connect() {
      try {
        const res = await fetch(`${BASE}/v1/stream`, {
          headers: { Authorization: 'Bearer demo_key_fraudshield_2024' }
        })
        setConnected(true)
        reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buf = ''

        while (active) {
          const { done, value } = await reader.read()
          if (done) break
          buf += decoder.decode(value, { stream: true })
          const lines = buf.split('\n')
          buf = lines.pop()
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const evt = JSON.parse(line.slice(6))
                onEvent(evt)
              } catch {}
            }
          }
        }
      } catch {
        setConnected(false)
        if (active) setTimeout(connect, 3000)
      }
    }

    connect()
    return () => {
      active = false
      reader?.cancel()
      setConnected(false)
    }
  }, [])

  return connected
}
