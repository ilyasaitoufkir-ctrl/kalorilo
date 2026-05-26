import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useStore } from '../store/useStore'

export default function SupplementChecklist() {
  const supplements      = useStore((s) => s.supplements)
  const supplementChecked = useStore((s) => s.supplementChecked)
  const addSupplement    = useStore((s) => s.addSupplement)
  const removeSupplement = useStore((s) => s.removeSupplement)
  const toggleSupplement = useStore((s) => s.toggleSupplement)

  const [newName, setNewName] = useState('')

  const today = new Date().toISOString().split('T')[0]
  const checkedToday = (id: string) => supplementChecked[id] === today
  const doneCount = supplements.filter((s) => checkedToday(s.id)).length

  const handleAdd = () => {
    const name = newName.trim()
    if (!name) return
    addSupplement(name)
    setNewName('')
  }

  return (
    <div className="space-y-3">
      {/* Header progress */}
      <div className="glass p-4 flex items-center justify-between">
        <div>
          <p className="font-black" style={{ color: 'var(--text-1)', fontSize: 16 }}>
            💊 Heute eingenommen
          </p>
          <p style={{ color: 'var(--text-3)', fontSize: 13, marginTop: 2 }}>
            Setzt sich täglich um Mitternacht zurück
          </p>
        </div>
        <div className="text-center">
          <p className="font-black" style={{ fontSize: 28, color: '#4a8c5c', lineHeight: 1 }}>
            {doneCount}/{supplements.length}
          </p>
        </div>
      </div>

      {/* Checklist */}
      <div className="glass divide-y" style={{ borderColor: 'transparent' }}>
        {supplements.length === 0 && (
          <p className="px-5 py-6 text-center" style={{ color: 'var(--text-3)', fontSize: 14 }}>
            Noch keine Supplements – füge unten welche hinzu.
          </p>
        )}
        {supplements.map((sup, i) => {
          const checked = checkedToday(sup.id)
          return (
            <div
              key={sup.id}
              className="flex items-center gap-4 px-4"
              style={{
                paddingTop: 16,
                paddingBottom: 16,
                borderTop: i > 0 ? '1px solid rgba(125,184,138,0.12)' : 'none',
                background: checked ? 'rgba(74,140,92,0.04)' : 'transparent',
                transition: 'background 0.2s',
              }}
            >
              {/* Checkmark button */}
              <button
                onClick={() => toggleSupplement(sup.id)}
                className="flex-shrink-0"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  border: checked ? 'none' : '2px solid rgba(125,184,138,0.3)',
                  background: checked ? 'linear-gradient(135deg,#7db88a,#4a8c5c)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 22,
                  transition: 'all 0.2s',
                  boxShadow: checked ? '0 4px 12px rgba(74,140,92,0.3)' : 'none',
                }}
              >
                {checked ? '✓' : ''}
              </button>

              {/* Name */}
              <p
                className="flex-1 font-bold"
                style={{
                  color: checked ? '#4a8c5c' : 'var(--text-1)',
                  fontSize: 16,
                  textDecoration: checked ? 'line-through' : 'none',
                  opacity: checked ? 0.7 : 1,
                  transition: 'all 0.2s',
                }}
              >
                {sup.name}
              </p>

              {/* Delete */}
              <button
                onClick={() => removeSupplement(sup.id)}
                className="flex-shrink-0"
                style={{ color: 'rgba(125,184,138,0.4)', padding: 4 }}
              >
                <X size={16} />
              </button>
            </div>
          )
        })}
      </div>

      {/* Add new */}
      <div className="glass p-4 flex gap-3">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Neues Supplement…"
          style={{
            flex: 1,
            background: 'rgba(74,140,92,0.05)',
            border: '1px solid rgba(125,184,138,0.2)',
            borderRadius: 14,
            color: 'var(--text-1)',
            padding: '12px 14px',
            fontSize: 15,
            fontWeight: 600,
            outline: 'none',
          }}
        />
        <button
          onClick={handleAdd}
          disabled={!newName.trim()}
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: 'linear-gradient(135deg,#7db88a,#4a8c5c)',
            border: 'none',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            opacity: newName.trim() ? 1 : 0.4,
          }}
        >
          <Plus size={22} />
        </button>
      </div>
    </div>
  )
}
