'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getSequences, createSequence, updateSequence, deleteSequence } from '@/actions/sequences'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Mail, Plus, Trash2, RefreshCw, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'

const PREDEFINED_TRIGGERS = [
  { value: 'new_contact', label: 'New contact added' },
  { value: 'job_completed', label: 'Job completed' },
  { value: 'estimate_sent', label: 'Estimate sent' },
  { value: 'no_purchase', label: 'No purchase (30 days)' },
  { value: 'birthday', label: '🎂 Birthday' },
  { value: 'review_requested', label: 'Review requested' },
  { value: 'manual', label: 'Manual only' },
  { value: 'custom', label: 'Custom…' },
]

const TRIGGER_COLORS: Record<string, string> = {
  new_contact: 'bg-blue-100 text-blue-700',
  job_completed: 'bg-green-100 text-green-700',
  estimate_sent: 'bg-teal-100 text-teal-700',
  no_purchase: 'bg-orange-100 text-orange-700',
  birthday: 'bg-purple-100 text-purple-700',
  review_requested: 'bg-yellow-100 text-yellow-700',
  manual: 'bg-gray-100 text-gray-600',
}

function triggerLabel(triggerType: string) {
  const found = PREDEFINED_TRIGGERS.find(t => t.value === triggerType)
  return found ? found.label : triggerType
}

function triggerColor(triggerType: string) {
  return TRIGGER_COLORS[triggerType] ?? 'bg-gray-100 text-gray-600'
}

type SequenceRow = {
  id: string
  name: string
  description: string | null
  trigger_type: string
  is_active: boolean
  stepCount: number
  enrolledCount: number
}

export default function SequencesPage() {
  const router = useRouter()
  const [sequences, setSequences] = useState<SequenceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [triggerType, setTriggerType] = useState('new_contact')
  const [customTrigger, setCustomTrigger] = useState('')

  const fetchSequences = useCallback(async () => {
    setLoading(true)
    const data = await getSequences()
    setSequences(data as SequenceRow[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchSequences() }, [fetchSequences])

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setCreating(true)
    const formData = new FormData(e.currentTarget)
    const finalTrigger = triggerType === 'custom' ? customTrigger.trim() : triggerType
    if (!finalTrigger) { toast.error('Please enter a trigger name'); setCreating(false); return }
    formData.set('trigger_type', finalTrigger)

    const res = await createSequence(formData)
    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success('Sequence created!')
      setCreateOpen(false)
      if (res.id) router.push(`/dashboard/sequences/${res.id}`)
    }
    setCreating(false)
  }

  async function handleToggleActive(id: string, current: boolean) {
    const res = await updateSequence(id, { is_active: !current })
    if (res.error) toast.error(res.error)
    else setSequences(prev => prev.map(s => s.id === id ? { ...s, is_active: !current } : s))
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This will cancel all active enrollments.`)) return
    const res = await deleteSequence(id)
    if (res.error) toast.error(res.error)
    else { toast.success('Sequence deleted'); fetchSequences() }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Mail className="text-blue-600" size={22} />
            <h1 className="text-2xl font-bold">Sequences</h1>
          </div>
          <p className="text-gray-500">
            {sequences.length} sequence{sequences.length !== 1 ? 's' : ''} ·{' '}
            {sequences.filter(s => s.is_active).length} active
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={fetchSequences}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </Button>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger>
              <Button type="button"><Plus size={16} className="mr-2" />New Sequence</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create sequence</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4 py-2">
                <div className="space-y-1">
                  <Label>Name *</Label>
                  <Input name="name" placeholder="e.g. New Client Welcome" required />
                </div>
                <div className="space-y-1">
                  <Label>Description</Label>
                  <Input name="description" placeholder="Short description (optional)" />
                </div>
                <div className="space-y-1">
                  <Label>Trigger</Label>
                  <select
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm bg-white"
                    value={triggerType}
                    onChange={e => setTriggerType(e.target.value)}
                  >
                    {PREDEFINED_TRIGGERS.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  {triggerType === 'custom' && (
                    <Input
                      className="mt-2"
                      placeholder="e.g. After consultation call"
                      value={customTrigger}
                      onChange={e => setCustomTrigger(e.target.value)}
                    />
                  )}
                </div>
                <div className="flex gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} className="flex-1">Cancel</Button>
                  <Button type="submit" disabled={creating} className="flex-1">
                    {creating ? 'Creating…' : 'Create & edit'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <RefreshCw size={20} className="animate-spin mr-2" /> Loading…
          </div>
        ) : sequences.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Mail size={32} className="mx-auto mb-2 opacity-30" />
            <p className="mb-3">No sequences yet</p>
            <Button size="sm" onClick={() => setCreateOpen(true)}>Create your first sequence</Button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-5 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Trigger</th>
                <th className="px-4 py-3 text-center">Steps</th>
                <th className="px-4 py-3 text-center">Enrolled</th>
                <th className="px-4 py-3 text-center">Active</th>
                <th className="px-4 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sequences.map(seq => (
                <tr key={seq.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="font-medium text-gray-900">{seq.name}</div>
                    {seq.description && <div className="text-xs text-gray-400 mt-0.5">{seq.description}</div>}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${triggerColor(seq.trigger_type)}`}>
                      {triggerLabel(seq.trigger_type)}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center text-gray-700">{seq.stepCount}</td>
                  <td className="px-4 py-4 text-center text-gray-700">{seq.enrolledCount}</td>
                  <td className="px-4 py-4 text-center">
                    <Switch
                      checked={seq.is_active}
                      onCheckedChange={() => handleToggleActive(seq.id, seq.is_active)}
                    />
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleDelete(seq.id, seq.name)}
                        className="text-gray-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                      <button
                        onClick={() => router.push(`/dashboard/sequences/${seq.id}`)}
                        className="flex items-center gap-1 text-gray-400 hover:text-blue-600 transition-colors text-xs font-medium"
                      >
                        Edit <ChevronRight size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
