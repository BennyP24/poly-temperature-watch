
CREATE TABLE public.paper_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text UNIQUE NOT NULL,
  balance numeric NOT NULL DEFAULT 1000,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.paper_trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES public.paper_accounts(id) ON DELETE CASCADE NOT NULL,
  event_id text NOT NULL,
  event_title text NOT NULL,
  market_id text NOT NULL,
  market_title text NOT NULL,
  side text NOT NULL DEFAULT 'yes',
  price numeric NOT NULL,
  amount numeric NOT NULL,
  shares numeric NOT NULL,
  status text NOT NULL DEFAULT 'open',
  payout numeric DEFAULT 0,
  profit numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE public.paper_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paper_trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can manage their paper account" ON public.paper_accounts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can manage their paper trades" ON public.paper_trades FOR ALL USING (true) WITH CHECK (true);
