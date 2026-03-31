// app/login/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase";
import { motion } from "framer-motion";
import { AlertCircle, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      const msg =
        error.message === "Invalid login credentials"
          ? "E-mail ou senha incorretos. Tente novamente."
          : error.message === "Email not confirmed"
          ? "Confirme seu e-mail antes de entrar."
          : "Erro ao fazer login. Tente novamente.";
      setError(msg);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      {/* Glow de fundo sutil */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 10%, rgba(245,158,11,0.07) 0%, transparent 70%)",
        }}
      />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="relative z-10 w-full max-w-sm"
      >
        {/* Card */}
        <div className="rounded-2xl border border-[#2e2c29] bg-[#1a1917] p-8 shadow-2xl shadow-black/60">

          {/* ── Logo / Branding TS HUB (Agora com o Pássaro) ── */}
          <div className="flex flex-col items-center gap-3 mb-8">

            {/* Logo da Controler (Imagem Real) */}
<div className="w-20 h-20 mb-2 flex items-center justify-center">
  <img 
    src="/ICONE.svg" 
    alt="TS HUB Logo" 
    className="w-full h-full object-contain"
  />
</div>

            {/* Título principal */}
            <div className="flex flex-col items-center gap-1">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-200">
                TS <span className="text-amber-400">HUB</span>
              </h1>
              {/* Slogan */}
              <p className="text-[11px] font-medium text-[#a09890] tracking-wide text-center leading-relaxed">
                Sua operação sob controle total.
              </p>
              {/* Badge de acesso restrito */}
              <span className="mt-1 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-[#2e2c29] bg-[#201f1d] text-[10px] font-semibold text-[#7a7268] tracking-widest uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500/60 inline-block"/>
                Acesso Restrito
              </span>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-[#2e2c29] mb-6" />

          {/* Formulário */}
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#7a7268]">
                E-mail
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full bg-[#201f1d] border border-[#2e2c29] rounded-xl px-4 py-2.5 text-sm text-[#e8e2d8] placeholder:text-[#4a4844] outline-none focus:border-amber-500/60 transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#7a7268]">
                Senha
              </label>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#201f1d] border border-[#2e2c29] rounded-xl px-4 py-2.5 text-sm text-[#e8e2d8] placeholder:text-[#4a4844] outline-none focus:border-amber-500/60 transition-colors"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 flex items-start gap-2.5">
                <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                <p className="text-xs text-red-400 leading-relaxed">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 w-full rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/40 disabled:cursor-not-allowed text-[#111] text-sm font-bold py-2.5 transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Entrando...
                </>
              ) : (
                "Entrar"
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-[0.65rem] text-[#4a4844] mt-5">
          TS HUB · Painel Interno · {new Date().getFullYear()}
        </p>
      </motion.div>
    </div>
  );
}
