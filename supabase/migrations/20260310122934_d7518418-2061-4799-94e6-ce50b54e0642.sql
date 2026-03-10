
-- Drop the RESTRICTIVE policies that block everything
DROP POLICY IF EXISTS "Anyone can manage their paper account" ON public.paper_accounts;
DROP POLICY IF EXISTS "Anyone can manage their paper trades" ON public.paper_trades;

-- Create PERMISSIVE policies (the default, which actually allows access)
CREATE POLICY "Allow all paper account access"
  ON public.paper_accounts
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all paper trades access"
  ON public.paper_trades
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
