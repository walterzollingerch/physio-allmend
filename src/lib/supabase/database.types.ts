export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type UserRole = 'admin' | 'physio' | 'client'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string
          role: UserRole
          is_blocked: boolean
          phone: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name: string
          role?: UserRole
          is_blocked?: boolean
          phone?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          role?: UserRole
          is_blocked?: boolean
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
      treatment_types: {
        Row: {
          id: string
          name: string
          duration_min: number
          description: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          duration_min?: number
          description?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          name?: string
          duration_min?: number
          description?: string | null
          is_active?: boolean
        }
        Relationships: []
      }
      bookings: {
        Row: {
          id: string
          patient_id: string
          treatment_type_id: string
          requested_date: string
          requested_time: string
          status: 'pending' | 'confirmed' | 'cancelled'
          notes: string | null
          google_event_id: string | null
          confirmed_by: string | null
          confirmed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          patient_id: string
          treatment_type_id: string
          requested_date: string
          requested_time: string
          status?: 'pending' | 'confirmed' | 'cancelled'
          notes?: string | null
          google_event_id?: string | null
          confirmed_by?: string | null
          confirmed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          status?: 'pending' | 'confirmed' | 'cancelled'
          notes?: string | null
          google_event_id?: string | null
          confirmed_by?: string | null
          confirmed_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
