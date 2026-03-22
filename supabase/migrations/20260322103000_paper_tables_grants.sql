-- PostgREST can return 401 + proxy-status "error=42501" (insufficient_privilege) if
-- anon/authenticated lack table privileges even when RLS policies allow access.
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.paper_accounts TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.paper_trades TO anon, authenticated;
