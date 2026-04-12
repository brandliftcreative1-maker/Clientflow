'use client'

import { useState } from 'react'
import { generateEmailAction, improveEmailAction, sendTestEmailAction } from '@/actions/ai'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Wand2, Copy, RefreshCw, Send, ChevronDown, ChevronUp } from 'lucide-react'
import toast from 'react-hot-toast'
import type { EmailVariation, AIProvider } from '@/types'

const RECIPIENT_TYPES = ['New leads', 'Existing customers', 'Past clients', 'Specific person']
const TONES = ['Professional', 'Friendly', 'Urgent', 'Grateful', 'Educational']
const IMPROVE_OPTIONS = ['Make it shorter', 'Stronger CTA', 'More personal', 'More professional', 'Custom instruction...']

interface ResultState {
  variations: EmailVariation[]
  provider: AIProvider
}

export default function AIWriterPage() {
  const [purpose, setPurpose] = useState('')
  const [recipientType, setRecipientType] = useState('')
  const [context, setContext] = useState('')
  const [tone, setTone] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ResultState | null>(null)
  const [expandedCard, setExpandedCard] = useState<number | null>(null)
  const [improving, setImproving] = useState<number | null>(null)
  const [improveInstruction, setImproveInstruction] = useState('')
  const [customInstruction, setCustomInstruction] = useState('')
  const [testEmailTo, setTestEmailTo] = useState('')
  const [sendingTest, setSendingTest] = useState<number | null>(null)

  async function handleGenerate() {
    if (!purpose.trim()) { toast.error('Please describe what you want to send'); return }
    if (!recipientType) { toast.error('Please select a recipient type'); return }
    if (!tone) { toast.error('Please select a tone'); return }

    setLoading(true)
    setResult(null)

    const res = await generateEmailAction({ purpose, recipientType, context, tone })
    if (res.error) {
      toast.error(res.error)
    } else {
      setResult({ variations: res.variations, provider: res.provider })
      setExpandedCard(0)
    }
    setLoading(false)
  }

  async function handleImprove(index: number) {
    if (!result) return
    const instruction = improveInstruction === 'Custom instruction...' ? customInstruction : improveInstruction
    if (!instruction) { toast.error('Please select or type an instruction'); return }

    setImproving(index)
    const res = await improveEmailAction({ existingEmail: result.variations[index], instruction })

    if (res.error) {
      toast.error(res.error)
    } else {
      const updated = [...result.variations]
      updated[index] = { subject: res.subject, body: res.body, previewText: res.previewText }
      setResult({ ...result, variations: updated })
      toast.success('Email improved!')
    }
    setImproving(null)
  }

  async function handleSendTest(index: number) {
    if (!result || !testEmailTo) { toast.error('Enter an email address to send the test to'); return }
    setSendingTest(index)
    const res = await sendTestEmailAction(result.variations[index], testEmailTo)
    if (res.error) toast.error(res.error)
    else toast.success(`Test email sent to ${testEmailTo}!`)
    setSendingTest(null)
  }

  function copyToClipboard(email: EmailVariation) {
    const text = `Subject: ${email.subject}\n\n${email.body}`
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard!')
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Wand2 className="text-blue-600" size={22} />
          <h1 className="text-2xl font-bold">AI Email Writer</h1>
        </div>
        <p className="text-gray-500">Describe what you want to send — get 3 polished variations instantly</p>
      </div>

      {/* Input section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">What do you want to send?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Describe your email purpose *</Label>
            <Textarea
              placeholder={`e.g. "Remind past clients about our spring cleaning special"\n"Follow up on the estimate I sent last week"\n"Ask happy customers for a Google review"`}
              rows={3}
              value={purpose}
              onChange={e => setPurpose(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Recipient type *</Label>
              <Select onValueChange={(v: string | null) => setRecipientType(v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="Who are you sending to?" />
                </SelectTrigger>
                <SelectContent>
                  {RECIPIENT_TYPES.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tone *</Label>
              <Select onValueChange={(v: string | null) => setTone(v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose tone" />
                </SelectTrigger>
                <SelectContent>
                  {TONES.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Additional context <span className="text-gray-400">(optional)</span></Label>
            <Input
              placeholder="Any extra details the AI should know..."
              value={context}
              onChange={e => setContext(e.target.value)}
            />
          </div>

          <Button onClick={handleGenerate} disabled={loading} className="w-full" size="lg">
            {loading ? (
              <span className="flex items-center gap-2">
                <RefreshCw size={16} className="animate-spin" />
                Generating 3 variations...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Wand2 size={16} />
                Generate emails
              </span>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">3 Email Variations</h2>
            <Badge variant="secondary">via {result.provider}</Badge>
          </div>

          {result.variations.map((email, i) => (
            <Card key={i} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline">Option {i + 1}</Badge>
                    </div>
                    <p className="font-semibold text-gray-900">{email.subject}</p>
                    <p className="text-sm text-gray-400 mt-0.5">{email.previewText}</p>
                  </div>
                  <button
                    onClick={() => setExpandedCard(expandedCard === i ? null : i)}
                    className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                  >
                    {expandedCard === i ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </button>
                </div>
              </CardHeader>

              {expandedCard === i && (
                <CardContent className="border-t pt-4 space-y-4">
                  {/* Email body */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <pre className="text-sm text-gray-800 whitespace-pre-wrap font-sans leading-relaxed">
                      {email.body}
                    </pre>
                  </div>

                  {/* Improve section */}
                  <div className="space-y-2">
                    <Label className="text-xs text-gray-500">Improve this email</Label>
                    <div className="flex gap-2 flex-wrap">
                      {IMPROVE_OPTIONS.map(opt => (
                        <button
                          key={opt}
                          onClick={() => setImproveInstruction(opt)}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                            improveInstruction === opt
                              ? 'border-blue-600 bg-blue-50 text-blue-700'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                    {improveInstruction === 'Custom instruction...' && (
                      <Input
                        placeholder="Describe how to improve it..."
                        value={customInstruction}
                        onChange={e => setCustomInstruction(e.target.value)}
                      />
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleImprove(i)}
                      disabled={improving === i || !improveInstruction}
                    >
                      {improving === i ? (
                        <span className="flex items-center gap-1"><RefreshCw size={12} className="animate-spin" /> Improving...</span>
                      ) : (
                        <span className="flex items-center gap-1"><Wand2 size={12} /> Improve It</span>
                      )}
                    </Button>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-wrap pt-2 border-t">
                    <Button size="sm" variant="outline" onClick={() => copyToClipboard(email)}>
                      <Copy size={14} className="mr-1" /> Copy
                    </Button>

                    <div className="flex items-center gap-2 ml-auto">
                      <Input
                        className="h-8 text-xs w-48"
                        placeholder="test@email.com"
                        type="email"
                        value={testEmailTo}
                        onChange={e => setTestEmailTo(e.target.value)}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSendTest(i)}
                        disabled={sendingTest === i}
                      >
                        {sendingTest === i ? (
                          <RefreshCw size={14} className="animate-spin" />
                        ) : (
                          <span className="flex items-center gap-1"><Send size={14} /> Test</span>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
