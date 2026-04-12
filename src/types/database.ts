export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      accounts: {
        Row: {
          id: string
          user_id: string
          business_name: string
          industry: string
          description: string | null
          website: string | null
          phone: string | null
          address: string | null
          brand_voice: string
          primary_color: string
          logo_url: string | null
          from_email: string | null
          from_name: string | null
          reply_to_email: string | null
          resend_domain_verified: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          business_name: string
          industry: string
          description?: string | null
          website?: string | null
          phone?: string | null
          address?: string | null
          brand_voice?: string
          primary_color?: string
          logo_url?: string | null
          from_email?: string | null
          from_name?: string | null
          reply_to_email?: string | null
          resend_domain_verified?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          business_name?: string
          industry?: string
          description?: string | null
          website?: string | null
          phone?: string | null
          address?: string | null
          brand_voice?: string
          primary_color?: string
          logo_url?: string | null
          from_email?: string | null
          from_name?: string | null
          reply_to_email?: string | null
          resend_domain_verified?: boolean
          created_at?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          id: string
          account_id: string
          email: string
          first_name: string | null
          last_name: string | null
          phone: string | null
          status: string
          segment: string
          tags: string[] | null
          custom_fields: Json
          last_contacted_at: string | null
          birthday: string | null
          created_at: string
        }
        Insert: {
          id?: string
          account_id: string
          email: string
          first_name?: string | null
          last_name?: string | null
          phone?: string | null
          status?: string
          segment?: string
          tags?: string[] | null
          custom_fields?: Json
          last_contacted_at?: string | null
          birthday?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          account_id?: string
          email?: string
          first_name?: string | null
          last_name?: string | null
          phone?: string | null
          status?: string
          segment?: string
          tags?: string[] | null
          custom_fields?: Json
          last_contacted_at?: string | null
          birthday?: string | null
          created_at?: string
        }
        Relationships: []
      }
      sequences: {
        Row: {
          id: string
          account_id: string | null
          name: string
          description: string | null
          industry: string | null
          trigger_type: string
          is_active: boolean
          is_template: boolean
          created_at: string
        }
        Insert: {
          id?: string
          account_id?: string | null
          name: string
          description?: string | null
          industry?: string | null
          trigger_type: string
          is_active?: boolean
          is_template?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          account_id?: string | null
          name?: string
          description?: string | null
          industry?: string | null
          trigger_type?: string
          is_active?: boolean
          is_template?: boolean
          created_at?: string
        }
        Relationships: []
      }
      sequence_steps: {
        Row: {
          id: string
          sequence_id: string
          step_number: number
          delay_days: number
          subject: string
          body: string
          preview_text: string | null
          created_at: string
        }
        Insert: {
          id?: string
          sequence_id: string
          step_number: number
          delay_days?: number
          subject: string
          body: string
          preview_text?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          sequence_id?: string
          step_number?: number
          delay_days?: number
          subject?: string
          body?: string
          preview_text?: string | null
          created_at?: string
        }
        Relationships: []
      }
      sequence_enrollments: {
        Row: {
          id: string
          sequence_id: string
          contact_id: string
          account_id: string
          current_step: number
          status: string
          enrolled_at: string
          next_send_at: string | null
          completed_at: string | null
        }
        Insert: {
          id?: string
          sequence_id: string
          contact_id: string
          account_id: string
          current_step?: number
          status?: string
          enrolled_at?: string
          next_send_at?: string | null
          completed_at?: string | null
        }
        Update: {
          id?: string
          sequence_id?: string
          contact_id?: string
          account_id?: string
          current_step?: number
          status?: string
          enrolled_at?: string
          next_send_at?: string | null
          completed_at?: string | null
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          id: string
          account_id: string
          name: string
          subject: string
          body: string
          preview_text: string | null
          segment: string | null
          status: string
          scheduled_at: string | null
          sent_at: string | null
          recipient_count: number
          created_at: string
        }
        Insert: {
          id?: string
          account_id: string
          name: string
          subject: string
          body: string
          preview_text?: string | null
          segment?: string | null
          status?: string
          scheduled_at?: string | null
          sent_at?: string | null
          recipient_count?: number
          created_at?: string
        }
        Update: {
          id?: string
          account_id?: string
          name?: string
          subject?: string
          body?: string
          preview_text?: string | null
          segment?: string | null
          status?: string
          scheduled_at?: string | null
          sent_at?: string | null
          recipient_count?: number
          created_at?: string
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          id: string
          account_id: string
          contact_id: string | null
          campaign_id: string | null
          sequence_id: string | null
          sequence_step_id: string | null
          email_type: string
          to_email: string
          subject: string
          resend_id: string | null
          status: string
          opened_at: string | null
          clicked_at: string | null
          bounced_at: string | null
          sent_at: string
        }
        Insert: {
          id?: string
          account_id: string
          contact_id?: string | null
          campaign_id?: string | null
          sequence_id?: string | null
          sequence_step_id?: string | null
          email_type: string
          to_email: string
          subject: string
          resend_id?: string | null
          status?: string
          opened_at?: string | null
          clicked_at?: string | null
          bounced_at?: string | null
          sent_at?: string
        }
        Update: {
          id?: string
          account_id?: string
          contact_id?: string | null
          campaign_id?: string | null
          sequence_id?: string | null
          sequence_step_id?: string | null
          email_type?: string
          to_email?: string
          subject?: string
          resend_id?: string | null
          status?: string
          opened_at?: string | null
          clicked_at?: string | null
          bounced_at?: string | null
          sent_at?: string
        }
        Relationships: []
      }
      review_requests: {
        Row: {
          id: string
          account_id: string
          contact_id: string
          platform: string
          status: string
          sent_at: string
          clicked_at: string | null
          review_url: string | null
        }
        Insert: {
          id?: string
          account_id: string
          contact_id: string
          platform?: string
          status?: string
          sent_at?: string
          clicked_at?: string | null
          review_url?: string | null
        }
        Update: {
          id?: string
          account_id?: string
          contact_id?: string
          platform?: string
          status?: string
          sent_at?: string
          clicked_at?: string | null
          review_url?: string | null
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
