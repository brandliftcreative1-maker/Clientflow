'use client'

import { useState } from 'react'
import { saveStep2 } from '@/actions/account'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

const VOICES = [
  { value: 'professional', label: 'Professional', description: 'Formal, trustworthy, authoritative' },
  { value: 'friendly', label: 'Friendly', description: 'Warm, approachable, conversational' },
  { value: 'casual', label: 'Casual', description: 'Relaxed, fun, like talking to a friend' },
  { value: 'educational', label: 'Educational', description: 'Informative, helpful, expert' },
  { value: 'inspirational', label: 'Inspirational', description: 'Motivating, uplifting, energetic' },
]

interface Props {
  onNext: () => void
  onBack: () => void
}

export default function StepBrandVoice({ onNext, onBack }: Props) {
  const [selected, setSelected] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    if (!selected) { toast.error('Please choose a brand voice'); return }
    setLoading(true)
    const formData = new FormData()
    formData.set('brand_voice', selected)
    const result = await saveStep2(formData)
    if (result.error) {
      toast.error(result.error)
      setLoading(false)
    } else {
      onNext()
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>What&apos;s your brand voice?</CardTitle>
        <CardDescription>This shapes how every email sounds — you can change it anytime in settings</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {VOICES.map(voice => (
          <button
            key={voice.value}
            type="button"
            onClick={() => setSelected(voice.value)}
            className={cn(
              'w-full text-left p-4 rounded-lg border-2 transition-colors',
              selected === voice.value
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            )}
          >
            <div className="font-medium">{voice.label}</div>
            <div className="text-sm text-gray-500">{voice.description}</div>
          </button>
        ))}
      </CardContent>
      <CardFooter className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1">Back</Button>
        <Button onClick={handleSubmit} disabled={loading} className="flex-1">
          {loading ? 'Saving...' : 'Continue'}
        </Button>
      </CardFooter>
    </Card>
  )
}
