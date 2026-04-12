'use client'

import { useEffect, useState, useCallback } from 'react'
import { getContacts, addContact, deleteContact } from '@/actions/contacts'
import { enrollContacts, getActiveSequences } from '@/actions/enrollment'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Users, Plus, Search, Upload, Trash2, RefreshCw, Play, Zap } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'

const SEGMENTS = ['lead', 'new_customer', 'repeat_customer', 'vip', 'cold', 'lost']

const SEGMENT_COLORS: Record<string, string> = {
  lead: 'bg-blue-100 text-blue-700',
  new_customer: 'bg-green-100 text-green-700',
  repeat_customer: 'bg-purple-100 text-purple-700',
  vip: 'bg-amber-100 text-amber-700',
  cold: 'bg-gray-100 text-gray-600',
  lost: 'bg-red-100 text-red-700',
}

interface Contact {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  status: string
  segment: string
  tags: string[] | null
  birthday: string | null
  last_contacted_at: string | null
  created_at: string
}

interface ActiveSequence {
  id: string
  name: string
  trigger_type: string
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [segmentFilter, setSegmentFilter] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [addOpen, setAddOpen] = useState(false)
  const [csvOpen, setCsvOpen] = useState(false)
  const [addLoading, setAddLoading] = useState(false)

  // Enrollment state
  const [activeSequences, setActiveSequences] = useState<ActiveSequence[]>([])
  const [enrollSequenceId, setEnrollSequenceId] = useState('')
  const [enrolling, setEnrolling] = useState(false)
  const [fireContactId, setFireContactId] = useState<string | null>(null)
  const [fireSequenceId, setFireSequenceId] = useState('')

  const fetchContacts = useCallback(async () => {
    setLoading(true)
    const res = await getContacts({ search, segment: segmentFilter || undefined })
    setContacts(res.contacts as Contact[])
    setTotal(res.total)
    setLoading(false)
  }, [search, segmentFilter])

  useEffect(() => {
    const timer = setTimeout(fetchContacts, 300)
    return () => clearTimeout(timer)
  }, [fetchContacts])

  useEffect(() => {
    getActiveSequences().then(seqs => {
      setActiveSequences(seqs as ActiveSequence[])
      if (seqs.length > 0) {
        setEnrollSequenceId(seqs[0].id)
        setFireSequenceId(seqs[0].id)
      }
    })
  }, [])

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selected.size === contacts.length) setSelected(new Set())
    else setSelected(new Set(contacts.map(c => c.id)))
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this contact?')) return
    const res = await deleteContact(id)
    if (res.error) toast.error(res.error)
    else { toast.success('Contact deleted'); fetchContacts() }
  }

  async function handleBulkEnroll() {
    if (!enrollSequenceId || selected.size === 0) return
    setEnrolling(true)
    const res = await enrollContacts(Array.from(selected), enrollSequenceId)
    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success(`Enrolled ${res.enrolled} contact${res.enrolled !== 1 ? 's' : ''}${res.skipped ? ` (${res.skipped} skipped)` : ''}`)
      setSelected(new Set())
    }
    setEnrolling(false)
  }

  async function handleFireTrigger() {
    if (!fireContactId || !fireSequenceId) return
    const res = await enrollContacts([fireContactId], fireSequenceId)
    if (res.error) toast.error(res.error)
    else toast.success(res.enrolled ? 'Enrolled in sequence!' : 'Already enrolled — skipped')
    setFireContactId(null)
  }

  async function handleAddContact(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setAddLoading(true)
    const formData = new FormData(e.currentTarget)
    const res = await addContact(formData)
    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success('Contact added!')
      setAddOpen(false)
      fetchContacts()
      ;(e.target as HTMLFormElement).reset()
    }
    setAddLoading(false)
  }

  async function handleCsvImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    const lines = text.trim().split('\n')
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''))
    const parsedContacts = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''))
      const obj: Record<string, string> = {}
      headers.forEach((h, i) => { obj[h] = values[i] ?? '' })
      return {
        email: obj['email'] ?? '',
        first_name: obj['first_name'] ?? obj['firstname'] ?? '',
        last_name: obj['last_name'] ?? obj['lastname'] ?? '',
        phone: obj['phone'] ?? '',
        segment: obj['segment'] ?? 'lead',
      }
    }).filter(c => c.email)

    const { importContacts } = await import('@/actions/account')
    const res = await importContacts(parsedContacts)
    if (res.error) toast.error(res.error)
    else {
      toast.success(`Imported ${res.imported} contacts!`)
      setCsvOpen(false)
      fetchContacts()
    }
  }

  function downloadTemplate() {
    const csv = 'email,first_name,last_name,phone,segment\njohn@example.com,John,Smith,(555)000-0000,lead'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'clientflow-contacts-template.csv'
    a.click()
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Users className="text-blue-600" size={22} />
            <h1 className="text-2xl font-bold">Contacts</h1>
          </div>
          <p className="text-gray-500">{total} total contacts</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={csvOpen} onOpenChange={setCsvOpen}>
            <DialogTrigger>
              <Button variant="outline" type="button"><Upload size={16} className="mr-2" />Import CSV</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Import contacts from CSV</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">
                <div className="flex justify-end">
                  <button onClick={downloadTemplate} className="text-sm text-blue-600 hover:underline">
                    Download CSV template
                  </button>
                </div>
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center">
                  <Upload size={24} className="mx-auto mb-2 text-gray-400" />
                  <p className="text-sm text-gray-500 mb-3">Upload your CSV file</p>
                  <Input type="file" accept=".csv" onChange={handleCsvImport} className="max-w-xs mx-auto" />
                </div>
                <p className="text-xs text-gray-400">
                  Columns: email, first_name, last_name, phone, segment. Duplicates (by email) will be skipped.
                </p>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger>
              <Button type="button"><Plus size={16} className="mr-2" />Add Contact</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add contact</DialogTitle></DialogHeader>
              <form onSubmit={handleAddContact} className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>First name</Label>
                    <Input name="first_name" placeholder="Jane" />
                  </div>
                  <div className="space-y-1">
                    <Label>Last name</Label>
                    <Input name="last_name" placeholder="Smith" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Email *</Label>
                  <Input name="email" type="email" placeholder="jane@example.com" required />
                </div>
                <div className="space-y-1">
                  <Label>Phone</Label>
                  <Input name="phone" type="tel" placeholder="(555) 000-0000" />
                </div>
                <div className="space-y-1">
                  <Label>Birthday</Label>
                  <Input name="birthday" type="date" />
                </div>
                <div className="space-y-1">
                  <Label>Segment</Label>
                  <select name="segment" defaultValue="lead" className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm bg-white">
                    {SEGMENTS.map(s => (
                      <option key={s} value={s}>{s.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Tags <span className="text-gray-400 text-xs">(comma separated)</span></Label>
                  <Input name="tags" placeholder="vip, referral, spring-promo" />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setAddOpen(false)} className="flex-1">Cancel</Button>
                  <Button type="submit" disabled={addLoading} className="flex-1">
                    {addLoading ? 'Adding...' : 'Add Contact'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="bg-blue-600 text-white rounded-lg px-4 py-3 mb-4 flex items-center justify-between">
          <span className="text-sm font-medium">{selected.size} contact{selected.size !== 1 ? 's' : ''} selected</span>
          <div className="flex items-center gap-3">
            {activeSequences.length > 0 && (
              <div className="flex items-center gap-2">
                <select
                  value={enrollSequenceId}
                  onChange={e => setEnrollSequenceId(e.target.value)}
                  className="bg-white/15 border border-white/30 text-white text-sm rounded px-2 py-1"
                >
                  {activeSequences.map(s => (
                    <option key={s.id} value={s.id} className="text-gray-900 bg-white">{s.name}</option>
                  ))}
                </select>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleBulkEnroll}
                  disabled={enrolling}
                  className="bg-white text-blue-600 border-white hover:bg-blue-50 h-7 text-xs"
                >
                  <Play size={12} className="mr-1" />
                  {enrolling ? 'Enrolling…' : 'Enroll'}
                </Button>
              </div>
            )}
            <button onClick={() => setSelected(new Set())} className="text-white/70 hover:text-white text-xs">
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Fire trigger dialog */}
      {fireContactId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setFireContactId(null)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-80" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold mb-1">Fire a trigger</h3>
            <p className="text-sm text-gray-500 mb-4">Enroll this contact in a sequence now</p>
            {activeSequences.length === 0 ? (
              <p className="text-sm text-gray-400">No active sequences. Activate a sequence first.</p>
            ) : (
              <div className="space-y-3">
                <select
                  value={fireSequenceId}
                  onChange={e => setFireSequenceId(e.target.value)}
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                >
                  {activeSequences.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setFireContactId(null)}>Cancel</Button>
                  <Button size="sm" className="flex-1" onClick={handleFireTrigger}>
                    <Zap size={13} className="mr-1" /> Enroll now
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <Card className="mb-4">
        <CardContent className="pt-4">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search by name or email..."
                className="pl-9"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Select onValueChange={(v: string | null) => setSegmentFilter(!v || v === 'all' ? '' : v)}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="All segments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All segments</SelectItem>
                {SEGMENTS.map(s => (
                  <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={fetchContacts}>
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={selected.size === contacts.length && contacts.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>Name / Email</TableHead>
              <TableHead>Segment</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead>Last contacted</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-gray-400">
                  <RefreshCw size={20} className="animate-spin mx-auto mb-2" />
                  Loading contacts...
                </TableCell>
              </TableRow>
            ) : contacts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-gray-400">
                  <Users size={32} className="mx-auto mb-2 opacity-30" />
                  <p>No contacts yet</p>
                  <Button size="sm" className="mt-3" onClick={() => setAddOpen(true)}>Add your first contact</Button>
                </TableCell>
              </TableRow>
            ) : (
              contacts.map(contact => (
                <TableRow key={contact.id} className={selected.has(contact.id) ? 'bg-blue-50' : ''}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(contact.id)}
                      onCheckedChange={() => toggleSelect(contact.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">
                        {contact.first_name || contact.last_name
                          ? `${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim()
                          : '—'}
                      </p>
                      <p className="text-sm text-gray-500">{contact.email}</p>
                      {contact.phone && <p className="text-xs text-gray-400">{contact.phone}</p>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${SEGMENT_COLORS[contact.segment] ?? 'bg-gray-100'}`}>
                      {contact.segment.replace('_', ' ')}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {contact.tags?.map(tag => (
                        <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {contact.last_contacted_at
                      ? formatDistanceToNow(new Date(contact.last_contacted_at), { addSuffix: true })
                      : 'Never'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setFireContactId(contact.id)}
                        className="text-gray-400 hover:text-blue-600 transition-colors"
                        title="Enroll in sequence"
                      >
                        <Zap size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(contact.id)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
