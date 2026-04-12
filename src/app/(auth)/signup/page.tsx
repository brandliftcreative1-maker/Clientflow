'use client'

import { useState } from 'react'
import Link from 'next/link'
import { signUp } from '@/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import toast from 'react-hot-toast'

export default function SignUpPage() {
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    const result = await signUp(formData)
    if (result?.error) {
      toast.error(result.error)
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>Start automating your client communications — free</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@business.com"
              required
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="At least 8 characters"
              required
              autoComplete="new-password"
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Creating account...' : 'Create free account'}
          </Button>
          <p className="text-sm text-center text-gray-500">
            Already have an account?{' '}
            <Link href="/login" className="text-blue-600 hover:underline">
              Sign in
            </Link>
          </p>
          <p className="text-xs text-center text-gray-400">
            By signing up you agree to our terms of service.
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
