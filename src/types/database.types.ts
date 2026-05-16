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
      analytics_targets: {
        Row: {
          checkin_completion_pct: number
          id: boolean
          medication_adherence_pct: number
          red_alert_rate_pct: number
          staff_response_hours: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          checkin_completion_pct?: number
          id?: boolean
          medication_adherence_pct?: number
          red_alert_rate_pct?: number
          staff_response_hours?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          checkin_completion_pct?: number
          id?: boolean
          medication_adherence_pct?: number
          red_alert_rate_pct?: number
          staff_response_hours?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_targets_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          appointment_type: string
          calendar_exported_at: string | null
          clinician_id: string | null
          created_at: string
          id: string
          location: Database["public"]["Enums"]["appointment_location"] | null
          location_address: string | null
          notes: string | null
          patient_id: string
          scheduled_at: string | null
          source_template_id: string | null
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
          location_address?: string | null
          notes?: string | null
          patient_id: string
          scheduled_at?: string | null
          source_template_id?: string | null
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
          location_address?: string | null
          notes?: string | null
          patient_id?: string
          scheduled_at?: string | null
          source_template_id?: string | null
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
          {
            foreignKeyName: "appointments_source_template_id_fkey"
            columns: ["source_template_id"]
            isOneToOne: false
            referencedRelation: "procedure_templates"
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
      bulk_push_deliveries: {
        Row: {
          bulk_push_id: string
          created_at: string
          delivered_at: string
          id: string
          message_id: string | null
          opened_at: string | null
          patient_id: string
          recovery_day: number | null
          status: string
        }
        Insert: {
          bulk_push_id: string
          created_at?: string
          delivered_at?: string
          id?: string
          message_id?: string | null
          opened_at?: string | null
          patient_id: string
          recovery_day?: number | null
          status?: string
        }
        Update: {
          bulk_push_id?: string
          created_at?: string
          delivered_at?: string
          id?: string
          message_id?: string | null
          opened_at?: string | null
          patient_id?: string
          recovery_day?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "bulk_push_deliveries_bulk_push_id_fkey"
            columns: ["bulk_push_id"]
            isOneToOne: false
            referencedRelation: "bulk_pushes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulk_push_deliveries_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulk_push_deliveries_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      bulk_pushes: {
        Row: {
          attachment_paths: string[]
          cohort_filter: Json
          cohort_summary: string
          content_item_ids: string[]
          content_type: string
          created_at: string
          fired_at: string | null
          id: string
          message_body: string
          message_title: string
          patients_reached: number
          scheduled_at: string
          sender_staff_id: string
          updated_at: string
        }
        Insert: {
          attachment_paths?: string[]
          cohort_filter: Json
          cohort_summary: string
          content_item_ids?: string[]
          content_type?: string
          created_at?: string
          fired_at?: string | null
          id?: string
          message_body: string
          message_title: string
          patients_reached?: number
          scheduled_at: string
          sender_staff_id: string
          updated_at?: string
        }
        Update: {
          attachment_paths?: string[]
          cohort_filter?: Json
          cohort_summary?: string
          content_item_ids?: string[]
          content_type?: string
          created_at?: string
          fired_at?: string | null
          id?: string
          message_body?: string
          message_title?: string
          patients_reached?: number
          scheduled_at?: string
          sender_staff_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bulk_pushes_sender_staff_id_fkey"
            columns: ["sender_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
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
      clinic_profile: {
        Row: {
          abn: string | null
          address: string
          after_hours_label: string
          after_hours_message: string
          after_hours_phone: string
          created_at: string
          email: string | null
          id: string
          name: string
          opening_hours: Json
          phone: string
          timezone: string
          updated_at: string
          website: string | null
        }
        Insert: {
          abn?: string | null
          address: string
          after_hours_label?: string
          after_hours_message: string
          after_hours_phone: string
          created_at?: string
          email?: string | null
          id?: string
          name: string
          opening_hours: Json
          phone: string
          timezone?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          abn?: string | null
          address?: string
          after_hours_label?: string
          after_hours_message?: string
          after_hours_phone?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          opening_hours?: Json
          phone?: string
          timezone?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      contact_options: {
        Row: {
          action_type: string
          action_value: string | null
          created_at: string
          enabled: boolean
          icon: string
          id: string
          is_required: boolean
          label: string
          order_index: number
          subtitle: string | null
          updated_at: string
        }
        Insert: {
          action_type: string
          action_value?: string | null
          created_at?: string
          enabled?: boolean
          icon?: string
          id?: string
          is_required?: boolean
          label: string
          order_index?: number
          subtitle?: string | null
          updated_at?: string
        }
        Update: {
          action_type?: string
          action_value?: string | null
          created_at?: string
          enabled?: boolean
          icon?: string
          id?: string
          is_required?: boolean
          label?: string
          order_index?: number
          subtitle?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      content_items: {
        Row: {
          active: boolean
          audience: string
          body: string | null
          created_at: string
          days_range: string | null
          id: string
          media_url: string | null
          procedures: string[]
          title: string
          topics: string[]
          type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          audience?: string
          body?: string | null
          created_at?: string
          days_range?: string | null
          id?: string
          media_url?: string | null
          procedures?: string[]
          title: string
          topics?: string[]
          type: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          audience?: string
          body?: string | null
          created_at?: string
          days_range?: string | null
          id?: string
          media_url?: string | null
          procedures?: string[]
          title?: string
          topics?: string[]
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      doctors: {
        Row: {
          active: boolean
          bio: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          photo_url: string | null
          role: string
          updated_at: string
          welcome_video_url: string | null
        }
        Insert: {
          active?: boolean
          bio?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          photo_url?: string | null
          role: string
          updated_at?: string
          welcome_video_url?: string | null
        }
        Update: {
          active?: boolean
          bio?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          photo_url?: string | null
          role?: string
          updated_at?: string
          welcome_video_url?: string | null
        }
        Relationships: []
      }
      documents: {
        Row: {
          category: string
          created_at: string
          filename: string
          id: string
          patient_id: string
          storage_path: string
          title: string | null
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
          title?: string | null
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
          title?: string | null
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
      feature_defaults: {
        Row: {
          config: Json
          enabled: boolean
          feature_key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          config?: Json
          enabled: boolean
          feature_key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          config?: Json
          enabled?: boolean
          feature_key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feature_defaults_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by_staff_id: string | null
          comment: string | null
          contact_requested: boolean
          created_at: string
          id: string
          patient_id: string
          rating: number
          recovery_day: number | null
          staff_mention: string | null
          submitted_at: string
          target: string
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by_staff_id?: string | null
          comment?: string | null
          contact_requested?: boolean
          created_at?: string
          id?: string
          patient_id: string
          rating: number
          recovery_day?: number | null
          staff_mention?: string | null
          submitted_at?: string
          target: string
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by_staff_id?: string | null
          comment?: string | null
          contact_requested?: boolean
          created_at?: string
          id?: string
          patient_id?: string
          rating?: number
          recovery_day?: number | null
          staff_mention?: string | null
          submitted_at?: string
          target?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_acknowledged_by_staff_id_fkey"
            columns: ["acknowledged_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_reports: {
        Row: {
          auto_generated: boolean
          data: Json | null
          generated_at: string
          generated_by_staff_id: string | null
          id: string
          include_identifiers: boolean
          parameters: Json
          report_type: string
        }
        Insert: {
          auto_generated?: boolean
          data?: Json | null
          generated_at?: string
          generated_by_staff_id?: string | null
          id?: string
          include_identifiers?: boolean
          parameters?: Json
          report_type: string
        }
        Update: {
          auto_generated?: boolean
          data?: Json | null
          generated_at?: string
          generated_by_staff_id?: string | null
          id?: string
          include_identifiers?: boolean
          parameters?: Json
          report_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_reports_generated_by_staff_id_fkey"
            columns: ["generated_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
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
          source_template_id: string | null
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
          source_template_id?: string | null
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
          source_template_id?: string | null
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
            foreignKeyName: "medications_source_template_id_fkey"
            columns: ["source_template_id"]
            isOneToOne: false
            referencedRelation: "procedure_templates"
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
          active: boolean
          body: string
          category: string | null
          created_at: string
          id: string
          label: string
          order_index: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          body: string
          category?: string | null
          created_at?: string
          id?: string
          label: string
          order_index?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          body?: string
          category?: string | null
          created_at?: string
          id?: string
          label?: string
          order_index?: number
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
          bulk_push_id: string | null
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
          bulk_push_id?: string | null
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
          bulk_push_id?: string | null
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
            foreignKeyName: "messages_bulk_push_id_fkey"
            columns: ["bulk_push_id"]
            isOneToOne: false
            referencedRelation: "bulk_pushes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "message_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_facilities: {
        Row: {
          active: boolean
          address: string | null
          created_at: string
          id: string
          liaison_email: string | null
          liaison_phone: string | null
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          created_at?: string
          id?: string
          liaison_email?: string | null
          liaison_phone?: string | null
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          created_at?: string
          id?: string
          liaison_email?: string | null
          liaison_phone?: string | null
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      patient_feature_flags: {
        Row: {
          changed_at: string | null
          changed_by_staff_id: string | null
          config: Json
          created_at: string
          enabled: boolean
          feature_key: string
          id: string
          patient_id: string
          updated_at: string
        }
        Insert: {
          changed_at?: string | null
          changed_by_staff_id?: string | null
          config?: Json
          created_at?: string
          enabled: boolean
          feature_key: string
          id?: string
          patient_id: string
          updated_at?: string
        }
        Update: {
          changed_at?: string | null
          changed_by_staff_id?: string | null
          config?: Json
          created_at?: string
          enabled?: boolean
          feature_key?: string
          id?: string
          patient_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_feature_flags_changed_by_staff_id_fkey"
            columns: ["changed_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_feature_flags_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_setup_tasks: {
        Row: {
          activated_at: string | null
          activated_by_staff_id: string | null
          checklist: Json
          created_at: string
          id: string
          patient_id: string
          status: string
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          activated_by_staff_id?: string | null
          checklist?: Json
          created_at?: string
          id?: string
          patient_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          activated_by_staff_id?: string | null
          checklist?: Json
          created_at?: string
          id?: string
          patient_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_setup_tasks_activated_by_staff_id_fkey"
            columns: ["activated_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_setup_tasks_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: true
            referencedRelation: "patients"
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
          first_name: string
          health_fund: Json | null
          id: string
          last_name: string
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
          first_name?: string
          health_fund?: Json | null
          id: string
          last_name?: string
          medicare_number?: string | null
          name?: string
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
          first_name?: string
          health_fund?: Json | null
          id?: string
          last_name?: string
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
          archived_at: string | null
          archived_by: string | null
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
          surgery_day_text: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
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
          surgery_day_text?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
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
          surgery_day_text?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "procedure_templates_archived_by_fkey"
            columns: ["archived_by"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
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
      report_schedules: {
        Row: {
          enabled: boolean
          include_identifiers: boolean
          parameters: Json
          report_type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          enabled?: boolean
          include_identifiers?: boolean
          parameters?: Json
          report_type: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          enabled?: boolean
          include_identifiers?: boolean
          parameters?: Json
          report_type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_schedules_updated_by_fkey"
            columns: ["updated_by"]
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
      staff_analytics_layout: {
        Row: {
          card_order: string[]
          staff_id: string
          updated_at: string
        }
        Insert: {
          card_order: string[]
          staff_id: string
          updated_at?: string
        }
        Update: {
          card_order?: string[]
          staff_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_analytics_layout_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: true
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
      staff_notification_prefs: {
        Row: {
          daily_digest_email: boolean
          notify_new_message: boolean
          notify_orange_flag: boolean
          notify_yellow_flag: boolean
          quiet_hours: boolean
          staff_id: string
          updated_at: string
        }
        Insert: {
          daily_digest_email?: boolean
          notify_new_message?: boolean
          notify_orange_flag?: boolean
          notify_yellow_flag?: boolean
          quiet_hours?: boolean
          staff_id: string
          updated_at?: string
        }
        Update: {
          daily_digest_email?: boolean
          notify_new_message?: boolean
          notify_orange_flag?: boolean
          notify_yellow_flag?: boolean
          quiet_hours?: boolean
          staff_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_notification_prefs_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: true
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_users: {
        Row: {
          access_tier: number
          bonus_pack_unlocked: boolean
          created_at: string
          dark_mode: boolean
          email: string
          id: string
          mfa_secret: string | null
          name: string
          role: Database["public"]["Enums"]["staff_role"]
          sparkle: boolean
          text_size: string
          theme: string
          updated_at: string
        }
        Insert: {
          access_tier?: number
          bonus_pack_unlocked?: boolean
          created_at?: string
          dark_mode?: boolean
          email: string
          id: string
          mfa_secret?: string | null
          name: string
          role: Database["public"]["Enums"]["staff_role"]
          sparkle?: boolean
          text_size?: string
          theme?: string
          updated_at?: string
        }
        Update: {
          access_tier?: number
          bonus_pack_unlocked?: boolean
          created_at?: string
          dark_mode?: boolean
          email?: string
          id?: string
          mfa_secret?: string | null
          name?: string
          role?: Database["public"]["Enums"]["staff_role"]
          sparkle?: boolean
          text_size?: string
          theme?: string
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
      user_preferences: {
        Row: {
          bonus_pack_unlocked: boolean
          created_at: string
          dark_mode: boolean
          high_contrast: boolean
          language: string
          notify_checkin: boolean
          notify_medication: boolean
          notify_messages: boolean
          onboarding_completed_at: string | null
          patient_id: string
          reduce_motion: boolean
          sparkle: boolean
          text_size: string
          theme: string
          updated_at: string
        }
        Insert: {
          bonus_pack_unlocked?: boolean
          created_at?: string
          dark_mode?: boolean
          high_contrast?: boolean
          language?: string
          notify_checkin?: boolean
          notify_medication?: boolean
          notify_messages?: boolean
          onboarding_completed_at?: string | null
          patient_id: string
          reduce_motion?: boolean
          sparkle?: boolean
          text_size?: string
          theme?: string
          updated_at?: string
        }
        Update: {
          bonus_pack_unlocked?: boolean
          created_at?: string
          dark_mode?: boolean
          high_contrast?: boolean
          language?: string
          notify_checkin?: boolean
          notify_medication?: boolean
          notify_messages?: boolean
          onboarding_completed_at?: string | null
          patient_id?: string
          reduce_motion?: boolean
          sparkle?: boolean
          text_size?: string
          theme?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: true
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
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
          expected_symptoms: string[] | null
          headline: string | null
          id: string
          instructions: string | null
          message: string | null
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
          expected_symptoms?: string[] | null
          headline?: string | null
          id?: string
          instructions?: string | null
          message?: string | null
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
          expected_symptoms?: string[] | null
          headline?: string | null
          id?: string
          instructions?: string | null
          message?: string | null
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
      mv_analytics_check_in_daily: {
        Row: {
          check_in_count: number | null
          day: string | null
          patient_zone: Database["public"]["Enums"]["patient_zone"] | null
          procedure_type: string | null
          staff_alert_level:
            | Database["public"]["Enums"]["staff_alert_level"]
            | null
          surgeon_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "procedures_surgeon_id_fkey"
            columns: ["surgeon_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
        ]
      }
      mv_analytics_checkin_completion: {
        Row: {
          expected_count: number | null
          recovery_day: number | null
          submitted_count: number | null
        }
        Relationships: []
      }
      mv_analytics_dose_daily: {
        Row: {
          day: string | null
          scheduled_count: number | null
          surgeon_id: string | null
          taken_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "procedures_surgeon_id_fkey"
            columns: ["surgeon_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
        ]
      }
      mv_analytics_message_response: {
        Row: {
          day: string | null
          response_seconds: number | null
        }
        Relationships: []
      }
      mv_analytics_onboarding: {
        Row: {
          created_day: string | null
          status: string | null
        }
        Relationships: []
      }
      mv_analytics_symptom_daily: {
        Row: {
          day: string | null
          occurrences: number | null
          symptom: string | null
        }
        Relationships: []
      }
      public_zone_content: {
        Row: {
          expected_symptoms: string[] | null
          headline: string | null
          id: string | null
          instructions: string | null
          message: string | null
          procedure_type: string | null
          surgeon_id: string | null
          today_tip: string | null
          warning: string | null
          zone: Database["public"]["Enums"]["patient_zone"] | null
        }
        Insert: {
          expected_symptoms?: string[] | null
          headline?: string | null
          id?: string | null
          instructions?: string | null
          message?: string | null
          procedure_type?: string | null
          surgeon_id?: string | null
          today_tip?: string | null
          warning?: string | null
          zone?: Database["public"]["Enums"]["patient_zone"] | null
        }
        Update: {
          expected_symptoms?: string[] | null
          headline?: string | null
          id?: string | null
          instructions?: string | null
          message?: string | null
          procedure_type?: string | null
          surgeon_id?: string | null
          today_tip?: string | null
          warning?: string | null
          zone?: Database["public"]["Enums"]["patient_zone"] | null
        }
        Relationships: [
          {
            foreignKeyName: "zone_content_surgeon_id_fkey"
            columns: ["surgeon_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      bulk_push_cohort: {
        Args: { p_filter: Json }
        Returns: {
          patient_id: string
          recovery_day: number
        }[]
      }
      create_patient_auth_user: {
        Args: { p_email: string; p_password: string }
        Returns: string
      }
      create_staff_user: {
        Args: {
          p_name: string
          p_role: Database["public"]["Enums"]["staff_role"]
        }
        Returns: {
          access_tier: number
          bonus_pack_unlocked: boolean
          created_at: string
          dark_mode: boolean
          email: string
          id: string
          mfa_secret: string | null
          name: string
          role: Database["public"]["Enums"]["staff_role"]
          sparkle: boolean
          text_size: string
          theme: string
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
      fire_bulk_push: { Args: { p_push_id: string }; Returns: undefined }
      fire_due_bulk_pushes: { Args: never; Returns: undefined }
      generate_scheduled_reports: { Args: never; Returns: undefined }
      is_staff: { Args: never; Returns: boolean }
      mark_thread_read: { Args: { p_thread_id: string }; Returns: undefined }
      prune_old_reports: { Args: never; Returns: undefined }
      record_patient_audit: {
        Args: { p_event_type: string; p_new_value: Json }
        Returns: undefined
      }
      record_patient_audit_event: {
        Args: {
          p_entity_id?: string
          p_entity_type: string
          p_event_type: string
          p_new_value: Json
        }
        Returns: undefined
      }
      refresh_analytics: { Args: never; Returns: undefined }
      send_bulk_push_now: { Args: { p_push_id: string }; Returns: undefined }
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
