import { useState, useEffect, useMemo } from 'react'
import { Plus, Copy, X, ChevronRight, LogOut, UserPlus, Check, Loader } from 'lucide-react'
import { useStore } from '../store/useStore'
import { isFirebaseReady, tryInitFromConfig } from '../lib/firebase'
import { useGroup, createGroup, joinGroup, leaveGroup, syncProgress, getGroupInfo } from '../hooks/useGroup'
import { CHALLENGES } from '../data/challenges'
import { formatDate } from '../utils/calculations'
import toast from 'react-hot-toast'

const today = formatDate()
const AVATARS = ['🦁', '🐯', '🦊', '🐺', '🐻', '🐼', '🐸', '🦅', '🦋', '🐬', '🦄', '🐲']

// ── Helper ─────────────────────────────────────────────────────────────────
function getChallengeProgress(member: any, challenge: any, calTarget: number): number {
  const t = member.today
  if (!t) return 0
  switch (challenge.metric) {
    case 'goalMet':      return t.goalMet ? 100 : Math.round((t.calories / calTarget) * 100)
    case 'steps':        return Math.round((t.steps / challenge.target) * 100)
    case 'water':        return Math.round((t.water / challenge.target) * 100)
    case 'streak':       return Math.round((t.streak / challenge.target) * 100)
    case 'activityMinutes': return Math.round((t.activityMinutes / challenge.target) * 100)
    case 'calories':     return t.calories < calTarget && t.calories > 0 ? 100 : Math.round((1 - t.calories / calTarget) * 100)
    default: return 0
  }
}

function getChallengeValue(member: any, challenge: any): string {
  const t = member.today
  if (!t) return '–'
  switch (challenge.metric) {
    case 'goalMet':      return t.goalMet ? '✓ Ziel erreicht' : `${t.calories} kcal`
    case 'steps':        return `${t.steps.toLocaleString()} 👟`
    case 'water':        return `${t.water} ml`
    case 'streak':       return `${t.streak} Tage 🔥`
    case 'activityMinutes': return `${t.activityMinutes} Min`
    case 'calories':     return `${t.calories} kcal`
    default: return '–'
  }
}

// ── Member Card ─────────────────────────────────────────────────────────────
function MemberCard({ member, challenge, rank, isMe, calTarget }: { member: any; challenge: any; rank: number; isMe: boolean; calTarget: number }) {
  const pct = Math.min(100, getChallengeProgress(member, challenge, calTarget))
  const val = getChallengeValue(member, challenge)
  const rankEmoji = rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : `${rank + 1}.`

  return (
    <div className={`card p-4 ${isMe ? 'ring-2 ring-blue-500' : ''}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className="text-2xl">{rankEmoji}</div>
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl"
          style={{ background: 'var(--surface2)' }}>
          {member.avatar}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-black truncate" style={{ color: 'var(--text1)' }}>{member.name}</p>
            {isMe && <span className="text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded-full font-bold">Du</span>}
          </div>
          <p className="text-xs font-semibold" style={{ color: challenge.color }}>{val}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-black" style={{ color: pct >= 100 ? '#10b981' : 'var(--text1)' }}>
            {pct >= 100 ? '✅' : `${pct}%`}
          </p>
        </div>
      </div>
      <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--surface2)' }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: pct >= 100 ? '#10b981' : challenge.color }}
        />
      </div>
    </div>
  )
}

// ── Create Group Sheet ──────────────────────────────────────────────────────
function CreateSheet({ userId, userName, userAvatar, onCreated, onClose }: {
  userId: string; userName: string; userAvatar: string
  onCreated: (id: string) => void; onClose: () => void
}) {
  const [step, setStep]     = useState<'name'|'challenge'>('name')
  const [name, setName]     = useState('')
  const [challenge, setChallenge] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const create = async () => {
    if (!name.trim() || !challenge) return
    setLoading(true)
    try {
      const id = await createGroup(name.trim(), challenge, userId, userName, userAvatar)
      toast.success(`Gruppe "${name}" erstellt! 🎉`)
      onCreated(id)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Fehler', { duration: 5000 }) }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="sheet-overlay absolute inset-0" />
      <div className="relative w-full max-w-[430px] mx-auto rounded-t-[32px] max-h-[92dvh] overflow-y-auto flex flex-col anim-up"
        style={{ background: 'var(--bg)' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0"><div className="sheet-handle" /></div>
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="text-lg font-black" style={{ color: 'var(--text1)' }}>Gruppe erstellen</h2>
          <button onClick={onClose} className="w-9 h-9 card flex items-center justify-center"><X size={18} style={{ color: 'var(--text1)' }} /></button>
        </div>

        <div className="px-5 pb-8 space-y-4">
          {step === 'name' && (
            <>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider mb-2 block" style={{ color: 'var(--text3)' }}>Gruppenname</label>
                <input
                  autoFocus value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-2xl px-4 py-4 text-base font-bold outline-none card"
                  style={{ color: 'var(--text1)' }}
                  placeholder="z.B. Team Sommer 2025"
                  onKeyDown={(e) => e.key === 'Enter' && name.trim() && setStep('challenge')}
                />
              </div>
              <button onClick={() => name.trim() && setStep('challenge')} disabled={!name.trim()}
                className="w-full py-4 bg-blue-500 rounded-3xl text-white font-black disabled:opacity-40">
                Weiter → Challenge wählen
              </button>
            </>
          )}

          {step === 'challenge' && (
            <>
              <button onClick={() => setStep('name')} className="text-blue-500 text-sm font-semibold">← Zurück</button>
              <p className="text-sm font-bold" style={{ color: 'var(--text1)' }}>Welche Challenge?</p>
              <div className="space-y-2">
                {CHALLENGES.map((ch) => (
                  <button key={ch.id} onClick={() => setChallenge(ch.id)}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl text-left transition ${challenge === ch.id ? 'ring-2' : 'card'}`}
                    style={challenge === ch.id ? { background: ch.color + '15', outline: `2px solid ${ch.color}` } : {}}>
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                      style={{ background: ch.color + '20' }}>{ch.emoji}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-sm" style={{ color: 'var(--text1)' }}>{ch.name}</p>
                      <p className="text-xs" style={{ color: 'var(--text3)' }}>{ch.desc}</p>
                    </div>
                    {challenge === ch.id && <Check size={18} style={{ color: ch.color }} />}
                  </button>
                ))}
              </div>
              <button onClick={create} disabled={!challenge || loading}
                className="w-full py-4 bg-blue-500 rounded-3xl text-white font-black disabled:opacity-40 flex items-center justify-center gap-2">
                {loading ? <><Loader size={16} className="animate-spin" />Erstelle…</> : '🎉 Gruppe erstellen'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Join Sheet ──────────────────────────────────────────────────────────────
function JoinSheet({ userId, userName, userAvatar, onJoined, onClose }: {
  userId: string; userName: string; userAvatar: string
  onJoined: (id: string) => void; onClose: () => void
}) {
  const [code, setCode]     = useState('')
  const [info, setInfo]     = useState<{ name: string; challengeId: string } | null>(null)
  const [checking, setChecking] = useState(false)
  const [joining, setJoining]  = useState(false)

  const checkCode = async () => {
    if (code.trim().length < 4) return
    setChecking(true)
    try {
      const result = await getGroupInfo(code.trim().toUpperCase())
      if (result) setInfo(result)
      else toast.error('Gruppe nicht gefunden')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Fehler') }
    setChecking(false)
  }

  const join = async () => {
    setJoining(true)
    try {
      await joinGroup(code.trim().toUpperCase(), userId, userName, userAvatar)
      toast.success('Gruppe beigetreten! 🎉')
      onJoined(code.trim().toUpperCase())
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Fehler', { duration: 5000 }) }
    setJoining(false)
  }

  const challenge = CHALLENGES.find((c) => c.id === info?.challengeId)

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="sheet-overlay absolute inset-0" />
      <div className="relative w-full max-w-[430px] mx-auto rounded-t-[32px] anim-up"
        style={{ background: 'var(--bg)' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1"><div className="sheet-handle" /></div>
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="text-lg font-black" style={{ color: 'var(--text1)' }}>Mit Code beitreten</h2>
          <button onClick={onClose} className="w-9 h-9 card flex items-center justify-center"><X size={18} style={{ color: 'var(--text1)' }} /></button>
        </div>
        <div className="px-5 pb-8 space-y-3">
          <div className="flex gap-2">
            <input
              autoFocus value={code}
              onChange={(e) => { setCode(e.target.value.toUpperCase()); setInfo(null) }}
              onKeyDown={(e) => e.key === 'Enter' && checkCode()}
              className="flex-1 rounded-2xl px-4 py-3.5 text-lg font-black text-center tracking-widest outline-none card"
              style={{ color: 'var(--text1)' }}
              placeholder="ABC123"
              maxLength={8}
            />
            <button onClick={checkCode} disabled={code.length < 4 || checking}
              className="px-4 py-3 bg-blue-500 rounded-2xl text-white font-bold text-sm disabled:opacity-40">
              {checking ? <Loader size={16} className="animate-spin" /> : 'Suchen'}
            </button>
          </div>

          {info && challenge && (
            <div className="card p-4">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">{challenge.emoji}</span>
                <div>
                  <p className="font-black" style={{ color: 'var(--text1)' }}>{info.name}</p>
                  <p className="text-sm" style={{ color: 'var(--text3)' }}>Challenge: {challenge.name}</p>
                </div>
              </div>
              <button onClick={join} disabled={joining}
                className="w-full py-3 bg-green-500 rounded-2xl text-white font-black flex items-center justify-center gap-2">
                {joining ? <><Loader size={14} className="animate-spin" />Beitrete…</> : '✅ Beitreten'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Group Detail ────────────────────────────────────────────────────────────
function GroupDetail({ groupId, userId, calTarget, onBack }: {
  groupId: string; userId: string; calTarget: number; onBack: () => void
}) {
  const { group, members, loading, error } = useGroup(groupId, userId)
  const challenge = CHALLENGES.find((c) => c.id === group?.challengeId)
  const inviteUrl = `${window.location.origin}?join=${groupId}`

  const copyInvite = () => {
    navigator.clipboard.writeText(inviteUrl)
      .then(() => toast.success('Einladungslink kopiert! 📋'))
      .catch(() => {
        // Fallback: show code
        toast.success(`Gruppencode: ${groupId}`)
      })
  }

  const handleLeave = async () => {
    await leaveGroup(groupId, userId)
    toast.success('Gruppe verlassen')
    onBack()
  }

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <Loader size={28} className="animate-spin text-blue-500 mx-auto mb-2" />
        <p className="text-sm" style={{ color: 'var(--text3)' }}>Lade Gruppe…</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="flex-1 flex items-center justify-center px-6 text-center">
      <div>
        <p className="text-4xl mb-3">⚠️</p>
        <p className="text-sm font-bold" style={{ color: 'var(--text1)' }}>{error}</p>
        <button onClick={onBack} className="mt-4 px-6 py-2 bg-blue-500 rounded-2xl text-white text-sm font-bold">Zurück</button>
      </div>
    </div>
  )

  if (!group || !challenge) return null

  return (
    <div className="flex-1 overflow-y-auto pb-nav">
      {/* Header */}
      <div className="px-5 pt-5 pb-4">
        <button onClick={onBack} className="text-blue-500 font-semibold text-sm mb-4 flex items-center gap-1">
          ← Alle Gruppen
        </button>

        {/* Challenge banner */}
        <div className="rounded-3xl p-4 mb-4"
          style={{ background: challenge.color + '15', border: `1.5px solid ${challenge.color}30` }}>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-3xl">{challenge.emoji}</span>
            <div>
              <p className="font-black" style={{ color: 'var(--text1)' }}>{group.name}</p>
              <p className="text-sm font-semibold" style={{ color: challenge.color }}>{challenge.name} · {challenge.desc}</p>
            </div>
          </div>
          <div className="flex items-center justify-between mt-3 text-xs" style={{ color: 'var(--text3)' }}>
            <span>{members.length} {members.length === 1 ? 'Mitglied' : 'Mitglieder'}</span>
            <span>Code: <strong style={{ color: 'var(--text1)' }}>{groupId}</strong></span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 mb-5">
          <button onClick={copyInvite}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-500 rounded-2xl text-white font-bold text-sm">
            <Copy size={15} />Einladungslink teilen
          </button>
          <button onClick={handleLeave}
            className="w-12 h-12 card flex items-center justify-center" style={{ color: '#ef4444' }}>
            <LogOut size={17} />
          </button>
        </div>

        {/* Members ranking */}
        <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text3)' }}>
          🏆 Rangliste heute
        </p>
        <div className="space-y-2">
          {members.length === 0 ? (
            <div className="card p-6 text-center">
              <p className="text-3xl mb-2">👥</p>
              <p className="text-sm" style={{ color: 'var(--text3)' }}>Noch keine Mitglieder.<br />Teile den Link!</p>
            </div>
          ) : (
            members.map((member, i) => (
              <MemberCard
                key={member.userId}
                member={member}
                challenge={challenge}
                rank={i}
                isMe={member.userId === userId}
                calTarget={calTarget}
              />
            ))
          )}
        </div>

        {/* Invite hint */}
        <div className="mt-4 rounded-2xl p-3" style={{ background: 'var(--surface2)' }}>
          <p className="text-xs" style={{ color: 'var(--text3)' }}>
            💡 Dein Fortschritt wird automatisch aus deinen heutigen Einträgen synchronisiert.
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Main Friends Component ──────────────────────────────────────────────────
export default function Friends() {
  const profile        = useStore((s) => s.profile)
  const firebaseConfig = useStore((s) => s.firebaseConfig)
  const userId         = useStore((s) => s.userId)
  const groupIds       = useStore((s) => s.groupIds)
  const addGroupId     = useStore((s) => s.addGroupId)
  const foodLogs       = useStore((s) => s.foodLogs)
  const activityLogs   = useStore((s) => s.activityLogs)
  const waterLogs      = useStore((s) => s.waterLogs)
  const stepsToday     = useStore((s) => s.stepsToday)

  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [showCreate, setShowCreate]       = useState(false)
  const [showJoin, setShowJoin]           = useState(false)
  const [activeTab, setActiveTab]         = useState<'groups'|'setup'>('groups')

  // Init Firebase from stored config
  const firebaseReady = useMemo(() => {
    if (firebaseConfig?.apiKey) return tryInitFromConfig(firebaseConfig)
    return isFirebaseReady()
  }, [firebaseConfig])

  // Check join code from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const joinCode = params.get('join')
    if (joinCode && firebaseReady) {
      setShowJoin(true)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [firebaseReady])

  // Calculate today's progress for sync
  const getDailyCalTarget = useStore((s) => s.getDailyCalorieTarget)
  const calTarget = getDailyCalTarget()

  const todayFoods = useMemo(() => foodLogs.filter((l) => l.date === today), [foodLogs])
  const todayActs  = useMemo(() => activityLogs.filter((l) => l.date === today), [activityLogs])
  const todayWater = useMemo(() => waterLogs.find((w) => w.date === today)?.amount ?? 0, [waterLogs])
  const todayCals  = useMemo(() => todayFoods.reduce((s, f) => s + (f.macros?.calories ?? 0), 0), [todayFoods])
  const todayMins  = useMemo(() => todayActs.reduce((s, a) => s + a.duration, 0), [todayActs])

  const userName   = profile?.name ?? 'Unbekannt'
  const userAvatar = AVATARS[parseInt(userId.slice(-2), 16) % AVATARS.length]

  // Auto-sync progress to all joined groups
  useEffect(() => {
    if (!firebaseReady || groupIds.length === 0 || !userId) return
    const progress = {
      calories: Math.round(todayCals), target: calTarget,
      goalMet: Math.abs(todayCals - calTarget) <= 200 && todayCals > 0,
      streak: 0, // simplified
      steps: stepsToday,
      water: todayWater,
      activityMinutes: todayMins,
      date: today,
    }
    groupIds.forEach((gid) => {
      syncProgress(gid, userId, progress).catch(() => {})
    })
  }, [todayCals, todayWater, todayMins, stepsToday, groupIds, userId, firebaseReady, calTarget])

  if (selectedGroup) {
    return (
      <div className="flex flex-col h-dvh pb-[calc(72px+max(env(safe-area-inset-bottom),8px))]" style={{ background: 'var(--bg)' }}>
        <div className="grad-blue px-5 pt-safe pb-4 flex-shrink-0">
          <h1 className="text-white text-2xl font-black">👥 Gruppen</h1>
        </div>
        <GroupDetail
          groupId={selectedGroup}
          userId={userId}
          calTarget={calTarget}
          onBack={() => setSelectedGroup(null)}
        />
      </div>
    )
  }

  return (
    <div className="pb-nav anim-fade" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="grad-blue px-5 pt-safe pb-5 relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-white/5" />
        <h1 className="text-white text-2xl font-black mb-1">👥 Gruppen & Challenges</h1>
        <p className="text-blue-200 text-sm">Trainiere mit Freunden – gemeinsam mehr erreichen</p>
      </div>

      <div className="px-4 pt-4">
        {/* Tab bar */}
        <div className="flex gap-1.5 p-1 rounded-2xl mb-4" style={{ background: 'var(--surface2)' }}>
          {(['groups', 'setup'] as const).map((t) => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === t ? 'bg-blue-500 text-white' : ''}`}
              style={activeTab !== t ? { color: 'var(--text3)' } : {}}>
              {{ groups: '🏆 Meine Gruppen', setup: '⚙️ Firebase Setup' }[t]}
            </button>
          ))}
        </div>

        {/* Groups Tab */}
        {activeTab === 'groups' && (
          <div className="space-y-3">
            {!firebaseReady && (
              <div className="card p-4">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl">⚙️</span>
                  <div>
                    <p className="font-black text-sm" style={{ color: 'var(--text1)' }}>Firebase einrichten</p>
                    <p className="text-xs" style={{ color: 'var(--text3)' }}>Für Gruppen-Features benötigt</p>
                  </div>
                </div>
                <button onClick={() => setActiveTab('setup')}
                  className="w-full py-3 bg-orange-500 rounded-2xl text-white font-bold text-sm">
                  Jetzt einrichten →
                </button>
              </div>
            )}

            {/* Create / Join buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => firebaseReady ? setShowCreate(true) : setActiveTab('setup')}
                className="card card-press p-4 flex flex-col items-center gap-2">
                <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center">
                  <Plus size={22} className="text-white" />
                </div>
                <p className="text-sm font-black" style={{ color: 'var(--text1)' }}>Gruppe erstellen</p>
                <p className="text-xs text-center" style={{ color: 'var(--text3)' }}>Neue Challenge starten</p>
              </button>
              <button onClick={() => firebaseReady ? setShowJoin(true) : setActiveTab('setup')}
                className="card card-press p-4 flex flex-col items-center gap-2">
                <div className="w-12 h-12 bg-green-500 rounded-2xl flex items-center justify-center">
                  <UserPlus size={22} className="text-white" />
                </div>
                <p className="text-sm font-black" style={{ color: 'var(--text1)' }}>Beitreten</p>
                <p className="text-xs text-center" style={{ color: 'var(--text3)' }}>Mit Code einsteigen</p>
              </button>
            </div>

            {/* My groups */}
            {groupIds.length > 0 ? (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text3)' }}>Meine Gruppen</p>
                <div className="space-y-2">
                  {groupIds.map((gid) => (
                    <GroupRow key={gid} groupId={gid} onSelect={() => setSelectedGroup(gid)} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="card p-8 text-center">
                <p className="text-4xl mb-3">🏆</p>
                <p className="font-black text-sm mb-1" style={{ color: 'var(--text1)' }}>Noch keine Gruppen</p>
                <p className="text-xs" style={{ color: 'var(--text3)' }}>
                  Erstelle eine Gruppe und lade deine Freunde ein!
                </p>
              </div>
            )}

            {/* Challenge preview */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text3)' }}>Verfügbare Challenges</p>
              <div className="space-y-2">
                {CHALLENGES.map((ch) => (
                  <div key={ch.id} className="card p-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl flex-shrink-0"
                      style={{ background: ch.color + '20' }}>{ch.emoji}</div>
                    <div className="flex-1">
                      <p className="text-sm font-black" style={{ color: 'var(--text1)' }}>{ch.name}</p>
                      <p className="text-xs" style={{ color: 'var(--text3)' }}>{ch.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Firebase Setup Tab */}
        {activeTab === 'setup' && (
          <div className="space-y-4">
            <FirebaseSetup onConfigured={() => { setActiveTab('groups') }} />
          </div>
        )}
      </div>

      {showCreate && (
        <CreateSheet
          userId={userId} userName={userName} userAvatar={userAvatar}
          onCreated={(id) => { addGroupId(id); setShowCreate(false); setSelectedGroup(id) }}
          onClose={() => setShowCreate(false)}
        />
      )}
      {showJoin && (
        <JoinSheet
          userId={userId} userName={userName} userAvatar={userAvatar}
          onJoined={(id) => { addGroupId(id); setShowJoin(false); setSelectedGroup(id) }}
          onClose={() => setShowJoin(false)}
        />
      )}
    </div>
  )
}

// ── Group Row (list item) ───────────────────────────────────────────────────
function GroupRow({ groupId, onSelect }: { groupId: string; onSelect: () => void }) {
  const { group, members } = useGroup(groupId, '')
  const challenge = CHALLENGES.find((c) => c.id === group?.challengeId)
  if (!group || !challenge) return (
    <div className="card p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-2xl skeleton" />
      <div className="flex-1">
        <div className="h-4 w-24 skeleton mb-2" />
        <div className="h-3 w-16 skeleton" />
      </div>
    </div>
  )
  return (
    <button onClick={onSelect} className="w-full card card-press p-4 flex items-center gap-3 text-left">
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
        style={{ background: challenge.color + '20' }}>{challenge.emoji}</div>
      <div className="flex-1 min-w-0">
        <p className="font-black text-sm truncate" style={{ color: 'var(--text1)' }}>{group.name}</p>
        <p className="text-xs" style={{ color: 'var(--text3)' }}>
          {challenge.name} · {members.length} {members.length === 1 ? 'Mitglied' : 'Mitglieder'}
        </p>
      </div>
      <ChevronRight size={16} style={{ color: 'var(--text3)' }} />
    </button>
  )
}

// ── Firebase Setup ──────────────────────────────────────────────────────────
function FirebaseSetup({ onConfigured }: { onConfigured: () => void }) {
  const firebaseConfig = useStore((s) => s.firebaseConfig)
  const setFirebaseConfig = useStore((s) => s.setFirebaseConfig)
  const [form, setForm] = useState({
    apiKey: firebaseConfig?.apiKey ?? '',
    authDomain: firebaseConfig?.authDomain ?? '',
    projectId: firebaseConfig?.projectId ?? '',
    storageBucket: firebaseConfig?.storageBucket ?? '',
    messagingSenderId: firebaseConfig?.messagingSenderId ?? '',
    appId: firebaseConfig?.appId ?? '',
  })
  const [saving, setSaving] = useState(false)

  const save = () => {
    if (!form.apiKey || !form.projectId) { toast.error('API Key und Project ID sind Pflichtfelder'); return }
    setSaving(true)
    try {
      tryInitFromConfig(form)
      setFirebaseConfig(form)
      toast.success('Firebase konfiguriert! ✅')
      onConfigured()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Fehler') }
    setSaving(false)
  }

  return (
    <div className="space-y-4">
      {/* Instructions */}
      <div className="card p-4">
        <p className="text-sm font-black mb-3" style={{ color: 'var(--text1)' }}>🔥 Firebase Einrichtung (kostenlos)</p>
        <ol className="space-y-2 text-sm" style={{ color: 'var(--text2)' }}>
          <li className="flex gap-2"><span className="font-black text-blue-500">1.</span><span>Gehe zu <strong>console.firebase.google.com</strong></span></li>
          <li className="flex gap-2"><span className="font-black text-blue-500">2.</span><span>Neues Projekt „kalorilo" erstellen</span></li>
          <li className="flex gap-2"><span className="font-black text-blue-500">3.</span><span>Web-App hinzufügen (</span><span className="font-mono text-xs bg-slate-100 px-1 rounded">&lt;/&gt;</span><span>)</span></li>
          <li className="flex gap-2"><span className="font-black text-blue-500">4.</span><span><strong>Firestore Database</strong> aktivieren → Testmodus</span></li>
          <li className="flex gap-2"><span className="font-black text-blue-500">5.</span><span>Firebase-Konfiguration unten einfügen</span></li>
        </ol>
      </div>

      {/* Config form */}
      <div className="card p-4 space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text3)' }}>Firebase Konfiguration</p>
        {[
          { key: 'apiKey', label: 'API Key *', placeholder: 'AIza...' },
          { key: 'projectId', label: 'Project ID *', placeholder: 'kalorilo-12345' },
          { key: 'authDomain', label: 'Auth Domain', placeholder: 'kalorilo.firebaseapp.com' },
          { key: 'storageBucket', label: 'Storage Bucket', placeholder: 'kalorilo.appspot.com' },
          { key: 'messagingSenderId', label: 'Messaging Sender ID', placeholder: '123456789' },
          { key: 'appId', label: 'App ID', placeholder: '1:123:web:abc...' },
        ].map((f) => (
          <div key={f.key}>
            <label className="text-xs font-bold mb-1 block" style={{ color: 'var(--text3)' }}>{f.label}</label>
            <input
              type={f.key === 'apiKey' ? 'password' : 'text'}
              value={form[f.key as keyof typeof form]}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              className="w-full rounded-2xl px-4 py-3 text-sm font-mono outline-none card"
              style={{ color: 'var(--text1)' }}
              placeholder={f.placeholder}
            />
          </div>
        ))}
      </div>

      <button onClick={save} disabled={!form.apiKey || !form.projectId || saving}
        className="w-full py-4 bg-orange-500 rounded-3xl text-white font-black disabled:opacity-40 flex items-center justify-center gap-2">
        {saving ? <><Loader size={16} className="animate-spin" />Verbinde…</> : '🔥 Firebase verbinden'}
      </button>
    </div>
  )
}
