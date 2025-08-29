-- Production tables for central kitchen (branch hub)
create table if not exists public.production_batches (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null,
  batch_number integer not null,
  produced_at timestamptz not null default now(),
  created_by uuid not null,
  created_at timestamptz not null default now()
);

create table if not exists public.production_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.production_batches(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null default 0,
  cost_per_unit numeric,
  total_cost numeric generated always as (coalesce(cost_per_unit,0) * quantity) stored,
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.production_batches enable row level security;
alter table public.production_items enable row level security;

-- Drop policies first if they exist
drop policy if exists "HO can manage production batches" on public.production_batches;
drop policy if exists "Branch managers manage own branch batches" on public.production_batches;
drop policy if exists "HO can manage production items" on public.production_items;
drop policy if exists "Branch managers manage own branch items" on public.production_items;

-- Recreate policies
create policy "HO can manage production batches"
  on public.production_batches
  for all
  using (get_current_user_role() = 'ho_admin');

create policy "Branch managers manage own branch batches"
  on public.production_batches
  for all
  using (get_current_user_role() = 'branch_manager' and branch_id = get_current_user_branch())
  with check (get_current_user_role() = 'branch_manager' and branch_id = get_current_user_branch());

create policy "HO can manage production items"
  on public.production_items
  for all
  using (get_current_user_role() = 'ho_admin');

create policy "Branch managers manage own branch items"
  on public.production_items
  for all
  using (
    get_current_user_role() = 'branch_manager'
    and exists (
      select 1 from public.production_batches b
      where b.id = production_items.batch_id and b.branch_id = get_current_user_branch()
    )
  )
  with check (
    get_current_user_role() = 'branch_manager'
    and exists (
      select 1 from public.production_batches b
      where b.id = production_items.batch_id and b.branch_id = get_current_user_branch()
    )
  );

-- Helpful indexes
create index if not exists idx_production_batches_branch_date on public.production_batches (branch_id, produced_at);
create index if not exists idx_production_items_batch on public.production_items (batch_id);
create index if not exists idx_production_items_product on public.production_items (product_id);