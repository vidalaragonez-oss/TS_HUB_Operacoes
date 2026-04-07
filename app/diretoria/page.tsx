"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { createClient } from "@/utils/supabase";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Circle,
  Loader2,
  LogOut,
  RefreshCw,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Cliente {
  id: string;
  nome: string;
  gestor: string;
  gestor_estrategico: string;
  status: string;
  operacao_id: string;
  moeda?: "BRL" | "USD" | null;
  meta_leads_mensal?: number | null;
  meta_leads_cache?: number | null;
  meta_spend_cache?: number | null;
  meta_cpl_cache?: number | null;
  meta_last_sync?: string | null;
  gasto_manual_outras_redes?: number | null;
  verba_meta_ads?: number | null;
  verba_gls?: number | null;
  verba_outros?: number | null;
}

interface Operacao {
  id: string;
  nome: string;
}

type Saude = "verde" | "amarelo" | "vermelho" | "sem_meta";

interface ClienteEnriquecido extends Cliente {
  leadsTotais: number;
  gastoTotal: number;
  orcamentoTotal: number;
  pctAtingida: number;
  metaEsperadaHoje: number;
  saude: Saude;
}

interface GestorPerfil {
  id: string;
  nome: string;
  role: "admin" | "gestor";
  user_id: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcSaude(
  leadsTotais: number,
  metaEsperadaHoje: number,
  temMeta: boolean,
): Saude {
  if (!temMeta) return "sem_meta";
  if (metaEsperadaHoje === 0) return leadsTotais > 0 ? "verde" : "sem_meta";
  if (leadsTotais >= metaEsperadaHoje)         return "verde";
  if (leadsTotais >= metaEsperadaHoje * 0.8)   return "amarelo";
  return "vermelho";
}

const SAUDE_CONFIG: Record<Saude, { label: string; dot: string; badge: string; order: number }> = {
  vermelho: { label: "Risco",     dot: "bg-red-500",     badge: "bg-red-500/15 text-red-400 border-red-500/30",         order: 0 },
  amarelo:  { label: "Atenção",   dot: "bg-amber-400",   badge: "bg-amber-400/15 text-amber-300 border-amber-400/30",   order: 1 },
  verde:    { label: "Saudável",  dot: "bg-emerald-500", badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", order: 2 },
  sem_meta: { label: "Sem Meta",  dot: "bg-[#3a3835]",   badge: "bg-[#2e2c29] text-[#7a7268] border-[#3a3835]",        order: 3 },
};

function fmtNum(v: number, moeda: "BRL" | "USD" = "USD") {
  const locale = moeda === "USD" ? "en-US" : "pt-BR";
  const sym    = moeda === "USD" ? "US$" : "R$";
  return `${sym} ${v.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtInt(v: number) {
  return v.toLocaleString("pt-BR");
}

function calcPacingDia() {
  const hoje = new Date();
  const ano  = hoje.getFullYear();
  const mes  = hoje.getMonth();
  const diaAtual   = hoje.getDate();
  const diasNoMes  = new Date(ano, mes + 1, 0).getDate();
  const percentual = diaAtual / diasNoMes;
  return { diaAtual, diasNoMes, percentual };
}

// ─── SortIcon ─────────────────────────────────────────────────────────────────

function SortIcon({ col, sort }: { col: string; sort: { key: string; asc: boolean } }) {
  if (sort.key !== col) return <ChevronDown size={11} className="text-[#3a3835]" />;
  return sort.asc
    ? <ChevronUp size={11} className="text-amber-400" />
    : <ChevronDown size={11} className="text-amber-400" />;
}

// ─── Barra de progresso compacta ─────────────────────────────────────────────

function MiniBar({ pct, saude }: { pct: number; saude: Saude }) {
  const cor = saude === "verde" ? "bg-emerald-500" : saude === "amarelo" ? "bg-amber-400" : "bg-red-500";
  const pctCapped = Math.min(pct, 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-[#2e2c29] overflow-hidden min-w-[60px]">
        <div className={`h-full rounded-full transition-all ${cor}`} style={{ width: `${pctCapped}%` }} />
      </div>
      <span className={`text-[10px] font-bold tabular-nums w-9 text-right ${
        saude === "verde" ? "text-emerald-400" : saude === "amarelo" ? "text-amber-400" : "text-red-400"
      }`}>
        {Math.round(pctCapped)}%
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function DiretoriaPage() {
  const router = useRouter();

  const [perfil, setPerfil]           = useState<GestorPerfil | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [clientes, setClientes]       = useState<ClienteEnriquecido[]>([]);
  const [operacoes, setOperacoes]     = useState<Operacao[]>([]);
  const [opFiltro, setOpFiltro]       = useState<string>("todas");
  const [loading, setLoading]         = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [sort, setSort]               = useState<{ key: string; asc: boolean }>({ key: "saude", asc: true });
  const [mostrarVerdes, setMostrarVerdes] = useState(false);
  const [mostrarUti, setMostrarUti]       = useState(true); // UTI começa expandida
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Scroll-to-top listener
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ── Auth ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const bootstrap = async () => {
      setAuthLoading(true);
      try {
        const sb = createClient();
        const { data: { user } } = await sb.auth.getUser();
        if (!user) { router.replace("/login"); return; }
        const { data: gestorData } = await sb
          .from("gestores").select("id, nome, role, user_id").eq("user_id", user.id).single();
        if (!gestorData || gestorData.role !== "admin") {
          router.replace("/"); return;
        }
        setPerfil(gestorData as GestorPerfil);
      } finally {
        setAuthLoading(false);
      }
    };
    bootstrap();
  }, [router]);

  // ── Fetch ────────────────────────────────────────────────────────────────────
  const fetchDados = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Operações
      const { data: ops } = await supabase.from("operacoes").select("id, nome").order("created_at");
      setOperacoes((ops ?? []) as Operacao[]);

      // 2. Clientes ativos com todos os campos necessários
      const { data: rawClientes } = await supabase
        .from("clientes")
        .select(`
          id, nome, gestor, gestor_estrategico, status, operacao_id, moeda,
          meta_leads_mensal, meta_leads_cache, meta_spend_cache, meta_cpl_cache,
          meta_last_sync, gasto_manual_outras_redes,
          verba_meta_ads, verba_gls, verba_outros
        `)
        .not("status", "in", '("INATIVO","CANCELAMENTO")')
        .order("nome");

      const clientes = (rawClientes ?? []) as Cliente[];

      // 3. Contagem de leads do banco local (mês corrente, D-1)
      const hoje     = new Date();
      const ano      = hoje.getFullYear();
      const mes      = hoje.getMonth();
      const mesInicio = new Date(ano, mes, 1).toISOString().slice(0, 10);
      const diaHoje  = hoje.getDate();
      const ontem    = diaHoje === 1
        ? new Date(ano, mes, 0).toISOString().slice(0, 10)
        : new Date(ano, mes, diaHoje - 1).toISOString().slice(0, 10);

      const clienteIds = clientes.map(c => c.id);
      const { data: leadsRows } = clienteIds.length > 0
        ? await supabase
            .from("leads")
            .select("cliente")
            .in("cliente", clienteIds)
            .gte("data", mesInicio)
            .lte("data", ontem)
        : { data: [] };

      const leadsBanco: Record<string, number> = {};
      for (const r of (leadsRows ?? []) as { cliente: string }[]) {
        if (r.cliente) leadsBanco[r.cliente] = (leadsBanco[r.cliente] ?? 0) + 1;
      }

      // 4. Enriquecimento com pacing
      const { percentual: pctMes } = calcPacingDia();

      const enriquecidos: ClienteEnriquecido[] = clientes.map(c => {
        const apiLeads   = c.meta_leads_cache ?? 0;
        const bancoLeads = leadsBanco[c.id]   ?? 0;
        const leadsTotais = apiLeads > 0 ? apiLeads : bancoLeads;

        const gastoMeta    = c.meta_spend_cache              ?? 0;
        const gastoManual  = c.gasto_manual_outras_redes     ?? 0;
        const gastoTotal   = gastoMeta + gastoManual;

        const orcamentoTotal = (c.verba_meta_ads ?? 0) + (c.verba_gls ?? 0) + (c.verba_outros ?? 0);

        const temMeta          = !!c.meta_leads_mensal && c.meta_leads_mensal > 0;
        const metaEsperadaHoje = temMeta ? (c.meta_leads_mensal! * pctMes) : 0;
        const pctAtingida      = temMeta && metaEsperadaHoje > 0
          ? (leadsTotais / c.meta_leads_mensal!) * 100
          : 0;
        const saude = calcSaude(leadsTotais, metaEsperadaHoje, temMeta);

        return {
          ...c,
          leadsTotais,
          gastoTotal,
          orcamentoTotal,
          pctAtingida,
          metaEsperadaHoje,
          saude,
        };
      });

      setClientes(enriquecidos);
      setLastRefresh(new Date());
    } catch (err) {
      console.error("[diretoria] Erro:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (perfil) fetchDados();
  }, [perfil, fetchDados]);

  // ── Ordenação ─────────────────────────────────────────────────────────────────
  const toggleSort = (key: string) => {
    setSort(prev => prev.key === key ? { key, asc: !prev.asc } : { key, asc: true });
  };

  // ── Filtro de operação ────────────────────────────────────────────────────────
  const clientesFiltrados = clientes.filter(c =>
    opFiltro === "todas" || c.operacao_id === opFiltro
  );

  // ── Ordenação aplicada ────────────────────────────────────────────────────────
  const clientesOrdenados = [...clientesFiltrados].sort((a, b) => {
    let va: number | string = 0;
    let vb: number | string = 0;
    switch (sort.key) {
      case "saude":       va = SAUDE_CONFIG[a.saude].order;  vb = SAUDE_CONFIG[b.saude].order; break;
      case "nome":        va = a.nome;                        vb = b.nome; break;
      case "leads":       va = a.leadsTotais;                 vb = b.leadsTotais; break;
      case "pct":         va = a.pctAtingida;                 vb = b.pctAtingida; break;
      case "gasto":       va = a.gastoTotal;                  vb = b.gastoTotal; break;
      case "gestor_estr": va = a.gestor_estrategico;          vb = b.gestor_estrategico; break;
    }
    if (typeof va === "string") return sort.asc ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
    return sort.asc ? (va as number) - (vb as number) : (vb as number) - (va as number);
  });

  // Separa em UTI (vermelho/amarelo) e saudáveis (verde/sem_meta)
  const uti       = clientesOrdenados.filter(c => c.saude === "vermelho" || c.saude === "amarelo");
  const saudaveis = clientesOrdenados.filter(c => c.saude === "verde" || c.saude === "sem_meta");

  // ── KPIs globais ─────────────────────────────────────────────────────────────
  const total            = clientesFiltrados.length;
  const nVerdes          = clientesFiltrados.filter(c => c.saude === "verde").length;
  const nAmarelos        = clientesFiltrados.filter(c => c.saude === "amarelo").length;
  const nVermelhos       = clientesFiltrados.filter(c => c.saude === "vermelho").length;
  const nSemMeta         = clientesFiltrados.filter(c => c.saude === "sem_meta").length;
  const gastoTotalGlobal = clientesFiltrados.reduce((s, c) => s + c.gastoTotal, 0);
  const orcTotalGlobal   = clientesFiltrados.reduce((s, c) => s + c.orcamentoTotal, 0);
  const pctGastoGlobal   = orcTotalGlobal > 0 ? Math.min((gastoTotalGlobal / orcTotalGlobal) * 100, 100) : 0;
  const { diaAtual, diasNoMes } = calcPacingDia();

  // ── Loading / Auth ────────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#111010] flex items-center justify-center">
        <Loader2 size={28} className="text-amber-500 animate-spin" />
      </div>
    );
  }

  // ─── Logoff ──────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    try {
      const sb = createClient();
      await sb.auth.signOut();
    } catch { /* ignora */ } finally {
      router.push("/login");
      router.refresh();
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    // ↓ Removido overflow-y-auto — o scroll deve ocorrer no documento, não aqui
    <div className="min-h-screen bg-[#0a0a0a] text-[#e8e2d8] flex flex-col pb-20">

      {/* ── Header ── */}
      <header className="shrink-0 border-b border-[#2e2c29] bg-[#111010] px-4 md:px-8 py-3 flex items-center justify-between gap-4 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#201f1d] border border-[#2e2c29] text-[#7a7268] text-xs font-semibold hover:text-[#e8e2d8] hover:border-[#7a7268] transition-colors"
          >
            <ArrowLeft size={13} /> <span className="hidden sm:inline">Voltar para Operação</span><span className="sm:hidden">Voltar</span>
          </button>
          <div>
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.18em] text-violet-400">Visão Executiva</p>
            <h1 className="text-sm font-extrabold tracking-tight text-[#e8e2d8] flex items-center gap-1.5">
              <BarChart3 size={14} className="text-violet-400" /> Dashboard da Diretoria
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Filtro de operação */}
          {operacoes.length > 1 && (
            <div className="relative">
              <select
                value={opFiltro}
                onChange={e => setOpFiltro(e.target.value)}
                className="appearance-none bg-[#201f1d] border border-[#2e2c29] rounded-xl px-3 pr-7 py-1.5 text-xs text-[#e8e2d8] outline-none focus:border-violet-500/50 cursor-pointer transition-colors"
              >
                <option value="todas">Todas as Operações</option>
                {operacoes.map(op => <option key={op.id} value={op.id}>{op.nome}</option>)}
              </select>
              <ChevronDown size={11} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#7a7268]" />
            </div>
          )}

          {/* Refresh */}
          <button
            onClick={fetchDados}
            disabled={loading}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#201f1d] border border-[#2e2c29] text-[#7a7268] text-xs font-semibold hover:text-violet-400 hover:border-violet-500/40 transition-colors disabled:opacity-40"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            <span className="hidden sm:inline">
              {lastRefresh ? lastRefresh.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "Atualizar"}
            </span>
          </button>

          {/* Separador */}
          <div className="w-px h-5 bg-[#2e2c29] hidden sm:block" />

          {/* Logoff */}
          <button
            onClick={handleLogout}
            title={`Sair (${perfil?.nome ?? ""})`}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#201f1d] border border-[#2e2c29] text-[#7a7268] text-xs font-semibold hover:text-red-400 hover:border-red-500/40 transition-colors group"
          >
            <LogOut size={13} className="transition-transform group-hover:translate-x-0.5" />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-6">

        {loading && clientes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-violet-500/20 border-t-violet-500 animate-spin" />
            <p className="text-[#7a7268] text-sm">Consolidando dados da operação...</p>
          </div>
        ) : (
          <>
            {/* ── Sub-header: pacing do mês ── */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="text-xs text-[#7a7268]">
                  Dia <span className="text-[#e8e2d8] font-bold">{diaAtual}</span> de <span className="text-[#e8e2d8] font-bold">{diasNoMes}</span> —{" "}
                  <span className="text-violet-400 font-semibold">{Math.round((diaAtual / diasNoMes) * 100)}%</span> do mês decorrido
                </p>
              </div>
              {lastRefresh && (
                <p className="text-[10px] text-[#4a4844]">
                  Atualizado às {lastRefresh.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </p>
              )}
            </div>

            {/* ── KPI Cards ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Gasto Total */}
              <div className="rounded-2xl border border-[#2e2c29] bg-[#1a1917] p-4 space-y-1">
                <p className="text-[9px] font-bold uppercase tracking-widest text-[#4a4844] flex items-center gap-1.5">
                  <Activity size={10} className="text-violet-400" /> Gasto Total Global
                </p>
                <p className="text-xl font-extrabold text-[#e8e2d8]">
                  {fmtNum(gastoTotalGlobal)}
                </p>
                <p className="text-[10px] text-[#4a4844]">Meta + Google/GLS/Outras</p>
              </div>

              {/* Orçamento Planejado */}
              <div className="rounded-2xl border border-[#2e2c29] bg-[#1a1917] p-4 space-y-1">
                <p className="text-[9px] font-bold uppercase tracking-widest text-[#4a4844] flex items-center gap-1.5">
                  <Target size={10} className="text-amber-400" /> Orçamento Planejado
                </p>
                <p className="text-xl font-extrabold text-amber-400">
                  {fmtNum(orcTotalGlobal)}
                </p>
                {orcTotalGlobal > 0 && (
                  <div className="flex items-center gap-2 pt-0.5">
                    <div className="flex-1 h-1 rounded-full bg-[#2e2c29] overflow-hidden">
                      <div
                        className={`h-full rounded-full ${pctGastoGlobal >= 95 ? "bg-red-500" : pctGastoGlobal >= 75 ? "bg-amber-500" : "bg-emerald-500"}`}
                        style={{ width: `${pctGastoGlobal}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-[#7a7268] tabular-nums">{Math.round(pctGastoGlobal)}%</span>
                  </div>
                )}
              </div>

              {/* Saúde da Operação */}
              <div className="rounded-2xl border border-[#2e2c29] bg-[#1a1917] p-4 space-y-2">
                <p className="text-[9px] font-bold uppercase tracking-widest text-[#4a4844] flex items-center gap-1.5">
                  <Users size={10} className="text-blue-400" /> Saúde da Operação
                </p>
                <div className="flex items-center gap-3 flex-wrap">
                  {[
                    { n: nVerdes,   icon: <CheckCircle size={12} className="text-emerald-400" />, label: "Verde",    color: "text-emerald-400" },
                    { n: nAmarelos, icon: <AlertTriangle size={12} className="text-amber-400" />, label: "Atenção",  color: "text-amber-400"   },
                    { n: nVermelhos,icon: <XCircle size={12} className="text-red-400" />,         label: "Risco",    color: "text-red-400"     },
                    { n: nSemMeta,  icon: <Circle size={12} className="text-[#3a3835]" />,        label: "Sem Meta", color: "text-[#7a7268]"   },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-1">
                      {item.icon}
                      <span className={`text-sm font-extrabold ${item.color}`}>{item.n}</span>
                    </div>
                  ))}
                </div>
                {total > 0 && nSemMeta < total && (
                  <p className="text-[10px] text-[#4a4844]">
                    {Math.round((nVerdes / (total - nSemMeta)) * 100)}% saudáveis (excl. sem meta)
                  </p>
                )}
              </div>

              {/* Clientes em UTI */}
              <div className={`rounded-2xl border p-4 space-y-1 ${
                uti.length > 0 ? "border-red-500/25 bg-red-500/5" : "border-[#2e2c29] bg-[#1a1917]"
              }`}>
                <p className="text-[9px] font-bold uppercase tracking-widest text-[#4a4844] flex items-center gap-1.5">
                  <TrendingDown size={10} className={uti.length > 0 ? "text-red-400" : "text-[#4a4844]"} /> UTI da Operação
                </p>
                <p className={`text-xl font-extrabold ${uti.length > 0 ? "text-red-400" : "text-emerald-400"}`}>
                  {uti.length}
                </p>
                <p className="text-[10px] text-[#4a4844]">
                  {uti.length === 0 ? "Operação saudável 🎉" : `cliente${uti.length !== 1 ? "s" : ""} precisam de atenção`}
                </p>
              </div>
            </div>

            {/* ── Tabela UTI (colapsável) ── */}
            {uti.length > 0 && (
              <div className="rounded-2xl border border-red-500/20 bg-[#1a1917] overflow-hidden">
                <button
                  onClick={() => setMostrarUti(v => !v)}
                  className="w-full flex items-center justify-between px-5 py-3 border-b border-[#2e2c29] bg-[#111010] hover:bg-[#161514] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <h2 className="text-xs font-bold text-[#e8e2d8] uppercase tracking-widest">UTI da Operação</h2>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/25 font-bold">{uti.length}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[#7a7268] text-[10px] font-semibold">
                    <span className="hidden sm:inline text-[#4a4844]">
                      {mostrarUti ? "Recolher" : "Expandir · Vermelho → Amarelo"}
                    </span>
                    {mostrarUti ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </div>
                </button>
                {mostrarUti && <TabelaClientes clientes={uti} sort={sort} onSort={toggleSort} />}
              </div>
            )}

            {/* ── Tabela Saudáveis (colapsável) ── */}
            <div className="rounded-2xl border border-[#2e2c29] bg-[#1a1917] overflow-hidden">
              <button
                onClick={() => setMostrarVerdes(v => !v)}
                className="w-full flex items-center justify-between px-5 py-3 border-b border-[#2e2c29] bg-[#111010] hover:bg-[#161514] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <TrendingUp size={13} className="text-emerald-400" />
                  <h2 className="text-xs font-bold text-[#e8e2d8] uppercase tracking-widest">
                    Clientes Saudáveis / Sem Meta
                  </h2>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 font-bold">
                    {saudaveis.length}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[#7a7268] text-[10px] font-semibold">
                  {mostrarVerdes ? "Recolher" : "Expandir"}
                  {mostrarVerdes ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </div>
              </button>
              {mostrarVerdes && <TabelaClientes clientes={saudaveis} sort={sort} onSort={toggleSort} />}
            </div>
          </>
        )}
      </main>

      <footer className="shrink-0 border-t border-[#2e2c29] py-3 px-6">
        <p className="text-center text-[0.6rem] text-[#4a4844]">
          TS HUB · Dashboard da Diretoria · Dados do mês corrente (D-1) + Cache Meta Ads
        </p>
      </footer>

      {/* Botão Flutuante: Voltar ao Topo */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-6 right-6 z-50 w-11 h-11 flex items-center justify-center rounded-full bg-violet-500 text-white shadow-[0_4px_20px_rgba(139,92,246,0.4)] hover:bg-violet-400 hover:-translate-y-1 transition-all animate-in fade-in slide-in-from-bottom-4 duration-300"
          title="Voltar ao topo"
        >
          <ChevronUp size={20} />
        </button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TABELA DE CLIENTES
// ═══════════════════════════════════════════════════════════════════════════════

function TabelaClientes({
  clientes,
  sort,
  onSort,
}: {
  clientes: ClienteEnriquecido[];
  sort: { key: string; asc: boolean };
  onSort: (key: string) => void;
}) {
  if (clientes.length === 0) return null;

  const thCls = "px-4 py-2.5 text-[9px] font-bold uppercase tracking-widest text-[#4a4844] text-left whitespace-nowrap cursor-pointer hover:text-[#7a7268] transition-colors select-none";

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[700px]">
        <thead>
          <tr className="border-b border-[#2e2c29] bg-[#111010]/60">
            <th className={thCls} onClick={() => onSort("saude")}>
              <span className="flex items-center gap-1">Status <SortIcon col="saude" sort={sort} /></span>
            </th>
            <th className={thCls} onClick={() => onSort("nome")}>
              <span className="flex items-center gap-1">Cliente <SortIcon col="nome" sort={sort} /></span>
            </th>
            <th className={thCls} onClick={() => onSort("gestor_estr")}>
              <span className="flex items-center gap-1">Gestor Est. <SortIcon col="gestor_estr" sort={sort} /></span>
            </th>
            <th className={thCls} onClick={() => onSort("leads")}>
              <span className="flex items-center gap-1">Leads / Meta <SortIcon col="leads" sort={sort} /></span>
            </th>
            <th className={thCls} onClick={() => onSort("pct")}>
              <span className="flex items-center gap-1">Progresso <SortIcon col="pct" sort={sort} /></span>
            </th>
            <th className={thCls} onClick={() => onSort("gasto")}>
              <span className="flex items-center gap-1">Gasto Total <SortIcon col="gasto" sort={sort} /></span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#1e1c1a]">
          {clientes.map(c => {
            const cfg   = SAUDE_CONFIG[c.saude];
            const moeda = c.moeda ?? "USD";
            const pctDisplay = c.meta_leads_mensal ? (c.leadsTotais / c.meta_leads_mensal) * 100 : 0;

            return (
              <tr key={c.id} className="hover:bg-[#1e1c1a]/60 transition-colors">
                {/* Status */}
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${cfg.badge}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                    {cfg.label}
                  </span>
                </td>

                {/* Cliente */}
                <td className="px-4 py-3">
                  <p className="text-sm font-semibold text-[#e8e2d8] max-w-[180px] truncate">{c.nome}</p>
                  <p className="text-[10px] text-[#4a4844]">{c.gestor}</p>
                </td>

                {/* Gestor Estratégico */}
                <td className="px-4 py-3">
                  <span className="text-xs text-[#c8c0b4] font-medium">{c.gestor_estrategico || "—"}</span>
                </td>

                {/* Leads / Meta */}
                <td className="px-4 py-3">
                  {c.meta_leads_mensal ? (
                    <div>
                      <span className={`text-sm font-extrabold ${
                        c.saude === "verde" ? "text-emerald-400" : c.saude === "amarelo" ? "text-amber-400" : "text-red-400"
                      }`}>
                        {fmtInt(c.leadsTotais)}
                      </span>
                      <span className="text-[#4a4844] text-sm"> / {fmtInt(c.meta_leads_mensal)}</span>
                      {c.metaEsperadaHoje > 0 && (
                        <p className="text-[9px] text-[#4a4844] mt-0.5">
                          Esperado hoje: {Math.round(c.metaEsperadaHoje)}
                        </p>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-[#4a4844] italic">
                      {c.leadsTotais > 0 ? fmtInt(c.leadsTotais) : "—"}
                    </span>
                  )}
                </td>

                {/* Progresso */}
                <td className="px-4 py-3 min-w-[120px]">
                  {c.meta_leads_mensal ? (
                    <MiniBar pct={pctDisplay} saude={c.saude} />
                  ) : (
                    <span className="text-[10px] text-[#4a4844]">—</span>
                  )}
                </td>

                {/* Gasto Total */}
                <td className="px-4 py-3">
                  {c.gastoTotal > 0 ? (
                    <div>
                      <p className="text-sm font-bold text-[#e8e2d8]">{fmtNum(c.gastoTotal, moeda)}</p>
                      {c.gasto_manual_outras_redes != null && c.gasto_manual_outras_redes > 0 && c.meta_spend_cache != null && c.meta_spend_cache > 0 && (
                        <p className="text-[9px] text-[#4a4844] mt-0.5">
                          Meta: {fmtNum(c.meta_spend_cache, moeda)} + Outras: {fmtNum(c.gasto_manual_outras_redes, moeda)}
                        </p>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-[#4a4844]">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
