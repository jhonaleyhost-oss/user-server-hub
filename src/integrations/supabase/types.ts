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
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          reply_to_id: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          reply_to_id?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
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
          plta_key: string
          plta_vault_id: string | null
          pltc_key: string
          pltc_vault_id: string | null
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
          plta_key: string
          plta_vault_id?: string | null
          pltc_key: string
          pltc_vault_id?: string | null
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
          plta_key?: string
          plta_vault_id?: string | null
          pltc_key?: string
          pltc_vault_id?: string | null
          server_type?: string
          updated_at?: string
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
      public_profiles: {
        Row: {
          avatar_url: string | null
          full_name: string | null
          role: Database["public"]["Enums"]["app_role"] | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      decrement_panel_count: { Args: { _user_id: string }; Returns: undefined }
      get_public_users: {
        Args: never
        Returns: {
          avatar_url: string
          created_at: string
          full_name: string
          panel_count: number
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
