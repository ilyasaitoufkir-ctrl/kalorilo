import { useEffect } from 'react'
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore'
import { db } from '../lib/firebase'
import toast from 'react-hot-toast'

const LS_SEEN = 'kalorilo_seen_broadcasts'

function getSeenIds(): string[] {
  try { return JSON.parse(localStorage.getItem(LS_SEEN) ?? '[]') } catch { return [] }
}
function markSeen(id: string) {
  const seen = getSeenIds()
  if (!seen.includes(id)) localStorage.setItem(LS_SEEN, JSON.stringify([...seen, id].slice(-50)))
}

export function useBroadcasts(code: string | null) {
  useEffect(() => {
    if (!code || !db) return
    const since = Date.now() - 7 * 24 * 60 * 60 * 1000 // last 7 days
    const seen = getSeenIds()

    getDocs(
      query(collection(db, 'broadcasts'), where('createdAt', '>', since), orderBy('createdAt', 'desc'), limit(10))
    ).then(snap => {
      snap.docs.forEach(d => {
        if (seen.includes(d.id)) return
        const data = d.data()
        toast(data.text as string, {
          duration: 6000,
          icon: '📢',
          style: { maxWidth: 320 },
        })
        markSeen(d.id)
      })
    }).catch(() => { /* offline – skip */ })
  }, [code])
}
