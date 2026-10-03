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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      _cleanup_marker: {
        Row: {
          id: number | null
        }
        Insert: {
          id?: number | null
        }
        Update: {
          id?: number | null
        }
        Relationships: []
      }
      _migration_test: {
        Row: {
          id: number | null
        }
        Insert: {
          id?: number | null
        }
        Update: {
          id?: number | null
        }
        Relationships: []
      }
      _old_auth_users_staging: {
        Row: {
          banned_until: string | null
          created_at: string | null
          email: string | null
          email_confirmed_at: string | null
          id: string
          is_anonymous: boolean | null
          last_sign_in_at: string | null
          phone: string | null
          phone_confirmed_at: string | null
          raw_app_meta_data: Json | null
          raw_user_meta_data: Json | null
          staged_at: string | null
          updated_at: string | null
        }
        Insert: {
          banned_until?: string | null
          created_at?: string | null
          email?: string | null
          email_confirmed_at?: string | null
          id: string
          is_anonymous?: boolean | null
          last_sign_in_at?: string | null
          phone?: string | null
          phone_confirmed_at?: string | null
          raw_app_meta_data?: Json | null
          raw_user_meta_data?: Json | null
          staged_at?: string | null
          updated_at?: string | null
        }
        Update: {
          banned_until?: string | null
          created_at?: string | null
          email?: string | null
          email_confirmed_at?: string | null
          id?: string
          is_anonymous?: boolean | null
          last_sign_in_at?: string | null
          phone?: string | null
          phone_confirmed_at?: string | null
          raw_app_meta_data?: Json | null
          raw_user_meta_data?: Json | null
          staged_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      _test_del2: {
        Row: {
          id: number | null
        }
        Insert: {
          id?: number | null
        }
        Update: {
          id?: number | null
        }
        Relationships: []
      }
      account_watermark_settings: {
        Row: {
          active_kind: string
          active_preset_id: string | null
          active_template_id: string | null
          created_at: string
          layers: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          active_kind?: string
          active_preset_id?: string | null
          active_template_id?: string | null
          created_at?: string
          layers?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          active_kind?: string
          active_preset_id?: string | null
          active_template_id?: string | null
          created_at?: string
          layers?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_watermark_settings_active_template_id_fkey"
            columns: ["active_template_id"]
            isOneToOne: false
            referencedRelation: "watermark_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      achievements: {
        Row: {
          active: boolean
          code: string
          created_at: string
          criteria: Json
          description: string | null
          icon: string | null
          id: string
          sort_order: number
          title: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          criteria?: Json
          description?: string | null
          icon?: string | null
          id?: string
          sort_order?: number
          title: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          criteria?: Json
          description?: string | null
          icon?: string | null
          id?: string
          sort_order?: number
          title?: string
        }
        Relationships: []
      }
      admin_audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          performed_by: string
          target_user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          performed_by: string
          target_user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          performed_by?: string
          target_user_id?: string
        }
        Relationships: []
      }
      ambassador_audit_logs: {
        Row: {
          action: string
          admin_id: string | null
          created_at: string | null
          id: string
          new_values: Json | null
          old_values: Json | null
          referral_id: string | null
        }
        Insert: {
          action: string
          admin_id?: string | null
          created_at?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          referral_id?: string | null
        }
        Update: {
          action?: string
          admin_id?: string | null
          created_at?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          referral_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ambassador_audit_logs_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["id"]
          },
        ]
      }
      ambassador_settings: {
        Row: {
          default_commission_pct: number
          default_duration_months: number
          id: string
          is_active: boolean
          min_payout_amount: number
          payout_cooldown_days: number
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          default_commission_pct?: number
          default_duration_months?: number
          id?: string
          is_active?: boolean
          min_payout_amount?: number
          payout_cooldown_days?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          default_commission_pct?: number
          default_duration_months?: number
          id?: string
          is_active?: boolean
          min_payout_amount?: number
          payout_cooldown_days?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      bib_detection_errors: {
        Row: {
          created_at: string
          error_code: string | null
          error_message: string | null
          event_id: string | null
          id: string
          photo_id: string | null
          pipeline: string
          retry_count: number
          s3_key: string
        }
        Insert: {
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          event_id?: string | null
          id?: string
          photo_id?: string | null
          pipeline?: string
          retry_count?: number
          s3_key: string
        }
        Update: {
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          event_id?: string | null
          id?: string
          photo_id?: string | null
          pipeline?: string
          retry_count?: number
          s3_key?: string
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          category: string | null
          content: string
          created_at: string
          excerpt: string | null
          featured_image: string | null
          id: string
          meta_description: string | null
          meta_title: string | null
          published_at: string | null
          read_minutes: number | null
          slug: string
          status: string
          title: string
          updated_at: string
          views_count: number
        }
        Insert: {
          category?: string | null
          content?: string
          created_at?: string
          excerpt?: string | null
          featured_image?: string | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          published_at?: string | null
          read_minutes?: number | null
          slug: string
          status?: string
          title: string
          updated_at?: string
          views_count?: number
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string
          excerpt?: string | null
          featured_image?: string | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          published_at?: string | null
          read_minutes?: number | null
          slug?: string
          status?: string
          title?: string
          updated_at?: string
          views_count?: number
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          created_at: string
          id: string
          photo_id: string | null
          price: number
          resolution: string | null
          session_id: string
          video_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          photo_id?: string | null
          price?: number
          resolution?: string | null
          session_id: string
          video_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          photo_id?: string | null
          price?: number
          resolution?: string | null
          session_id?: string
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "event_photos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "photo_search_index"
            referencedColumns: ["photo_id"]
          },
          {
            foreignKeyName: "cart_items_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "event_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      cidades: {
        Row: {
          busca: string | null
          created_at: string
          id: number
          latitude: number | null
          longitude: number | null
          nome: string
          nome_completo: string | null
          uf: string
        }
        Insert: {
          busca?: string | null
          created_at?: string
          id: number
          latitude?: number | null
          longitude?: number | null
          nome: string
          nome_completo?: string | null
          uf: string
        }
        Update: {
          busca?: string | null
          created_at?: string
          id?: number
          latitude?: number | null
          longitude?: number | null
          nome?: string
          nome_completo?: string | null
          uf?: string
        }
        Relationships: []
      }
      coletivo_members: {
        Row: {
          coletivo_id: string
          commission_pct: number
          id: string
          invited_at: string
          invited_by: string | null
          joined_at: string | null
          status: Database["public"]["Enums"]["coletivo_member_status"]
          user_id: string
        }
        Insert: {
          coletivo_id: string
          commission_pct?: number
          id?: string
          invited_at?: string
          invited_by?: string | null
          joined_at?: string | null
          status?: Database["public"]["Enums"]["coletivo_member_status"]
          user_id: string
        }
        Update: {
          coletivo_id?: string
          commission_pct?: number
          id?: string
          invited_at?: string
          invited_by?: string | null
          joined_at?: string | null
          status?: Database["public"]["Enums"]["coletivo_member_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coletivo_members_coletivo_id_fkey"
            columns: ["coletivo_id"]
            isOneToOne: false
            referencedRelation: "coletivos"
            referencedColumns: ["id"]
          },
        ]
      }
      coletivos: {
        Row: {
          avatar_url: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          owner_asaas_wallet_id: string | null
          owner_id: string
          slug: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_asaas_wallet_id?: string | null
          owner_id: string
          slug?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_asaas_wallet_id?: string | null
          owner_id?: string
          slug?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      custom_links: {
        Row: {
          created_at: string
          id: string
          label: string
          sort_order: number | null
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          sort_order?: number | null
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          sort_order?: number | null
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      discount_packages: {
        Row: {
          active: boolean
          all_photos_price: number | null
          base_photo_price: number | null
          created_at: string
          discount_pct: number
          display_mode: string
          event_id: string
          id: string
          min_photo_price: number | null
          min_photos: number
          package_type: string
        }
        Insert: {
          active?: boolean
          all_photos_price?: number | null
          base_photo_price?: number | null
          created_at?: string
          discount_pct?: number
          display_mode?: string
          event_id: string
          id?: string
          min_photo_price?: number | null
          min_photos?: number
          package_type?: string
        }
        Update: {
          active?: boolean
          all_photos_price?: number | null
          base_photo_price?: number | null
          created_at?: string
          discount_pct?: number
          display_mode?: string
          event_id?: string
          id?: string
          min_photo_price?: number | null
          min_photos?: number
          package_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "discount_packages_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      eligibility_rules: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      event_access: {
        Row: {
          created_at: string
          event_id: string
          expires_at: string
          id: string
          ip_address: string | null
          session_id: string | null
          token: string
        }
        Insert: {
          created_at?: string
          event_id: string
          expires_at: string
          id?: string
          ip_address?: string | null
          session_id?: string | null
          token: string
        }
        Update: {
          created_at?: string
          event_id?: string
          expires_at?: string
          id?: string
          ip_address?: string | null
          session_id?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_access_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_applications: {
        Row: {
          created_at: string
          event_id: string
          id: string
          message: string | null
          organizer_response: string | null
          photographer_id: string
          responded_at: string | null
          status: Database["public"]["Enums"]["application_status"]
          suggested_fee: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          message?: string | null
          organizer_response?: string | null
          photographer_id: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          suggested_fee?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          message?: string | null
          organizer_response?: string | null
          photographer_id?: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          suggested_fee?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      event_coupons: {
        Row: {
          active: boolean
          code: string
          created_at: string
          discount_type: Database["public"]["Enums"]["discount_type"]
          discount_value: number
          event_id: string
          id: string
          max_uses: number
          uses: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          discount_type?: Database["public"]["Enums"]["discount_type"]
          discount_value?: number
          event_id: string
          id?: string
          max_uses?: number
          uses?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          discount_type?: Database["public"]["Enums"]["discount_type"]
          discount_value?: number
          event_id?: string
          id?: string
          max_uses?: number
          uses?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_coupons_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_face_collections: {
        Row: {
          collection_id: string
          created_at: string
          event_id: string
          faces_indexed: number
          last_indexed_at: string | null
          last_searched_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          collection_id: string
          created_at?: string
          event_id: string
          faces_indexed?: number
          last_indexed_at?: string | null
          last_searched_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          collection_id?: string
          created_at?: string
          event_id?: string
          faces_indexed?: number
          last_indexed_at?: string | null
          last_searched_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      event_indexing_progress: {
        Row: {
          bibs_done: number
          bibs_errors: number
          created_at: string
          event_id: string
          faces_done: number
          faces_errors: number
          last_updated_at: string
          total_photos: number
        }
        Insert: {
          bibs_done?: number
          bibs_errors?: number
          created_at?: string
          event_id: string
          faces_done?: number
          faces_errors?: number
          last_updated_at?: string
          total_photos?: number
        }
        Update: {
          bibs_done?: number
          bibs_errors?: number
          created_at?: string
          event_id?: string
          faces_done?: number
          faces_errors?: number
          last_updated_at?: string
          total_photos?: number
        }
        Relationships: []
      }
      event_participations: {
        Row: {
          attended_at: string
          client_key: string
          client_user_id: string | null
          created_at: string
          event_id: string
          first_order_id: string | null
          id: string
          photographer_id: string
        }
        Insert: {
          attended_at?: string
          client_key: string
          client_user_id?: string | null
          created_at?: string
          event_id: string
          first_order_id?: string | null
          id?: string
          photographer_id: string
        }
        Update: {
          attended_at?: string
          client_key?: string
          client_user_id?: string | null
          created_at?: string
          event_id?: string
          first_order_id?: string | null
          id?: string
          photographer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_participations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_participations_first_order_id_fkey"
            columns: ["first_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      event_partners: {
        Row: {
          commission_pct: number
          created_at: string
          event_id: string
          id: string
          partner_email: string | null
          partner_name: string
          partner_user_id: string | null
          permissions: Json
        }
        Insert: {
          commission_pct?: number
          created_at?: string
          event_id: string
          id?: string
          partner_email?: string | null
          partner_name: string
          partner_user_id?: string | null
          permissions?: Json
        }
        Update: {
          commission_pct?: number
          created_at?: string
          event_id?: string
          id?: string
          partner_email?: string | null
          partner_name?: string
          partner_user_id?: string | null
          permissions?: Json
        }
        Relationships: [
          {
            foreignKeyName: "event_partners_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_passwords: {
        Row: {
          created_at: string
          event_id: string
          password_hash: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          password_hash: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          password_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_passwords_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_photo_faces: {
        Row: {
          bounding_box: Json
          confidence: number
          event_id: string
          external_image_id: string | null
          face_crop_generated_at: string | null
          face_crop_s3_key: string | null
          id: string
          indexed_at: string
          photo_id: string
          pose: Json | null
          quality: Json | null
          rekognition_face_id: string
        }
        Insert: {
          bounding_box: Json
          confidence: number
          event_id: string
          external_image_id?: string | null
          face_crop_generated_at?: string | null
          face_crop_s3_key?: string | null
          id?: string
          indexed_at?: string
          photo_id: string
          pose?: Json | null
          quality?: Json | null
          rekognition_face_id: string
        }
        Update: {
          bounding_box?: Json
          confidence?: number
          event_id?: string
          external_image_id?: string | null
          face_crop_generated_at?: string | null
          face_crop_s3_key?: string | null
          id?: string
          indexed_at?: string
          photo_id?: string
          pose?: Json | null
          quality?: Json | null
          rekognition_face_id?: string
        }
        Relationships: []
      }
      event_photographers: {
        Row: {
          commission_pct: number
          created_at: string
          event_id: string
          id: string
          invited_at: string
          note: string | null
          photographer_id: string
          status: string
        }
        Insert: {
          commission_pct?: number
          created_at?: string
          event_id: string
          id?: string
          invited_at?: string
          note?: string | null
          photographer_id: string
          status?: string
        }
        Update: {
          commission_pct?: number
          created_at?: string
          event_id?: string
          id?: string
          invited_at?: string
          note?: string | null
          photographer_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_photographers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_photos: {
        Row: {
          album: string | null
          bibs_count: number
          bibs_indexed_at: string | null
          created_at: string
          event_id: string
          faces_indexed_at: string | null
          file_hash: string | null
          file_name: string | null
          file_size: number | null
          file_url: string
          id: string
          identified: boolean
          indexing_status: string
          photographer_id: string | null
        }
        Insert: {
          album?: string | null
          bibs_count?: number
          bibs_indexed_at?: string | null
          created_at?: string
          event_id: string
          faces_indexed_at?: string | null
          file_hash?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url: string
          id?: string
          identified?: boolean
          indexing_status?: string
          photographer_id?: string | null
        }
        Update: {
          album?: string | null
          bibs_count?: number
          bibs_indexed_at?: string | null
          created_at?: string
          event_id?: string
          faces_indexed_at?: string | null
          file_hash?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string
          id?: string
          identified?: boolean
          indexing_status?: string
          photographer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_photos_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_registrations: {
        Row: {
          amount_due: number
          birth_date: string | null
          category: string | null
          category_id: string | null
          checked_in_at: string | null
          checkin_status: Database["public"]["Enums"]["registration_checkin_status"]
          city: string | null
          cpf: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          notes: string | null
          payment_proof_url: string | null
          payment_status: Database["public"]["Enums"]["registration_payment_status"]
          phone: string
          price_tier_id: string | null
          qr_token: string
          registration_event_id: string
          senior_discount_applied: boolean
          shirt_size: string | null
          team: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount_due?: number
          birth_date?: string | null
          category?: string | null
          category_id?: string | null
          checked_in_at?: string | null
          checkin_status?: Database["public"]["Enums"]["registration_checkin_status"]
          city?: string | null
          cpf?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          notes?: string | null
          payment_proof_url?: string | null
          payment_status?: Database["public"]["Enums"]["registration_payment_status"]
          phone: string
          price_tier_id?: string | null
          qr_token?: string
          registration_event_id: string
          senior_discount_applied?: boolean
          shirt_size?: string | null
          team?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount_due?: number
          birth_date?: string | null
          category?: string | null
          category_id?: string | null
          checked_in_at?: string | null
          checkin_status?: Database["public"]["Enums"]["registration_checkin_status"]
          city?: string | null
          cpf?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          notes?: string | null
          payment_proof_url?: string | null
          payment_status?: Database["public"]["Enums"]["registration_payment_status"]
          phone?: string
          price_tier_id?: string | null
          qr_token?: string
          registration_event_id?: string
          senior_discount_applied?: boolean
          shirt_size?: string | null
          team?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_registrations_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "registration_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_price_tier_id_fkey"
            columns: ["price_tier_id"]
            isOneToOne: false
            referencedRelation: "registration_price_tiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_registration_event_id_fkey"
            columns: ["registration_event_id"]
            isOneToOne: false
            referencedRelation: "registration_events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_videos: {
        Row: {
          created_at: string
          event_id: string
          file_hash: string | null
          file_name: string | null
          file_size: number | null
          file_url: string
          id: string
          photographer_id: string | null
          visibility: string | null
        }
        Insert: {
          created_at?: string
          event_id: string
          file_hash?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url: string
          id?: string
          photographer_id?: string | null
          visibility?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string
          file_hash?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string
          id?: string
          photographer_id?: string | null
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_videos_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          bib_number_pattern: string
          bib_search_enabled: boolean
          category: string
          coletivo_id: string | null
          coletivo_priority_until: string | null
          collab_note: string | null
          commission_client_share: number
          commission_photographer_share: number
          cover_url: string | null
          created_at: string
          event_date: string
          event_time: string | null
          face_index_mode: string
          face_search_enabled: boolean
          has_password: boolean
          id: string
          location: string
          name: string
          organizer_id: string
          owner_commission_pct: number
          password: string | null
          plan_type: string
          publish_at: string | null
          search_type: string[] | null
          status: Database["public"]["Enums"]["event_status"]
          updated_at: string
          visibility: boolean
        }
        Insert: {
          bib_number_pattern?: string
          bib_search_enabled?: boolean
          category?: string
          coletivo_id?: string | null
          coletivo_priority_until?: string | null
          collab_note?: string | null
          commission_client_share?: number
          commission_photographer_share?: number
          cover_url?: string | null
          created_at?: string
          event_date: string
          event_time?: string | null
          face_index_mode?: string
          face_search_enabled?: boolean
          has_password?: boolean
          id?: string
          location: string
          name: string
          organizer_id: string
          owner_commission_pct?: number
          password?: string | null
          plan_type?: string
          publish_at?: string | null
          search_type?: string[] | null
          status?: Database["public"]["Enums"]["event_status"]
          updated_at?: string
          visibility?: boolean
        }
        Update: {
          bib_number_pattern?: string
          bib_search_enabled?: boolean
          category?: string
          coletivo_id?: string | null
          coletivo_priority_until?: string | null
          collab_note?: string | null
          commission_client_share?: number
          commission_photographer_share?: number
          cover_url?: string | null
          created_at?: string
          event_date?: string
          event_time?: string | null
          face_index_mode?: string
          face_search_enabled?: boolean
          has_password?: boolean
          id?: string
          location?: string
          name?: string
          organizer_id?: string
          owner_commission_pct?: number
          password?: string | null
          plan_type?: string
          publish_at?: string | null
          search_type?: string[] | null
          status?: Database["public"]["Enums"]["event_status"]
          updated_at?: string
          visibility?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "events_coletivo_id_fkey"
            columns: ["coletivo_id"]
            isOneToOne: false
            referencedRelation: "coletivos"
            referencedColumns: ["id"]
          },
        ]
      }
      face_index_jobs: {
        Row: {
          attempts: number
          created_at: string
          enqueued_at: string
          error_code: string | null
          error_message: string | null
          event_id: string
          finished_at: string | null
          id: string
          photo_id: string
          s3_key: string | null
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          enqueued_at?: string
          error_code?: string | null
          error_message?: string | null
          event_id: string
          finished_at?: string | null
          id?: string
          photo_id: string
          s3_key?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          enqueued_at?: string
          error_code?: string | null
          error_message?: string | null
          event_id?: string
          finished_at?: string | null
          id?: string
          photo_id?: string
          s3_key?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      face_search_logs: {
        Row: {
          avg_similarity: number | null
          best_similarity: number | null
          created_at: string
          duration_ms: number | null
          event_id: string
          id: string
          ip_address: string | null
          matches_count: number
          selfie_quality: Json | null
          selfie_s3_key: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          avg_similarity?: number | null
          best_similarity?: number | null
          created_at?: string
          duration_ms?: number | null
          event_id: string
          id?: string
          ip_address?: string | null
          matches_count?: number
          selfie_quality?: Json | null
          selfie_s3_key?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          avg_similarity?: number | null
          best_similarity?: number | null
          created_at?: string
          duration_ms?: number | null
          event_id?: string
          id?: string
          ip_address?: string | null
          matches_count?: number
          selfie_quality?: Json | null
          selfie_s3_key?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      face_search_matches: {
        Row: {
          added_to_cart_at: string | null
          clicked_at: string | null
          created_at: string
          event_id: string
          face_id: string | null
          id: string
          photo_id: string
          purchased_at: string | null
          rank: number
          search_log_id: string
          similarity: number
        }
        Insert: {
          added_to_cart_at?: string | null
          clicked_at?: string | null
          created_at?: string
          event_id: string
          face_id?: string | null
          id?: string
          photo_id: string
          purchased_at?: string | null
          rank: number
          search_log_id: string
          similarity: number
        }
        Update: {
          added_to_cart_at?: string | null
          clicked_at?: string | null
          created_at?: string
          event_id?: string
          face_id?: string | null
          id?: string
          photo_id?: string
          purchased_at?: string | null
          rank?: number
          search_log_id?: string
          similarity?: number
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string
          id: string
          photo_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          photo_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          photo_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "event_photos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "photo_search_index"
            referencedColumns: ["photo_id"]
          },
        ]
      }
      fraud_cases: {
        Row: {
          created_at: string
          decision_note: string | null
          id: string
          reviewed_at: string | null
          reviewer_id: string | null
          score: number
          signals: Json
          status: string
          subject_id: string
          subject_type: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          decision_note?: string | null
          id?: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          score?: number
          signals?: Json
          status?: string
          subject_id: string
          subject_type: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          decision_note?: string | null
          id?: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          score?: number
          signals?: Json
          status?: string
          subject_id?: string
          subject_type?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      fraud_rules: {
        Row: {
          active: boolean
          config: Json
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          weight: number
        }
        Insert: {
          active?: boolean
          config?: Json
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          weight?: number
        }
        Update: {
          active?: boolean
          config?: Json
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          weight?: number
        }
        Relationships: []
      }
      fraud_signals: {
        Row: {
          created_at: string
          details: Json
          id: string
          ip: string | null
          rule_key: string
          subject_id: string | null
          subject_type: string
          user_agent: string | null
          user_id: string | null
          weight: number
        }
        Insert: {
          created_at?: string
          details?: Json
          id?: string
          ip?: string | null
          rule_key: string
          subject_id?: string | null
          subject_type: string
          user_agent?: string | null
          user_id?: string | null
          weight?: number
        }
        Update: {
          created_at?: string
          details?: Json
          id?: string
          ip?: string | null
          rule_key?: string
          subject_id?: string | null
          subject_type?: string
          user_agent?: string | null
          user_id?: string | null
          weight?: number
        }
        Relationships: []
      }
      hero_settings: {
        Row: {
          autoplay: boolean
          created_at: string
          highlight: string
          highlight_color: string
          id: string
          interval_seconds: number
          title: string
          title_color: string
          transition_duration_ms: number
          transition_type: string
          updated_at: string
        }
        Insert: {
          autoplay?: boolean
          created_at?: string
          highlight?: string
          highlight_color?: string
          id?: string
          interval_seconds?: number
          title?: string
          title_color?: string
          transition_duration_ms?: number
          transition_type?: string
          updated_at?: string
        }
        Update: {
          autoplay?: boolean
          created_at?: string
          highlight?: string
          highlight_color?: string
          id?: string
          interval_seconds?: number
          title?: string
          title_color?: string
          transition_duration_ms?: number
          transition_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      hero_slides: {
        Row: {
          active: boolean
          created_at: string
          id: string
          image_path: string
          media_type: string
          poster_path: string | null
          sort_order: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          image_path: string
          media_type?: string
          poster_path?: string | null
          sort_order?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          image_path?: string
          media_type?: string
          poster_path?: string | null
          sort_order?: number
        }
        Relationships: []
      }
      level_rules: {
        Row: {
          benefits: Json
          commission_pct: number
          level: Database["public"]["Enums"]["photographer_level"]
          manual_only: boolean
          match_mode: string
          message: string | null
          min_attended_participations: number
          min_eligible_events: number
          min_eligible_revenue: number
          min_events: number
          min_revenue: number
          min_sales: number
          requires_document: boolean
          requires_profile_complete: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          benefits?: Json
          commission_pct?: number
          level: Database["public"]["Enums"]["photographer_level"]
          manual_only?: boolean
          match_mode?: string
          message?: string | null
          min_attended_participations?: number
          min_eligible_events?: number
          min_eligible_revenue?: number
          min_events?: number
          min_revenue?: number
          min_sales?: number
          requires_document?: boolean
          requires_profile_complete?: boolean
          sort_order: number
          updated_at?: string
        }
        Update: {
          benefits?: Json
          commission_pct?: number
          level?: Database["public"]["Enums"]["photographer_level"]
          manual_only?: boolean
          match_mode?: string
          message?: string | null
          min_attended_participations?: number
          min_eligible_events?: number
          min_eligible_revenue?: number
          min_events?: number
          min_revenue?: number
          min_sales?: number
          requires_document?: boolean
          requires_profile_complete?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      log_cleanup_runs: {
        Row: {
          error: string | null
          finished_at: string | null
          id: string
          results: Json
          started_at: string
        }
        Insert: {
          error?: string | null
          finished_at?: string | null
          id?: string
          results?: Json
          started_at?: string
        }
        Update: {
          error?: string | null
          finished_at?: string | null
          id?: string
          results?: Json
          started_at?: string
        }
        Relationships: []
      }
      logradouros: {
        Row: {
          busca: string | null
          cep: string | null
          cidade_id: number
          created_at: string
          id: number
          latitude: number | null
          localidade: string | null
          longitude: number | null
          nome_completo: string | null
          nome_logradouro: string
          qtd_enderecos: number
          tipo_logradouro: string | null
          titulo_logradouro: string | null
        }
        Insert: {
          busca?: string | null
          cep?: string | null
          cidade_id: number
          created_at?: string
          id?: number
          latitude?: number | null
          localidade?: string | null
          longitude?: number | null
          nome_completo?: string | null
          nome_logradouro: string
          qtd_enderecos?: number
          tipo_logradouro?: string | null
          titulo_logradouro?: string | null
        }
        Update: {
          busca?: string | null
          cep?: string | null
          cidade_id?: number
          created_at?: string
          id?: number
          latitude?: number | null
          localidade?: string | null
          longitude?: number | null
          nome_completo?: string | null
          nome_logradouro?: string
          qtd_enderecos?: number
          tipo_logradouro?: string | null
          titulo_logradouro?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "logradouros_cidade_id_fkey"
            columns: ["cidade_id"]
            isOneToOne: false
            referencedRelation: "cidades"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_automation_settings: {
        Row: {
          auto_approve: boolean
          autopilot_enabled: boolean
          created_at: string
          daily_budget_limit: number | null
          last_scan_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_approve?: boolean
          autopilot_enabled?: boolean
          created_at?: string
          daily_budget_limit?: number | null
          last_scan_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_approve?: boolean
          autopilot_enabled?: boolean
          created_at?: string
          daily_budget_limit?: number | null
          last_scan_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      marketing_consultant_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      marketing_events_log: {
        Row: {
          created_at: string
          event_id: string | null
          event_name: string
          id: string
          payload: Json
          photographer_id: string | null
          referrer: string | null
          session_id: string | null
          user_agent: string | null
          visitor_id: string | null
        }
        Insert: {
          created_at?: string
          event_id?: string | null
          event_name: string
          id?: string
          payload?: Json
          photographer_id?: string | null
          referrer?: string | null
          session_id?: string | null
          user_agent?: string | null
          visitor_id?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string | null
          event_name?: string
          id?: string
          payload?: Json
          photographer_id?: string | null
          referrer?: string | null
          session_id?: string | null
          user_agent?: string | null
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_events_log_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_insights_cache: {
        Row: {
          created_at: string
          expires_at: string
          generated_at: string
          id: string
          insights: Json
          model: string | null
          signature: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          generated_at?: string
          id?: string
          insights: Json
          model?: string | null
          signature: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          generated_at?: string
          id?: string
          insights?: Json
          model?: string | null
          signature?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      marketing_pixels: {
        Row: {
          access_token: string | null
          active: boolean
          created_at: string
          id: string
          label: string | null
          pixel_id: string
          provider: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          active?: boolean
          created_at?: string
          id?: string
          label?: string | null
          pixel_id: string
          provider: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          active?: boolean
          created_at?: string
          id?: string
          label?: string | null
          pixel_id?: string
          provider?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      marketing_suggestions: {
        Row: {
          created_at: string
          description: string | null
          event_id: string | null
          id: string
          kind: string
          payload: Json
          reviewed_at: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_id?: string | null
          id?: string
          kind: string
          payload?: Json
          reviewed_at?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          event_id?: string | null
          id?: string
          kind?: string
          payload?: Json
          reviewed_at?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          photo_id: string | null
          price: number
          resolution: string
          video_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          photo_id?: string | null
          price?: number
          resolution?: string
          video_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          photo_id?: string | null
          price?: number
          resolution?: string
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "event_photos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "photo_search_index"
            referencedColumns: ["photo_id"]
          },
          {
            foreignKeyName: "order_items_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "event_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          amount: number
          asaas_payment_id: string | null
          client_cpf: string | null
          client_email: string
          client_name: string
          created_at: string
          event_id: string
          id: string
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          status: Database["public"]["Enums"]["order_status"]
          tracking_origin: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          asaas_payment_id?: string | null
          client_cpf?: string | null
          client_email: string
          client_name: string
          created_at?: string
          event_id: string
          id?: string
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          status?: Database["public"]["Enums"]["order_status"]
          tracking_origin?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          asaas_payment_id?: string | null
          client_cpf?: string | null
          client_email?: string
          client_name?: string
          created_at?: string
          event_id?: string
          id?: string
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          status?: Database["public"]["Enums"]["order_status"]
          tracking_origin?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_activity_log: {
        Row: {
          active: boolean
          created_at: string
          id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          active: boolean
          created_at?: string
          id?: string
          reason?: string | null
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      partner_applications: {
        Row: {
          accepted_terms_at: string | null
          created_at: string
          id: string
          pix_key: string | null
          pix_key_type: string | null
          requested_at: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accepted_terms_at?: string | null
          created_at?: string
          id?: string
          pix_key?: string | null
          pix_key_type?: string | null
          requested_at?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accepted_terms_at?: string | null
          created_at?: string
          id?: string
          pix_key?: string | null
          pix_key_type?: string | null
          requested_at?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      partner_payouts: {
        Row: {
          amount: number
          created_at: string
          id: string
          notes: string | null
          paid_at: string | null
          pix_key: string
          pix_key_type: string | null
          processed_at: string | null
          requested_at: string
          reviewed_by: string | null
          status: string
          tx_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          pix_key: string
          pix_key_type?: string | null
          processed_at?: string | null
          requested_at?: string
          reviewed_by?: string | null
          status?: string
          tx_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          pix_key?: string
          pix_key_type?: string | null
          processed_at?: string | null
          requested_at?: string
          reviewed_by?: string | null
          status?: string
          tx_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      photo_bib_numbers: {
        Row: {
          bbox: Json
          confidence: number
          detected_at: string
          event_id: string
          id: string
          number: string
          photo_id: string
          raw_text: string
        }
        Insert: {
          bbox?: Json
          confidence: number
          detected_at?: string
          event_id: string
          id?: string
          number: string
          photo_id: string
          raw_text: string
        }
        Update: {
          bbox?: Json
          confidence?: number
          detected_at?: string
          event_id?: string
          id?: string
          number?: string
          photo_id?: string
          raw_text?: string
        }
        Relationships: []
      }
      photographer_achievements: {
        Row: {
          achievement_id: string
          id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          id?: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "photographer_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
        ]
      }
      photographer_levels: {
        Row: {
          attended_participations_count: number
          current_level: Database["public"]["Enums"]["photographer_level"]
          eligible_events_count: number
          eligible_revenue_total: number
          events_count: number
          history: Json
          is_ambassador: boolean
          referrals_count: number
          revenue_total: number
          sales_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          attended_participations_count?: number
          current_level?: Database["public"]["Enums"]["photographer_level"]
          eligible_events_count?: number
          eligible_revenue_total?: number
          events_count?: number
          history?: Json
          is_ambassador?: boolean
          referrals_count?: number
          revenue_total?: number
          sales_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          attended_participations_count?: number
          current_level?: Database["public"]["Enums"]["photographer_level"]
          eligible_events_count?: number
          eligible_revenue_total?: number
          events_count?: number
          history?: Json
          is_ambassador?: boolean
          referrals_count?: number
          revenue_total?: number
          sales_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      photographer_reputation: {
        Row: {
          rating_avg: number | null
          response_rate: number | null
          score: number | null
          total_reviews: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          rating_avg?: number | null
          response_rate?: number | null
          score?: number | null
          total_reviews?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          rating_avg?: number | null
          response_rate?: number | null
          score?: number | null
          total_reviews?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      photographer_sites: {
        Row: {
          ai_bio: string | null
          ai_bio_generated_at: string | null
          ai_bio_signature: string | null
          allow_custom_links: boolean | null
          avatar_url: string | null
          banner_url: string | null
          bio: string | null
          blur_protection_devices: string
          blur_protection_enabled: boolean
          blur_protection_pattern: string
          cnpj: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          display_name: string | null
          facebook: string | null
          id: string
          instagram: string | null
          linkedin: string | null
          primary_color: string | null
          referral_code: string | null
          secondary_color: string | null
          seo_keywords: string | null
          seo_title: string | null
          slug: string | null
          template: string | null
          tiktok: string | null
          twitter: string | null
          updated_at: string
          user_id: string
          watermark_opacity: number | null
          watermark_position: string | null
          watermark_size: number | null
          watermark_url: string | null
          whatsapp: string | null
          youtube: string | null
        }
        Insert: {
          ai_bio?: string | null
          ai_bio_generated_at?: string | null
          ai_bio_signature?: string | null
          allow_custom_links?: boolean | null
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          blur_protection_devices?: string
          blur_protection_enabled?: boolean
          blur_protection_pattern?: string
          cnpj?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          display_name?: string | null
          facebook?: string | null
          id?: string
          instagram?: string | null
          linkedin?: string | null
          primary_color?: string | null
          referral_code?: string | null
          secondary_color?: string | null
          seo_keywords?: string | null
          seo_title?: string | null
          slug?: string | null
          template?: string | null
          tiktok?: string | null
          twitter?: string | null
          updated_at?: string
          user_id: string
          watermark_opacity?: number | null
          watermark_position?: string | null
          watermark_size?: number | null
          watermark_url?: string | null
          whatsapp?: string | null
          youtube?: string | null
        }
        Update: {
          ai_bio?: string | null
          ai_bio_generated_at?: string | null
          ai_bio_signature?: string | null
          allow_custom_links?: boolean | null
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          blur_protection_devices?: string
          blur_protection_enabled?: boolean
          blur_protection_pattern?: string
          cnpj?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          display_name?: string | null
          facebook?: string | null
          id?: string
          instagram?: string | null
          linkedin?: string | null
          primary_color?: string | null
          referral_code?: string | null
          secondary_color?: string | null
          seo_keywords?: string | null
          seo_title?: string | null
          slug?: string | null
          template?: string | null
          tiktok?: string | null
          twitter?: string | null
          updated_at?: string
          user_id?: string
          watermark_opacity?: number | null
          watermark_position?: string | null
          watermark_size?: number | null
          watermark_url?: string | null
          whatsapp?: string | null
          youtube?: string | null
        }
        Relationships: []
      }
      photographer_specialties: {
        Row: {
          events_count: number | null
          id: string
          level: string | null
          photos_sold_count: number | null
          specialty_id: string
          unique_clients_count: number | null
          unlocked_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          events_count?: number | null
          id?: string
          level?: string | null
          photos_sold_count?: number | null
          specialty_id: string
          unique_clients_count?: number | null
          unlocked_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          events_count?: number | null
          id?: string
          level?: string | null
          photos_sold_count?: number | null
          specialty_id?: string
          unique_clients_count?: number | null
          unlocked_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "photographer_specialties_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "specialties"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          user_id?: string
        }
        Relationships: []
      }
      portfolio_photos: {
        Row: {
          category_id: string | null
          created_at: string
          id: string
          image_url: string
          is_featured: boolean
          sort_order: number
          user_id: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          id?: string
          image_url: string
          is_featured?: boolean
          sort_order?: number
          user_id: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          id?: string
          image_url?: string
          is_featured?: boolean
          sort_order?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_photos_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "portfolio_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      price_grids: {
        Row: {
          created_at: string
          event_id: string
          id: string
          name: string
          photo_high_price: number
          photo_low_price: number
          video_price: number
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          name?: string
          photo_high_price?: number
          photo_low_price?: number
          video_price?: number
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          name?: string
          photo_high_price?: number
          photo_low_price?: number
          video_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "price_grids_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          asaas_customer_id: string | null
          asaas_wallet_id: string | null
          avatar_url: string | null
          blocked: boolean
          cpf_cnpj: string | null
          created_at: string
          experience_level: string | null
          full_name: string | null
          full_name_updated_at: string | null
          id: string
          interest: string | null
          last_sign_in_at: string | null
          phone: string | null
          terms_accepted_at: string | null
          terms_version: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          asaas_customer_id?: string | null
          asaas_wallet_id?: string | null
          avatar_url?: string | null
          blocked?: boolean
          cpf_cnpj?: string | null
          created_at?: string
          experience_level?: string | null
          full_name?: string | null
          full_name_updated_at?: string | null
          id?: string
          interest?: string | null
          last_sign_in_at?: string | null
          phone?: string | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          asaas_customer_id?: string | null
          asaas_wallet_id?: string | null
          avatar_url?: string | null
          blocked?: boolean
          cpf_cnpj?: string | null
          created_at?: string
          experience_level?: string | null
          full_name?: string | null
          full_name_updated_at?: string | null
          id?: string
          interest?: string | null
          last_sign_in_at?: string | null
          phone?: string | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      proposal_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          proposal_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          proposal_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          proposal_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_attachments_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_comments: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          proposal_id: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          proposal_id: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          proposal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_comments_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          created_at: string
          created_by: string
          deadline: string | null
          description: string | null
          event_id: string
          fee: number | null
          id: string
          organizer_id: string
          photographer_id: string
          status: Database["public"]["Enums"]["proposal_status"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          deadline?: string | null
          description?: string | null
          event_id: string
          fee?: number | null
          id?: string
          organizer_id: string
          photographer_id: string
          status?: Database["public"]["Enums"]["proposal_status"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          deadline?: string | null
          description?: string | null
          event_id?: string
          fee?: number | null
          id?: string
          organizer_id?: string
          photographer_id?: string
          status?: Database["public"]["Enums"]["proposal_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      referral_earnings: {
        Row: {
          amount: number
          commission_amount: number | null
          commission_pct: number
          created_at: string
          hold_until: string | null
          id: string
          order_id: string | null
          paid_at: string | null
          payout_id: string | null
          referred_id: string
          referrer_id: string
          released_at: string | null
          status: string
        }
        Insert: {
          amount?: number
          commission_amount?: number | null
          commission_pct?: number
          created_at?: string
          hold_until?: string | null
          id?: string
          order_id?: string | null
          paid_at?: string | null
          payout_id?: string | null
          referred_id: string
          referrer_id: string
          released_at?: string | null
          status?: string
        }
        Update: {
          amount?: number
          commission_amount?: number | null
          commission_pct?: number
          created_at?: string
          hold_until?: string | null
          id?: string
          order_id?: string | null
          paid_at?: string | null
          payout_id?: string | null
          referred_id?: string
          referrer_id?: string
          released_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_earnings_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "partner_payouts"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          activated_at: string | null
          code: string
          commission_pct: number | null
          created_at: string
          expires_at: string | null
          id: string
          is_paused: boolean | null
          notes: string | null
          referred_id: string
          referrer_id: string
          starts_at: string | null
          status: string
        }
        Insert: {
          activated_at?: string | null
          code: string
          commission_pct?: number | null
          created_at?: string
          expires_at?: string | null
          id?: string
          is_paused?: boolean | null
          notes?: string | null
          referred_id: string
          referrer_id: string
          starts_at?: string | null
          status?: string
        }
        Update: {
          activated_at?: string | null
          code?: string
          commission_pct?: number | null
          created_at?: string
          expires_at?: string | null
          id?: string
          is_paused?: boolean | null
          notes?: string | null
          referred_id?: string
          referrer_id?: string
          starts_at?: string | null
          status?: string
        }
        Relationships: []
      }
      registration_categories: {
        Row: {
          created_at: string
          id: string
          max_slots: number | null
          name: string
          registration_event_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          max_slots?: number | null
          name: string
          registration_event_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          max_slots?: number | null
          name?: string
          registration_event_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "registration_categories_registration_event_id_fkey"
            columns: ["registration_event_id"]
            isOneToOne: false
            referencedRelation: "registration_events"
            referencedColumns: ["id"]
          },
        ]
      }
      registration_events: {
        Row: {
          categories: Json
          category: string | null
          cover_url: string | null
          created_at: string
          description: string | null
          event_date: string
          event_time: string | null
          id: string
          location: string
          max_slots: number | null
          name: string
          organizer_id: string
          payment_instructions: string | null
          pix_amount: number | null
          pix_key: string | null
          regulation: string | null
          regulation_file_url: string | null
          requires_birth_date: boolean
          requires_city: boolean
          requires_shirt_size: boolean
          senior_discount_enabled: boolean
          senior_discount_min_age: number
          shirt_sizes: Json
          slug: string
          status: Database["public"]["Enums"]["registration_event_status"]
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          categories?: Json
          category?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          event_date: string
          event_time?: string | null
          id?: string
          location: string
          max_slots?: number | null
          name: string
          organizer_id: string
          payment_instructions?: string | null
          pix_amount?: number | null
          pix_key?: string | null
          regulation?: string | null
          regulation_file_url?: string | null
          requires_birth_date?: boolean
          requires_city?: boolean
          requires_shirt_size?: boolean
          senior_discount_enabled?: boolean
          senior_discount_min_age?: number
          shirt_sizes?: Json
          slug: string
          status?: Database["public"]["Enums"]["registration_event_status"]
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          categories?: Json
          category?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          event_date?: string
          event_time?: string | null
          id?: string
          location?: string
          max_slots?: number | null
          name?: string
          organizer_id?: string
          payment_instructions?: string | null
          pix_amount?: number | null
          pix_key?: string | null
          regulation?: string | null
          regulation_file_url?: string | null
          requires_birth_date?: boolean
          requires_city?: boolean
          requires_shirt_size?: boolean
          senior_discount_enabled?: boolean
          senior_discount_min_age?: number
          shirt_sizes?: Json
          slug?: string
          status?: Database["public"]["Enums"]["registration_event_status"]
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      registration_price_tiers: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          name: string
          price: number
          registration_event_id: string
          sort_order: number
          starts_at: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          name: string
          price?: number
          registration_event_id: string
          sort_order?: number
          starts_at: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          name?: string
          price?: number
          registration_event_id?: string
          sort_order?: number
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "registration_price_tiers_registration_event_id_fkey"
            columns: ["registration_event_id"]
            isOneToOne: false
            referencedRelation: "registration_events"
            referencedColumns: ["id"]
          },
        ]
      }
      registration_shirt_stock: {
        Row: {
          created_at: string
          id: string
          quantity: number
          registration_event_id: string
          size: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          quantity?: number
          registration_event_id: string
          size: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          quantity?: number
          registration_event_id?: string
          size?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "registration_shirt_stock_registration_event_id_fkey"
            columns: ["registration_event_id"]
            isOneToOne: false
            referencedRelation: "registration_events"
            referencedColumns: ["id"]
          },
        ]
      }
      search_events: {
        Row: {
          created_at: string
          event_id: string | null
          event_type: Database["public"]["Enums"]["search_event_type"]
          has_results: boolean | null
          id: string
          metadata: Json
          order_id: string | null
          photo_id: string | null
          results_count: number | null
          search_kind: Database["public"]["Enums"]["search_kind"] | null
          session_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_id?: string | null
          event_type: Database["public"]["Enums"]["search_event_type"]
          has_results?: boolean | null
          id?: string
          metadata?: Json
          order_id?: string | null
          photo_id?: string | null
          results_count?: number | null
          search_kind?: Database["public"]["Enums"]["search_kind"] | null
          session_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string | null
          event_type?: Database["public"]["Enums"]["search_event_type"]
          has_results?: boolean | null
          id?: string
          metadata?: Json
          order_id?: string | null
          photo_id?: string | null
          results_count?: number | null
          search_kind?: Database["public"]["Enums"]["search_kind"] | null
          session_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "search_events_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      specialties: {
        Row: {
          code: string
          created_at: string | null
          icon: string
          id: string
          min_events: number
          min_photos_sold: number
          min_unique_clients: number
          sort_order: number | null
          title: string
        }
        Insert: {
          code: string
          created_at?: string | null
          icon: string
          id?: string
          min_events?: number
          min_photos_sold?: number
          min_unique_clients?: number
          sort_order?: number | null
          title: string
        }
        Update: {
          code?: string
          created_at?: string | null
          icon?: string
          id?: string
          min_events?: number
          min_photos_sold?: number
          min_unique_clients?: number
          sort_order?: number | null
          title?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          admin_response: string | null
          assigned_photographer_id: string | null
          attachment_url: string | null
          category: string
          created_at: string
          escalate_after: string | null
          escalated_at: string | null
          event_id: string | null
          id: string
          message: string
          photo_id: string | null
          photo_url: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          subject: string
          updated_at: string
          user_email: string
          user_id: string
          user_name: string | null
        }
        Insert: {
          admin_response?: string | null
          assigned_photographer_id?: string | null
          attachment_url?: string | null
          category: string
          created_at?: string
          escalate_after?: string | null
          escalated_at?: string | null
          event_id?: string | null
          id?: string
          message: string
          photo_id?: string | null
          photo_url?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_email: string
          user_id: string
          user_name?: string | null
        }
        Update: {
          admin_response?: string | null
          assigned_photographer_id?: string | null
          attachment_url?: string | null
          category?: string
          created_at?: string
          escalate_after?: string | null
          escalated_at?: string | null
          event_id?: string | null
          id?: string
          message?: string
          photo_id?: string | null
          photo_url?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_email?: string
          user_id?: string
          user_name?: string | null
        }
        Relationships: []
      }
      sync_state: {
        Row: {
          last_error: string | null
          last_rows_synced: number | null
          last_run_at: string | null
          last_synced_at: string
          table_name: string
          updated_at: string
        }
        Insert: {
          last_error?: string | null
          last_rows_synced?: number | null
          last_run_at?: string | null
          last_synced_at?: string
          table_name: string
          updated_at?: string
        }
        Update: {
          last_error?: string | null
          last_rows_synced?: number | null
          last_run_at?: string | null
          last_synced_at?: string
          table_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      two_factor_codes: {
        Row: {
          action: string
          attempts: number
          blocked_until: string | null
          code: string
          created_at: string
          expires_at: string
          id: string
          ip_address: string | null
          used: boolean
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          attempts?: number
          blocked_until?: string | null
          code: string
          created_at?: string
          expires_at?: string
          id?: string
          ip_address?: string | null
          used?: boolean
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          attempts?: number
          blocked_until?: string | null
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          ip_address?: string | null
          used?: boolean
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      watermark_configs: {
        Row: {
          created_at: string
          event_id: string
          id: string
          layers: Json
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          layers?: Json
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          layers?: Json
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "watermark_configs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      watermark_templates: {
        Row: {
          created_at: string
          id: string
          layers: Json
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          layers?: Json
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          layers?: Json
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      withdrawal_accounts: {
        Row: {
          account_holder: string | null
          account_number: string | null
          account_type: string
          account_type_bank: string | null
          activated_at: string | null
          agency: string | null
          bank_code: string | null
          bank_name: string | null
          cpf_cnpj: string
          created_at: string
          id: string
          label: string | null
          pix_key: string | null
          pix_key_type: string | null
          status: string
          user_id: string
        }
        Insert: {
          account_holder?: string | null
          account_number?: string | null
          account_type?: string
          account_type_bank?: string | null
          activated_at?: string | null
          agency?: string | null
          bank_code?: string | null
          bank_name?: string | null
          cpf_cnpj: string
          created_at?: string
          id?: string
          label?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          status?: string
          user_id: string
        }
        Update: {
          account_holder?: string | null
          account_number?: string | null
          account_type?: string
          account_type_bank?: string | null
          activated_at?: string | null
          agency?: string | null
          bank_code?: string | null
          bank_name?: string | null
          cpf_cnpj?: string
          created_at?: string
          id?: string
          label?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      withdrawal_logs: {
        Row: {
          account_id: string | null
          amount: number
          asaas_transfer_id: string | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          ip_address: string | null
          status: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          asaas_transfer_id?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          ip_address?: string | null
          status?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          asaas_transfer_id?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          ip_address?: string | null
          status?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_logs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "withdrawal_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawal_notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          metadata: Json | null
          notification_type: string
          read: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          metadata?: Json | null
          notification_type: string
          read?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          metadata?: Json | null
          notification_type?: string
          read?: boolean
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      photo_search_index: {
        Row: {
          bib_count: number | null
          bib_numbers: string[] | null
          event_id: string | null
          face_count: number | null
          face_ids: string[] | null
          photo_created_at: string | null
          photo_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_photos_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      photographer_sites_public: {
        Row: {
          ai_bio: string | null
          ai_bio_generated_at: string | null
          allow_custom_links: boolean | null
          avatar_url: string | null
          banner_url: string | null
          bio: string | null
          blur_protection_devices: string | null
          blur_protection_enabled: boolean | null
          blur_protection_pattern: string | null
          created_at: string | null
          display_name: string | null
          facebook: string | null
          id: string | null
          instagram: string | null
          linkedin: string | null
          primary_color: string | null
          secondary_color: string | null
          seo_keywords: string | null
          seo_title: string | null
          slug: string | null
          template: string | null
          tiktok: string | null
          twitter: string | null
          updated_at: string | null
          user_id: string | null
          watermark_opacity: number | null
          watermark_position: string | null
          watermark_size: number | null
          watermark_url: string | null
          whatsapp: string | null
          youtube: string | null
        }
        Insert: {
          ai_bio?: string | null
          ai_bio_generated_at?: string | null
          allow_custom_links?: boolean | null
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          blur_protection_devices?: string | null
          blur_protection_enabled?: boolean | null
          blur_protection_pattern?: string | null
          created_at?: string | null
          display_name?: string | null
          facebook?: string | null
          id?: string | null
          instagram?: string | null
          linkedin?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          seo_keywords?: string | null
          seo_title?: string | null
          slug?: string | null
          template?: string | null
          tiktok?: string | null
          twitter?: string | null
          updated_at?: string | null
          user_id?: string | null
          watermark_opacity?: number | null
          watermark_position?: string | null
          watermark_size?: number | null
          watermark_url?: string | null
          whatsapp?: string | null
          youtube?: string | null
        }
        Update: {
          ai_bio?: string | null
          ai_bio_generated_at?: string | null
          allow_custom_links?: boolean | null
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          blur_protection_devices?: string | null
          blur_protection_enabled?: boolean | null
          blur_protection_pattern?: string | null
          created_at?: string | null
          display_name?: string | null
          facebook?: string | null
          id?: string | null
          instagram?: string | null
          linkedin?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          seo_keywords?: string | null
          seo_title?: string | null
          slug?: string | null
          template?: string | null
          tiktok?: string | null
          twitter?: string | null
          updated_at?: string | null
          user_id?: string | null
          watermark_opacity?: number | null
          watermark_position?: string | null
          watermark_size?: number | null
          watermark_url?: string | null
          whatsapp?: string | null
          youtube?: string | null
        }
        Relationships: []
      }
      profiles_public: {
        Row: {
          avatar_url: string | null
          full_name: string | null
          id: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          full_name?: string | null
          id?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          full_name?: string | null
          id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _test_del_fn: { Args: never; Returns: undefined }
      buscar_cidades: {
        Args: { limite?: number; termo: string }
        Returns: {
          id: number
          latitude: number
          longitude: number
          nome: string
          nome_completo: string
          similaridade: number
          uf: string
        }[]
      }
      buscar_enderecos: {
        Args: { cidade_id_param: number; limite?: number; termo: string }
        Returns: {
          cep: string
          cidade_id: number
          id: number
          latitude: number
          localidade: string
          longitude: number
          nome_completo: string
          similaridade: number
        }[]
      }
      claim_face_index_jobs: {
        Args: { _batch_size?: number; _event_id: string }
        Returns: {
          job_id: string
          photo_id: string
          s3_key: string
        }[]
      }
      cleanup_old_logs: { Args: never; Returns: Json }
      enqueue_event_backfill: {
        Args: { _event_id: string; _force?: boolean }
        Returns: {
          enqueued: number
        }[]
      }
      ensure_face_collection: {
        Args: { _event_id: string }
        Returns: {
          collection_id: string
          created: boolean
        }[]
      }
      ensure_referral_code: { Args: { _user_id: string }; Returns: string }
      f_unaccent: { Args: { "": string }; Returns: string }
      fraud_decide_case: {
        Args: { _case_id: string; _decision: string; _note?: string }
        Returns: undefined
      }
      fraud_register_signal: {
        Args: {
          _details?: Json
          _ip?: string
          _rule_key: string
          _subject_id: string
          _subject_type: string
          _ua?: string
          _user_id: string
        }
        Returns: string
      }
      get_referral_active_commission: {
        Args: { _referral_id: string }
        Returns: number
      }
      get_registration_availability: {
        Args: { _event_id: string }
        Returns: {
          category: string
          category_id: string
          shirt_size: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hash_event_password: { Args: { _password: string }; Returns: string }
      increment_blog_views: { Args: { _slug: string }; Returns: undefined }
      infra_metrics_snapshot: { Args: never; Returns: Json }
      is_event_eligible: { Args: { _event_id: string }; Returns: boolean }
      is_event_organizer: { Args: { _event_id: string }; Returns: boolean }
      is_event_photographer: { Args: { _event_id: string }; Returns: boolean }
      is_partner_active: { Args: { _user_id: string }; Returns: boolean }
      is_partner_approved: { Args: { _user_id: string }; Returns: boolean }
      is_proposal_party: { Args: { _proposal_id: string }; Returns: boolean }
      is_registration_event_organizer: {
        Args: { _event_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: never; Returns: boolean }
      mark_face_index_done: {
        Args: { _faces_count: number; _job_id: string }
        Returns: undefined
      }
      mark_face_index_error: {
        Args: {
          _error_code: string
          _error_message: string
          _job_id: string
          _permanent?: boolean
        }
        Returns: undefined
      }
      publish_scheduled_events: { Args: never; Returns: number }
      recalc_photographer_level: { Args: { _user_id: string }; Returns: string }
      refresh_photo_search_index: { Args: never; Returns: undefined }
      release_due_referral_earnings: { Args: never; Returns: number }
      set_ambassador: {
        Args: { _enabled: boolean; _user_id: string }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      unaccent: { Args: { "": string }; Returns: string }
      verify_event_password: {
        Args: { _event_id: string; _password: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "user" | "photographer" | "organizer" | "super_admin"
      application_status: "pendente" | "aceita" | "rejeitada" | "cancelada"
      coletivo_member_status: "convidado" | "ativo" | "removido"
      discount_type: "percentual" | "valor_fixo"
      event_status: "ativo" | "em_breve" | "inativo" | "agendado"
      order_status: "aguardando_pagamento" | "pago" | "enviado" | "cancelado"
      payment_method: "pix" | "cartao"
      photographer_level:
        | "bronze"
        | "prata"
        | "ouro"
        | "diamante"
        | "embaixador"
      proposal_status:
        | "rascunho"
        | "enviada"
        | "em_negociacao"
        | "aceita"
        | "rejeitada"
        | "encerrada"
      registration_checkin_status: "ausente" | "presente"
      registration_event_status:
        | "rascunho"
        | "aberto"
        | "encerrado"
        | "cancelado"
      registration_payment_status: "pendente" | "pago" | "cancelado"
      search_event_type:
        | "search_performed"
        | "photo_viewed"
        | "add_to_cart"
        | "checkout_started"
        | "purchase_completed"
      search_kind: "facial" | "bib" | "album" | "none"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["user", "photographer", "organizer", "super_admin"],
      application_status: ["pendente", "aceita", "rejeitada", "cancelada"],
      coletivo_member_status: ["convidado", "ativo", "removido"],
      discount_type: ["percentual", "valor_fixo"],
      event_status: ["ativo", "em_breve", "inativo", "agendado"],
      order_status: ["aguardando_pagamento", "pago", "enviado", "cancelado"],
      payment_method: ["pix", "cartao"],
      photographer_level: ["bronze", "prata", "ouro", "diamante", "embaixador"],
      proposal_status: [
        "rascunho",
        "enviada",
        "em_negociacao",
        "aceita",
        "rejeitada",
        "encerrada",
      ],
      registration_checkin_status: ["ausente", "presente"],
      registration_event_status: [
        "rascunho",
        "aberto",
        "encerrado",
        "cancelado",
      ],
      registration_payment_status: ["pendente", "pago", "cancelado"],
      search_event_type: [
        "search_performed",
        "photo_viewed",
        "add_to_cart",
        "checkout_started",
        "purchase_completed",
      ],
      search_kind: ["facial", "bib", "album", "none"],
    },
  },
} as const
