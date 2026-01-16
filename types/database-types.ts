export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1";
  };
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      ai_insights: {
        Row: {
          child_id: string;
          created_at: string;
          id: string;
          insights: string[];
          package_name: string | null;
          period_end: string;
          period_start: string;
          suggested_limit_seconds: number | null;
        };
        Insert: {
          child_id: string;
          created_at?: string;
          id?: string;
          insights?: string[];
          package_name?: string | null;
          period_end: string;
          period_start: string;
          suggested_limit_seconds?: number | null;
        };
        Update: {
          child_id?: string;
          created_at?: string;
          id?: string;
          insights?: string[];
          package_name?: string | null;
          period_end?: string;
          period_start?: string;
          suggested_limit_seconds?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "ai_insights_child_id_fkey";
            columns: ["child_id"];
            isOneToOne: false;
            referencedRelation: "children";
            referencedColumns: ["id"];
          }
        ];
      };
      app_limits: {
        Row: {
          applies_fri: boolean;
          applies_mon: boolean;
          applies_sat: boolean;
          applies_sun: boolean;
          applies_thu: boolean;
          applies_tue: boolean;
          applies_wed: boolean;
          bonus_enabled: boolean;
          bonus_seconds: number;
          bonus_streak_target: number;
          child_id: string;
          created_at: string;
          id: string;
          limit_seconds: number;
          package_name: string;
          updated_at: string;
        };
        Insert: {
          applies_fri?: boolean;
          applies_mon?: boolean;
          applies_sat?: boolean;
          applies_sun?: boolean;
          applies_thu?: boolean;
          applies_tue?: boolean;
          applies_wed?: boolean;
          bonus_enabled?: boolean;
          bonus_seconds?: number;
          bonus_streak_target?: number;
          child_id: string;
          created_at?: string;
          id?: string;
          limit_seconds: number;
          package_name: string;
          updated_at?: string;
        };
        Update: {
          applies_fri?: boolean;
          applies_mon?: boolean;
          applies_sat?: boolean;
          applies_sun?: boolean;
          applies_thu?: boolean;
          applies_tue?: boolean;
          applies_wed?: boolean;
          bonus_enabled?: boolean;
          bonus_seconds?: number;
          bonus_streak_target?: number;
          child_id?: string;
          created_at?: string;
          id?: string;
          limit_seconds?: number;
          package_name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "app_limits_child_id_fkey";
            columns: ["child_id"];
            isOneToOne: false;
            referencedRelation: "children";
            referencedColumns: ["id"];
          }
        ];
      };
      app_access_overrides: {
        Row: {
          id: string;
          child_id: string;
          package_name: string;
          granted_by_parent_id: string;
          granted_at: string;
          expires_at: string;
          duration_minutes: number;
          reason: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          child_id: string;
          package_name: string;
          granted_by_parent_id: string;
          granted_at?: string;
          expires_at: string;
          duration_minutes: number;
          reason?: string | null;
          status: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          child_id?: string;
          package_name?: string;
          granted_by_parent_id?: string;
          granted_at?: string;
          expires_at?: string;
          duration_minutes?: number;
          reason?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "app_access_overrides_child_id_fkey";
            columns: ["child_id"];
            isOneToOne: false;
            referencedRelation: "children";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "app_access_overrides_granted_by_parent_id_fkey";
            columns: ["granted_by_parent_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      override_requests: {
        Row: {
          id: string;
          child_id: string;
          package_name: string;
          app_name: string;
          requested_at: string;
          status: string;
          granted_by_parent_id: string | null;
          responded_at: string | null;
          response_note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          child_id: string;
          package_name: string;
          app_name: string;
          requested_at?: string;
          status: string;
          granted_by_parent_id?: string | null;
          responded_at?: string | null;
          response_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          child_id?: string;
          package_name?: string;
          app_name?: string;
          requested_at?: string;
          status?: string;
          granted_by_parent_id?: string | null;
          responded_at?: string | null;
          response_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "override_requests_child_id_fkey";
            columns: ["child_id"];
            isOneToOne: false;
            referencedRelation: "children";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "override_requests_granted_by_parent_id_fkey";
            columns: ["granted_by_parent_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      app_usage_daily: {
        Row: {
          child_id: string;
          created_at: string;
          device_id: string | null;
          id: string;
          last_synced_at: string;
          open_count: number;
          package_name: string;
          total_seconds: number;
          usage_date: string;
        };
        Insert: {
          child_id: string;
          created_at?: string;
          device_id?: string | null;
          id?: string;
          last_synced_at?: string;
          open_count?: number;
          package_name: string;
          total_seconds?: number;
          usage_date: string;
        };
        Update: {
          child_id?: string;
          created_at?: string;
          device_id?: string | null;
          id?: string;
          last_synced_at?: string;
          open_count?: number;
          package_name?: string;
          total_seconds?: number;
          usage_date?: string;
        };
        Relationships: [
          {
            foreignKeyName: "app_usage_daily_child_id_fkey";
            columns: ["child_id"];
            isOneToOne: false;
            referencedRelation: "children";
            referencedColumns: ["id"];
          }
        ];
      };
      app_usage_hourly: {
        Row: {
          child_id: string;
          created_at: string;
          device_id: string | null;
          hour: number;
          id: string;
          last_synced_at: string;
          package_name: string;
          total_seconds: number;
          usage_date: string;
        };
        Insert: {
          child_id: string;
          created_at?: string;
          device_id?: string | null;
          hour: number;
          id?: string;
          last_synced_at?: string;
          package_name: string;
          total_seconds?: number;
          usage_date: string;
        };
        Update: {
          child_id?: string;
          created_at?: string;
          device_id?: string | null;
          hour?: number;
          id?: string;
          last_synced_at?: string;
          package_name?: string;
          total_seconds?: number;
          usage_date?: string;
        };
        Relationships: [
          {
            foreignKeyName: "app_usage_hourly_child_id_fkey";
            columns: ["child_id"];
            isOneToOne: false;
            referencedRelation: "children";
            referencedColumns: ["id"];
          }
        ];
      };
      child_apps: {
        Row: {
          app_name: string;
          category: Database["public"]["Enums"]["app_category"];
          child_id: string;
          created_at: string;
          icon_path: string | null;
          icon_url: string | null;
          id: string;
          package_name: string;
        };
        Insert: {
          app_name: string;
          category?: Database["public"]["Enums"]["app_category"];
          child_id: string;
          created_at?: string;
          icon_path?: string | null;
          icon_url?: string | null;
          id?: string;
          package_name: string;
        };
        Update: {
          app_name?: string;
          category?: Database["public"]["Enums"]["app_category"];
          child_id?: string;
          created_at?: string;
          icon_path?: string | null;
          icon_url?: string | null;
          id?: string;
          package_name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "child_apps_child_id_fkey";
            columns: ["child_id"];
            isOneToOne: false;
            referencedRelation: "children";
            referencedColumns: ["id"];
          }
        ];
      };
      child_devices: {
        Row: {
          child_id: string;
          device_id: string;
          first_seen_at: string;
          id: string;
          is_active: boolean;
          last_seen_at: string | null;
          model: string | null;
          os_version: string | null;
          platform: string;
        };
        Insert: {
          child_id: string;
          device_id: string;
          first_seen_at?: string;
          id?: string;
          is_active?: boolean;
          last_seen_at?: string | null;
          model?: string | null;
          os_version?: string | null;
          platform?: string;
        };
        Update: {
          child_id?: string;
          device_id?: string;
          first_seen_at?: string;
          id?: string;
          is_active?: boolean;
          last_seen_at?: string | null;
          model?: string | null;
          os_version?: string | null;
          platform?: string;
        };
        Relationships: [
          {
            foreignKeyName: "child_devices_child_id_fkey";
            columns: ["child_id"];
            isOneToOne: false;
            referencedRelation: "children";
            referencedColumns: ["id"];
          }
        ];
      };
      children: {
        Row: {
          age: number;
          child_email: string;
          child_user_id: string | null;
          created_at: string;
          grade_level: string | null;
          id: string;
          interests: string[];
          motivations: Database["public"]["Enums"]["motivation_type"][];
          name: string;
          parent_user_id: string;
        };
        Insert: {
          age: number;
          child_email: string;
          child_user_id?: string | null;
          created_at?: string;
          grade_level?: string | null;
          id?: string;
          interests?: string[];
          motivations?: Database["public"]["Enums"]["motivation_type"][];
          name: string;
          parent_user_id: string;
        };
        Update: {
          age?: number;
          child_email?: string;
          child_user_id?: string | null;
          created_at?: string;
          grade_level?: string | null;
          id?: string;
          interests?: string[];
          motivations?: Database["public"]["Enums"]["motivation_type"][];
          name?: string;
          parent_user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string | null;
          role: Database["public"]["Enums"]["user_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          display_name?: string | null;
          role: Database["public"]["Enums"]["user_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          display_name?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      app_category:
        | "education"
        | "games"
        | "video"
        | "social"
        | "creativity"
        | "productivity"
        | "communication"
        | "utilities"
        | "other";
      motivation_type:
        | "entertainment_videos"
        | "gaming"
        | "learning_education"
        | "social_communication"
        | "creativity"
        | "habit_boredom"
        | "relaxation_stress_relief"
        | "rewards_achievements"
        | "other";
      user_role: "parent" | "child";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
      DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] &
      DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R;
    }
    ? R
    : never
  : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I;
    }
    ? I
    : never
  : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U;
    }
    ? U
    : never
  : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_category: [
        "education",
        "games",
        "video",
        "social",
        "creativity",
        "productivity",
        "communication",
        "utilities",
        "other",
      ],
      motivation_type: [
        "entertainment_videos",
        "gaming",
        "learning_education",
        "social_communication",
        "creativity",
        "habit_boredom",
        "relaxation_stress_relief",
        "rewards_achievements",
        "other",
      ],
      user_role: ["parent", "child"],
    },
  },
} as const;
