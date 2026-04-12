'use client'

import { useEffect, useState } from 'react'
import { getIndustryTemplates, activateSequenceTemplate } from '@/actions/account'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import toast from 'react-hot-toast'

interface Template {
  id: string
  name: string
  description: string | null
  trigger_type: string
  industry: string | null
}

interface Props {
  industry: string
  onNext: () => void
  onBack: () => void
}

const TRIGGER_LABELS: Record<string, string> = {
  new_contact: 'New contact',
  job_completed: 'Job completed',
  no_purchase: 'Win-back',
  estimate_sent: 'Estimate sent',
  birthday: 'Birthday',
  manual: 'Manual send',
  review_requested: 'Review request',
}

export default function StepChooseSequences({ industry, onNext, onBack }: Props) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [activated, setActivated] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [activating, setActivating] = useState<string | null>(null)

  useEffect(() => {
    getIndustryTemplates(industry).then(data => {
      setTemplates(data as Template[])
      setLoading(false)
    })
  }, [industry])

  async function toggleSequence(id: string, on: boolean) {
    if (!on) return // Can only activate, not deactivate during onboarding
    setActivating(id)
    const result = await activateSequenceTemplate(id)
    if (result.error) {
      toast.error(result.error)
    } else {
      setActivated(prev => new Set(Array.from(prev).concat(id)))
      toast.success('Sequence activated!')
    }
    setActivating(null)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Choose your sequences</CardTitle>
        <CardDescription>
          Pre-built email sequences for {industry} — you can customize them anytime
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && (
          <div className="text-center py-8 text-gray-400">Loading sequences...</div>
        )}
        {!loading && templates.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            No templates available yet. You can create your own in the Sequences section.
          </div>
        )}
        {templates.map(template => (
          <div
            key={template.id}
            className="flex items-start justify-between p-4 rounded-lg border border-gray-200"
          >
            <div className="flex-1 min-w-0 mr-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">{template.name}</span>
                <Badge variant="outline" className="text-xs">
                  {TRIGGER_LABELS[template.trigger_type] ?? template.trigger_type}
                </Badge>
                {template.industry === null && (
                  <Badge variant="secondary" className="text-xs">Universal</Badge>
                )}
              </div>
              {template.description && (
                <p className="text-sm text-gray-500 mt-1">{template.description}</p>
              )}
            </div>
            <Switch
              checked={activated.has(template.id)}
              disabled={activating === template.id || activated.has(template.id)}
              onCheckedChange={on => toggleSequence(template.id, on)}
            />
          </div>
        ))}
      </CardContent>
      <CardFooter className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1">Back</Button>
        <Button onClick={onNext} className="flex-1">
          {activated.size > 0 ? `Continue with ${activated.size} sequence${activated.size > 1 ? 's' : ''}` : 'Skip for now'}
        </Button>
      </CardFooter>
    </Card>
  )
}
