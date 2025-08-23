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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          branch_id: string | null
          check_in_location: string | null
          check_in_photo_url: string | null
          check_in_time: string | null
          check_out_location: string | null
          check_out_photo_url: string | null
          check_out_time: string | null
          created_at: string | null
          id: string
          rider_id: string | null
          status: string | null
          work_date: string | null
        }
        Insert: {
          branch_id?: string | null
          check_in_location?: string | null
          check_in_photo_url?: string | null
          check_in_time?: string | null
          check_out_location?: string | null
          check_out_photo_url?: string | null
          check_out_time?: string | null
          created_at?: string | null
          id?: string
          rider_id?: string | null
          status?: string | null
          work_date?: string | null
        }
        Update: {
          branch_id?: string | null
          check_in_location?: string | null
          check_in_photo_url?: string | null
          check_in_time?: string | null
          check_out_location?: string | null
          check_out_photo_url?: string | null
          check_out_time?: string | null
          created_at?: string | null
          id?: string
          rider_id?: string | null
          status?: string | null
          work_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string | null
          branch_type: string | null
          code: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          manager_id: string | null
          name: string
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          branch_type?: string | null
          code: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          manager_id?: string | null
          name: string
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          branch_type?: string | null
          code?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          manager_id?: string | null
          name?: string
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      checkpoints: {
        Row: {
          address_info: string | null
          branch_id: string
          checkpoint_name: string | null
          created_at: string
          id: string
          latitude: number
          longitude: number
          notes: string | null
          rider_id: string
        }
        Insert: {
          address_info?: string | null
          branch_id: string
          checkpoint_name?: string | null
          created_at?: string
          id?: string
          latitude: number
          longitude: number
          notes?: string | null
          rider_id: string
        }
        Update: {
          address_info?: string | null
          branch_id?: string
          checkpoint_name?: string | null
          created_at?: string
          id?: string
          latitude?: number
          longitude?: number
          notes?: string | null
          rider_id?: string
        }
        Relationships: []
      }
      customer_loyalty: {
        Row: {
          created_at: string | null
          customer_id: string | null
          id: string
          points_balance: number | null
          tier: string | null
          total_earned_points: number | null
          total_redeemed_points: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          id?: string
          points_balance?: number | null
          tier?: string | null
          total_earned_points?: number | null
          total_redeemed_points?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          id?: string
          points_balance?: number | null
          tier?: string | null
          total_earned_points?: number | null
          total_redeemed_points?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_loyalty_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_operational_expenses: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          expense_date: string
          expense_type: string
          id: string
          receipt_photo_url: string | null
          rider_id: string
          shift_id: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          description?: string | null
          expense_date?: string
          expense_type: string
          id?: string
          receipt_photo_url?: string | null
          rider_id: string
          shift_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          expense_date?: string
          expense_type?: string
          id?: string
          receipt_photo_url?: string | null
          rider_id?: string
          shift_id?: string | null
        }
        Relationships: []
      }
      daily_reports: {
        Row: {
          branch_id: string | null
          cash_collected: number | null
          created_at: string | null
          end_location: string | null
          id: string
          photos: Json | null
          report_date: string
          rider_id: string | null
          start_location: string | null
          total_sales: number | null
          total_transactions: number | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          branch_id?: string | null
          cash_collected?: number | null
          created_at?: string | null
          end_location?: string | null
          id?: string
          photos?: Json | null
          report_date: string
          rider_id?: string | null
          start_location?: string | null
          total_sales?: number | null
          total_transactions?: number | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          branch_id?: string | null
          cash_collected?: number | null
          created_at?: string | null
          end_location?: string | null
          id?: string
          photos?: Json | null
          report_date?: string
          rider_id?: string | null
          start_location?: string | null
          total_sales?: number | null
          total_transactions?: number | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_reports_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_reports_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_reports_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_transactions: {
        Row: {
          account_type: string
          amount: number
          branch_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          fiscal_period: string | null
          id: string
          reference_number: string | null
          transaction_id: string | null
          transaction_type: string
        }
        Insert: {
          account_type: string
          amount: number
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          fiscal_period?: string | null
          id?: string
          reference_number?: string | null
          transaction_id?: string | null
          transaction_type: string
        }
        Update: {
          account_type?: string
          amount?: number
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          fiscal_period?: string | null
          id?: string
          reference_number?: string | null
          transaction_id?: string | null
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory: {
        Row: {
          branch_id: string | null
          id: string
          last_updated: string | null
          max_stock_level: number | null
          min_stock_level: number | null
          product_id: string | null
          reserved_quantity: number | null
          rider_id: string | null
          stock_quantity: number | null
        }
        Insert: {
          branch_id?: string | null
          id?: string
          last_updated?: string | null
          max_stock_level?: number | null
          min_stock_level?: number | null
          product_id?: string | null
          reserved_quantity?: number | null
          rider_id?: string | null
          stock_quantity?: number | null
        }
        Update: {
          branch_id?: string | null
          id?: string
          last_updated?: string | null
          max_stock_level?: number | null
          min_stock_level?: number | null
          product_id?: string | null
          reserved_quantity?: number | null
          rider_id?: string | null
          stock_quantity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      operational_expenses: {
        Row: {
          amount: number
          branch_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          expense_category: string
          expense_date: string | null
          id: string
          is_recurring: boolean | null
          recurring_frequency: string | null
        }
        Insert: {
          amount: number
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          expense_category: string
          expense_date?: string | null
          id?: string
          is_recurring?: boolean | null
          recurring_frequency?: string | null
        }
        Update: {
          amount?: number
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          expense_category?: string
          expense_date?: string | null
          id?: string
          is_recurring?: boolean | null
          recurring_frequency?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "operational_expenses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string | null
          code: string
          cost_price: number | null
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          price: number
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          code: string
          cost_price?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          price: number
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          code?: string
          cost_price?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          price?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          branch_id: string | null
          created_at: string | null
          full_name: string
          id: string
          is_active: boolean | null
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          full_name: string
          id?: string
          is_active?: boolean | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          full_name?: string
          id?: string
          is_active?: boolean | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      shift_management: {
        Row: {
          branch_id: string
          cash_collected: number | null
          created_at: string | null
          id: string
          report_submitted: boolean | null
          report_verified: boolean | null
          rider_id: string
          shift_date: string
          shift_end_time: string | null
          shift_number: number
          shift_start_time: string | null
          status: string
          total_sales: number | null
          total_transactions: number | null
          updated_at: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          branch_id: string
          cash_collected?: number | null
          created_at?: string | null
          id?: string
          report_submitted?: boolean | null
          report_verified?: boolean | null
          rider_id: string
          shift_date?: string
          shift_end_time?: string | null
          shift_number?: number
          shift_start_time?: string | null
          status?: string
          total_sales?: number | null
          total_transactions?: number | null
          updated_at?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          branch_id?: string
          cash_collected?: number | null
          created_at?: string | null
          id?: string
          report_submitted?: boolean | null
          report_verified?: boolean | null
          rider_id?: string
          shift_date?: string
          shift_end_time?: string | null
          shift_number?: number
          shift_start_time?: string | null
          status?: string
          total_sales?: number | null
          total_transactions?: number | null
          updated_at?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          actual_delivery_date: string | null
          branch_id: string | null
          created_at: string | null
          created_by: string | null
          expected_delivery_date: string | null
          id: string
          movement_type: Database["public"]["Enums"]["stock_movement_type"]
          notes: string | null
          product_id: string | null
          quantity: number
          reference_id: string | null
          reference_type: string | null
          rider_id: string | null
          status: string | null
          verification_photo_url: string | null
        }
        Insert: {
          actual_delivery_date?: string | null
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          expected_delivery_date?: string | null
          id?: string
          movement_type: Database["public"]["Enums"]["stock_movement_type"]
          notes?: string | null
          product_id?: string | null
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
          rider_id?: string | null
          status?: string | null
          verification_photo_url?: string | null
        }
        Update: {
          actual_delivery_date?: string | null
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          expected_delivery_date?: string | null
          id?: string
          movement_type?: Database["public"]["Enums"]["stock_movement_type"]
          notes?: string | null
          product_id?: string | null
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          rider_id?: string | null
          status?: string | null
          verification_photo_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_items: {
        Row: {
          created_at: string | null
          id: string
          product_id: string | null
          quantity: number
          total_price: number
          transaction_id: string | null
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id?: string | null
          quantity: number
          total_price: number
          transaction_id?: string | null
          unit_price: number
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string | null
          quantity?: number
          total_price?: number
          transaction_id?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "transaction_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_items_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          branch_id: string | null
          created_at: string | null
          customer_id: string | null
          discount_amount: number | null
          final_amount: number
          id: string
          notes: string | null
          payment_method: string | null
          payment_proof_url: string | null
          payment_verified: boolean | null
          payment_verified_at: string | null
          payment_verified_by: string | null
          rider_id: string | null
          status: Database["public"]["Enums"]["transaction_status"] | null
          total_amount: number
          transaction_date: string | null
          transaction_number: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          discount_amount?: number | null
          final_amount?: number
          id?: string
          notes?: string | null
          payment_method?: string | null
          payment_proof_url?: string | null
          payment_verified?: boolean | null
          payment_verified_at?: string | null
          payment_verified_by?: string | null
          rider_id?: string | null
          status?: Database["public"]["Enums"]["transaction_status"] | null
          total_amount?: number
          transaction_date?: string | null
          transaction_number: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          discount_amount?: number | null
          final_amount?: number
          id?: string
          notes?: string | null
          payment_method?: string | null
          payment_proof_url?: string | null
          payment_verified?: boolean | null
          payment_verified_at?: string | null
          payment_verified_by?: string | null
          rider_id?: string | null
          status?: Database["public"]["Enums"]["transaction_status"] | null
          total_amount?: number
          transaction_date?: string | null
          transaction_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_receive_stock: {
        Args: { rider_uuid: string }
        Returns: boolean
      }
      check_user_role: {
        Args: {
          check_user_id: string
          required_role: Database["public"]["Enums"]["user_role"]
        }
        Returns: boolean
      }
      get_current_user_branch: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Enums"]["user_role"]
      }
      get_user_profile: {
        Args: Record<PropertyKey, never>
        Returns: {
          branch_id: string | null
          created_at: string | null
          full_name: string
          id: string
          is_active: boolean | null
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string | null
          user_id: string | null
        }
      }
      has_active_shift: {
        Args: { rider_uuid: string }
        Returns: boolean
      }
      has_role: {
        Args: { required_role: Database["public"]["Enums"]["user_role"] }
        Returns: boolean
      }
    }
    Enums: {
      stock_movement_type: "in" | "out" | "transfer" | "adjustment" | "return"
      transaction_status: "pending" | "completed" | "cancelled" | "returned"
      user_role:
        | "ho_admin"
        | "branch_manager"
        | "rider"
        | "finance"
        | "customer"
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
      stock_movement_type: ["in", "out", "transfer", "adjustment", "return"],
      transaction_status: ["pending", "completed", "cancelled", "returned"],
      user_role: ["ho_admin", "branch_manager", "rider", "finance", "customer"],
    },
  },
} as const
