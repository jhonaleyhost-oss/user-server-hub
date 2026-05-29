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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activity_events: {
        Row: {
          actor_name: string | null
          actor_role: string | null
          actor_user_id: string | null
          amount: number | null
          created_at: string
          detail: string | null
          id: string
          kind: string
        }
        Insert: {
          actor_name?: string | null
          actor_role?: string | null
          actor_user_id?: string | null
          amount?: number | null
          created_at?: string
          detail?: string | null
          id?: string
          kind: string
        }
        Update: {
          actor_name?: string | null
          actor_role?: string | null
          actor_user_id?: string | null
          amount?: number | null
          created_at?: string
          detail?: string | null
          id?: string
          kind?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      blocked_devices: {
        Row: {
          archived_at: string
          device_fingerprint: string | null
          id: string
          ip_address: string | null
          original_user_id: string | null
        }
        Insert: {
          archived_at?: string
          device_fingerprint?: string | null
          id?: string
          ip_address?: string | null
          original_user_id?: string | null
        }
        Update: {
          archived_at?: string
          device_fingerprint?: string | null
          id?: string
          ip_address?: string | null
          original_user_id?: string | null
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      feedback: {
        Row: {
          created_at: string
          id: string
          message: string | null
          rating: number
          role: string
          user_id: string
          username: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          rating: number
          role?: string
          user_id: string
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          rating?: number
          role?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      message_reads: {
        Row: {
          message_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          message_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          message_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string | null
          created_at: string
          deleted: boolean
          deleted_by: string | null
          edited_at: string | null
          id: string
          image_url: string | null
          reply_to_id: string | null
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          deleted?: boolean
          deleted_by?: string | null
          edited_at?: string | null
          id?: string
          image_url?: string | null
          reply_to_id?: string | null
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          deleted?: boolean
          deleted_by?: string | null
          edited_at?: string | null
          id?: string
          image_url?: string | null
          reply_to_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      popup_settings: {
        Row: {
          buttons: Json | null
          content: string
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean
          title: string
          updated_at: string
        }
        Insert: {
          buttons?: Json | null
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          title?: string
          updated_at?: string
        }
        Update: {
          buttons?: Json | null
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          device_fingerprint: string | null
          email: string
          full_name: string | null
          id: string
          ip_address: string | null
          panel_creations_count: number
          reseller_expires_at: string | null
          reseller_permanent: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          device_fingerprint?: string | null
          email: string
          full_name?: string | null
          id?: string
          ip_address?: string | null
          panel_creations_count?: number
          reseller_expires_at?: string | null
          reseller_permanent?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          device_fingerprint?: string | null
          email?: string
          full_name?: string | null
          id?: string
          ip_address?: string | null
          panel_creations_count?: number
          reseller_expires_at?: string | null
          reseller_permanent?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pterodactyl_servers: {
        Row: {
          created_at: string
          domain: string
          egg_id: number
          id: string
          is_active: boolean
          location_id: number
          name: string
          nest_id: number
          plta_key: string
          plta_vault_id: string | null
          pltc_key: string
          pltc_vault_id: string | null
          python_egg_id: number
          server_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          domain: string
          egg_id?: number
          id?: string
          is_active?: boolean
          location_id?: number
          name: string
          nest_id?: number
          plta_key: string
          plta_vault_id?: string | null
          pltc_key: string
          pltc_vault_id?: string | null
          python_egg_id?: number
          server_type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          domain?: string
          egg_id?: number
          id?: string
          is_active?: boolean
          location_id?: number
          name?: string
          nest_id?: number
          plta_key?: string
          plta_vault_id?: string | null
          pltc_key?: string
          pltc_vault_id?: string | null
          python_egg_id?: number
          server_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      reseller_orders: {
        Row: {
          amount: number
          created_at: string
          duration_days: number | null
          expires_at: string | null
          id: string
          order_id: string
          paid_at: string | null
          permanent: boolean
          plan: string
          status: string
          user_id: string
          username: string
        }
        Insert: {
          amount: number
          created_at?: string
          duration_days?: number | null
          expires_at?: string | null
          id?: string
          order_id: string
          paid_at?: string | null
          permanent?: boolean
          plan: string
          status?: string
          user_id: string
          username: string
        }
        Update: {
          amount?: number
          created_at?: string
          duration_days?: number | null
          expires_at?: string | null
          id?: string
          order_id?: string
          paid_at?: string | null
          permanent?: boolean
          plan?: string
          status?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          content: string | null
          created_at: string
          edited_at: string | null
          id: string
          image_url: string | null
          read_by_admin: boolean
          read_by_user: boolean
          sender_role: string
          sender_user_id: string | null
          telegram_message_id: number | null
          thread_user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          edited_at?: string | null
          id?: string
          image_url?: string | null
          read_by_admin?: boolean
          read_by_user?: boolean
          sender_role: string
          sender_user_id?: string | null
          telegram_message_id?: number | null
          thread_user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          edited_at?: string | null
          id?: string
          image_url?: string | null
          read_by_admin?: boolean
          read_by_user?: boolean
          sender_role?: string
          sender_user_id?: string | null
          telegram_message_id?: number | null
          thread_user_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      tips: {
        Row: {
          amount: number
          created_at: string
          id: string
          message: string | null
          order_id: string
          role: string
          status: string
          user_id: string
          username: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          message?: string | null
          order_id: string
          role?: string
          status?: string
          user_id: string
          username: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          message?: string | null
          order_id?: string
          role?: string
          status?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      user_activity_logs: {
        Row: {
          action: string
          created_at: string
          detail: string | null
          id: string
          new_value: string | null
          old_value: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          detail?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          detail?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_panels: {
        Row: {
          cpu: number
          created_at: string
          disk: number
          email: string
          id: string
          is_active: boolean
          login_url: string
          password: string
          ptero_server_id: number | null
          ptero_user_id: number | null
          ram: number
          server_id: string
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          cpu: number
          created_at?: string
          disk: number
          email: string
          id?: string
          is_active?: boolean
          login_url: string
          password: string
          ptero_server_id?: number | null
          ptero_user_id?: number | null
          ram: number
          server_id: string
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          cpu?: number
          created_at?: string
          disk?: number
          email?: string
          id?: string
          is_active?: boolean
          login_url?: string
          password?: string
          ptero_server_id?: number | null
          ptero_user_id?: number | null
          ram?: number
          server_id?: string
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_panels_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "active_servers_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_panels_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "pterodactyl_servers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      active_servers_public: {
        Row: {
          domain: string | null
          egg_id: number | null
          id: string | null
          is_active: boolean | null
          location_id: number | null
          name: string | null
          server_type: string | null
        }
        Insert: {
          domain?: string | null
          egg_id?: number | null
          id?: string | null
          is_active?: boolean | null
          location_id?: number | null
          name?: string | null
          server_type?: string | null
        }
        Update: {
          domain?: string | null
          egg_id?: number | null
          id?: string | null
          is_active?: boolean | null
          location_id?: number | null
          name?: string | null
          server_type?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _actor_snapshot: {
        Args: { _user_id: string }
        Returns: {
          name: string
          role: string
        }[]
      }
      activate_reseller: { Args: { _order_id: string }; Returns: Json }
      decrement_panel_count: { Args: { _user_id: string }; Returns: undefined }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_exists: { Args: { _email: string }; Returns: boolean }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_my_reseller_status: {
        Args: never
        Returns: {
          days_left: number
          expires_at: string
          is_reseller: boolean
          permanent: boolean
        }[]
      }
      get_panel_activity: {
        Args: { _limit?: number }
        Returns: {
          avatar_url: string
          cpu: number
          created_at: string
          disk: number
          full_name: string
          id: string
          ram: number
          role: Database["public"]["Enums"]["app_role"]
          server_domain: string
          server_name: string
          user_id: string
          username: string
        }[]
      }
      get_public_users: {
        Args: never
        Returns: {
          avatar_url: string
          created_at: string
          full_name: string
          panel_count: number
          reseller_expires_at: string
          reseller_permanent: boolean
          reseller_plan: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }[]
      }
      get_server_keys: {
        Args: { _server_id: string }
        Returns: {
          plta_key: string
          pltc_key: string
        }[]
      }
      get_signup_activity: {
        Args: { _limit?: number }
        Returns: {
          avatar_url: string
          created_at: string
          full_name: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }[]
      }
      get_support_threads: {
        Args: never
        Returns: {
          avatar_url: string
          email: string
          full_name: string
          last_message: string
          last_message_at: string
          last_sender_role: string
          role: Database["public"]["Enums"]["app_role"]
          thread_user_id: string
          unread_admin: number
        }[]
      }
      get_upgrade_activity: {
        Args: { _limit?: number }
        Returns: {
          amount: number
          avatar_url: string
          created_at: string
          duration_days: number
          expires_at: string
          full_name: string
          id: string
          paid_at: string
          permanent: boolean
          plan: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }[]
      }
      get_user_activity_logs: {
        Args: { _limit?: number }
        Returns: {
          action: string
          avatar_url: string
          created_at: string
          detail: string
          email: string
          full_name: string
          id: string
          new_value: string
          old_value: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }[]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      store_server_keys: {
        Args: { _plta_key: string; _pltc_key: string; _server_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "free" | "premium" | "reseller" | "admin"
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
      app_role: ["free", "premium", "reseller", "admin"],
    },
  },
} as const
