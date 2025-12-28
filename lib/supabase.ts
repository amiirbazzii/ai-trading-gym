import { createClient } from "@supabase/supabase-js";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      ai_results: {
        Row: {
          created_at: string;
          id: string;
          pnl: number;
          trade_ai_attribution_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          pnl: number;
          trade_ai_attribution_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          pnl?: number;
          trade_ai_attribution_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_results_trade_ai_attribution_id_fkey";
            columns: ["trade_ai_attribution_id"];
            referencedRelation: "trade_ai_attribution";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_strategies: {
        Row: {
          description: string | null;
          id: string;
          name: string;
        };
        Insert: {
          description?: string | null;
          id?: string;
          name: string;
        };
        Update: {
          description?: string | null;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      trade_ai_attribution: {
        Row: {
          ai_strategy_id: string;
          id: string;
          trade_id: string;
        };
        Insert: {
          ai_strategy_id: string;
          id?: string;
          trade_id: string;
        };
        Update: {
          ai_strategy_id?: string;
          id?: string;
          trade_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trade_ai_attribution_ai_strategy_id_fkey";
            columns: ["ai_strategy_id"];
            referencedRelation: "ai_strategies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trade_ai_attribution_trade_id_fkey";
            columns: ["trade_id"];
            referencedRelation: "trades";
            referencedColumns: ["id"];
          },
        ];
      };
      trade_tps: {
        Row: {
          id: string;
          is_hit: boolean;
          tp_price: number;
          trade_id: string;
        };
        Insert: {
          id?: string;
          is_hit?: boolean;
          tp_price: number;
          trade_id: string;
        };
        Update: {
          id?: string;
          is_hit?: boolean;
          tp_price?: number;
          trade_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trade_tps_trade_id_fkey";
            columns: ["trade_id"];
            referencedRelation: "trades";
            referencedColumns: ["id"];
          },
        ];
      };
      trades: {
        Row: {
          created_at: string;
          direction: "long" | "short";
          entry_price: number;
          id: string;
          sl: number;
          status: "open" | "closed" | "cancelled";
          user_id: string;
        };
        Insert: {
          created_at?: string;
          direction: "long" | "short";
          entry_price: number;
          id?: string;
          sl: number;
          status?: "open" | "closed" | "cancelled";
          user_id: string;
        };
        Update: {
          created_at?: string;
          direction?: "long" | "short";
          entry_price?: number;
          id?: string;
          sl?: number;
          status?: "open" | "closed" | "cancelled";
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trades_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

export const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
