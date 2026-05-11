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
      customers: {
        Row: {
          id: string
          customer_number: string
          name: string
          street: string | null
          street_number: string | null
          postal_code: string | null
          city: string | null
          country: string | null
          phone: string | null
          website: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          customer_number: string
          name: string
          street?: string | null
          street_number?: string | null
          postal_code?: string | null
          city?: string | null
          country?: string | null
          phone?: string | null
          website?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          customer_number?: string
          name?: string
          street?: string | null
          street_number?: string | null
          postal_code?: string | null
          city?: string | null
          country?: string | null
          phone?: string | null
          website?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      accounts: {
        Row: {
          id: string
          number: string
          name: string
          type: 'aktiv' | 'passiv' | 'ertrag' | 'aufwand'
          group_id: string | null
          balance: number
          description: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          number: string
          name: string
          type: 'aktiv' | 'passiv' | 'ertrag' | 'aufwand'
          group_id?: string | null
          balance?: number
          description?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          number?: string
          name?: string
          type?: 'aktiv' | 'passiv' | 'ertrag' | 'aufwand'
          group_id?: string | null
          balance?: number
          description?: string | null
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      account_groups: {
        Row: {
          id: string
          name: string
          type: 'aktiv' | 'passiv' | 'ertrag' | 'aufwand'
          description: string | null
          sort_order: number
          account_number: string | null
          level: 'klasse' | 'gruppe' | null
          parent_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          type: 'aktiv' | 'passiv' | 'ertrag' | 'aufwand'
          description?: string | null
          sort_order?: number
          account_number?: string | null
          level?: 'klasse' | 'gruppe' | null
          parent_id?: string | null
          created_at?: string
        }
        Update: {
          name?: string
          type?: 'aktiv' | 'passiv' | 'ertrag' | 'aufwand'
          description?: string | null
          sort_order?: number
          account_number?: string | null
          level?: 'klasse' | 'gruppe' | null
          parent_id?: string | null
        }
        Relationships: []
      }
      fiscal_years: {
        Row: {
          id: string
          name: string
          start_date: string
          end_date: string
          is_closed: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          start_date: string
          end_date: string
          is_closed?: boolean
          created_at?: string
        }
        Update: {
          name?: string
          start_date?: string
          end_date?: string
          is_closed?: boolean
        }
        Relationships: []
      }
      invoices: {
        Row: {
          id: string
          number: string
          customer_name: string
          customer_address: string
          invoice_date: string
          due_date: string | null
          delivery_date: string | null
          reference: string | null
          bank_info: string | null
          conditions: string | null
          notes: string | null
          footer: string | null
          discount_type: 'percent' | 'amount'
          discount_value: number
          rounding_diff: number
          status: 'entwurf' | 'gesendet' | 'bezahlt' | 'archiviert'
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          number?: string
          customer_name?: string
          customer_address?: string
          invoice_date?: string
          due_date?: string | null
          delivery_date?: string | null
          reference?: string | null
          bank_info?: string | null
          conditions?: string | null
          notes?: string | null
          footer?: string | null
          discount_type?: 'percent' | 'amount'
          discount_value?: number
          rounding_diff?: number
          status?: 'entwurf' | 'gesendet' | 'bezahlt' | 'archiviert'
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          number?: string
          customer_name?: string
          customer_address?: string
          invoice_date?: string
          due_date?: string | null
          delivery_date?: string | null
          reference?: string | null
          bank_info?: string | null
          conditions?: string | null
          notes?: string | null
          footer?: string | null
          discount_type?: 'percent' | 'amount'
          discount_value?: number
          rounding_diff?: number
          status?: 'entwurf' | 'gesendet' | 'bezahlt' | 'archiviert'
          updated_at?: string
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          id: string
          invoice_id: string
          position: number
          service_name: string
          description: string | null
          unit_price: number
          quantity: number
          unit: string
          account_id: string | null
        }
        Insert: {
          id?: string
          invoice_id: string
          position?: number
          service_name?: string
          description?: string | null
          unit_price?: number
          quantity?: number
          unit?: string
          account_id?: string | null
        }
        Update: {
          position?: number
          service_name?: string
          description?: string | null
          unit_price?: number
          quantity?: number
          unit?: string
          account_id?: string | null
        }
        Relationships: []
      }
      journal_entries: {
        Row: {
          id: string
          date: string
          description: string
          debit_account_id: string
          credit_account_id: string
          amount: number
          invoice_id: string | null
          fiscal_year_id: string | null
          created_by: string | null
          created_at: string
          is_deleted: boolean
        }
        Insert: {
          id?: string
          date: string
          description: string
          debit_account_id: string
          credit_account_id: string
          amount: number
          invoice_id?: string | null
          fiscal_year_id?: string | null
          created_by?: string | null
          created_at?: string
          is_deleted?: boolean
        }
        Update: {
          date?: string
          description?: string
          debit_account_id?: string
          credit_account_id?: string
          amount?: number
          invoice_id?: string | null
          fiscal_year_id?: string | null
          is_deleted?: boolean
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
