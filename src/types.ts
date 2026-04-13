export interface Rickshaw {
  id: number;
  number: string;
  purchase_date: string;
  investment_cost: number;
  status: string;
  recovered_cost?: number;
}

export interface Driver {
  id: number;
  name: string;
  phone: string;
  join_date: string;
  status: string;
  pending_balance?: number;
  assigned_rickshaw?: string;
}

export interface Assignment {
  id: number;
  rickshaw_id: number;
  driver_id: number;
  start_date: string;
  end_date: string | null;
  rickshaw_number?: string;
  driver_name?: string;
}

export interface Transaction {
  id: number;
  date: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  rickshaw_id: number | null;
  driver_id: number | null;
  notes: string | null;
  rickshaw_number?: string;
  driver_name?: string;
}

export interface DashboardStats {
  totalIncome: number;
  totalExpense: number;
  totalInvestment: number;
  profit: number;
  profitIncludingPending: number;
  allTimeProfit: number;
  allTimeIncome: number;
  allTimeExpense: number;
  pendingBalance: number;
  activeRickshaws: number;
  totalRickshaws: number;
  monthlyData: { month: string; income: number; expense: number }[];
  dailyData: { date: string; income: number; expense: number }[];
}
