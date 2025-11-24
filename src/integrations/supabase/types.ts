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
      branch_hub_report_assignments: {
        Row: {
          created_at: string
          id: string
          rider_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          rider_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          rider_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "branch_hub_report_assignments_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_hub_report_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string | null
          branch_code: string | null
          branch_type: string | null
          code: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          latitude: number | null
          level: number | null
          longitude: number | null
          manager_id: string | null
          name: string
          parent_branch_id: string | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          branch_code?: string | null
          branch_type?: string | null
          code: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          level?: number | null
          longitude?: number | null
          manager_id?: string | null
          name: string
          parent_branch_id?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          branch_code?: string | null
          branch_type?: string | null
          code?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          level?: number | null
          longitude?: number | null
          manager_id?: string | null
          name?: string
          parent_branch_id?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branches_parent_branch_id_fkey"
            columns: ["parent_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
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
      customer_order_items: {
        Row: {
          created_at: string
          custom_options: Json | null
          id: string
          order_id: string
          price: number
          product_id: string
          quantity: number
        }
        Insert: {
          created_at?: string
          custom_options?: Json | null
          id?: string
          order_id: string
          price: number
          product_id: string
          quantity?: number
        }
        Update: {
          created_at?: string
          custom_options?: Json | null
          id?: string
          order_id?: string
          price?: number
          product_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "customer_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_orders: {
        Row: {
          created_at: string
          delivery_address: string | null
          delivery_fee: number | null
          discount_amount: number | null
          estimated_arrival: string | null
          id: string
          latitude: number | null
          longitude: number | null
          order_type: string | null
          outlet_id: string | null
          payment_method: string | null
          qris_payment_proof_url: string | null
          rejection_reason: string | null
          rider_id: string | null
          rider_profile_id: string | null
          status: string
          total_price: number
          updated_at: string
          user_id: string
          voucher_id: string | null
        }
        Insert: {
          created_at?: string
          delivery_address?: string | null
          delivery_fee?: number | null
          discount_amount?: number | null
          estimated_arrival?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          order_type?: string | null
          outlet_id?: string | null
          payment_method?: string | null
          qris_payment_proof_url?: string | null
          rejection_reason?: string | null
          rider_id?: string | null
          rider_profile_id?: string | null
          status?: string
          total_price?: number
          updated_at?: string
          user_id: string
          voucher_id?: string | null
        }
        Update: {
          created_at?: string
          delivery_address?: string | null
          delivery_fee?: number | null
          discount_amount?: number | null
          estimated_arrival?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          order_type?: string | null
          outlet_id?: string | null
          payment_method?: string | null
          qris_payment_proof_url?: string | null
          rejection_reason?: string | null
          rider_id?: string | null
          rider_profile_id?: string | null
          status?: string
          total_price?: number
          updated_at?: string
          user_id?: string
          voucher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_orders_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_orders_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "customer_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_orders_rider_profile_id_fkey"
            columns: ["rider_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "customer_users"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_points_history: {
        Row: {
          change: number
          created_at: string
          description: string
          id: string
          order_id: string | null
          user_id: string
        }
        Insert: {
          change: number
          created_at?: string
          description: string
          id?: string
          order_id?: string | null
          user_id: string
        }
        Update: {
          change?: number
          created_at?: string
          description?: string
          id?: string
          order_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_points_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_points_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "customer_users"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_user_vouchers: {
        Row: {
          claimed_at: string
          id: string
          is_used: boolean | null
          used_at: string | null
          user_id: string
          voucher_id: string
        }
        Insert: {
          claimed_at?: string
          id?: string
          is_used?: boolean | null
          used_at?: string | null
          user_id: string
          voucher_id: string
        }
        Update: {
          claimed_at?: string
          id?: string
          is_used?: boolean | null
          used_at?: string | null
          user_id?: string
          voucher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_user_vouchers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "customer_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_user_vouchers_voucher_id_fkey"
            columns: ["voucher_id"]
            isOneToOne: false
            referencedRelation: "customer_vouchers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_users: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          is_online: boolean | null
          latitude: number | null
          longitude: number | null
          name: string
          phone: string | null
          photo_url: string | null
          points: number
          role: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_online?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name: string
          phone?: string | null
          photo_url?: string | null
          points?: number
          role?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_online?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          phone?: string | null
          photo_url?: string | null
          points?: number
          role?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      customer_vouchers: {
        Row: {
          code: string
          created_at: string
          description: string
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean | null
          min_order: number | null
          valid_from: string
          valid_until: string
        }
        Insert: {
          code: string
          created_at?: string
          description: string
          discount_type?: string
          discount_value: number
          id?: string
          is_active?: boolean | null
          min_order?: number | null
          valid_from: string
          valid_until: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean | null
          min_order?: number | null
          valid_from?: string
          valid_until?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          branch_id: string | null
          created_at: string
          id: string
          is_active: boolean | null
          name: string
          phone: string | null
          rider_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          branch_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
          phone?: string | null
          rider_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          branch_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
          phone?: string | null
          rider_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
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
          shift_id: string | null
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
          shift_id?: string | null
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
          shift_id?: string | null
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
            foreignKeyName: "daily_reports_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shift_management"
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
      loyalty_rewards: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          points_required: number
          reward_name: string
          reward_type: string
          reward_value: Json | null
          stock_quantity: number | null
          updated_at: string | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          points_required: number
          reward_name: string
          reward_type: string
          reward_value?: Json | null
          stock_quantity?: number | null
          updated_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          points_required?: number
          reward_name?: string
          reward_type?: string
          reward_value?: Json | null
          stock_quantity?: number | null
          updated_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      loyalty_tiers: {
        Row: {
          benefits: Json | null
          created_at: string | null
          discount_percentage: number | null
          id: string
          min_points: number
          tier_color: string | null
          tier_name: string
          updated_at: string | null
        }
        Insert: {
          benefits?: Json | null
          created_at?: string | null
          discount_percentage?: number | null
          id?: string
          min_points: number
          tier_color?: string | null
          tier_name: string
          updated_at?: string | null
        }
        Update: {
          benefits?: Json | null
          created_at?: string | null
          discount_percentage?: number | null
          id?: string
          min_points?: number
          tier_color?: string | null
          tier_name?: string
          updated_at?: string | null
        }
        Relationships: []
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
      order_status_history: {
        Row: {
          created_at: string | null
          id: string
          latitude: number | null
          longitude: number | null
          notes: string | null
          order_id: string
          status: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          order_id: string
          status: string
        }
        Update: {
          created_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          order_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "customer_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      product_price_history: {
        Row: {
          changed_at: string
          changed_by: string
          field_name: string
          id: string
          new_value: number
          notes: string | null
          old_value: number
          product_id: string
        }
        Insert: {
          changed_at?: string
          changed_by: string
          field_name: string
          id?: string
          new_value: number
          notes?: string | null
          old_value: number
          product_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string
          field_name?: string
          id?: string
          new_value?: number
          notes?: string | null
          old_value?: number
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_price_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_waste: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string | null
          hpp: number
          id: string
          notes: string | null
          product_id: string
          quantity: number
          rider_id: string
          total_waste: number | null
          waste_reason: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by?: string | null
          hpp?: number
          id?: string
          notes?: string | null
          product_id: string
          quantity: number
          rider_id: string
          total_waste?: number | null
          waste_reason: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string | null
          hpp?: number
          id?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          rider_id?: string
          total_waste?: number | null
          waste_reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_waste_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_waste_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_waste_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_waste_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      production_batches: {
        Row: {
          batch_number: number
          branch_id: string
          created_at: string
          created_by: string
          id: string
          produced_at: string
        }
        Insert: {
          batch_number: number
          branch_id: string
          created_at?: string
          created_by: string
          id?: string
          produced_at?: string
        }
        Update: {
          batch_number?: number
          branch_id?: string
          created_at?: string
          created_by?: string
          id?: string
          produced_at?: string
        }
        Relationships: []
      }
      production_items: {
        Row: {
          batch_id: string
          cost_per_unit: number | null
          created_at: string
          id: string
          product_id: string
          quantity: number
          total_cost: number | null
        }
        Insert: {
          batch_id: string
          cost_per_unit?: number | null
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          total_cost?: number | null
        }
        Update: {
          batch_id?: string
          cost_per_unit?: number | null
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          total_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "production_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "production_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string | null
          ck_price: number | null
          code: string
          cost_price: number | null
          created_at: string | null
          custom_options: Json | null
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
          ck_price?: number | null
          code: string
          cost_price?: number | null
          created_at?: string | null
          custom_options?: Json | null
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
          ck_price?: number | null
          code?: string
          cost_price?: number | null
          created_at?: string | null
          custom_options?: Json | null
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
          app_access_type: Database["public"]["Enums"]["app_access_type"] | null
          branch_id: string | null
          created_at: string | null
          full_name: string
          id: string
          is_active: boolean | null
          last_known_lat: number | null
          last_known_lng: number | null
          location_updated_at: string | null
          phone: string | null
          photo_url: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          app_access_type?:
            | Database["public"]["Enums"]["app_access_type"]
            | null
          branch_id?: string | null
          created_at?: string | null
          full_name: string
          id?: string
          is_active?: boolean | null
          last_known_lat?: number | null
          last_known_lng?: number | null
          location_updated_at?: string | null
          phone?: string | null
          photo_url?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          app_access_type?:
            | Database["public"]["Enums"]["app_access_type"]
            | null
          branch_id?: string | null
          created_at?: string | null
          full_name?: string
          id?: string
          is_active?: boolean | null
          last_known_lat?: number | null
          last_known_lng?: number | null
          location_updated_at?: string | null
          phone?: string | null
          photo_url?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_profiles_branch_id"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_banners: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          display_order: number | null
          id: string
          image_url: string
          is_active: boolean | null
          link_url: string | null
          title: string
          updated_at: string | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          image_url: string
          is_active?: boolean | null
          link_url?: string | null
          title: string
          updated_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string
          is_active?: boolean | null
          link_url?: string | null
          title?: string
          updated_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "promo_banners_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_items: {
        Row: {
          cost_per_unit: number
          created_at: string
          id: string
          product_id: string
          purchase_id: string
          quantity: number
          total_cost: number
        }
        Insert: {
          cost_per_unit?: number
          created_at?: string
          id?: string
          product_id: string
          purchase_id: string
          quantity?: number
          total_cost?: number
        }
        Update: {
          cost_per_unit?: number
          created_at?: string
          id?: string
          product_id?: string
          purchase_id?: string
          quantity?: number
          total_cost?: number
        }
        Relationships: []
      }
      purchases: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          purchase_date: string
          purchase_number: string
          status: string
          supplier_name: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          purchase_date?: string
          purchase_number: string
          status?: string
          supplier_name: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          purchase_date?: string
          purchase_number?: string
          status?: string
          supplier_name?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      rider_locations: {
        Row: {
          accuracy: number | null
          heading: number | null
          id: string
          latitude: number
          longitude: number
          rider_id: string
          speed: number | null
          updated_at: string
        }
        Insert: {
          accuracy?: number | null
          heading?: number | null
          id?: string
          latitude: number
          longitude: number
          rider_id: string
          speed?: number | null
          updated_at?: string
        }
        Update: {
          accuracy?: number | null
          heading?: number | null
          id?: string
          latitude?: number
          longitude?: number
          rider_id?: string
          speed?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rider_locations_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_management: {
        Row: {
          branch_id: string
          cash_collected: number | null
          created_at: string | null
          id: string
          notes: string | null
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
          notes?: string | null
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
          notes?: string | null
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
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      stock_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_type: string
          branch_id: string | null
          created_at: string | null
          current_qty: number
          id: string
          is_acknowledged: boolean | null
          message: string
          product_id: string
          resolved_at: string | null
          rider_id: string | null
          severity: string
          threshold_qty: number | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type: string
          branch_id?: string | null
          created_at?: string | null
          current_qty: number
          id?: string
          is_acknowledged?: boolean | null
          message: string
          product_id: string
          resolved_at?: string | null
          rider_id?: string | null
          severity?: string
          threshold_qty?: number | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type?: string
          branch_id?: string | null
          created_at?: string | null
          current_qty?: number
          id?: string
          is_acknowledged?: boolean | null
          message?: string
          product_id?: string
          resolved_at?: string | null
          rider_id?: string | null
          severity?: string
          threshold_qty?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_alerts_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_alerts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_alerts_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          actual_delivery_date: string | null
          approved_at: string | null
          approved_by: string | null
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
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          requires_approval: boolean | null
          rider_id: string | null
          status: string | null
          verification_photo_url: string | null
        }
        Insert: {
          actual_delivery_date?: string | null
          approved_at?: string | null
          approved_by?: string | null
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
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          requires_approval?: boolean | null
          rider_id?: string | null
          status?: string | null
          verification_photo_url?: string | null
        }
        Update: {
          actual_delivery_date?: string | null
          approved_at?: string | null
          approved_by?: string | null
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
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          requires_approval?: boolean | null
          rider_id?: string | null
          status?: string | null
          verification_photo_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "stock_movements_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      stock_opname: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          branch_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          notes: string | null
          opname_date: string
          opname_number: string
          rejected_reason: string | null
          rider_id: string | null
          status: string
          submitted_at: string | null
          total_items: number | null
          total_variance_qty: number | null
          total_variance_value: number | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          opname_date?: string
          opname_number: string
          rejected_reason?: string | null
          rider_id?: string | null
          status?: string
          submitted_at?: string | null
          total_items?: number | null
          total_variance_qty?: number | null
          total_variance_value?: number | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          opname_date?: string
          opname_number?: string
          rejected_reason?: string | null
          rider_id?: string | null
          status?: string
          submitted_at?: string | null
          total_items?: number | null
          total_variance_qty?: number | null
          total_variance_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_opname_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_opname_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_opname_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_opname_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_opname_items: {
        Row: {
          actual_qty: number
          created_at: string | null
          id: string
          notes: string | null
          opname_id: string
          product_id: string
          system_qty: number
          unit_cost: number | null
          variance_qty: number | null
          variance_value: number | null
        }
        Insert: {
          actual_qty?: number
          created_at?: string | null
          id?: string
          notes?: string | null
          opname_id: string
          product_id: string
          system_qty?: number
          unit_cost?: number | null
          variance_qty?: number | null
          variance_value?: number | null
        }
        Update: {
          actual_qty?: number
          created_at?: string | null
          id?: string
          notes?: string | null
          opname_id?: string
          product_id?: string
          system_qty?: number
          unit_cost?: number | null
          variance_qty?: number | null
          variance_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_opname_items_opname_id_fkey"
            columns: ["opname_id"]
            isOneToOne: false
            referencedRelation: "stock_opname"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_opname_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_reservations: {
        Row: {
          branch_id: string | null
          cancelled_at: string | null
          created_at: string | null
          expires_at: string | null
          fulfilled_at: string | null
          id: string
          product_id: string
          quantity: number
          reference_id: string
          reference_type: string
          rider_id: string | null
          status: string
        }
        Insert: {
          branch_id?: string | null
          cancelled_at?: string | null
          created_at?: string | null
          expires_at?: string | null
          fulfilled_at?: string | null
          id?: string
          product_id: string
          quantity: number
          reference_id: string
          reference_type: string
          rider_id?: string | null
          status?: string
        }
        Update: {
          branch_id?: string | null
          cancelled_at?: string | null
          created_at?: string | null
          expires_at?: string | null
          fulfilled_at?: string | null
          id?: string
          product_id?: string
          quantity?: number
          reference_id?: string
          reference_type?: string
          rider_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_reservations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reservations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reservations_rider_id_fkey"
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
      transaction_void_requests: {
        Row: {
          branch_id: string
          created_at: string | null
          id: string
          reason: string
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_notes: string | null
          rider_id: string
          status: string
          transaction_id: string
          updated_at: string | null
        }
        Insert: {
          branch_id: string
          created_at?: string | null
          id?: string
          reason: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          rider_id: string
          status?: string
          transaction_id: string
          updated_at?: string | null
        }
        Update: {
          branch_id?: string
          created_at?: string | null
          id?: string
          reason?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          rider_id?: string
          status?: string
          transaction_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transaction_void_requests_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_void_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_void_requests_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_void_requests_transaction_id_fkey"
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
          external_id: string | null
          final_amount: number
          id: string
          is_voided: boolean | null
          location_name: string | null
          metadata: Json | null
          notes: string | null
          payment_method: string | null
          payment_proof_url: string | null
          payment_status: string | null
          payment_verified: boolean | null
          payment_verified_at: string | null
          payment_verified_by: string | null
          rider_id: string | null
          source_id: string | null
          source_type: string | null
          status: Database["public"]["Enums"]["transaction_status"] | null
          total_amount: number
          transaction_date: string | null
          transaction_latitude: number | null
          transaction_longitude: number | null
          transaction_number: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
          xendit_invoice_id: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          discount_amount?: number | null
          external_id?: string | null
          final_amount?: number
          id?: string
          is_voided?: boolean | null
          location_name?: string | null
          metadata?: Json | null
          notes?: string | null
          payment_method?: string | null
          payment_proof_url?: string | null
          payment_status?: string | null
          payment_verified?: boolean | null
          payment_verified_at?: string | null
          payment_verified_by?: string | null
          rider_id?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: Database["public"]["Enums"]["transaction_status"] | null
          total_amount?: number
          transaction_date?: string | null
          transaction_latitude?: number | null
          transaction_longitude?: number | null
          transaction_number: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
          xendit_invoice_id?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          discount_amount?: number | null
          external_id?: string | null
          final_amount?: number
          id?: string
          is_voided?: boolean | null
          location_name?: string | null
          metadata?: Json | null
          notes?: string | null
          payment_method?: string | null
          payment_proof_url?: string | null
          payment_status?: string | null
          payment_verified?: boolean | null
          payment_verified_at?: string | null
          payment_verified_by?: string | null
          rider_id?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: Database["public"]["Enums"]["transaction_status"] | null
          total_amount?: number
          transaction_date?: string | null
          transaction_latitude?: number | null
          transaction_longitude?: number | null
          transaction_number?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
          xendit_invoice_id?: string | null
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
          {
            foreignKeyName: "transactions_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_module_permissions: {
        Row: {
          created_at: string | null
          id: string
          is_granted: boolean | null
          module_name: string
          permission_type: string
          resource_filter: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_granted?: boolean | null
          module_name: string
          permission_type: string
          resource_filter?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_granted?: boolean | null
          module_name?: string
          permission_type?: string
          resource_filter?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_module_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_role_permissions: {
        Row: {
          created_at: string
          id: string
          is_granted: boolean
          module_name: string
          permission: Database["public"]["Enums"]["permission_type"]
          role_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_granted?: boolean
          module_name: string
          permission: Database["public"]["Enums"]["permission_type"]
          role_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_granted?: boolean
          module_name?: string
          permission?: Database["public"]["Enums"]["permission_type"]
          role_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_specific_permissions: {
        Row: {
          created_at: string | null
          id: string
          module_name: string
          permission: string
          resource_filter: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          module_name: string
          permission: string
          resource_filter?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          module_name?: string
          permission?: string
          resource_filter?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_specific_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
      v_active_stock_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_type: string | null
          branch_id: string | null
          branch_name: string | null
          created_at: string | null
          current_qty: number | null
          id: string | null
          is_acknowledged: boolean | null
          message: string | null
          product_id: string | null
          product_name: string | null
          resolved_at: string | null
          rider_id: string | null
          rider_name: string | null
          severity: string | null
          threshold_qty: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_alerts_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_alerts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_alerts_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v_pending_approvals: {
        Row: {
          branch_name: string | null
          created_at: string | null
          created_by: string | null
          created_by_name: string | null
          id: string | null
          movement_type:
            | Database["public"]["Enums"]["stock_movement_type"]
            | null
          notes: string | null
          product_name: string | null
          quantity: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      acknowledge_stock_alert: {
        Args: { alert_uuid: string; user_uuid: string }
        Returns: boolean
      }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      approve_stock_adjustment: {
        Args: { approver_uuid: string; movement_uuid: string }
        Returns: boolean
      }
      approve_stock_opname: {
        Args: { approver_uuid: string; opname_uuid: string }
        Returns: boolean
      }
      can_manage_role: {
        Args: {
          manager_role: Database["public"]["Enums"]["user_role"]
          target_role: Database["public"]["Enums"]["user_role"]
        }
        Returns: boolean
      }
      can_receive_stock: { Args: { rider_uuid: string }; Returns: boolean }
      can_rider_view_customer: {
        Args: { customer_user_uuid: string }
        Returns: boolean
      }
      check_adjustment_approval_required: {
        Args: {
          movement_qty: number
          movement_type_param: Database["public"]["Enums"]["stock_movement_type"]
        }
        Returns: boolean
      }
      check_stock_levels: { Args: never; Returns: number }
      check_user_role: {
        Args: {
          check_user_id: string
          required_role: Database["public"]["Enums"]["user_role"]
        }
        Returns: boolean
      }
      decrement_rider_stock: {
        Args: { p_product_id: string; p_quantity: number; p_rider_id: string }
        Returns: {
          id: string
          stock_quantity: number
        }[]
      }
      disablelongtransactions: { Args: never; Returns: string }
      dropgeometrycolumn:
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
      dropgeometrytable:
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
      enablelongtransactions: { Args: never; Returns: string }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      expire_old_reservations: { Args: never; Returns: number }
      fulfill_stock_reservation: {
        Args: { order_uuid: string }
        Returns: boolean
      }
      generate_opname_number: { Args: never; Returns: string }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      get_assigned_rider_id: { Args: never; Returns: string }
      get_branch_assignments: {
        Args: never
        Returns: {
          report_name: string
          report_user_id: string
          rider_id: string
          rider_name: string
        }[]
      }
      get_branch_stock: {
        Args: { p_branch_id: string; p_product_id: string }
        Returns: number
      }
      get_current_user_branch: { Args: never; Returns: string }
      get_current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      get_current_user_role_safe: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      get_user_level: {
        Args: { user_role_param: Database["public"]["Enums"]["user_role"] }
        Returns: number
      }
      get_user_profile: {
        Args: never
        Returns: {
          app_access_type: Database["public"]["Enums"]["app_access_type"] | null
          branch_id: string | null
          created_at: string | null
          full_name: string
          id: string
          is_active: boolean | null
          last_known_lat: number | null
          last_known_lng: number | null
          location_updated_at: string | null
          phone: string | null
          photo_url: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string | null
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      gettransactionid: { Args: never; Returns: unknown }
      has_active_shift: { Args: { rider_uuid: string }; Returns: boolean }
      has_role: {
        Args: { required_role: Database["public"]["Enums"]["user_role"] }
        Returns: boolean
      }
      has_user_permission: {
        Args: {
          check_user_id: string
          module_name: string
          permission_type: string
        }
        Returns: boolean
      }
      increment_inventory_stock: {
        Args: { p_product_id: string; p_quantity: number; p_rider_id: string }
        Returns: undefined
      }
      is_customer_user_owner: {
        Args: { customer_user_id: string }
        Returns: boolean
      }
      is_rider_role: { Args: never; Returns: boolean }
      longtransactionsenabled: { Args: never; Returns: boolean }
      populate_geometry_columns:
        | { Args: { use_typmod?: boolean }; Returns: string }
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      reject_stock_adjustment: {
        Args: { movement_uuid: string; reason: string; rejector_uuid: string }
        Returns: boolean
      }
      release_stock_reservation: {
        Args: { new_status?: string; reservation_uuid: string }
        Returns: boolean
      }
      reserve_stock_for_order: {
        Args: { order_uuid: string }
        Returns: boolean
      }
      resolve_stock_alert: { Args: { alert_uuid: string }; Returns: boolean }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_askml:
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geom: unknown }; Returns: number }
        | { Args: { geog: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      unlockrows: { Args: { "": string }; Returns: number }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
      upsert_bh_report_assignment: {
        Args: { _report_user_id: string; _rider_profile_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_access_type: "web_backoffice" | "pos_app" | "rider_app"
      permission_type:
        | "view"
        | "insert"
        | "update"
        | "delete"
        | "approve"
        | "release"
      stock_movement_type: "in" | "out" | "transfer" | "adjustment" | "return"
      transaction_status: "pending" | "completed" | "cancelled" | "returned"
      user_role:
        | "ho_admin"
        | "branch_manager"
        | "rider"
        | "finance"
        | "customer"
        | "ho_owner"
        | "ho_staff"
        | "bh_staff"
        | "bh_kasir"
        | "bh_rider"
        | "bh_report"
        | "sb_branch_manager"
        | "sb_kasir"
        | "sb_rider"
        | "sb_report"
        | "1_HO_Admin"
        | "1_HO_Owner"
        | "1_HO_Staff"
        | "2_Hub_Branch_Manager"
        | "2_Hub_Staff"
        | "2_Hub_Kasir"
        | "2_Hub_Rider"
        | "3_SB_Branch_Manager"
        | "3_SB_Staff"
        | "3_SB_Kasir"
        | "3_SB_Rider"
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
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
      app_access_type: ["web_backoffice", "pos_app", "rider_app"],
      permission_type: [
        "view",
        "insert",
        "update",
        "delete",
        "approve",
        "release",
      ],
      stock_movement_type: ["in", "out", "transfer", "adjustment", "return"],
      transaction_status: ["pending", "completed", "cancelled", "returned"],
      user_role: [
        "ho_admin",
        "branch_manager",
        "rider",
        "finance",
        "customer",
        "ho_owner",
        "ho_staff",
        "bh_staff",
        "bh_kasir",
        "bh_rider",
        "bh_report",
        "sb_branch_manager",
        "sb_kasir",
        "sb_rider",
        "sb_report",
        "1_HO_Admin",
        "1_HO_Owner",
        "1_HO_Staff",
        "2_Hub_Branch_Manager",
        "2_Hub_Staff",
        "2_Hub_Kasir",
        "2_Hub_Rider",
        "3_SB_Branch_Manager",
        "3_SB_Staff",
        "3_SB_Kasir",
        "3_SB_Rider",
      ],
    },
  },
} as const
