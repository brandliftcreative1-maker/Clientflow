'use client'

import { useState } from 'react'
import { importContacts } from '@/actions/account'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import toast from 'react-hot-toast'

interface ManualContact {
  email: string
  first_name: string
  last_name: string
}

interface Props {
  onNext: () => void
  onBack: () => void
}

export default function StepImportContacts({ onNext, onBack }: Props) {
  const [loading, setLoading] = useState(false)
  const [manualContacts, setManualContacts] = useState<ManualContact[]>([
    { email: '', first_name: '', last_name: '' },
  ])
  const [csvFile, setCsvFile] = useState<File | null>(null)

  function updateContact(index: number, field: keyof ManualContact, value: string) {
    setManualContacts(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c))
  }

  function addRow() {
    if (manualContacts.length < 5) {
      setManualContacts(prev => [...prev, { email: '', first_name: '', last_name: '' }])
    }
  }

  async function handleManualImport() {
    const valid = manualContacts.filter(c => c.email.trim())
    if (valid.length === 0) { onNext(); return }
    setLoading(true)
    const result = await importContacts(valid)
    if (result.error) {
      toast.error(result.error)
      setLoading(false)
    } else {
      toast.success(`Added ${result.imported} contact${result.imported === 1 ? '' : 's'}!`)
      onNext()
    }
  }

  async function handleCsvImport() {
    if (!csvFile) { onNext(); return }
    setLoading(true)

    const text = await csvFile.text()
    const lines = text.trim().split('\n')
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''))

    const contacts = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''))
      const obj: Record<string, string> = {}
      headers.forEach((h, i) => { obj[h] = values[i] ?? '' })
      return {
        email: obj['email'] ?? '',
        first_name: obj['first_name'] ?? obj['firstname'] ?? obj['first name'] ?? '',
        last_name: obj['last_name'] ?? obj['lastname'] ?? obj['last name'] ?? '',
        phone: obj['phone'] ?? '',
        segment: obj['segment'] ?? 'lead',
      }
    }).filter(c => c.email)

    const result = await importContacts(contacts)
    if (result.error) {
      toast.error(result.error)
      setLoading(false)
    } else {
      toast.success(`Imported ${result.imported} contacts!`)
      onNext()
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
    <Card>
      <CardHeader>
        <CardTitle>Import your contacts</CardTitle>
        <CardDescription>Add existing clients to start sending emails</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* CSV Upload */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Upload CSV file</Label>
            <button
              type="button"
              onClick={downloadTemplate}
              className="text-xs text-blue-600 hover:underline"
            >
              Download template
            </button>
          </div>
          <Input
            type="file"
            accept=".csv"
            onChange={e => setCsvFile(e.target.files?.[0] ?? null)}
          />
          {csvFile && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{csvFile.name}</Badge>
              <Button size="sm" onClick={handleCsvImport} disabled={loading}>
                {loading ? 'Importing...' : 'Import CSV'}
              </Button>
            </div>
          )}
        </div>

        <div className="relative flex items-center">
          <div className="flex-grow border-t border-gray-200" />
          <span className="mx-3 text-xs text-gray-400">or add manually</span>
          <div className="flex-grow border-t border-gray-200" />
        </div>

        {/* Manual add */}
        <div className="space-y-2">
          {manualContacts.map((contact, i) => (
            <div key={i} className="grid grid-cols-3 gap-2">
              <Input
                placeholder="Email *"
                type="email"
                value={contact.email}
                onChange={e => updateContact(i, 'email', e.target.value)}
              />
              <Input
                placeholder="First name"
                value={contact.first_name}
                onChange={e => updateContact(i, 'first_name', e.target.value)}
              />
              <Input
                placeholder="Last name"
                value={contact.last_name}
                onChange={e => updateContact(i, 'last_name', e.target.value)}
              />
            </div>
          ))}
          {manualContacts.length < 5 && (
            <button
              type="button"
              onClick={addRow}
              className="text-sm text-blue-600 hover:underline"
            >
              + Add another
            </button>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1">Back</Button>
        <Button onClick={handleManualImport} disabled={loading} className="flex-1">
          {loading ? 'Saving...' : 'Continue'}
        </Button>
      </CardFooter>
      <div className="px-6 pb-4">
        <button
          type="button"
          onClick={onNext}
          className="w-full text-sm text-gray-400 hover:text-gray-600 text-center"
        >
          Skip — I&apos;ll add contacts later
        </button>
      </div>
    </Card>
  )
}
