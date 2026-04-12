'use client'

import { useState } from 'react'
import { saveStep3 } from '@/actions/account'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import toast from 'react-hot-toast'

interface Props {
  onNext: () => void
  onBack: () => void
}

export default function StepEmailSetup({ onNext, onBack }: Props) {
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    const result = await saveStep3(formData)
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
        <CardTitle>Email sending setup</CardTitle>
        <CardDescription>How should your emails appear to clients?</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="from_name">From name</Label>
            <Input
              id="from_name"
              name="from_name"
              placeholder='e.g. "Mike at Clean Pro"'
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="from_email">From email</Label>
            <Input
              id="from_email"
              name="from_email"
              type="email"
              placeholder="hello@yourbusiness.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reply_to_email">Reply-to email</Label>
            <Input
              id="reply_to_email"
              name="reply_to_email"
              type="email"
              placeholder="Same as from email, or different"
            />
          </div>

          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
            <strong>Tip:</strong> Using your business domain email (not Gmail/Yahoo) improves deliverability.
            We&apos;ll help you verify it in Settings.
          </div>
        </CardContent>
        <CardFooter className="flex gap-3">
          <Button type="button" variant="outline" onClick={onBack} className="flex-1">Back</Button>
          <Button type="submit" disabled={loading} className="flex-1">
            {loading ? 'Saving...' : 'Continue'}
          </Button>
        </CardFooter>
      </form>
      <div className="px-6 pb-4">
        <button
          type="button"
          onClick={onNext}
          className="w-full text-sm text-gray-400 hover:text-gray-600 text-center"
        >
          Skip for now — use default sending
        </button>
      </div>
    </Card>
  )
}
