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
      beauty_products: {
        Row: {
          brand: string | null
          created_at: string
          id: string
          image_url: string
          ingredients: string[] | null
          name: string | null
          notes: string | null
          product_type: string | null
          routine_step: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          brand?: string | null
          created_at?: string
          id?: string
          image_url: string
          ingredients?: string[] | null
          name?: string | null
          notes?: string | null
          product_type?: string | null
          routine_step?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          brand?: string | null
          created_at?: string
          id?: string
          image_url?: string
          ingredients?: string[] | null
          name?: string | null
          notes?: string | null
          product_type?: string | null
          routine_step?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      beauty_products_catalog: {
        Row: {
          brand: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          price: string | null
          product_link: string | null
          rating: number | null
          reviews: number | null
          search_query: string | null
          standardized_category: string
          store: string | null
        }
        Insert: {
          brand?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          price?: string | null
          product_link?: string | null
          rating?: number | null
          reviews?: number | null
          search_query?: string | null
          standardized_category?: string
          store?: string | null
        }
        Update: {
          brand?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          price?: string | null
          product_link?: string | null
          rating?: number | null
          reviews?: number | null
          search_query?: string | null
          standardized_category?: string
          store?: string | null
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          suggested_garment_ids: string[] | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role?: string
          suggested_garment_ids?: string[] | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          suggested_garment_ids?: string[] | null
          user_id?: string
        }
        Relationships: []
      }
      closet_items: {
        Row: {
          brand: string | null
          category: string | null
          color: string | null
          created_at: string
          id: string
          image_url: string
          is_in_laundry: boolean
          material: string | null
          name: string | null
          notes: string | null
          storage_zone_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          brand?: string | null
          category?: string | null
          color?: string | null
          created_at?: string
          id?: string
          image_url: string
          is_in_laundry?: boolean
          material?: string | null
          name?: string | null
          notes?: string | null
          storage_zone_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          brand?: string | null
          category?: string | null
          color?: string | null
          created_at?: string
          id?: string
          image_url?: string
          is_in_laundry?: boolean
          material?: string | null
          name?: string | null
          notes?: string | null
          storage_zone_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      dream_items: {
        Row: {
          brand: string | null
          catalog_item_id: string | null
          created_at: string
          garments_json: Json | null
          id: string
          image_url: string
          item_type: string
          name: string | null
          price: number | null
          user_id: string
        }
        Insert: {
          brand?: string | null
          catalog_item_id?: string | null
          created_at?: string
          garments_json?: Json | null
          id?: string
          image_url: string
          item_type?: string
          name?: string | null
          price?: number | null
          user_id: string
        }
        Update: {
          brand?: string | null
          catalog_item_id?: string | null
          created_at?: string
          garments_json?: Json | null
          id?: string
          image_url?: string
          item_type?: string
          name?: string | null
          price?: number | null
          user_id?: string
        }
        Relationships: []
      }
      feed_posts: {
        Row: {
          created_at: string
          description: string
          id: string
          image_url: string
          outfit_breakdown: Json | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          image_url: string
          outfit_breakdown?: Json | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          image_url?: string
          outfit_breakdown?: Json | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      generated_looks_cache: {
        Row: {
          created_at: string
          id: string
          image_path: string
          input_hash: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_path: string
          input_hash: string
        }
        Update: {
          created_at?: string
          id?: string
          image_path?: string
          input_hash?: string
        }
        Relationships: []
      }
      likes: {
        Row: {
          created_at: string
          id: string
          look_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          look_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          look_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "likes_look_id_fkey"
            columns: ["look_id"]
            isOneToOne: false
            referencedRelation: "looks"
            referencedColumns: ["id"]
          },
        ]
      }
      lookbook_outfits: {
        Row: {
          created_at: string
          garment_ids: string[]
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          garment_ids: string[]
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          garment_ids?: string[]
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      looks: {
        Row: {
          body_shape: string | null
          created_at: string
          garment_ids: string[] | null
          id: string
          image_path: string
          is_featured: boolean | null
          is_public: boolean | null
          likes_count: number | null
          occasion: string | null
          reported: boolean | null
          user_id: string
        }
        Insert: {
          body_shape?: string | null
          created_at?: string
          garment_ids?: string[] | null
          id?: string
          image_path: string
          is_featured?: boolean | null
          is_public?: boolean | null
          likes_count?: number | null
          occasion?: string | null
          reported?: boolean | null
          user_id: string
        }
        Update: {
          body_shape?: string | null
          created_at?: string
          garment_ids?: string[] | null
          id?: string
          image_path?: string
          is_featured?: boolean | null
          is_public?: boolean | null
          likes_count?: number | null
          occasion?: string | null
          reported?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "looks_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      outfit_calendar: {
        Row: {
          created_at: string
          date: string
          garment_ids: string[] | null
          id: string
          notes: string | null
          occasion: string | null
          status: string
          updated_at: string
          user_id: string
          weather_label: string | null
          weather_temp: number | null
        }
        Insert: {
          created_at?: string
          date: string
          garment_ids?: string[] | null
          id?: string
          notes?: string | null
          occasion?: string | null
          status?: string
          updated_at?: string
          user_id: string
          weather_label?: string | null
          weather_temp?: number | null
        }
        Update: {
          created_at?: string
          date?: string
          garment_ids?: string[] | null
          id?: string
          notes?: string | null
          occasion?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          weather_label?: string | null
          weather_temp?: number | null
        }
        Relationships: []
      }
      planned_outfits: {
        Row: {
          created_at: string
          id: string
          lookbook_id: string
          planned_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lookbook_id: string
          planned_date: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lookbook_id?: string
          planned_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planned_outfits_lookbook_id_fkey"
            columns: ["lookbook_id"]
            isOneToOne: false
            referencedRelation: "lookbook_outfits"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          app_theme: string
          avatar_url: string | null
          biometric_consent: boolean
          body_shape: string | null
          closet_svg: string | null
          created_at: string
          date_of_birth: string | null
          display_name: string | null
          generations_used: number
          height_cm: number | null
          id: string
          onboarding_complete: boolean
          selfie_url: string | null
          sex: string | null
          subscription_tier: string
          updated_at: string
          user_id: string
          username: string | null
          weight_kg: number | null
        }
        Insert: {
          app_theme?: string
          avatar_url?: string | null
          biometric_consent?: boolean
          body_shape?: string | null
          closet_svg?: string | null
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          generations_used?: number
          height_cm?: number | null
          id?: string
          onboarding_complete?: boolean
          selfie_url?: string | null
          sex?: string | null
          subscription_tier?: string
          updated_at?: string
          user_id: string
          username?: string | null
          weight_kg?: number | null
        }
        Update: {
          app_theme?: string
          avatar_url?: string | null
          biometric_consent?: boolean
          body_shape?: string | null
          closet_svg?: string | null
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          generations_used?: number
          height_cm?: number | null
          id?: string
          onboarding_complete?: boolean
          selfie_url?: string | null
          sex?: string | null
          subscription_tier?: string
          updated_at?: string
          user_id?: string
          username?: string | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          id: string
          look_id: string | null
          reason: string | null
          reporter_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          look_id?: string | null
          reason?: string | null
          reporter_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          look_id?: string | null
          reason?: string | null
          reporter_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_look_id_fkey"
            columns: ["look_id"]
            isOneToOne: false
            referencedRelation: "looks"
            referencedColumns: ["id"]
          },
        ]
      }
      trending_clothes: {
        Row: {
          brand: string | null
          category: string | null
          created_at: string
          id: string
          image_url: string | null
          price: string | null
          product_link: string | null
          title: string
        }
        Insert: {
          brand?: string | null
          category?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          price?: string | null
          product_link?: string | null
          title: string
        }
        Update: {
          brand?: string | null
          category?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          price?: string | null
          product_link?: string | null
          title?: string
        }
        Relationships: []
      }
      user_feedback: {
        Row: {
          created_at: string
          id: string
          message: string
          status: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          status?: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          status?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
