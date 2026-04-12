'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Progress } from '@/components/ui/progress'
import StepBusinessBasics from '@/components/onboarding/StepBusinessBasics'
import StepBrandVoice from '@/components/onboarding/StepBrandVoice'
import StepEmailSetup from '@/components/onboarding/StepEmailSetup'
import StepImportContacts from '@/components/onboarding/StepImportContacts'
import StepChooseSequences from '@/components/onboarding/StepChooseSequences'

const TOTAL_STEPS = 5

const STEP_TITLES = [
  'Business Basics',
  'Brand Voice',
  'Email Setup',
  'Import Contacts',
  'Choose Sequences',
]

export default function OnboardingPage() {
  const [step, setStep] = useState(1)
  const [industry, setIndustry] = useState('')
  const router = useRouter()

  function next() {
    if (step < TOTAL_STEPS) setStep(s => s + 1)
    else router.push('/dashboard')
  }

  function back() {
    if (step > 1) setStep(s => s - 1)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-blue-600">ClientFlow</h1>
          <p className="text-sm text-gray-500 mt-1">
            Step {step} of {TOTAL_STEPS} — {STEP_TITLES[step - 1]}
          </p>
        </div>

        {/* Progress */}
        <Progress value={(step / TOTAL_STEPS) * 100} className="mb-6 h-2" />

        {/* Step content */}
        {step === 1 && (
          <StepBusinessBasics
            onNext={(ind) => { setIndustry(ind); next() }}
          />
        )}
        {step === 2 && (
          <StepBrandVoice onNext={next} onBack={back} />
        )}
        {step === 3 && (
          <StepEmailSetup onNext={next} onBack={back} />
        )}
        {step === 4 && (
          <StepImportContacts onNext={next} onBack={back} />
        )}
        {step === 5 && (
          <StepChooseSequences
            industry={industry}
            onNext={() => router.push('/dashboard')}
            onBack={back}
          />
        )}
      </div>
    </div>
  )
}
