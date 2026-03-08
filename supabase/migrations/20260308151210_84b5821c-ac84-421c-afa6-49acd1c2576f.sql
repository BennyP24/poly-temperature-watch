
DROP POLICY IF EXISTS "Anyone can manage their paper account" ON public.paper_accounts;
DROP POLICY IF EXISTS "Anyone can manage their paper trades" ON public.paper_trades;

CREATE POLICY "Anyone can manage their paper account"
ON public.paper_accounts
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Anyone can manage their paper trades"
ON public.paper_trades
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);
