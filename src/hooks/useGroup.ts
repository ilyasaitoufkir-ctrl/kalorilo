import { useState, useEffect } from 'react'
import {
  doc, setDoc, getDoc, onSnapshot, collection,
  deleteDoc, updateDoc,
} from 'firebase/firestore'
import { getDb } from '../lib/firebase'

export interface MemberProgress {
  userId: string
  name: string
  avatar: string
  joinedAt: number
  today: {
    calories: number
    target: number
    goalMet: boolean
    streak: number
    steps: number
    water: number
    activityMinutes: number
    date: string
  }
  lastSeen: number
}

export interface Group {
  id: string
  name: string
  challengeId: string
  createdAt: number
  createdBy: string
  members: MemberProgress[]
}

function genId(length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export function useGroup(groupId: string | null, _userId: string) {
  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<MemberProgress[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!groupId) { setGroup(null); setMembers([]); return }
    const db = getDb()
    if (!db) { setError('Firebase nicht konfiguriert'); return }

    setLoading(true)
    // Subscribe to group document
    const unsubGroup = onSnapshot(doc(db, 'groups', groupId), (snap) => {
      if (!snap.exists()) { setGroup(null); setLoading(false); return }
      setGroup({ id: snap.id, members: [], ...(snap.data() as Omit<Group, 'id'|'members'>) })
      setLoading(false)
    }, (e) => { setError(e.message); setLoading(false) })

    // Subscribe to members subcollection
    const unsubMembers = onSnapshot(
      collection(db, 'groups', groupId, 'members'),
      (snap) => {
        const list: MemberProgress[] = snap.docs.map((d) => d.data() as MemberProgress)
        setMembers(list.sort((a, b) => {
          // Sort by today's progress descending
          const aScore = a.today?.goalMet ? 1 : 0
          const bScore = b.today?.goalMet ? 1 : 0
          return bScore - aScore || b.today?.streak - a.today?.streak
        }))
      },
      (e) => setError(e.message)
    )

    return () => { unsubGroup(); unsubMembers() }
  }, [groupId])

  return { group, members, loading, error }
}

// ── Operations ────────────────────────────────────────────────────────────

export async function createGroup(
  name: string,
  challengeId: string,
  userId: string,
  userName: string,
  userAvatar: string
): Promise<string> {
  const db = getDb()
  if (!db) throw new Error('Firebase nicht konfiguriert – bitte unter Profil → Gruppen einrichten')
  const groupId = genId(6)
  await setDoc(doc(db, 'groups', groupId), {
    id: groupId, name, challengeId,
    createdAt: Date.now(),
    createdBy: userId,
  })
  // Auto-join as creator
  await joinGroup(groupId, userId, userName, userAvatar)
  return groupId
}

export async function joinGroup(
  groupId: string,
  userId: string,
  userName: string,
  userAvatar: string
): Promise<void> {
  const db = getDb()
  if (!db) throw new Error('Firebase nicht konfiguriert')
  // Check group exists
  const groupSnap = await getDoc(doc(db, 'groups', groupId.toUpperCase()))
  if (!groupSnap.exists()) throw new Error(`Gruppe "${groupId}" nicht gefunden`)
  await setDoc(doc(db, 'groups', groupId.toUpperCase(), 'members', userId), {
    userId, name: userName, avatar: userAvatar,
    joinedAt: Date.now(), lastSeen: Date.now(),
    today: {
      calories: 0, target: 2000, goalMet: false, streak: 0,
      steps: 0, water: 0, activityMinutes: 0,
      date: new Date().toISOString().split('T')[0],
    },
  })
}

export async function leaveGroup(groupId: string, userId: string): Promise<void> {
  const db = getDb()
  if (!db) return
  await deleteDoc(doc(db, 'groups', groupId, 'members', userId))
}

export async function syncProgress(
  groupId: string,
  userId: string,
  progress: MemberProgress['today']
): Promise<void> {
  const db = getDb()
  if (!db) return
  await updateDoc(doc(db, 'groups', groupId, 'members', userId), {
    today: progress,
    lastSeen: Date.now(),
  })
}

export async function getGroupInfo(groupId: string): Promise<{ name: string; challengeId: string } | null> {
  const db = getDb()
  if (!db) return null
  const snap = await getDoc(doc(db, 'groups', groupId.toUpperCase()))
  if (!snap.exists()) return null
  const d = snap.data()
  return { name: d.name, challengeId: d.challengeId }
}
