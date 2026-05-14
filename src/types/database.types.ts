export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          appointment_type: string
          calendar_exported_at: string | null
          clinician_id: string | null
          created_at: string
          id: string
          location: Database["public"]["Enums"]["appointment_location"] | null
          notes: string | null
          patient_id: string
          scheduled_at: string | null
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        Insert: {
          appointment_type: string
          calendar_exported_at?: string | null
          clinician_id?: string | null
          created_at?: string
          id?: string
          location?: Database["public"]["Enums"]["appointment_location"] | null
          notes?: string | null
          patient_id: string
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Update: {
          appointment_type?: string
          calendar_exported_at?: string | null
          clinician_id?: string | null
          created_at?: string
          id?: string
          location?: Database["public"]["Enums"]["appointment_location"] | null
          notes?: string | null
          patient_id?: string
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_clinician_id_fkey"
            columns: ["clinician_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          actor_role: string | null
          actor_staff_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          event_type: string
          id: string
          ip_address: unknown
          new_value: Json | null
          old_value: Json | null
          patient_id: string | null
          user_agent: string | null
        }
        Insert: {
          actor_role?: string | null
          actor_staff_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type: string
          id?: string
          ip_address?: unknown
          new_value?: Json | null
          old_value?: Json | null
          patient_id?: string | null
          user_agent?: string | null
        }
        Update: {
          actor_role?: string | null
          actor_staff_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string
          id?: string
          ip_address?: unknown
          new_value?: Json | null
          old_value?: Json | null
          patient_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_actor_staff_id_fkey"
            columns: ["actor_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_events_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      check_ins: {
        Row: {
          created_at: string
          id: string
          light_sensitivity: number
          other_description: string | null
          pain: number
          patient_id: string
          patient_zone: Database["public"]["Enums"]["patient_zone"]
          recovery_day: number
          reviewed_at: string | null
          reviewed_by: string | null
          staff_alert_level: Database["public"]["Enums"]["staff_alert_level"]
          unusual_symptoms: string[]
          updated_at: string
          vision: Database["public"]["Enums"]["vision_assessment"]
        }
        Insert: {
          created_at?: string
          id?: string
          light_sensitivity: number
          other_description?: string | null
          pain: number
          patient_id: string
          patient_zone: Database["public"]["Enums"]["patient_zone"]
          recovery_day: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          staff_alert_level: Database["public"]["Enums"]["staff_alert_level"]
          unusual_symptoms?: string[]
          updated_at?: string
          vision: Database["public"]["Enums"]["vision_assessment"]
        }
        Update: {
          created_at?: string
          id?: string
          light_sensitivity?: number
          other_description?: string | null
          pain?: number
          patient_id?: string
          patient_zone?: Database["public"]["Enums"]["patient_zone"]
          recovery_day?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          staff_alert_level?: Database["public"]["Enums"]["staff_alert_level"]
          unusual_symptoms?: string[]
          updated_at?: string
          vision?: Database["public"]["Enums"]["vision_assessment"]
        }
        Relationships: [
          {
            foreignKeyName: "check_ins_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "check_ins_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          category: string
          created_at: string
          filename: string
          id: string
          patient_id: string
          storage_path: string
          updated_at: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          category: string
          created_at?: string
          filename: string
          id?: string
          patient_id: string
          storage_path: string
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          filename?: string
          id?: string
          patient_id?: string
          storage_path?: string
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
        ]
      }
      eye_photos: {
        Row: {
          captured_at: string
          check_in_id: string | null
          created_at: string
          id: string
          patient_id: string
          recovery_day: number | null
          storage_path: string
          updated_at: string
        }
        Insert: {
          captured_at?: string
          check_in_id?: string | null
          created_at?: string
          id?: string
          patient_id: string
          recovery_day?: number | null
          storage_path: string
          updated_at?: string
        }
        Update: {
          captured_at?: string
          check_in_id?: string | null
          created_at?: string
          id?: string
          patient_id?: string
          recovery_day?: number | null
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "eye_photos_check_in_id_fkey"
            columns: ["check_in_id"]
            isOneToOne: false
            referencedRelation: "check_ins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eye_photos_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_flags: {
        Row: {
          alert_level: Database["public"]["Enums"]["manual_flag_level"]
          created_at: string
          id: string
          patient_id: string
          raised_by_staff_id: string
          reason: string
          resolved_at: string | null
          resolved_by_staff_id: string | null
          updated_at: string
        }
        Insert: {
          alert_level: Database["public"]["Enums"]["manual_flag_level"]
          created_at?: string
          id?: string
          patient_id: string
          raised_by_staff_id: string
          reason: string
          resolved_at?: string | null
          resolved_by_staff_id?: string | null
          updated_at?: string
        }
        Update: {
          alert_level?: Database["public"]["Enums"]["manual_flag_level"]
          created_at?: string
          id?: string
          patient_id?: string
          raised_by_staff_id?: string
          reason?: string
          resolved_at?: string | null
          resolved_by_staff_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "manual_flags_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_flags_raised_by_staff_id_fkey"
            columns: ["raised_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_flags_resolved_by_staff_id_fkey"
            columns: ["resolved_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
        ]
      }
      medication_doses: {
        Row: {
          created_at: string
          id: string
          medication_id: string
          patient_note: string | null
          scheduled_at: string
          snooze_count: number
          taken_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          medication_id: string
          patient_note?: string | null
          scheduled_at: string
          snooze_count?: number
          taken_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          medication_id?: string
          patient_note?: string | null
          scheduled_at?: string
          snooze_count?: number
          taken_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medication_doses_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
        ]
      }
      medications: {
        Row: {
          created_at: string
          dose: string
          end_date: string | null
          frequency: string
          id: string
          name: string
          patient_id: string
          route: string
          scheduled_times: string[]
          start_date: string
          stop_reason: string | null
          stopped_at: string | null
          stopped_by_staff_id: string | null
          taper_notes: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          dose: string
          end_date?: string | null
          frequency: string
          id?: string
          name: string
          patient_id: string
          route: string
          scheduled_times?: string[]
          start_date: string
          stop_reason?: string | null
          stopped_at?: string | null
          stopped_by_staff_id?: string | null
          taper_notes?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          dose?: string
          end_date?: string | null
          frequency?: string
          id?: string
          name?: string
          patient_id?: string
          route?: string
          scheduled_times?: string[]
          start_date?: string
          stop_reason?: string | null
          stopped_at?: string | null
          stopped_by_staff_id?: string | null
          taper_notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medications_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medications_stopped_by_staff_id_fkey"
            columns: ["stopped_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          body: string
          category: string | null
          created_at: string
          id: string
          label: string
          updated_at: string
        }
        Insert: {
          body: string
          category?: string | null
          created_at?: string
          id?: string
          label: string
          updated_at?: string
        }
        Update: {
          body?: string
          category?: string | null
          created_at?: string
          id?: string
          label?: string
          updated_at?: string
        }
        Relationships: []
      }
      message_threads: {
        Row: {
          assigned_staff_id: string | null
          created_at: string
          id: string
          last_message_at: string | null
          patient_id: string
          status: Database["public"]["Enums"]["message_thread_status"]
          unread_for_patient: number
          unread_for_staff: number
          updated_at: string
        }
        Insert: {
          assigned_staff_id?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          patient_id: string
          status?: Database["public"]["Enums"]["message_thread_status"]
          unread_for_patient?: number
          unread_for_staff?: number
          updated_at?: string
        }
        Update: {
          assigned_staff_id?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          patient_id?: string
          status?: Database["public"]["Enums"]["message_thread_status"]
          unread_for_patient?: number
          unread_for_staff?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_threads_assigned_staff_id_fkey"
            columns: ["assigned_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_threads_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: true
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachments: Json
          body: string
          created_at: string
          id: string
          read_at: string | null
          sender_id: string
          sender_type: Database["public"]["Enums"]["message_sender_type"]
          sent_at: string
          thread_id: string
          updated_at: string
        }
        Insert: {
          attachments?: Json
          body: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id: string
          sender_type: Database["public"]["Enums"]["message_sender_type"]
          sent_at?: string
          thread_id: string
          updated_at?: string
        }
        Update: {
          attachments?: Json
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id?: string
          sender_type?: Database["public"]["Enums"]["message_sender_type"]
          sent_at?: string
          thread_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "message_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          allergies: string[]
          created_at: string
          date_of_birth: string | null
          email: string
          emergency_contact: Json | null
          health_fund: Json | null
          id: string
          medicare_number: string | null
          name: string
          paired_clinic_record_id: string | null
          phone: string | null
          phone_verified: boolean
          updated_at: string
        }
        Insert: {
          allergies?: string[]
          created_at?: string
          date_of_birth?: string | null
          email: string
          emergency_contact?: Json | null
          health_fund?: Json | null
          id: string
          medicare_number?: string | null
          name: string
          paired_clinic_record_id?: string | null
          phone?: string | null
          phone_verified?: boolean
          updated_at?: string
        }
        Update: {
          allergies?: string[]
          created_at?: string
          date_of_birth?: string | null
          email?: string
          emergency_contact?: Json | null
          health_fund?: Json | null
          id?: string
          medicare_number?: string | null
          name?: string
          paired_clinic_record_id?: string | null
          phone?: string | null
          phone_verified?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      procedure_templates: {
        Row: {
          created_at: string
          created_by: string | null
          default_appointments: Json
          default_medications: Json
          default_postop_content_ids: string[]
          default_preop_content_ids: string[]
          id: string
          linked_recovery_guidance_id: string | null
          linked_routing_ruleset_id: string | null
          procedure_type: string
          surgeon_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          default_appointments?: Json
          default_medications?: Json
          default_postop_content_ids?: string[]
          default_preop_content_ids?: string[]
          id?: string
          linked_recovery_guidance_id?: string | null
          linked_routing_ruleset_id?: string | null
          procedure_type: string
          surgeon_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          default_appointments?: Json
          default_medications?: Json
          default_postop_content_ids?: string[]
          default_preop_content_ids?: string[]
          id?: string
          linked_recovery_guidance_id?: string | null
          linked_routing_ruleset_id?: string | null
          procedure_type?: string
          surgeon_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "procedure_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedure_templates_surgeon_id_fkey"
            columns: ["surgeon_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedure_templates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
        ]
      }
      procedures: {
        Row: {
          created_at: string
          custom_notes: string | null
          eye: Database["public"]["Enums"]["eye_side"]
          id: string
          patient_id: string
          procedure_type: string
          source_template_id: string | null
          status: Database["public"]["Enums"]["procedure_status"]
          surgeon_id: string
          surgery_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_notes?: string | null
          eye: Database["public"]["Enums"]["eye_side"]
          id?: string
          patient_id: string
          procedure_type: string
          source_template_id?: string | null
          status?: Database["public"]["Enums"]["procedure_status"]
          surgeon_id: string
          surgery_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_notes?: string | null
          eye?: Database["public"]["Enums"]["eye_side"]
          id?: string
          patient_id?: string
          procedure_type?: string
          source_template_id?: string | null
          status?: Database["public"]["Enums"]["procedure_status"]
          surgeon_id?: string
          surgery_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "procedures_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedures_source_template_id_fkey"
            columns: ["source_template_id"]
            isOneToOne: false
            referencedRelation: "procedure_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedures_surgeon_id_fkey"
            columns: ["surgeon_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
        ]
      }
      routing_rules: {
        Row: {
          created_at: string
          id: string
          item_key: string
          item_value: string
          route: Database["public"]["Enums"]["route_action"]
          ruleset_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_key: string
          item_value: string
          route: Database["public"]["Enums"]["route_action"]
          ruleset_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          item_key?: string
          item_value?: string
          route?: Database["public"]["Enums"]["route_action"]
          ruleset_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "routing_rules_ruleset_id_fkey"
            columns: ["ruleset_id"]
            isOneToOne: false
            referencedRelation: "routing_rulesets"
            referencedColumns: ["id"]
          },
        ]
      }
      routing_rulesets: {
        Row: {
          created_at: string
          id: string
          name: string
          procedure_type: string | null
          surgeon_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          procedure_type?: string | null
          surgeon_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          procedure_type?: string | null
          surgeon_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "routing_rulesets_surgeon_id_fkey"
            columns: ["surgeon_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_notes: {
        Row: {
          author_staff_id: string
          body: string
          created_at: string
          id: string
          patient_id: string
        }
        Insert: {
          author_staff_id: string
          body: string
          created_at?: string
          id?: string
          patient_id: string
        }
        Update: {
          author_staff_id?: string
          body?: string
          created_at?: string
          id?: string
          patient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_notes_author_staff_id_fkey"
            columns: ["author_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_notes_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_users: {
        Row: {
          created_at: string
          email: string
          id: string
          mfa_secret: string | null
          name: string
          role: Database["public"]["Enums"]["staff_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          mfa_secret?: string | null
          name: string
          role: Database["public"]["Enums"]["staff_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          mfa_secret?: string | null
          name?: string
          role?: Database["public"]["Enums"]["staff_role"]
          updated_at?: string
        }
        Relationships: []
      }
      symptom_options: {
        Row: {
          active: boolean
          created_at: string
          id: string
          key: string
          label: string
          order_index: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          key: string
          label: string
          order_index?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          key?: string
          label?: string
          order_index?: number
          updated_at?: string
        }
        Relationships: []
      }
      zone_alert_actions: {
        Row: {
          additional_email: string | null
          alert_level: Database["public"]["Enums"]["staff_alert_level"]
          autocall_oncall: boolean
          created_at: string
          email_clinic: boolean
          inapp_to_all: boolean
          oncall_number: string | null
          push_to_oncall: boolean
          sms_oncall: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          additional_email?: string | null
          alert_level: Database["public"]["Enums"]["staff_alert_level"]
          autocall_oncall?: boolean
          created_at?: string
          email_clinic?: boolean
          inapp_to_all?: boolean
          oncall_number?: string | null
          push_to_oncall?: boolean
          sms_oncall?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          additional_email?: string | null
          alert_level?: Database["public"]["Enums"]["staff_alert_level"]
          autocall_oncall?: boolean
          created_at?: string
          email_clinic?: boolean
          inapp_to_all?: boolean
          oncall_number?: string | null
          push_to_oncall?: boolean
          sms_oncall?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "zone_alert_actions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
        ]
      }
      zone_content: {
        Row: {
          created_at: string
          expected_symptoms: string[]
          headline: string
          id: string
          instructions: string | null
          message: string
          procedure_type: string | null
          surgeon_id: string | null
          today_tip: string | null
          updated_at: string
          updated_by: string | null
          warning: string | null
          zone: Database["public"]["Enums"]["patient_zone"]
        }
        Insert: {
          created_at?: string
          expected_symptoms?: string[]
          headline: string
          id?: string
          instructions?: string | null
          message: string
          procedure_type?: string | null
          surgeon_id?: string | null
          today_tip?: string | null
          updated_at?: string
          updated_by?: string | null
          warning?: string | null
          zone: Database["public"]["Enums"]["patient_zone"]
        }
        Update: {
          created_at?: string
          expected_symptoms?: string[]
          headline?: string
          id?: string
          instructions?: string | null
          message?: string
          procedure_type?: string | null
          surgeon_id?: string | null
          today_tip?: string | null
          updated_at?: string
          updated_by?: string | null
          warning?: string | null
          zone?: Database["public"]["Enums"]["patient_zone"]
        }
        Relationships: [
          {
            foreignKeyName: "zone_content_surgeon_id_fkey"
            columns: ["surgeon_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zone_content_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_staff_user: {
        Args: {
          p_name: string
          p_role: Database["public"]["Enums"]["staff_role"]
        }
        Returns: {
          created_at: string
          email: string
          id: string
          mfa_secret: string | null
          name: string
          role: Database["public"]["Enums"]["staff_role"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "staff_users"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ensure_todays_doses: { Args: { p_patient_id: string }; Returns: number }
      is_staff: { Args: never; Returns: boolean }
    }
    Enums: {
      appointment_location: "in_clinic" | "phone" | "video"
      appointment_status: "to_book" | "confirmed" | "completed" | "cancelled"
      eye_side: "left" | "right" | "both"
      manual_flag_level: "yellow" | "orange" | "red"
      message_sender_type: "patient" | "staff"
      message_thread_status: "open" | "resolved"
      patient_zone: "green" | "yellow" | "orange"
      procedure_status: "active" | "completed" | "cancelled"
      route_action: "off" | "yellow" | "orange" | "red"
      staff_alert_level: "none" | "yellow" | "orange" | "red"
      staff_role: "surgeon" | "optometrist" | "nurse" | "reception"
      vision_assessment: "worse" | "same" | "better"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      appointment_location: ["in_clinic", "phone", "video"],
      appointment_status: ["to_book", "confirmed", "completed", "cancelled"],
      eye_side: ["left", "right", "both"],
      manual_flag_level: ["yellow", "orange", "red"],
      message_sender_type: ["patient", "staff"],
      message_thread_status: ["open", "resolved"],
      patient_zone: ["green", "yellow", "orange"],
      procedure_status: ["active", "completed", "cancelled"],
      route_action: ["off", "yellow", "orange", "red"],
      staff_alert_level: ["none", "yellow", "orange", "red"],
      staff_role: ["surgeon", "optometrist", "nurse", "reception"],
      vision_assessment: ["worse", "same", "better"],
    },
  },
} as const
