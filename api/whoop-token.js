/**
 * Vercel Serverless Function – Whoop OAuth2 Token Exchange Proxy
 * Runs server-side to avoid CORS restrictions from the browser.
 */
export default async function handler(req, res) {
  // CORS headers so the PWA can call this endpoint
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { grant_type, code, client_id, client_secret, refresh_token, redirect_uri } = req.body

  if (!client_id || !client_secret) {
    return res.status(400).json({ error: 'client_id and client_secret required' })
  }

  const body = new URLSearchParams({ grant_type, client_id, client_secret })

  if (grant_type === 'authorization_code') {
    if (!code) return res.status(400).json({ error: 'code required' })
    body.append('code', code)
    body.append('redirect_uri', redirect_uri || 'https://kalorilo.vercel.app/whoop-callback')
  } else if (grant_type === 'refresh_token') {
    if (!refresh_token) return res.status(400).json({ error: 'refresh_token required' })
    body.append('refresh_token', refresh_token)
  } else {
    return res.status(400).json({ error: `Unknown grant_type: ${grant_type}` })
  }

  try {
    const response = await fetch('https://api.prod.whoop.com/oauth/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    const data = await response.json()
    return res.status(response.status).json(data)
  } catch (e) {
    return res.status(500).json({ error: String(e) })
  }
}
