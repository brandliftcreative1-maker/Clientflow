import type { Database } from './database'

// DB row types
export type Account = Database['public']['Tables']['accounts']['Row']
export type Contact = Database['public']['Tables']['contacts']['Row']
export type Sequence = Database['public']['Tables']['sequences']['Row']
export type SequenceStep = Database['public']['Tables']['sequence_steps']['Row']
export type SequenceEnrollment = Database['public']['Tables']['sequence_enrollments']['Row']
export type Campaign = Database['public']['Tables']['campaigns']['Row']
export type EmailLog = Database['public']['Tables']['email_logs']['Row']
export type ReviewRequest = Database['public']['Tables']['review_requests']['Row']

// Insert types
export type AccountInsert = Database['public']['Tables']['accounts']['Insert']
export type ContactInsert = Database['public']['Tables']['contacts']['Insert']
export type SequenceInsert = Database['public']['Tables']['sequences']['Insert']
export type SequenceStepInsert = Database['public']['Tables']['sequence_steps']['Insert']
export type CampaignInsert = Database['public']['Tables']['campaigns']['Insert']
export type EmailLogInsert = Database['public']['Tables']['email_logs']['Insert']

// Domain enums
export type ContactStatus = 'active' | 'unsubscribed' | 'bounced'
export type ContactSegment = 'lead' | 'new_customer' | 'repeat_customer' | 'vip' | 'cold' | 'lost'
export type TriggerType = 'new_contact' | 'job_completed' | 'no_purchase' | 'estimate_sent' | 'birthday' | 'manual' | 'review_requested'
export type EnrollmentStatus = 'active' | 'completed' | 'cancelled' | 'paused'
export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled'
export type EmailType = 'campaign' | 'sequence' | 'review_request' | 'transactional'
export type EmailStatus = 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained'
export type ReviewPlatform = 'google' | 'yelp' | 'facebook'
export type BrandVoice = 'professional' | 'friendly' | 'casual' | 'educational' | 'inspirational'

export type Industry =
  | 'Salon & Beauty'
  | 'Cleaning Service'
  | 'Contractor & Trades'
  | 'Consultant'
  | 'Restaurant'
  | 'Retail'
  | 'Fitness & Wellness'
  | 'Medical & Dental'
  | 'Real Estate'
  | 'Other'

// AI provider types
export type AIProvider = 'gemini' | 'groq' | 'anthropic'

export interface EmailVariation {
  subject: string
  body: string
  previewText: string
}

export interface GenerateEmailParams {
  purpose: string
  businessName: string
  industry: string
  brandVoice: string
  recipientType: string
  context?: string
  tone: string
}

export interface GenerateEmailResult {
  variations: EmailVariation[]
  provider: AIProvider
}

export interface SequenceStepDraft {
  day: number
  subject: string
  body: string
  previewText: string
}

export interface GenerateSequenceParams {
  sequenceType: string
  industry: string
  businessName: string
  brandVoice: string
  stepCount: number
}

export interface GenerateSequenceResult {
  steps: SequenceStepDraft[]
  provider: AIProvider
}

export interface ImproveEmailParams {
  existingEmail: EmailVariation
  instruction: string
}

export interface ImproveEmailResult {
  subject: string
  body: string
  previewText: string
  provider: AIProvider
}

// Onboarding
export interface OnboardingData {
  step: number
  businessName?: string
  industry?: string
  description?: string
  website?: string
  phone?: string
  brandVoice?: BrandVoice
  fromName?: string
  fromEmail?: string
  replyToEmail?: string
}

// Dashboard stats
export interface DashboardStats {
  totalContacts: number
  activeSequences: number
  emailsSentThisMonth: number
}

export interface ActivityItem {
  id: string
  type: EmailType
  toEmail: string
  subject: string
  status: EmailStatus
  sentAt: string
  contactName?: string
}
