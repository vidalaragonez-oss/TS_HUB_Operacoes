// app/page.tsx — Ponto de entrada: redireciona autenticados para /hub
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase";
import { Loader2 } from "lucide-react";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const check = async () => {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (user) {
        router.replace("/hub");
      } else {
        router.replace("/login");
      }
    };
    check();
  }, [router]);

  return (
    <div className="min-h-screen bg-[#111010] flex items-center justify-center">
      <Loader2 size={28} className="text-amber-500 animate-spin" />
    </div>
  );
}
