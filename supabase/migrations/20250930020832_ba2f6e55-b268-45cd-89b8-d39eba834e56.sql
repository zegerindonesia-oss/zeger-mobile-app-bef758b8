-- 1. Add SELECT policy for Small Branch managers to view their branch staff
CREATE POLICY "SB managers can view branch staff"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  get_current_user_role() = 'sb_branch_manager'::user_role 
  AND branch_id = get_current_user_branch()
);

-- 2. Add ck_price column to products table
ALTER TABLE public.products 
ADD COLUMN ck_price numeric;

-- 3. Update products with ck_price values (foodcost)
UPDATE public.products SET ck_price = 2680 WHERE name = 'Americano';
UPDATE public.products SET ck_price = 4046 WHERE name = 'Sunrise Americano';
UPDATE public.products SET ck_price = 4000 WHERE name = 'Citrus Coffee';
UPDATE public.products SET ck_price = 3826 WHERE name = 'Classic Latte';
UPDATE public.products SET ck_price = 4150 WHERE name = 'Dolce Latte';
UPDATE public.products SET ck_price = 4451 WHERE name = 'Mocha Aren Latte';
UPDATE public.products SET ck_price = 5566 WHERE name = 'Caramel Mocha';
UPDATE public.products SET ck_price = 4537 WHERE name = 'Aren Creamy Latte';
UPDATE public.products SET ck_price = 5176 WHERE name = 'Bailey''s Creamy Latte';
UPDATE public.products SET ck_price = 5176 WHERE name = 'Butterscotch Creamy Latte';
UPDATE public.products SET ck_price = 5176 WHERE name = 'Caramel Creamy Latte';
UPDATE public.products SET ck_price = 2809 WHERE name = 'Lychee Tea';
UPDATE public.products SET ck_price = 2231 WHERE name = 'Lemonade';
UPDATE public.products SET ck_price = 4294 WHERE name = 'Cookies n Cream';
UPDATE public.products SET ck_price = 4171 WHERE name = 'Choco Malt';
UPDATE public.products SET ck_price = 5220 WHERE name = 'Matcha Latte';
UPDATE public.products SET ck_price = 2794 WHERE name = 'Thai Tea';