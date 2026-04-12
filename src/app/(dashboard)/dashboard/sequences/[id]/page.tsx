'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getSequence, updateSequence, updateStep, createStep, deleteStep, moveStep } from '@/actions/sequences'
import { generateSequence } from '@/lib/ai-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown, Wand2, Save, RefreshCw } from 'lucide-react'
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

type Step = {
  id: string
  step_number: number
  delay_days: number
  subject: string
  body: string
  preview_text: string | null
}

type Sequence = {
  id: string
  name: string
  description: string | null
  trigger_type: string
  is_active: boolean
  steps: Step[]
}

export default function SequenceEditorPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [sequence, setSequence] = useState<Sequence | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [aiGenerating, setAiGenerating] = useState(false)

  // Editable header fields
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [triggerType, setTriggerType] = useState('')
  const [customTrigger, setCustomTrigger] = useState('')
  const [isCustomTrigger, setIsCustomTrigger] = useState(false)

  // Editable step fields (for selected step)
  const [stepDelayDays, setStepDelayDays] = useState(0)
  const [stepSubject, setStepSubject] = useState('')
  const [stepBody, setStepBody] = useState('')
  const [stepPreviewText, setStepPreviewText] = useState('')

  const fetchSequence = useCallback(async () => {
    setLoading(true)
    const data = await getSequence(id)
    if (!data) { router.push('/dashboard/sequences'); return }
    setSequence(data as Sequence)
    setName(data.name)
    setDescription(data.description ?? '')

    const isPredefined = PREDEFINED_TRIGGERS.some(t => t.value === data.trigger_type)
    if (isPredefined) {
      setTriggerType(data.trigger_type)
      setIsCustomTrigger(false)
    } else {
      setTriggerType('custom')
      setCustomTrigger(data.trigger_type)
      setIsCustomTrigger(true)
    }

    if (data.steps.length > 0 && !selectedStepId) {
      selectStep(data.steps[0])
    }
    setLoading(false)
  }, [id])

  useEffect(() => { fetchSequence() }, [fetchSequence])

  function selectStep(step: Step) {
    setSelectedStepId(step.id)
    setStepDelayDays(step.delay_days)
    setStepSubject(step.subject)
    setStepBody(step.body)
    setStepPreviewText(step.preview_text ?? '')
  }

  async function handleSaveSequence() {
    setSaving(true)
    const finalTrigger = isCustomTrigger ? customTrigger.trim() : triggerType
    const res = await updateSequence(id, {
      name: name.trim() || sequence!.name,
      description: description.trim() || null,
      trigger_type: finalTrigger,
    })
    if (res.error) toast.error(res.error)
    else toast.success('Saved')
    setSaving(false)
  }

  async function handleSaveStep() {
    if (!selectedStepId) return
    setSaving(true)
    const res = await updateStep(selectedStepId, {
      delay_days: stepDelayDays,
      subject: stepSubject,
      body: stepBody,
      preview_text: stepPreviewText || null,
    })
    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success('Step saved')
      // Update local state
      setSequence(prev => prev ? {
        ...prev,
        steps: prev.steps.map(s => s.id === selectedStepId
          ? { ...s, delay_days: stepDelayDays, subject: stepSubject, body: stepBody, preview_text: stepPreviewText || null }
          : s
        )
      } : prev)
    }
    setSaving(false)
  }

  async function handleAddStep() {
    const formData = new FormData()
    formData.set('delay_days', '3')
    formData.set('subject', 'Follow-up')
    formData.set('body', 'Hi [First Name],\n\nJust checking in...\n\n[Your Name]')
    formData.set('preview_text', '')
    const res = await createStep(id, formData)
    if (res.error) toast.error(res.error)
    else { await fetchSequence() }
  }

  async function handleDeleteStep(stepId: string) {
    if (!confirm('Delete this step?')) return
    const res = await deleteStep(stepId, id)
    if (res.error) toast.error(res.error)
    else {
      await fetchSequence()
      if (selectedStepId === stepId) setSelectedStepId(null)
    }
  }

  async function handleMoveStep(stepId: string, direction: 'up' | 'down') {
    const res = await moveStep(stepId, id, direction)
    if (res.error) toast.error(res.error)
    else await fetchSequence()
  }

  async function handleAIGenerate() {
    if (!sequence) return
    setAiGenerating(true)
    try {
      // Get account info for AI generation
      const res = await generateSequence({
        sequenceType: sequence.trigger_type,
        industry: 'service business',
        businessName: '[Business Name]',
        brandVoice: 'friendly',
        stepCount: 3,
      })
      toast.success(`Generated ${res.steps.length} steps — review and save each one`)
      // We don't auto-overwrite; show a toast and let the user apply manually
      // This is a simplified approach — a full version would show a preview dialog
    } catch (err) {
      toast.error('AI generation failed — check your GROQ_API_KEY')
    }
    setAiGenerating(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <RefreshCw size={20} className="animate-spin mr-2" /> Loading…
      </div>
    )
  }

  if (!sequence) return null

  const selectedStep = sequence.steps.find(s => s.id === selectedStepId)

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/dashboard/sequences')} className="text-gray-400 hover:text-gray-600">
            <ArrowLeft size={18} />
          </button>
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            className="text-lg font-semibold border-none shadow-none px-0 focus-visible:ring-0 w-72"
          />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-gray-500">Trigger</Label>
            <select
              className="border border-gray-200 rounded-md px-2 py-1.5 text-sm bg-white"
              value={triggerType}
              onChange={e => {
                setTriggerType(e.target.value)
                setIsCustomTrigger(e.target.value === 'custom')
              }}
            >
              {PREDEFINED_TRIGGERS.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            {isCustomTrigger && (
              <Input
                className="w-44 h-8 text-sm"
                placeholder="Trigger name"
                value={customTrigger}
                onChange={e => setCustomTrigger(e.target.value)}
              />
            )}
          </div>
          <Button variant="outline" size="sm" onClick={handleAIGenerate} disabled={aiGenerating}>
            <Wand2 size={14} className="mr-1.5" />
            {aiGenerating ? 'Generating…' : 'AI Generate'}
          </Button>
          <Button size="sm" onClick={handleSaveSequence} disabled={saving}>
            <Save size={14} className="mr-1.5" />
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Editor body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Step list */}
        <div className="w-60 border-r border-gray-200 bg-gray-50 flex flex-col overflow-y-auto">
          <div className="p-4 flex-1">
            <div className="text-xs uppercase tracking-wider text-gray-400 mb-3">Steps</div>
            <div className="space-y-2">
              {sequence.steps.map((step, idx) => (
                <div
                  key={step.id}
                  onClick={() => selectStep(step)}
                  className={`group relative rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                    selectedStepId === step.id
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="text-xs text-gray-400 mb-1">
                    Step {step.step_number} · Day {step.delay_days}
                  </div>
                  <div className={`text-sm font-medium truncate ${selectedStepId === step.id ? 'text-blue-700' : 'text-gray-700'}`}>
                    {step.subject}
                  </div>
                  {/* Hover controls */}
                  <div className="absolute right-1 top-1 hidden group-hover:flex gap-0.5">
                    {idx > 0 && (
                      <button onClick={e => { e.stopPropagation(); handleMoveStep(step.id, 'up') }}
                        className="p-0.5 text-gray-400 hover:text-gray-600">
                        <ChevronUp size={12} />
                      </button>
                    )}
                    {idx < sequence.steps.length - 1 && (
                      <button onClick={e => { e.stopPropagation(); handleMoveStep(step.id, 'down') }}
                        className="p-0.5 text-gray-400 hover:text-gray-600">
                        <ChevronDown size={12} />
                      </button>
                    )}
                    <button onClick={e => { e.stopPropagation(); handleDeleteStep(step.id) }}
                      className="p-0.5 text-gray-400 hover:text-red-500">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleAddStep}
              className="mt-3 w-full border border-dashed border-gray-300 rounded-lg py-2 text-xs text-gray-400 hover:text-gray-600 hover:border-gray-400 transition-colors"
            >
              + Add step
            </button>
          </div>
        </div>

        {/* Step editor */}
        <div className="flex-1 overflow-y-auto p-6">
          {!selectedStep ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <p>Select a step to edit it</p>
                <Button size="sm" className="mt-3" onClick={handleAddStep}>Add first step</Button>
              </div>
            </div>
          ) : (
            <div className="max-w-2xl">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-semibold text-gray-900">
                  Step {selectedStep.step_number}
                </h2>
                <Button size="sm" onClick={handleSaveStep} disabled={saving}>
                  <Save size={14} className="mr-1.5" />
                  {saving ? 'Saving…' : 'Save step'}
                </Button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <Label>Send delay (days after previous step)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={stepDelayDays}
                    onChange={e => setStepDelayDays(Number(e.target.value))}
                    className="w-32"
                  />
                  <p className="text-xs text-gray-400">
                    {stepDelayDays === 0 ? 'Sends immediately upon enrollment or previous step' : `Sends ${stepDelayDays} day${stepDelayDays !== 1 ? 's' : ''} after the previous step`}
                  </p>
                </div>

                <div className="space-y-1">
                  <Label>Subject line</Label>
                  <Input
                    value={stepSubject}
                    onChange={e => setStepSubject(e.target.value)}
                    placeholder="e.g. Welcome to [Business Name], [First Name]!"
                  />
                </div>

                <div className="space-y-1">
                  <Label>Preview text <span className="text-gray-400 text-xs">(shown in inbox)</span></Label>
                  <Input
                    value={stepPreviewText}
                    onChange={e => setStepPreviewText(e.target.value)}
                    placeholder="Short teaser shown before the email opens…"
                  />
                </div>

                <div className="space-y-1">
                  <Label>Email body</Label>
                  <p className="text-xs text-gray-400">
                    Use tokens: [First Name], [Business Name], [Your Name]
                  </p>
                  <textarea
                    value={stepBody}
                    onChange={e => setStepBody(e.target.value)}
                    rows={14}
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={"Hi [First Name],\n\n...\n\n[Your Name]"}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
