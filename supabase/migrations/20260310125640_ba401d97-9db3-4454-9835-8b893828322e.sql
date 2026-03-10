
-- Drop existing RESTRICTIVE policies
DROP POLICY IF EXISTS "Allow all paper account access" ON public.paper_accounts;
DROP POLICY IF EXISTS "Allow all paper trades access" ON public.paper_trades;
DROP POLICY IF EXISTS "Anyone can manage their paper account" ON public.paper_accounts;
DROP POLICY IF EXISTS "Anyone can manage their paper trades" ON public.paper_trades;

-- Create explicitly PERMISSIVE policies
CREATE POLICY "paper_accounts_permissive_all"
  ON public.paper_accounts
  AS PERMISSIVE
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "paper_trades_permissive_all"
  ON public.paper_trades
  AS PERMISSIVE
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
