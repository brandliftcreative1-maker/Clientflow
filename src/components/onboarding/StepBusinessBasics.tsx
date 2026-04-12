'use client'

import { useState } from 'react'
import { saveStep1 } from '@/actions/account'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import toast from 'react-hot-toast'

const INDUSTRIES = [
  'Salon & Beauty',
  'Cleaning Service',
  'Contractor & Trades',
  'Consultant',
  'Restaurant',
  'Retail',
  'Fitness & Wellness',
  'Medical & Dental',
  'Real Estate',
  'Other',
]

interface Props {
  onNext: (industry: string) => void
}

export default function StepBusinessBasics({ onNext }: Props) {
  const [loading, setLoading] = useState(false)
  const [industry, setIndustry] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!industry) { toast.error('Please select your industry'); return }
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    formData.set('industry', industry)
    const result = await saveStep1(formData)
    if (result.error) {
      toast.error(result.error)
      setLoading(false)
    } else {
      onNext(industry)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tell us about your business</CardTitle>
        <CardDescription>This helps us personalize everything for you</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="business_name">Business name *</Label>
            <Input id="business_name" name="business_name" placeholder="e.g. Clean Pro Services" required />
          </div>

          <div className="space-y-2">
            <Label>Industry *</Label>
            <Select onValueChange={(v: string | null) => setIndustry(v ?? '')} required>
              <SelectTrigger>
                <SelectValue placeholder="Select your industry" />
              </SelectTrigger>
              <SelectContent>
                {INDUSTRIES.map(ind => (
                  <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Short description</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="What do you do and who do you serve?"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input id="website" name="website" type="url" placeholder="https://yourbusiness.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" type="tel" placeholder="(555) 000-0000" />
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Saving...' : 'Continue'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
