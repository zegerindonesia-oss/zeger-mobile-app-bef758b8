

## Plan: Overhaul Pendapatan Rider Dashboard

### Overview
Rebuild the Rider Income page into a comprehensive dashboard with commission tiers, target tracking, income projections, and payment status management.

### 1. Database: Create `weekly_payouts` table

```sql
create table public.weekly_payouts (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null,
  week_start date not null,
  week_end date not null,
  weekly_sales numeric default 0,
  commission numeric default 0,
  attendance_bonus numeric default 0,
  total_income numeric default 0,
  payment_status text default 'UNPAID',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(rider_id, week_start)
);

alter table public.weekly_payouts enable row level security;

-- RLS: branch managers and admin can manage
create policy "Managers can manage weekly payouts"
on public.weekly_payouts for all to authenticated
using (
  has_role('ho_admin'::user_role)
  OR (
    (has_role('branch_manager'::user_role) OR has_role('sb_branch_manager'::user_role))
    AND rider_id IN (SELECT id FROM profiles WHERE branch_id = get_current_user_branch())
  )
);
```

### 2. Update `src/pages/finance/RiderIncome.tsx`

Major additions while keeping existing commission logic intact:

**New UI Sections (when a specific rider is selected):**

- **Commission Tier Card**: Shows current tier %, next tier target, remaining sales, with progress bar
- **Target Tracker**: Daily (500k), Weekly (3.5M), Monthly (15M) progress bars
- **Income Projection**: Estimated weekly and monthly income
- **Sales Summary Cards**: Today / This Week / This Month sales

**New UI Section (all riders view):**

- **Payment Status Table**: Shows weekly payout periods with UNPAID/PAID status
- **Admin Toggle**: Button to mark payment as PAID (upserts into `weekly_payouts`)

**Updated Detail Table**: Add payment status column per week period

**Key Components to add within the same file:**

```text
┌─────────────────────────────────────────────┐
│ Filters (existing)                          │
├──────────┬──────────┬──────────┬────────────┤
│ Rider    │ Komisi   │ Komisi   │ Total      │
│ Aktif    │ Harian   │ Penjualan│ Waste      │
├──────────┴──────────┴──────────┴────────────┤
│ [If specific rider selected:]               │
│ ┌─────────────┐ ┌─────────────────────────┐ │
│ │ Commission  │ │ Target Tracker          │ │
│ │ Tier Card   │ │ Daily/Weekly/Monthly    │ │
│ └─────────────┘ └─────────────────────────┘ │
│ ┌───────────────────────────────────────────┐│
│ │ Income Projection (Weekly/Monthly Est.)  ││
│ └───────────────────────────────────────────┘│
├─────────────────────────────────────────────┤
│ Resume Table (existing, enhanced)           │
├─────────────────────────────────────────────┤
│ Payment Status Table (weekly payouts)       │
│ Week Period | Sales | Commission | Bonus |  │
│ Total | Status [UNPAID/PAID toggle]         │
├─────────────────────────────────────────────┤
│ Detail Table (existing)                     │
└─────────────────────────────────────────────┘
```

**Commission logic** stays as-is (already correct per the tiers). The new features are purely additive UI and the payment tracking table.

### 3. Payment Status Logic

- When admin clicks "Mark as PAID", upsert into `weekly_payouts` with calculated values
- Auto-calculate weekly_sales, commission, attendance_bonus, total_income from existing transaction data
- Payment status toggle only available for admin/branch_manager roles

### Files Changed
- `src/pages/finance/RiderIncome.tsx` — major UI additions
- New migration for `weekly_payouts` table

