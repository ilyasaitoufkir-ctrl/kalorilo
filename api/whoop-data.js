/**
 * Vercel Serverless Function – WHOOP Developer API Proxy
 * Proxies all WHOOP data requests server-side to avoid browser CORS restrictions.
 * Usage: GET /api/whoop-data?path=/recovery&start=...&end=...&limit=1
 * Authorization header is forwarded as-is.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { path, ...queryParams } = req.query
  const authorization = req.headers.authorization

  if (!path) return res.status(400).json({ error: 'path query param required' })
  if (!authorization) return res.status(401).json({ error: 'Authorization header required' })

  // Forward all remaining query params to WHOOP
  const qs = new URLSearchParams(queryParams).toString()
  const url = `https://api.prod.whoop.com/developer/v1${path}${qs ? '?' + qs : ''}`

  try {
    const response = await fetch(url, {
      headers: { Authorization: authorization },
    })
    const data = await response.json()
    return res.status(response.status).json(data)
  } catch (e) {
    return res.status(500).json({ error: String(e) })
  }
}
