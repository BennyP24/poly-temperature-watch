import { createRoot } from "react-dom/client";
import { supabase } from "@/integrations/supabase/client";
import App from "./App.tsx";
import "./index.css";

const rootEl = document.getElementById("root")!;

// Wait for signOut so the first REST calls (e.g. paper trading) never race a stale in-memory JWT.
void supabase.auth.signOut().finally(() => {
  createRoot(rootEl).render(<App />);
});
