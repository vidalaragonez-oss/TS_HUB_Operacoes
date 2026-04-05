"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, 
  X, 
  Loader2, 
  Zap, 
  Sparkles, 
  Pencil, 
  ChevronDown, 
  User, 
  Users, 
  Layers, 
  Settings, 
  Check, 
  Circle,
  Activity,
  Bug,
  Bell,
  ImageIcon,
  CheckCircle,
  Link2,
  RefreshCw,
  Wifi,
  WifiOff,
  Search,
  AlertTriangle,
  Info,
  Shield,
  History,
  RotateCcw,
  Trash2,
  Building2,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

// ═══════════════════════════════════════════════════════════════════════════════
// UTILIDADE: LOG DE AUDITORIA
// ═══════════════════════════════════════════════════════════════════════════════

export async function registrarLog(
  userId: string,
  userNome: string,
  acao: string,
  entidade: string,
  entidadeId: string | null,
  detalhes: string
): Promise<void> {
  try {
    const { error } = await supabase.from("audit_logs").insert({
      user_id:    userId,
      user_nome:  userNome,
      acao,
      entidade,
      entidade_id: entidadeId,
      detalhes,
    });
    if (error) console.error("[AuditLog] Erro ao registrar log:", error);
  } catch (err) {
    console.error("[AuditLog] Exceção ao registrar log:", err);
  }
}

// ─── Tipos locais ─────────────────────────────────────────────────────────────

export type PlatformKey = "meta" | "google" | "gls" | "nextdoor" | "thumbtack";

export interface Platform {
  key: PlatformKey;
  label: string;
  campaigns: string[];
}

export interface Operacao {
  id: string;
  nome: string;
  created_at: string;
}

export type ClienteStatus = "ATIVO" | "INATIVO" | "SEM CAMPANHA" | "CANCELAMENTO";

export interface Cliente {
  id: string;
  nome: string;
  operacao_id: string;
  gestor: string;
  gestor_estrategico: string;
  platforms: Platform[];
  status: ClienteStatus;
  created_at: string;
  ordem?: number | null;
  tipo_campanha?: string[] | null;
  // ── Meta Ads Integration ──────────────────────────────────────────────────
  meta_ad_account_id?: string | null;
  meta_access_token?:  string | null;
  meta_status?:        string | null;
  // ── Metas & Orçamento ─────────────────────────────────────────────────────
  meta_leads_mensal?: number | null;
  verba_meta_ads?:    number | null;
  verba_gls?:         number | null;
  verba_outros?:      number | null;
  // ── IDs de Integração extra ───────────────────────────────────────────────
  gls_account_id?:    string | null;
  // ── Moeda ─────────────────────────────────────────────────────────────────
  moeda?:             'BRL' | 'USD' | null;
  // ── Cache de Métricas Meta (Background Sync) ──────────────────────────────
  meta_spend_cache?:  number | null;
  meta_leads_cache?:  number | null;
  meta_cpl_cache?:    number | null;
  meta_last_sync?:    string | null;
  // ── Blacklist de Campanhas (excluídas do cálculo de métricas) ─────────────
  meta_ignored_campaigns?: string[] | null;
  // ── Input Express: Gasto manual de redes sem API ──────────────────────────
  gasto_manual_outras_redes?: number | null;
}

export interface Lead {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  data: string;
  plataforma: string;
  operacao?: string;
  cliente?: string;
  operacao_id?: string;
  created_at?: string;
  charge_status?: string;
  meta_lead_id?: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── REGRA DE OURO: Definições canônicas ──────────────────────────────────────
// Estes são os ÚNICOS nomes aceitos para plataformas e campanhas.
// São gravados EXATAMENTE assim no campo tipo_campanha do Supabase.
// ═══════════════════════════════════════════════════════════════════════════════

export const PLATFORM_DEFS: {
  key: PlatformKey;
  label: string;
  campaigns: string[];
}[] = [
  {
    key: "meta",
    label: "Meta Ads",
    campaigns: [
      "Direct Messages (Meta)",
      "Engagement (Meta)",
      "Lead Generation (Meta)",
      "Leads Form (Meta)",
      "WhatsApp Leads",
      "Website Traffic",
      "Sales/Conversion",
    ],
  },
  {
    key: "google",
    label: "Google Ads",
    campaigns: [
      "Search Network (G-Ads)",
      "Performance Max",
      "Display Network",
      "YouTube Ads",
      "App Install",
    ],
  },
  {
    key: "gls",
    label: "Google Local Services",
    campaigns: [
      "Local Service Ads (GLS)",
      "Local Awareness",
    ],
  },
  {
    key: "nextdoor",
    label: "Nextdoor Ads",
    campaigns: [
      "Nextdoor Local Deals",
      "Nextdoor Awareness",
    ],
  },
  {
    key: "thumbtack",
    label: "Thumbtack",
    campaigns: [
      "Thumbtack Leads",
      "Thumbtack Pro Spotlight",
    ],
  },
];

// Lookup: dado um nome de campanha, retorna a PlatformKey pai
export function getCampanhaPlatformKey(campanha: string): PlatformKey | null {
  for (const def of PLATFORM_DEFS) {
    if (def.campaigns.includes(campanha)) return def.key;
  }
  return null;
}

// ─── SVGs ─────────────────────────────────────────────────────────────────────

export const PLATFORM_SVG: Record<PlatformKey, React.ReactNode> = {
  meta: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M24 12.073c0-6.627-5.372-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" fill="#1877F2" />
    </svg>
  ),
  google: (
    <svg width="14" height="14" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  ),
  gls: (
    <svg width="14" height="14" viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="20" fill="#34A853" />
      <path d="M34.5858 17.5858L21.4142 30.7574L14.8284 24.1716L12 27L21.4142 36.4142L37.4142 20.4142L34.5858 17.5858Z" fill="white" />
    </svg>
  ),
  nextdoor: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="11" fill="#00B246" />
      <path d="M7 12.5L10.5 16L17 9" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  thumbtack: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="11" fill="#009FD9" />
      <path d="M12 6V14M12 14L9 11M12 14L15 11" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="12" cy="17" r="1.2" fill="white"/>
    </svg>
  ),
};

const PLATFORM_CHIP_COLOR: Record<PlatformKey, string> = {
  meta:      "bg-blue-500/15 text-blue-400 border-blue-500/30",
  google:    "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  gls:       "bg-purple-500/15 text-purple-400 border-purple-500/30",
  nextdoor:  "bg-green-500/15 text-green-400 border-green-500/30",
  thumbtack: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
};

const LEAD_PLATFORM_OPTIONS = [
  "Meta Ads",
  "Google Ads",
  "Google Local Services",
  "Nextdoor Ads",
  "Thumbtack",
  "Elementor Form",
  "Outro",
];

// ═══════════════════════════════════════════════════════════════════════════════
// ── MISSÃO 5: Hook — gestores filtrados por ativo_na_selecao = true ───────────
// ═══════════════════════════════════════════════════════════════════════════════

function useGestoresFiltrados(enabled: boolean) {
  const [estrategicos, setEstratégicos] = useState<string[]>([]);
  const [trafego, setTrafego]           = useState<string[]>([]);
  const [loading, setLoading]           = useState(false);

  const fetch = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("gestores")
        .select("nome, tipo")
        .eq("ativo_na_selecao", true)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as { nome: string; tipo: string }[];
 
      setEstratégicos(rows.filter(r => r.tipo === "estrategico").map(r => r.nome));
      setTrafego(rows.filter(r => r.tipo === "trafego").map(r => r.nome));
    } catch (err) {
      console.error("Erro ao buscar gestores filtrados:", err);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => { fetch(); }, [fetch]);

  return { estrategicos, trafego, loading };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── HELPER: reconstrói estado de campanhas a partir de um Cliente ─────────────
// Suporta tanto tipo_campanha[] (novo) quanto platforms[].campaigns (legado)
// ═══════════════════════════════════════════════════════════════════════════════

function buildInitialCamps(cliente?: Cliente): Record<PlatformKey, string[]> {
  const result: Record<PlatformKey, string[]> = { meta: [], google: [], gls: [], nextdoor: [], thumbtack: [] };
  if (!cliente) return result;

  // Fonte primária: tipo_campanha (array canônico, formato novo)
  if (Array.isArray(cliente.tipo_campanha) && cliente.tipo_campanha.length > 0) {
    for (const camp of cliente.tipo_campanha) {
      const key = getCampanhaPlatformKey(camp);
      if (key) result[key] = [...result[key], camp];
    }
    if (Object.values(result).some(arr => arr.length > 0)) return result;
  }

  // Fallback: platforms[].campaigns (formato legado)
  for (const plat of (cliente.platforms ?? [])) {
    const def = PLATFORM_DEFS.find(d => d.key === plat.key);
    if (def && plat.key in result) {
      // Filtra apenas nomes canônicos para evitar strings inválidas
      result[plat.key] = (plat.campaigns ?? []).filter(c => def.campaigns.includes(c));
    }
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── COMPONENTE: PlatformCampaignSelector ─────────────────────────────────────
// Checkboxes diretos e limpos para as campanhas de uma plataforma
// ═══════════════════════════════════════════════════════════════════════════════

function PlatformCampaignSelector({
  platKey,
  selectedCamps,
  onChange,
}: {
  platKey: PlatformKey;
  selectedCamps: string[];
  onChange: (camps: string[]) => void;
}) {
  const def = PLATFORM_DEFS.find(d => d.key === platKey)!;

  const toggle = (camp: string) => {
    onChange(
      selectedCamps.includes(camp)
        ? selectedCamps.filter(c => c !== camp)
        : [...selectedCamps, camp]
    );
  };

  return (
    <div className="space-y-1">
      {/* Barra superior: label + atalhos */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-[9px] font-bold uppercase tracking-widest text-amber-500/70">
          Campanhas — {def.label}
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onChange([...def.campaigns])}
            className="text-[9px] font-semibold text-amber-500/60 hover:text-amber-400 transition-colors"
          >
            ✓ Todas
          </button>
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-[9px] font-semibold text-[#7a7268] hover:text-[#e8e2d8] transition-colors"
          >
            ✕ Limpar
          </button>
        </div>
      </div>

      {/* Checkboxes — 2 colunas no desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
        {def.campaigns.map(camp => {
          
          const checked = selectedCamps.includes(camp);
          return (
            <label
              key={camp}
              className="flex items-center gap-2 py-1.5 cursor-pointer group"
            >
              <button
                type="button"
                onClick={() => toggle(camp)}
                className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                  checked
                    ? "bg-amber-500 border-amber-500"
                    : "border-[#3a3835] group-hover:border-amber-500/40"
                }`}
              >
                {checked && (
                  <span className="text-[#111] text-[9px] font-bold leading-none">✓</span>
                )}
              </button>
              {/* Nome exato da campanha */}
              <span className={`text-xs leading-snug transition-colors ${
                checked ? "text-[#e8e2d8] font-medium" : "text-[#7a7268] group-hover:text-[#a09890]"
              }`}>
                {camp}
              </span>
            </label>
          );
        })}
      </div>

      {selectedCamps.length > 0 && (
        <p className="text-[9px] text-amber-500/50 pt-1.5">
          {selectedCamps.length}/{def.campaigns.length} selecionada{selectedCamps.length !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL: NOVA OPERAÇÃO
// ═══════════════════════════════════════════════════════════════════════════════

export interface NovaOperacaoModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: (op: Operacao) => void;
}

export function NovaOperacaoModal({ open, onClose, onSaved }: NovaOperacaoModalProps) {
  const [nome, setNome]     = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setNome(""); }, [open]);

  const handleSave = async () => {
    const trimmed = nome.trim();
    if (!trimmed) { toast.error("Informe o nome da operação."); return; }
    setSaving(true);
    try {
      const { data, error } = await supabase.from("operacoes").insert({ nome: trimmed }).select().single();
      if (error) throw error;
      toast.success(`Operação "${trimmed}" criada!`);
      onSaved(data as Operacao);
      onClose();
    } catch (err: unknown) {
      toast.error(`Erro: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100]" style={{ backgroundColor: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }} />
        <Dialog.Content className="fixed z-[101] inset-x-0 bottom-0 sm:inset-0 sm:flex sm:items-center sm:justify-center" onInteractOutside={onClose}>
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="w-full sm:max-w-sm bg-[#1a1917] border border-[#2e2c29] rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col"
            >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#2e2c29]">
       
              <Dialog.Title className="font-bold text-[#e8e2d8] flex items-center gap-2">
                <Plus size={16} className="text-amber-500" /> Nova Operação
              </Dialog.Title>
              <Dialog.Close asChild>
                <button className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#201f1d] border border-[#2e2c29] text-[#7a7268] hover:text-[#e8e2d8] transition-colors">
                  <X size={16} />
                </button>
            
              </Dialog.Close>
            </div>
            <div className="px-5 py-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#7a7268]">Nome da Operação</label>
                <input
                 
                  autoFocus type="text" value={nome}
                  onChange={e => setNome(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleSave();
                  }}
                  placeholder="Ex: Op 04"
                  className="w-full bg-[#201f1d] border border-[#2e2c29] rounded-xl px-4 py-2.5 text-sm text-[#e8e2d8] placeholder:text-[#4a4844] outline-none focus:border-amber-500/60 transition-colors"
                />
              </div>
            </div>
        
            <div className="px-5 pb-5 flex gap-3">
              <Dialog.Close asChild>
                <button className="flex-1 py-2.5 rounded-xl bg-[#201f1d] border border-[#2e2c29] text-[#7a7268] text-sm font-semibold hover:text-[#e8e2d8] transition-colors">Cancelar</button>
              </Dialog.Close>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 text-[#111] text-sm font-bold hover:bg-amber-400 active:scale-95 transition-all shadow-[0_4px_16px_rgba(245,166,35,0.3)] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} className="fill-current" />}
                {saving ? "Criando..." : "Criar Operação"}
              </button>
            </div>
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL: NOVO / EDITAR CLIENTE
// ═══════════════════════════════════════════════════════════════════════════════


export interface ClienteModalProps {
  mode: "new" | "edit";
  initial?: Cliente;
  operacaoId: string;
  gestoresEstrat: string[];
  gestoresTrafego: string[];
  onSaved: (cliente: Cliente) => void;
  onClose: () => void;
  initialTab?: "perfil" | "campanhas" | "financeiro" | "integracoes";
  perfil?: { user_id: string; nome: string } | null;
}

export function ClienteModal({
  mode, initial, operacaoId,
  gestoresEstrat: gestoresEstratProp,
  gestoresTrafego: gestoresTrafegoProp,
  onSaved, onClose,
  initialTab,
  perfil,
}: ClienteModalProps) {


  // Busca filtrada por ativo_na_selecao = true
  const {
    estrategicos: gestoresEstratFiltrados,
    trafego: gestoresTrafFiltrados,
    loading: gestoresLoading,
  } = useGestoresFiltrados(true);

  // Merge: filtrados têm prioridade; props são fallback para quando o hook ainda não carregou
  const gestoresEstrat = gestoresEstratFiltrados.length > 0 ? gestoresEstratFiltrados : gestoresEstratProp;
  const gestoresTraf   = gestoresTrafFiltrados.length   > 0 ? gestoresTrafFiltrados   : gestoresTrafegoProp;

  const [nome,          setNome]          = useState(initial?.nome ?? "");
  const [gestor,        setGestor]        = useState(initial?.gestor ?? "");
  const [gestorEstrat,  setGestorEstrat]  = useState(initial?.gestor_estrategico ?? "");
  const [status,        setStatus]        = useState<ClienteStatus>(initial?.status ?? "ATIVO");

  // Plataformas ativas
  const [activePlats, setActivePlats] = useState<Set<PlatformKey>>(
    () => new Set((initial?.platforms ?? []).map(p => p.key))
  );

  // Campanhas por plataforma — lidas do banco ao abrir
  const [camps, setCamps] = useState<Record<PlatformKey, string[]>>(
    () => buildInitialCamps(initial)
  );

  const [saving, setSaving] = useState(false);

  // ── Meta Ads Integration ────────────────────────────────────────────────
  const [metaToken,         setMetaToken]         = useState(initial?.meta_access_token ?? "");
  const [metaAccountId,     setMetaAccountId]     = useState(initial?.meta_ad_account_id ?? "");
  const [metaAccounts,      setMetaAccounts]      = useState<{ id: string; name: string; status: number }[]>([]);
  const [metaLoading,       setMetaLoading]       = useState(false);
  const [metaAccountSearch, setMetaAccountSearch] = useState("");
  const [metaDropdownOpen,  setMetaDropdownOpen]  = useState(false);
  const metaSearchRef = useRef<HTMLInputElement>(null);
  const metaDropdownRef = useRef<HTMLDivElement>(null);

  // ── Blacklist de Campanhas ──────────────────────────────────────────────────
  const [ignoredCamps,     setIgnoredCamps]     = useState<string[]>(
    Array.isArray(initial?.meta_ignored_campaigns) ? initial.meta_ignored_campaigns : []
  );
  const [campaignList,     setCampaignList]     = useState<{ id: string; name: string; status: string; objective: string }[]>([]);
  const [campListLoading,  setCampListLoading]  = useState(false);
  const [campListError,    setCampListError]    = useState<string | null>(null);

  // ── Metas, Orçamentos & IDs adicionais ─────────────────────────────────────
  const [metaLeadsMensal, setMetaLeadsMensal] = useState<string>(
    initial?.meta_leads_mensal != null ? String(initial.meta_leads_mensal) : ""
  );
  const [verbaMeta, setVerbaMeta]         = useState<string>(initial?.verba_meta_ads != null ? String(initial.verba_meta_ads) : "");
  const [verbaGoogle, setVerbaGoogle]     = useState<string>("");
  const [verbaGls, setVerbaGls]           = useState<string>(initial?.verba_gls      != null ? String(initial.verba_gls)      : "");
  const [verbaNextdoor, setVerbaNextdoor] = useState<string>(initial?.verba_outros   != null && (initial?.platforms ?? []).some(p => p.key === 'nextdoor') ? String(initial.verba_outros) : "");
  const [verbaThumbtack, setVerbaThumbtack] = useState<string>(initial?.verba_outros != null && (initial?.platforms ?? []).some(p => p.key === 'thumbtack') ? String(initial.verba_outros) : "");
  const [verbaOutros, setVerbaOutros]     = useState<string>(initial?.verba_outros   != null ? String(initial.verba_outros)   : "");
  const [gastoManual, setGastoManual]     = useState<string>(initial?.gasto_manual_outras_redes != null ? String(initial.gasto_manual_outras_redes) : "");
  const [glsAccountId, setGlsAccountId] = useState(initial?.gls_account_id ?? "");
  const [moeda, setMoeda] = useState<'BRL' | 'USD'>(initial?.moeda ?? 'USD');

  const handleFetchAccounts = async () => {
    setMetaLoading(true);
    setMetaAccounts([]);
    setMetaAccountSearch(""); // reset do filtro ao buscar novamente
    setMetaDropdownOpen(false);
    try {
      const params = new URLSearchParams({ action: "accounts" });
      if (metaToken.trim()) params.set("token", metaToken.trim());
      const res  = await fetch(`/api/meta?${params}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setMetaAccounts(json.accounts ?? []);
      if ((json.accounts ?? []).length === 0) toast.warning("Nenhuma conta encontrada para esse token.");
    } catch (err: unknown) {
      toast.error(`Erro Meta Ads: ${(err as Error).message}`);
    } finally {
      setMetaLoading(false);
    }
  };

  const handleFetchCampaigns = async () => {
    if (!metaAccountId) { toast.error("Vincule uma conta Meta Ads antes de buscar campanhas."); return; }
    setCampListLoading(true);
    setCampListError(null);
    try {
      const params = new URLSearchParams({ action: "campaign_list", account_id: metaAccountId });
      if (metaToken.trim()) params.set("token", metaToken.trim());
      const res  = await fetch(`/api/meta?${params}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setCampaignList(json.campaigns ?? []);
      if ((json.campaigns ?? []).length === 0) toast.warning("Nenhuma campanha encontrada para esta conta.");
    } catch (err: unknown) {
      setCampListError((err as Error).message);
      toast.error(`Erro ao buscar campanhas: ${(err as Error).message}`);
    } finally {
      setCampListLoading(false);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        metaDropdownRef.current &&
        !metaDropdownRef.current.contains(e.target as Node)
      ) {
        setMetaDropdownOpen(false);
      }
    };
    if (metaDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [metaDropdownOpen]);

  // Toggle de plataforma: ao desmarcar limpa campanhas E verba correspondente
  const togglePlatform = (key: PlatformKey) => {
    setActivePlats(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        setCamps(c => ({ ...c, [key]: [] })); // limpa campanhas
        // Reseta verba da plataforma desmarcada IMEDIATAMENTE
        if (key === 'meta')      setVerbaMeta("");
        if (key === 'google')    setVerbaGoogle("");
        if (key === 'gls')       setVerbaGls("");
        if (key === 'nextdoor')  setVerbaNextdoor("");
        if (key === 'thumbtack') setVerbaThumbtack("");
      } else {
        next.add(key);
      }
      
      return next;
    });
  };

  // ── FIX DA MADRUGADA: Salva tipo_campanha como STRING separada por vírgula ──
  const handleSave = async () => {
    if (!nome.trim())  { toast.error("Informe o nome do cliente."); return; }
    if (!gestor)       { toast.error("Selecione o Gestor de Tráfego."); return; }
    if (!gestorEstrat) { toast.error("Selecione o Gestor Estratégico."); return; }

    // platforms[]: apenas plataformas ativas, com campanhas corretas
    const platforms: Platform[] = PLATFORM_DEFS
      .filter(d => activePlats.has(d.key))
      .map(d => ({ key: d.key, label: d.label, campaigns: camps[d.key] ?? [] }));

    // tipo_campanha: flat array de TODOS os nomes exatos selecionados
    const tipoCampanhaArray: string[] = PLATFORM_DEFS
      .filter(d => activePlats.has(d.key))
      .flatMap(d => camps[d.key] ?? []);

    const payload = {
      nome: nome.trim(),
      operacao_id: operacaoId,
      gestor,
      gestor_estrategico: gestorEstrat,
      platforms,
      status,
      // CONVERTE PARA TEXTO. Ex: "Lead Generation (Meta),Search Network (G-Ads)"
      tipo_campanha: tipoCampanhaArray.length > 0 ? tipoCampanhaArray.join(',') : null,
      // ── Meta Ads ────────────────────────────────────────────────────────────
      meta_ad_account_id: metaAccountId.trim() || null,
      meta_access_token:  metaToken.trim() || null,
      meta_status: metaAccountId.trim() ? "vinculado" : "sem_link",
      // ── Metas & Orçamentos ─────────────────────────────────────────────────
      meta_leads_mensal: metaLeadsMensal !== "" ? Number(metaLeadsMensal) : null,
      verba_meta_ads:    verbaMeta      !== "" && activePlats.has('meta')      ? Number(verbaMeta)      : null,
      verba_gls:         verbaGls       !== "" && activePlats.has('gls')       ? Number(verbaGls)       : null,
      // verba_outros agrega: Google Ads + Nextdoor + Thumbtack + campo genérico "Outros"
      verba_outros: (() => {
        const v = (verbaGoogle    !== "" && activePlats.has('google')    ? Number(verbaGoogle)    : 0)
                + (verbaNextdoor  !== "" && activePlats.has('nextdoor')  ? Number(verbaNextdoor)  : 0)
                + (verbaThumbtack !== "" && activePlats.has('thumbtack') ? Number(verbaThumbtack) : 0)
                + (verbaOutros    !== ""                                  ? Number(verbaOutros)    : 0);
        return v > 0 ? v : null;
      })(),
      gls_account_id:    glsAccountId.trim() || null,
      moeda,
      // Blacklist de campanhas ignoradas nas métricas
      meta_ignored_campaigns: ignoredCamps.length > 0 ? ignoredCamps : null,
      // Input Express: gasto manual de redes sem API (Google/GLS/outras)
      gasto_manual_outras_redes: gastoManual !== "" ? Number(gastoManual) : null,
    };

    setSaving(true);
    try {
      const result = mode === "new"
        ? await supabase.from("clientes").insert(payload).select().single()
        : await supabase.from("clientes").update(payload).eq("id", initial!.id).select().single();

      if (result.error) throw result.error;
      // Merge returned data with full payload to guarantee all fields are fresh
      // (avoids stale reads when Supabase returns cached row state)
      const saved: Cliente = {
        ...(result.data as Cliente),
        ...payload,
        id: mode === "new" ? (result.data as Cliente).id : initial!.id,
      } as unknown as Cliente;
      toast.success(mode === "new" ? `${payload.nome} cadastrado!` : "Alterações salvas!");
      if (perfil) {
        await registrarLog(
          perfil.user_id,
          perfil.nome,
          mode === "new" ? "CRIAR_CLIENTE" : "EDITAR_CLIENTE",
          "clientes",
          saved.id,
          mode === "new"
            ? `Gestor criou o cliente "${payload.nome}"`
            : `Gestor alterou configurações do cliente "${payload.nome}"`
        );
      }
      onSaved(saved);
      onClose();
    } catch (err: unknown) {
      toast.error(`Erro ao salvar: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const [activeTab, setActiveTab] = useState<"perfil" | "campanhas" | "financeiro" | "integracoes">(initialTab ?? "perfil");

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="w-full sm:max-w-lg bg-[#1a1917] border border-[#2e2c29] rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col"
        style={{ maxHeight: "92dvh" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2e2c29] shrink-0 bg-[#111010]">
          <div>
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.18em] text-amber-500 mb-0.5">
              {mode === "new" ? "Cadastrar Cliente" : "Editar Cliente"}
            </p>
            <h2 className="font-bold text-[#e8e2d8] text-sm flex items-center gap-2">
              {mode === "new" ? (
                <><Sparkles size={14} className="text-amber-500" /> Novo Cliente</>
              ) : (
                <><Pencil size={14} className="text-amber-500" /> {initial?.nome ?? "Editar"}</>
              )}
            </h2>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#201f1d] border border-[#2e2c29] text-[#7a7268] hover:text-[#e8e2d8] transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#2e2c29] bg-[#111010] shrink-0 px-1">
          {(["perfil", "campanhas", "financeiro", "integracoes"] as const).map(tab => {
            const labels: Record<string, string> = {
              perfil: "Perfil",
              campanhas: "Camps.",
              financeiro: "Financeiro",
              integracoes: "Integrações",
            };
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap ${
                  activeTab === tab
                    ? "border-amber-500 text-amber-400"
                    : "border-transparent text-[#4a4844] hover:text-[#7a7268]"
                }`}
              >
                {labels[tab]}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div
          className="flex-1 overflow-y-auto px-5 py-5 space-y-5"
          style={{ WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}
        >
          {activeTab === "perfil" && (
            <div className="space-y-5">
          {/* Nome */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#7a7268]">Nome do Cliente</label>
            
            <input
              type="text" value={nome} onChange={e => setNome(e.target.value)}
              placeholder="Ex: JAC Cosméticos"
              className="w-full bg-[#201f1d] border border-[#2e2c29] rounded-xl px-4 py-2.5 text-sm text-[#e8e2d8] placeholder:text-[#4a4844] outline-none focus:border-amber-500/60 transition-colors"
            />
          </div>

          {/* Gestor de Tráfego */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#7a7268]">Gestor de Tráfego</label>
            {gestoresLoading ?
            (
              <div className="h-10 bg-[#201f1d] border border-[#2e2c29] rounded-xl animate-pulse" />
            ) : (
              <div className="relative">
                <select value={gestor} onChange={e => setGestor(e.target.value)}
                  className="w-full appearance-none bg-[#201f1d] border border-[#2e2c29] rounded-xl px-4 pr-9 py-2.5 text-sm text-[#e8e2d8] outline-none focus:border-amber-500/60 transition-colors cursor-pointer">
                  <option value="">Selecionar gestor</option>
                  {gestoresTraf.map(g => <option key={g} value={g}>{g}</option>)}
                  {/* Valor atual que pode ter sido desativado depois */}
                  {initial?.gestor && !gestoresTraf.includes(initial.gestor) && (
                    <option value={initial.gestor}>{initial.gestor} ↩ atual</option>
                  )}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#7a7268]" size={14} />
              </div>
            )}
          </div>

          {/* Gestor Estratégico */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#7a7268]">Gestor Estratégico</label>
            {gestoresLoading ?
            (
              <div className="h-9 bg-[#201f1d] border border-[#2e2c29] rounded-xl animate-pulse" />
            ) : (
              <div className="flex flex-wrap gap-2">
                {gestoresEstrat.map(g => (
                  <button key={g} type="button" onClick={() => setGestorEstrat(g)}
                    className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-all flex items-center gap-1.5 ${
                      gestorEstrat === g
                        ? g === "Duda"  ? "bg-blue-600 border-blue-500 text-white"
                          : g === "Diego" ? "bg-purple-600 border-purple-500 text-white"
                          : "bg-amber-500 border-amber-400 text-[#111]"
                        : "bg-[#201f1d] border-[#2e2c29] text-[#7a7268] hover:text-[#e8e2d8] hover:border-[#7a7268]"
                    }`}>
                    <User size={13} /> {g}
                  </button>
                ))}
                {/* Valor atual desativado — mantém selecionável */}
                {initial?.gestor_estrategico && !gestoresEstrat.includes(initial.gestor_estrategico) && (
                  <button type="button" onClick={() => setGestorEstrat(initial.gestor_estrategico)}
                    className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-all opacity-60 ${
                      gestorEstrat === initial.gestor_estrategico
                        ? "bg-amber-500 border-amber-400 text-[#111]"
                        : "bg-[#201f1d] border-[#2e2c29] text-[#7a7268]"
                    }`}>
                    <User size={12} className="inline-block mr-1" />{initial.gestor_estrategico} ↩
                  </button>
               )}
                {gestoresEstrat.length === 0 && (
                  <p className="text-xs text-[#7a7268] italic py-1">Nenhum gestor estratégico com seleção ativa.</p>
                )}
              </div>
            )}
          </div>

          {/* Status — apenas edição */}
          {mode === "edit" && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#7a7268]">Status</label>
              <div className="flex flex-wrap gap-2">
                {([
                  { value: "ATIVO"        as const, label: "Ativo",           color: "emerald" },
                  { value: "SEM CAMPANHA" as const, label: "Sem Camp.",      color: "amber"   },
                  { value: "CANCELAMENTO" as const, label: "Cancelamento",   color: "red"     },
                ] as const).map(opt => (
                  <button key={opt.value} type="button" onClick={() => setStatus(opt.value)}
                    className={`flex-1 min-w-[100px] py-2 rounded-xl text-xs font-semibold border transition-all ${
                      status === opt.value
                        ? opt.color === "emerald" ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                          : opt.color === "amber"   ? "bg-amber-500/15 border-amber-500/40 text-amber-400"
                          : "bg-red-500/15 border-red-500/40 text-red-400"
                        : "bg-[#201f1d] border-[#2e2c29] text-[#7a7268] hover:border-[#7a7268]"
                    }`}>
                    <div className="flex items-center justify-center gap-1.5">
                      <Circle size={8} className={status === opt.value ? "fill-current" : ""} />
                      {opt.label}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
            </div>
          )}

          {activeTab === "campanhas" && (
            <div className="space-y-5">
          {/* Plataformas + Campanhas dinâmicas */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#7a7268]">
                Plataformas &amp; Campanhas
              </label>
              {/* Contador global de campanhas selecionadas */}
              {(() => {
                const total = PLATFORM_DEFS
                  .filter(d => activePlats.has(d.key))
                  .reduce((acc, d) => acc + (camps[d.key]?.length ?? 0), 0);
                return total > 0 ? (
                  <span className="text-[9px] font-semibold text-amber-500/60">
                    {total} campanha{total !== 1 ? "s" : ""} ativa{total !== 1 ? "s" : ""}
                  </span>
                ) : null;
              })()}
            </div>

            {PLATFORM_DEFS.map(def => {
              const isActive = activePlats.has(def.key);
              return (
                <div key={def.key}>
                  {/* Linha de toggle da plataforma */}
                  <div
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer select-none transition-all ${
                      isActive
                        ? "border-amber-500/40 bg-amber-500/5 rounded-b-none border-b-0"
                        : "border-[#2e2c29] bg-[#201f1d] hover:border-[#3a3835]"
                    }`}
                    onClick={() => togglePlatform(def.key)}
                  >
                    {/* Checkbox visual */}
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                      isActive ? "bg-amber-500 border-amber-500" : "border-[#3a3835]"
                    }`}>
                      {isActive && <Check size={12} className="text-[#111] stroke-[4]" />}
                    </div>
                    <span className="shrink-0">{PLATFORM_SVG[def.key]}</span>
                    <span className={`font-semibold text-sm flex-1 transition-colors ${
                      isActive ? "text-[#e8e2d8]" : "text-[#7a7268]"
                    }`}>
                      {def.label}
                    </span>
                    {/* Badge: qtd de campanhas selecionadas */}
                    {isActive && (camps[def.key]?.length ?? 0) > 0 && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${PLATFORM_CHIP_COLOR[def.key]}`}>
                        {camps[def.key].length}
                      </span>
                    )}
                    <ChevronDown size={14} className={`shrink-0 transition-transform ${isActive ? "text-amber-400 rotate-180" : "text-[#3a3835]"}`} />
                  </div>

                  {/* Campanhas aparecem IMEDIATAMENTE abaixo */}
                  {isActive && (
                    <div className="border border-amber-500/20 border-t-0 rounded-b-xl bg-[#111010]/60 px-4 py-3">
                      <PlatformCampaignSelector
                        platKey={def.key}
                        selectedCamps={camps[def.key] ?? []}
                        onChange={newCamps => setCamps(prev => ({ ...prev, [def.key]: newCamps }))}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
            </div>
          )}

          {activeTab === "financeiro" && (
            <div className="space-y-5">
          {/* ── Metas & Orçamentos ──────────────────────────────────────────────── */}
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-amber-500/20 flex items-center justify-center shrink-0">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#f5a623" strokeWidth="2.5"><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></svg>
              </div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#7a7268]">Metas &amp; Orçamento Mensal</label>
            </div>
            {/* Meta de Leads */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-[#4a4844] font-medium flex items-center gap-1">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
                Meta Mensal de Leads
              </label>
              <input type="number" min="0" value={metaLeadsMensal} onChange={e => setMetaLeadsMensal(e.target.value)}
                placeholder="Ex: 50"
                className="w-full bg-[#201f1d] border border-[#2e2c29] rounded-xl px-4 py-2.5 text-sm text-[#e8e2d8] placeholder:text-[#4a4844] outline-none focus:border-amber-500/60 transition-colors"/>
            </div>
            {/* Moeda do cliente */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-[#4a4844] font-medium">Moeda dos Relatórios</label>
              <div className="flex gap-2">
                {(['BRL', 'USD'] as const).map(c => (
                  <button key={c} type="button" onClick={() => setMoeda(c)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                      moeda === c
                        ? c === 'BRL'
                          ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                          : "bg-blue-500/15 border-blue-500/40 text-blue-400"
                        : "bg-[#201f1d] border-[#2e2c29] text-[#7a7268] hover:text-[#e8e2d8] hover:border-[#7a7268]"
                    }`}>
                    {c === 'BRL' ? 'R$ — Real' : 'US$ — Dólar'}
                  </button>
                ))}
              </div>
            </div>

            {/* Verbas — condicionais por plataforma ativa, estado separado por plataforma */}
            {(() => {
              const symbol = moeda === 'USD' ? 'US$' : 'R$';
              const platVerbas: { platKey: PlatformKey; label: string; value: string; setter: (v: string) => void; borderCls: string }[] = [
                { platKey: 'meta',      label: `Verba Meta Ads (${symbol})`,   value: verbaMeta,      setter: setVerbaMeta,      borderCls: 'focus:border-blue-500/50'    },
                { platKey: 'google',    label: `Verba Google Ads (${symbol})`, value: verbaGoogle,    setter: setVerbaGoogle,    borderCls: 'focus:border-emerald-500/50' },
                { platKey: 'gls',       label: `Verba GLS (${symbol})`,        value: verbaGls,       setter: setVerbaGls,       borderCls: 'focus:border-purple-500/50'  },
                { platKey: 'nextdoor',  label: `Verba Nextdoor (${symbol})`,   value: verbaNextdoor,  setter: setVerbaNextdoor,  borderCls: 'focus:border-green-500/50'   },
                { platKey: 'thumbtack', label: `Verba Thumbtack (${symbol})`,  value: verbaThumbtack, setter: setVerbaThumbtack, borderCls: 'focus:border-cyan-500/50'    },
              ];
              const activeVerbas = platVerbas.filter(v => activePlats.has(v.platKey));
              // Grid: 1 coluna se só 1 ativo+outros, 2 colunas se mais
              const totalCols = activeVerbas.length + 1; // +1 para "Outros"
              const gridCls = totalCols === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2';
              return (
                <div className={`grid gap-3 ${gridCls}`}>
                  {activeVerbas.map(v => (
                    <div key={v.platKey} className="space-y-1.5">
                      <label className="text-[10px] text-[#4a4844] font-medium flex items-center gap-1.5 min-h-[1.1rem]">
                        {PLATFORM_SVG[v.platKey]}
                        {v.label}
                      </label>
                      <input type="number" min="0" step="0.01" value={v.value} onChange={e => v.setter(e.target.value)}
                        placeholder="0.00"
                        className={`w-full h-[42px] bg-[#201f1d] border border-[#2e2c29] rounded-xl px-4 py-2.5 text-sm text-[#e8e2d8] placeholder:text-[#4a4844] outline-none transition-colors ${v.borderCls}`}/>
                    </div>
                  ))}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-[#4a4844] font-medium min-h-[1.1rem] flex items-center">Outras Verbas ({symbol})</label>
                    <input type="number" min="0" step="0.01" value={verbaOutros} onChange={e => setVerbaOutros(e.target.value)}
                      placeholder="0.00"
                      className="w-full h-[42px] bg-[#201f1d] border border-[#2e2c29] rounded-xl px-4 py-2.5 text-sm text-[#e8e2d8] placeholder:text-[#4a4844] outline-none focus:border-amber-500/50 transition-colors"/>
                  </div>
                </div>
              );
            })()}
            {/* Budget total preview — moeda exclusiva do seletor */}
            {(verbaMeta !== "" || verbaGoogle !== "" || verbaGls !== "" || verbaNextdoor !== "" || verbaThumbtack !== "" || verbaOutros !== "") && (() => {
              const total = (verbaMeta      !== "" ? Number(verbaMeta)      : 0)
                + (verbaGoogle    !== "" ? Number(verbaGoogle)    : 0)
                + (verbaGls       !== "" ? Number(verbaGls)       : 0)
                + (verbaNextdoor  !== "" ? Number(verbaNextdoor)  : 0)
                + (verbaThumbtack !== "" ? Number(verbaThumbtack) : 0)
                + (verbaOutros    !== "" ? Number(verbaOutros)    : 0);
              const fmtTotal = moeda === 'USD'
                ? `US$ ${total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : `R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
              return (
                <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#111010]/60 border border-[#2e2c29]">
                  <span className="text-[10px] text-[#7a7268] font-semibold uppercase tracking-widest">Orçamento Total Mensal</span>
                  <span className="text-sm font-extrabold text-amber-400">{fmtTotal}</span>
                </div>
              );
            })()}
          </div>

          {/* ── Input Express: Gasto Realizado (outras redes) ────────────────── */}
          <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-4 space-y-3">
            <div className="flex items-start gap-2.5">
              <div className="w-4 h-4 rounded bg-orange-500/20 flex items-center justify-center shrink-0 mt-0.5">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              </div>
              <div className="flex-1 min-w-0">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#7a7268] block mb-0.5">
                  Gasto Realizado — Google / GLS / Outras
                </label>
                <p className="text-[10px] text-[#4a4844] leading-relaxed mb-3">
                  Informe o gasto mensal acumulado das plataformas sem integração direta (Google Ads, GLS, etc.).
                  Este valor é atualizado manualmente pelo gestor e compõe o Dashboard da Diretoria.
                </p>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-orange-400 pointer-events-none select-none">
                    {moeda === "USD" ? "US$" : "R$"}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={gastoManual}
                    onChange={e => setGastoManual(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-[#201f1d] border border-orange-500/20 rounded-xl pl-9 pr-4 py-2.5 text-sm text-[#e8e2d8] placeholder:text-[#4a4844] outline-none focus:border-orange-500/50 transition-colors"
                  />
                </div>
                {gastoManual !== "" && Number(gastoManual) > 0 && (
                  <p className="text-[10px] text-orange-400/70 mt-1.5 font-medium">
                    Aparecerá somado ao gasto Meta no Dashboard da Diretoria.
                  </p>
                )}
              </div>
            </div>
          </div>
            </div>
          )}

          {activeTab === "integracoes" && (
            <div className="space-y-5">
          {/* ── IDs de Integração ────────────────────────────────────────────── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-emerald-500/20 flex items-center justify-center shrink-0">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              </div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#7a7268]">ID de Conta — Google Local Services</label>
            </div>
            <input
              type="text"
              value={glsAccountId}
              onChange={e => setGlsAccountId(e.target.value)}
              placeholder="ID da conta GLS (opcional)"
              className="w-full bg-[#201f1d] border border-[#2e2c29] rounded-xl px-4 py-2.5 text-xs text-[#e8e2d8] placeholder:text-[#3a3835] outline-none focus:border-emerald-500/50 transition-colors font-mono"
            />
          </div>

          {/* ── Integração Meta Ads ─────────────────────────────────────────── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-blue-600 flex items-center justify-center shrink-0">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="white">
                  <path d="M24 12.073c0-6.627-5.372-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#7a7268]">Integração Meta Ads</label>
              {metaAccountId && (
                <span className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
                  <Wifi size={10} /> Vinculada
                </span>
              )}
            </div>

            {/* Token específico */}
            <div className="space-y-1">
              <label className="text-[10px] text-[#4a4844] font-medium">
                Token Específico{" "}<span className="text-[#3a3835]">(opcional — se vazio usa o Token Geral do sistema)</span>
              </label>
              <input
                type="password"
                value={metaToken}
                onChange={e => setMetaToken(e.target.value)}
                placeholder="EAAxxxxx... (deixe vazio para usar token geral)"
                className="w-full bg-[#201f1d] border border-[#2e2c29] rounded-xl px-4 py-2.5 text-xs text-[#e8e2d8] placeholder:text-[#3a3835] outline-none focus:border-blue-500/50 transition-colors font-mono"
              />
            </div>

            {/* Botão buscar contas */}
            <button
              type="button"
              onClick={handleFetchAccounts}
              disabled={metaLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600/15 border border-blue-500/30 text-blue-400 text-xs font-semibold hover:bg-blue-600/25 transition-colors disabled:opacity-50 disabled:pointer-events-none"
            >
              {metaLoading
                ? <><Loader2 size={13} className="animate-spin" /> Buscando contas...</>
                : <><RefreshCw size={13} /> Buscar Contas Disponíveis</>
              }
            </button>

            {/* Autocomplete de contas */}
            {metaAccounts.length > 0 && (
              <div className="space-y-2">
                <label className="text-[10px] text-[#4a4844] font-medium">Conta de Anúncios</label>

                <div className="relative" ref={metaDropdownRef}>
                  {/* Campo de busca / autocomplete */}
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a4844] pointer-events-none z-10" />
                    <input
                      ref={metaSearchRef}
                      type="text"
                      value={metaAccountSearch}
                      onChange={e => {
                        setMetaAccountSearch(e.target.value);
                        setMetaDropdownOpen(true);
                        // Se o usuário editar o campo, limpa a seleção anterior
                        if (metaAccountId) setMetaAccountId("");
                      }}
                      onFocus={() => setMetaDropdownOpen(true)}
                      placeholder={
                        metaAccountId
                          ? (() => {
                              const sel = metaAccounts.find(a => String(a.id) === metaAccountId);
                              return sel ? `${sel.name} (${sel.id})` : "Conta selecionada";
                            })()
                          : "Buscar por nome ou ID..."
                      }
                      className={`w-full bg-[#111010] border rounded-xl pl-8 pr-9 py-2.5 text-xs text-[#e8e2d8] placeholder:text-[#3a3835] outline-none transition-colors ${
                        metaAccountId
                          ? "border-emerald-500/40 placeholder:text-emerald-400/80 focus:border-emerald-500/70"
                          : metaDropdownOpen
                          ? "border-blue-500/50"
                          : "border-[#2e2c29] focus:border-blue-500/50"
                      }`}
                    />
                    {/* Ícone direito: check se selecionado, X se tem texto, seta se vazio */}
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center">
                      {metaAccountId ? (
                        <Check size={14} className="text-emerald-400" />
                      ) : metaAccountSearch ? (
                        <button
                          type="button"
                          onClick={() => { setMetaAccountSearch(""); setMetaDropdownOpen(true); metaSearchRef.current?.focus(); }}
                          className="text-[#4a4844] hover:text-[#e8e2d8] transition-colors"
                        >
                          <X size={12} />
                        </button>
                      ) : (
                        <ChevronDown size={13} className={`text-[#4a4844] transition-transform ${metaDropdownOpen ? "rotate-180" : ""}`} />
                      )}
                    </div>
                  </div>

                  {/* Lista dropdown */}
                  {metaDropdownOpen && (() => {
                    const q = metaAccountSearch.toLowerCase().trim();
                    const filtered = q
                      ? metaAccounts.filter(acc =>
                          acc.name.toLowerCase().includes(q) ||
                          String(acc.id).toLowerCase().includes(q)
                        )
                      : metaAccounts;

                    return (
                      <div
                        className="absolute left-0 right-0 top-[calc(100%+4px)] z-[200] bg-[#1a1917] border border-[#2e2c29] rounded-xl shadow-2xl overflow-hidden"
                        style={{ maxHeight: "220px", overflowY: "auto" }}
                      >
                        {filtered.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-5 gap-1.5">
                            <Search size={16} className="text-[#3a3835]" />
                            <p className="text-[10px] text-[#4a4844] italic">
                              Nenhuma conta para &ldquo;{metaAccountSearch}&rdquo;
                            </p>
                          </div>
                        ) : (
                          <>
                            <div className="px-3 py-1.5 border-b border-[#1e1c1a]">
                              <p className="text-[9px] font-semibold text-[#4a4844] uppercase tracking-widest">
                                {filtered.length} de {metaAccounts.length} conta{metaAccounts.length !== 1 ? "s" : ""}
                              </p>
                            </div>
                            {filtered.map(acc => {
                              const isSelected = String(acc.id) === metaAccountId;
                              return (
                                <button
                                  key={acc.id}
                                  type="button"
                                  onMouseDown={e => {
                                    // mouseDown antes do blur do input
                                    e.preventDefault();
                                    setMetaAccountId(String(acc.id));
                                    setMetaAccountSearch("");
                                    setMetaDropdownOpen(false);
                                  }}
                                  className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors group ${
                                    isSelected
                                      ? "bg-blue-500/10"
                                      : "hover:bg-[#201f1d]"
                                  }`}
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className={`text-xs font-medium truncate transition-colors ${
                                      isSelected ? "text-blue-300" : "text-[#c8c0b4] group-hover:text-[#e8e2d8]"
                                    }`}>
                                      {acc.name}
                                    </p>
                                    <p className="text-[10px] text-[#4a4844] font-mono mt-0.5">{acc.id}</p>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${
                                      acc.status === 1
                                        ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/25"
                                        : "text-orange-400 bg-orange-500/10 border-orange-500/25"
                                    }`}>
                                      {acc.status === 1 ? "ATIVA" : "!"}
                                    </span>
                                    {isSelected && (
                                      <Check size={13} className="text-emerald-400" />
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Confirmação da conta selecionada */}
                {metaAccountId && (() => {
                  const sel = metaAccounts.find(a => String(a.id) === metaAccountId);
                  return sel ? (
                    <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                      <div className="flex items-center gap-2 min-w-0">
                        <Check size={11} className="text-emerald-400 shrink-0" />
                        <span className="text-[10px] text-emerald-300 font-medium truncate">{sel.name}</span>
                        <span className="text-[10px] text-[#4a4844] font-mono shrink-0">({sel.id})</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setMetaAccountId(""); setMetaAccountSearch(""); }}
                        className="text-[10px] text-[#4a4844] hover:text-red-400 font-semibold transition-colors shrink-0 ml-2"
                      >
                        Limpar
                      </button>
                    </div>
                  ) : null;
                })()}
              </div>
            )}

            {/* Conta já vinculada (sem ter clicado em buscar) */}
            {metaAccountId && metaAccounts.length === 0 && (
              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-blue-500/8 border border-blue-500/20">
                <div className="flex items-center gap-2">
                  <Link2 size={12} className="text-blue-400" />
                  <span className="text-xs text-[#e8e2d8] font-mono">{metaAccountId}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMetaAccountId("")}
                  className="text-[10px] text-red-400 hover:text-red-300 font-semibold transition-colors"
                >
                  Desvincular
                </button>
              </div>
            )}
          </div>

          <div className="pb-2" />

          {/* ── Blacklist de Campanhas ────────────────────────────────────── */}
          {metaAccountId && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 space-y-3">
              {/* Header */}
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-red-400 flex items-center gap-1.5">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                    Blacklist de Campanhas
                  </p>
                  <p className="text-[10px] text-[#7a7268] mt-0.5">
                    Campanhas marcadas são excluídas do Gasto, Leads e CPL.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleFetchCampaigns}
                  disabled={campListLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap shrink-0"
                >
                  {campListLoading
                    ? <><Loader2 size={11} className="animate-spin" /> Buscando...</>
                    : <><RefreshCw size={11} /> Buscar Campanhas</>}
                </button>
              </div>

              {/* Aviso sobre ignoradas já salvas (sem ter buscado ainda) */}
              {ignoredCamps.length > 0 && campaignList.length === 0 && !campListLoading && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-red-400 shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <p className="text-[10px] text-red-300">
                    <span className="font-bold">{ignoredCamps.length}</span> campanha{ignoredCamps.length !== 1 ? "s" : ""} ignorada{ignoredCamps.length !== 1 ? "s" : ""} salva{ignoredCamps.length !== 1 ? "s" : ""}. Clique em "Buscar Campanhas" para gerenciar.
                  </p>
                </div>
              )}

              {/* Erro */}
              {campListError && (
                <p className="text-[10px] text-red-400 font-semibold">{campListError}</p>
              )}

              {/* Lista de campanhas */}
              {campaignList.length > 0 && (
                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-0.5">
                  {campaignList.map(camp => {
                    const isIgnored = ignoredCamps.includes(camp.id);
                    const isActive  = camp.status === "ACTIVE";
                    return (
                      <button
                        key={camp.id}
                        type="button"
                        onClick={() => setIgnoredCamps(prev =>
                          isIgnored ? prev.filter(id => id !== camp.id) : [...prev, camp.id]
                        )}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${
                          isIgnored
                            ? "border-red-500/40 bg-red-500/10"
                            : "border-[#2e2c29] bg-[#111010] hover:border-[#3a3835]"
                        }`}
                      >
                        {/* Checkbox visual */}
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                          isIgnored ? "bg-red-500 border-red-500" : "border-[#3a3835]"
                        }`}>
                          {isIgnored && (
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round"><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/><line x1="19.07" y1="4.93" x2="4.93" y2="19.07"/></svg>
                          )}
                        </div>
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-semibold truncate ${isIgnored ? "text-red-300 line-through opacity-70" : "text-[#e8e2d8]"}`}>
                            {camp.name}
                          </p>
                          <p className="text-[9px] text-[#4a4844] font-mono mt-0.5">{camp.id}</p>
                        </div>
                        {/* Status badge */}
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border shrink-0 ${
                          isActive
                            ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/25"
                            : "text-[#7a7268] bg-[#2e2c29] border-[#3a3835]"
                        }`}>
                          {isActive ? "ATIVA" : "PAUSADA"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Resumo de ignoradas */}
              {campaignList.length > 0 && (
                <p className={`text-[10px] font-semibold ${ignoredCamps.length > 0 ? "text-red-400" : "text-[#4a4844]"}`}>
                  {ignoredCamps.length > 0
                    ? `${ignoredCamps.length} campanha${ignoredCamps.length !== 1 ? "s" : ""} ignorada${ignoredCamps.length !== 1 ? "s" : ""} — excluída${ignoredCamps.length !== 1 ? "s" : ""} do cálculo de métricas.`
                    : "Nenhuma campanha ignorada. Todas entram no cálculo."}
                </p>
              )}
            </div>
          )}

          <div className="pb-2" />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 py-4 border-t border-[#2e2c29] flex gap-3 bg-[#111010]">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-[#201f1d] border border-[#2e2c29] text-[#7a7268] text-sm font-semibold hover:text-[#e8e2d8] transition-colors">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-amber-500 text-[#111] text-sm font-bold hover:bg-amber-400 active:scale-95 transition-all shadow-[0_4px_16px_rgba(245,166,35,0.3)] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} className="fill-current" />}
            {saving ? "Salvando..." : mode === "new" ? "Cadastrar" : "Salvar"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// MODAL: SETTINGS (Gestores)
// ═══════════════════════════════════════════════════════════════════════════════

export interface OperacaoSimples { id: string; nome: string; }
export interface GestorAcesso {
  id: string; nome: string;
  role: "admin" | "gestor";
  user_id: string;
  operacao_id: string[] | null;
}

export interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  gestoresEstrat: string[];
  gestoresTrafego: string[];
  onRenameEstrat:  (o: string, n: string) => Promise<void>;
  onDeleteEstrat:  (n: string) => Promise<void>;
  onAddEstrat:     (n: string) => Promise<void>;
  onRenameTrafego: (o: string, n: string) => Promise<void>;
  onDeleteTrafego: (n: string) => Promise<void>;
  onAddTrafego:    (n: string) => Promise<void>;
  // Novas props para Unidades e Acessos
  operacoes?:          OperacaoSimples[];
  onDeleteOperacao?:   (id: string) => Promise<void>;
  onRefreshOperacoes?: () => Promise<void>;
  // Guard: somente admin logado pode alterar acessos
  isCallerAdmin?: boolean;
}

export function SettingsModal({
  open, onClose,
  gestoresEstrat, gestoresTrafego,
  onRenameEstrat, onDeleteEstrat, onAddEstrat,
  onRenameTrafego, onDeleteTrafego, onAddTrafego,
  operacoes = [], onDeleteOperacao, onRefreshOperacoes,
  isCallerAdmin = false,
}: SettingsModalProps) {
  type Tab = "estrategico" | "trafego" | "unidades" | "acessos";
  const [tab, setTab]         = useState<Tab>("estrategico");
  const [editing, setEditing] = useState<{ idx: number; val: string } | null>(null);
  const [newVal, setNewVal]   = useState("");
  const [busy, setBusy]       = useState(false);

  // ── Gestores de Acesso ───────────────────────────────────────────────────────
  const [gestoresAcesso, setGestoresAcesso] = useState<GestorAcesso[]>([]);
  const [acessoLoading, setAcessoLoading]   = useState(false);
  const [acessoBusy, setAcessoBusy]         = useState<string | null>(null);

  const fetchGestoresAcesso = useCallback(async () => {
    setAcessoLoading(true);
    try {
      const { data, error } = await supabase
        .from("gestores")
        .select("id, nome, role, user_id, operacao_id")
        .order("created_at", { ascending: true });
      if (error) throw error;
      setGestoresAcesso((data ?? []) as GestorAcesso[]);
    } catch (err) {
      toast.error(`Erro ao carregar usuários: ${err instanceof Error ? err.message : "Erro"}`);
    } finally {
      setAcessoLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) { setEditing(null); setNewVal(""); setTab("estrategico"); fetchGestoresAcesso(); }
  }, [open, fetchGestoresAcesso]);

  // Recarrega acessos quando operações mudam (nova op criada) e aba está visível
  useEffect(() => {
    if (open && tab === "acessos") fetchGestoresAcesso();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operacoes.length]);

  // ── Toggle de operação para um gestor ───────────────────────────────────────
  const handleToggleOpAcesso = async (gestor: GestorAcesso, opId: string) => {
    if (gestor.role === "admin") return;
    // Somente admin logado pode alterar acessos
    if (!isCallerAdmin) {
      toast.error("Sem permissão para alterar acessos.");
      return;
    }
    const current = gestor.operacao_id ?? [];
    const next = current.includes(opId)
      ? current.filter(id => id !== opId)
      : [...current, opId];
    setAcessoBusy(gestor.id);
    try {
      // Usa createBrowserClient para carregar a sessão autenticada do cookie,
      // garantindo que as políticas RLS do Supabase aceitem o UPDATE.
      const { createBrowserClient } = await import("@supabase/ssr");
      const sbAuth = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { error } = await sbAuth
        .from("gestores")
        .update({ operacao_id: next.length > 0 ? next : null })
        .eq("id", gestor.id);
      if (error) throw error;
      // Sincroniza estado local sem precisar de F5
      setGestoresAcesso(prev =>
        prev.map(g => g.id === gestor.id
          ? { ...g, operacao_id: next.length > 0 ? next : null }
          : g)
      );
      toast.success(`Acesso de ${gestor.nome} atualizado`);
    } catch (err) {
      toast.error(`Erro: ${err instanceof Error ? err.message : "Erro desconhecido"}`);
    } finally {
      setAcessoBusy(null);
    }
  };

  // ── Gestores de names (estratégico / tráfego) ────────────────────────────────
  const isEstrat = tab === "estrategico";
  const list     = isEstrat ? gestoresEstrat : gestoresTrafego;
  const onRename = isEstrat ? onRenameEstrat  : onRenameTrafego;
  const onDelete = isEstrat ? onDeleteEstrat  : onDeleteTrafego;
  const onAdd    = isEstrat ? onAddEstrat     : onAddTrafego;

  const handleSaveEdit = async (original: string) => {
    const trimmed = editing?.val.trim() ?? "";
    if (!trimmed) { toast.error("O nome não pode estar vazio."); return; }
    if (trimmed !== original && list.includes(trimmed)) { toast.error("Já existe um gestor com esse nome."); return; }
    if (trimmed !== original) { setBusy(true); await onRename(original, trimmed); setBusy(false); }
    setEditing(null);
  };

  const handleAdd = async () => {
    const trimmed = newVal.trim();
    if (!trimmed) return;
    if (list.includes(trimmed)) { toast.error("Já existe um gestor com esse nome."); return; }
    setBusy(true); await onAdd(trimmed); setBusy(false);
    setNewVal("");
    toast.success(`"${trimmed}" adicionado!`);
  };

  const handleDeleteGestor = async (name: string) => {
    if (!confirm(`Remover "${name}"?`)) return;
    setBusy(true); await onDelete(name); setBusy(false);
    toast.success(`"${name}" removido.`);
  };

  // ── Deletar operação ─────────────────────────────────────────────────────────
  const handleDeleteOperacao = async (op: OperacaoSimples) => {
    if (!confirm(
      `Deseja excluir a unidade "${op.nome}"?\n\nIsso não afetará os clientes, mas eles ficarão sem unidade atribuída.`
    )) return;
    if (!onDeleteOperacao) return;
    setBusy(true);
    try {
      await onDeleteOperacao(op.id);
      toast.success(`Unidade "${op.nome}" excluída.`);
      if (onRefreshOperacoes) await onRefreshOperacoes();
    } catch (err) {
      toast.error(`Erro: ${err instanceof Error ? err.message : "Erro"}`);
    } finally {
      setBusy(false);
    }
  };

  const TAB_DEFS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "estrategico", label: "Estratégicos", icon: <Users    size={12} /> },
    { key: "trafego",     label: "Tráfego",      icon: <Layers   size={12} /> },
    { key: "unidades",    label: "Unidades",     icon: <Building2 size={12} /> },
    { key: "acessos",     label: "Acessos",      icon: <ShieldCheck size={12} /> },
  ];

  return (
    <Dialog.Root open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100]" style={{ backgroundColor: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }} />
        <Dialog.Content className="fixed z-[101] inset-x-0 bottom-0 sm:inset-0 sm:flex sm:items-center sm:justify-center" onInteractOutside={onClose}>
          <motion.div
            initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            className="w-full sm:max-w-lg bg-[#1a1917] border border-[#2e2c29] rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col"
            style={{ maxHeight: "90dvh" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#2e2c29] shrink-0">
              <Dialog.Title className="font-bold text-[#e8e2d8] flex items-center gap-2">
                <Settings size={18} className="text-amber-500" /> Configurações Globais
              </Dialog.Title>
              <Dialog.Close asChild>
                <button className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#201f1d] border border-[#2e2c29] text-[#7a7268] hover:text-[#e8e2d8] transition-colors">
                  <X size={16} />
                </button>
              </Dialog.Close>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 px-5 pt-4 pb-1 shrink-0 overflow-x-auto no-scrollbar">
              {TAB_DEFS.map(t => (
                <button key={t.key}
                  onClick={() => { setTab(t.key); setEditing(null); setNewVal(""); }}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1.5 ${
                    tab === t.key ? "bg-amber-500 text-[#111]" : "bg-[#201f1d] border border-[#2e2c29] text-[#7a7268] hover:text-[#e8e2d8]"
                  }`}>
                  {t.icon}{t.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2" style={{ WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}>

              {/* ── Gestores (Estratégico / Tráfego) ── */}
              {(tab === "estrategico" || tab === "trafego") && (
                <>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#7a7268] mb-3">
                    {list.length} gestor{list.length !== 1 ? "es" : ""} cadastrado{list.length !== 1 ? "s" : ""}
                  </p>
                  {list.length === 0 && (
                    <div className="flex items-center justify-center py-8 text-[#7a7268] text-sm">Nenhum gestor cadastrado.</div>
                  )}
                  {list.map((name, idx) => (
                    <div key={name} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-colors ${
                      editing?.idx === idx ? "border-amber-500/50 bg-amber-500/5" : "border-[#2e2c29] bg-[#201f1d]"
                    }`}>
                      {editing?.idx === idx ? (
                        <>
                          <input autoFocus value={editing.val}
                            onChange={e => setEditing({ idx, val: e.target.value })}
                            onKeyDown={e => { if (e.key === "Enter") handleSaveEdit(name); if (e.key === "Escape") setEditing(null); }}
                            className="flex-1 bg-transparent text-sm text-[#e8e2d8] outline-none min-w-0"/>
                          <button onClick={() => handleSaveEdit(name)} disabled={busy}
                            className="px-2.5 py-1 rounded-lg bg-amber-500 text-[#111] text-xs font-bold hover:bg-amber-400 transition-colors shrink-0 disabled:opacity-50">
                            {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                          </button>
                          <button onClick={() => setEditing(null)}
                            className="px-2.5 py-1 rounded-lg bg-[#2e2c29] text-[#7a7268] text-xs hover:text-[#e8e2d8] transition-colors shrink-0">
                            <X size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 text-sm font-medium text-[#e8e2d8] truncate">{name}</span>
                          <button onClick={() => setEditing({ idx, val: name })}
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#2e2c29] text-[#7a7268] hover:text-amber-400 hover:bg-amber-500/10 transition-colors shrink-0">
                            <Pencil size={12} />
                          </button>
                          <button onClick={() => handleDeleteGestor(name)} disabled={busy}
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#2e2c29] text-[#7a7268] hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0 disabled:opacity-50">
                            <Trash2 size={12} />
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                  <div className="flex gap-2 pt-2">
                    <input type="text" value={newVal} onChange={e => setNewVal(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") handleAdd(); }}
                      placeholder={isEstrat ? "Ex: João Silva" : "Ex: MR"}
                      className="flex-1 bg-[#201f1d] border border-[#2e2c29] rounded-xl px-4 py-2.5 text-sm text-[#e8e2d8] placeholder:text-[#4a4844] outline-none focus:border-amber-500/60 transition-colors"/>
                    <button onClick={handleAdd} disabled={!newVal.trim() || busy}
                      className="px-4 py-2.5 rounded-xl bg-amber-500 text-[#111] text-sm font-bold hover:bg-amber-400 active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none shrink-0 flex items-center gap-1.5">
                      {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                      Add
                    </button>
                  </div>
                  <p className="text-[10px] text-[#7a7268] pt-1 leading-relaxed flex items-center gap-1">
                    <Sparkles size={11} className="text-amber-500/70 shrink-0" /> Ao renomear, todos os clientes vinculados são atualizados em cascata.
                  </p>
                </>
              )}

              {/* ── Unidades (CRUD de Operações) ── */}
              {tab === "unidades" && (
                <>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#7a7268] mb-3">
                    {operacoes.length} unidade{operacoes.length !== 1 ? "s" : ""} cadastrada{operacoes.length !== 1 ? "s" : ""}
                  </p>
                  {operacoes.length === 0 && (
                    <div className="flex items-center justify-center py-8 text-[#7a7268] text-sm">Nenhuma unidade cadastrada.</div>
                  )}
                  {operacoes.map(op => (
                    <div key={op.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-[#2e2c29] bg-[#201f1d]">
                      <Building2 size={14} className="text-amber-500/70 shrink-0" />
                      <span className="flex-1 text-sm font-medium text-[#e8e2d8] truncate">{op.nome}</span>
                      <button
                        onClick={() => handleDeleteOperacao(op)}
                        disabled={busy}
                        title={`Excluir unidade "${op.nome}"`}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#2e2c29] text-[#7a7268] hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0 disabled:opacity-50"
                      >
                        {busy ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      </button>
                    </div>
                  ))}
                  <div className="rounded-xl border border-amber-500/15 bg-amber-500/5 px-3 py-2.5 mt-2">
                    <p className="text-[10px] text-amber-400/70 leading-relaxed">
                      Para criar uma nova unidade, use o botão <strong>+ Nova Operação</strong> no Portal de Operações.
                      Excluir uma unidade não remove os clientes vinculados a ela.
                    </p>
                  </div>
                </>
              )}

              {/* ── Acessos (Vínculo de usuários às operações) ── */}
              {tab === "acessos" && (
                <>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#7a7268] mb-3">
                    Permissões por usuário
                  </p>
                  {acessoLoading && (
                    <div className="flex items-center justify-center py-8 gap-2 text-[#7a7268]">
                      <Loader2 size={16} className="animate-spin" />
                      <span className="text-sm">Carregando usuários...</span>
                    </div>
                  )}
                  {!acessoLoading && gestoresAcesso.length === 0 && (
                    <div className="flex items-center justify-center py-8 text-[#7a7268] text-sm">Nenhum usuário encontrado.</div>
                  )}
                  {!acessoLoading && gestoresAcesso.map(gestor => {
                    const isAdmin = gestor.role === "admin";
                    const opIds   = gestor.operacao_id ?? [];
                    const isBusy  = acessoBusy === gestor.id;
                    return (
                      <div key={gestor.id} className="rounded-xl border border-[#2e2c29] bg-[#201f1d] overflow-hidden">
                        {/* Cabeçalho do gestor */}
                        <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-[#2a2826]">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            isAdmin ? "bg-violet-500/20" : "bg-amber-500/15"
                          }`}>
                            <UserCheck size={13} className={isAdmin ? "text-violet-400" : "text-amber-400"} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-[#e8e2d8] truncate">{gestor.nome}</p>
                            <p className={`text-[9px] font-bold uppercase tracking-wider ${
                              isAdmin ? "text-violet-400" : "text-[#4a4844]"
                            }`}>{isAdmin ? "Admin" : "Gestor"}</p>
                          </div>
                          {isBusy && <Loader2 size={13} className="animate-spin text-amber-400 shrink-0" />}
                        </div>
                        {/* Checkboxes de operações */}
                        <div className="px-3 py-2.5 flex flex-wrap gap-2">
                          {operacoes.length === 0 && (
                            <p className="text-[10px] text-[#4a4844] italic">Nenhuma unidade cadastrada.</p>
                          )}
                          {operacoes.map(op => {
                            const checked = isAdmin || opIds.includes(op.id);
                            return (
                              <button
                                key={op.id}
                                disabled={isAdmin || isBusy}
                                onClick={() => handleToggleOpAcesso(gestor, op.id)}
                                title={isAdmin ? "Admin tem acesso a todas as unidades" : `${checked ? "Remover" : "Dar"} acesso a ${op.nome}`}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all
                                  ${checked
                                    ? isAdmin
                                      ? "bg-violet-500/15 border-violet-500/30 text-violet-300 cursor-default"
                                      : "bg-amber-500/15 border-amber-500/30 text-amber-300 hover:bg-amber-500/20"
                                    : "bg-[#1a1917] border-[#2e2c29] text-[#4a4844] hover:border-[#3a3835] hover:text-[#7a7268]"
                                  } disabled:cursor-not-allowed`}
                              >
                                <div className={`w-3 h-3 rounded border flex items-center justify-center shrink-0 transition-colors ${
                                  checked
                                    ? isAdmin ? "bg-violet-500 border-violet-400" : "bg-amber-500 border-amber-400"
                                    : "border-[#3a3835]"
                                }`}>
                                  {checked && <Check size={8} strokeWidth={3} className={isAdmin ? "text-white" : "text-[#111]"} />}
                                </div>
                                {op.nome}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 px-3 py-2.5 mt-1">
                    <p className="text-[10px] text-blue-400/70 leading-relaxed">
                      Admins têm acesso a todas as unidades automaticamente. Alterações de acesso entram em vigor no próximo login do usuário.
                    </p>
                  </div>
                </>
              )}

              <div className="pb-1" />
            </div>

            {/* Footer */}
            <div className="shrink-0 px-5 py-4 border-t border-[#2e2c29]">
              <Dialog.Close asChild>
                <button className="w-full py-2.5 rounded-xl bg-[#201f1d] border border-[#2e2c29] text-[#7a7268] text-sm font-semibold hover:text-[#e8e2d8] transition-colors">Fechar</button>
              </Dialog.Close>
            </div>
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// DIALOG: NOVO LEAD MANUAL
// ═══════════════════════════════════════════════════════════════════════════════

export interface NewLeadDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (lead: Omit<Lead, "id">) => Promise<void>;
}

export function NewLeadDialog({ open, onClose, onSave }: NewLeadDialogProps) {
  const [nome, setNome]             = useState("");
  const [email, setEmail]           = useState("");
  const [telefone, setTelefone]     = useState("");
  const [data, setData]             = useState("");
  const [plataforma, setPlataforma] = useState(LEAD_PLATFORM_OPTIONS[0]);
  const [saving, setSaving]         = useState(false);

  useEffect(() => {
    if (open) { setNome(""); setEmail(""); setTelefone(""); setData(""); setPlataforma(LEAD_PLATFORM_OPTIONS[0]); }
  }, [open]);

  const handleSave = async () => {
    if (!nome.trim() && !telefone.trim() && !email.trim()) {
      toast.error("Preencha ao menos Nome, Telefone ou E-mail.");
      return;
    }
    setSaving(true);
    try {
      let dataFormatada = "";
      if (data) { const [y, m, d] = data.split("-"); dataFormatada = `${d}/${m}/${y}`; }
      await onSave({ nome: nome.trim(), email: email.trim(), telefone: telefone.trim(), data: dataFormatada, plataforma });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100]" style={{ backgroundColor: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }} />
        <Dialog.Content className="fixed z-[101] inset-x-0 bottom-0 sm:inset-0 sm:flex sm:items-center sm:justify-center" onInteractOutside={onClose}>
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="w-full sm:max-w-md bg-[#1a1917] border border-[#2e2c29] rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col" style={{ maxHeight: "90dvh" }}
            >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#2e2c29] shrink-0">
  
              <Dialog.Title className="font-bold text-[#e8e2d8] flex items-center gap-2">
                <Plus size={18} className="text-amber-500" /> Novo Lead Manual
              </Dialog.Title>
              <Dialog.Close asChild>
                <button className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#201f1d] border border-[#2e2c29] text-[#7a7268] hover:text-[#e8e2d8] transition-colors">
                  <X size={16} />
                </button>
      
              </Dialog.Close>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4" style={{ WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}>
              {([
                { label: "Nome",     type: "text",  val: nome,     set: setNome,     ph: "Nome completo" },
  
                { label: "E-mail",   type: "email", val: email,    set: setEmail,    ph: "email@exemplo.com" },
                { label: "Telefone", type: "tel",   val: telefone, set: setTelefone, ph: "+55 11 9 0000-0000" },
              ] as { label: string; type: string; val: string; set: (v: string) => void; ph: string }[]).map(f => (
                <div key={f.label} className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#7a7268]">{f.label}</label>
                  <input type={f.type} value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph}
                    className="w-full bg-[#201f1d] border border-[#2e2c29] rounded-xl px-4 py-2.5 text-sm text-[#e8e2d8] placeholder:text-[#4a4844] outline-none focus:border-amber-500/60 transition-colors"/>
                </div>
              ))}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#7a7268]">Data do Lead</label>
                <input type="date" value={data} onChange={e => setData(e.target.value)}
 
                  className="w-full bg-[#201f1d] border border-[#2e2c29] rounded-xl px-4 py-2.5 text-sm text-[#e8e2d8] outline-none focus:border-amber-500/60 transition-colors [color-scheme:dark] cursor-pointer"/>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#7a7268]">Plataforma</label>
                <div className="relative">
   
                    <select value={plataforma} onChange={e => setPlataforma(e.target.value)}
                    className="w-full appearance-none bg-[#201f1d] border border-[#2e2c29] rounded-xl px-4 pr-9 py-2.5 text-sm text-[#e8e2d8] outline-none focus:border-amber-500/60 transition-colors cursor-pointer">
                    {LEAD_PLATFORM_OPTIONS.map(o => <option key={o}>{o}</option>)}
                  </select>
      
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#7a7268]" size={14} />
                </div>
              </div>
              <div className="pb-1" />
            </div>
            <div className="shrink-0 px-5 py-4 border-t border-[#2e2c29] flex gap-3">
    
              <Dialog.Close asChild>
                <button className="flex-1 py-2.5 rounded-xl bg-[#201f1d] border border-[#2e2c29] text-[#7a7268] text-sm font-semibold hover:text-[#e8e2d8] transition-colors">Cancelar</button>
              </Dialog.Close>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 text-[#111] text-sm font-bold hover:bg-amber-400 active:scale-95 transition-all shadow-[0_4px_16px_rgba(245,166,35,0.3)] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} className="fill-current" />}
                {saving ? "Salvando..." : "Salvar Lead"}
              </button>
            </div>
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ─── Adicionar ao arquivo: app/components/Modais.tsx ────────────────────────
// Cole estes dois componentes no final do arquivo existente (antes do último })
// e adicione os exports correspondentes.

// ─── Types ────────────────────────────────────────────────────────────────────

interface BugReport {
  id: string;
  user_id: string;
  user_nome: string;
  descricao: string;
  image_url: string | null;
  status: "aberto" | "resolvido";
  created_at: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL: REPORTAR BUG (visível para todos)
// ═══════════════════════════════════════════════════════════════════════════════

export function ReportBugModal({
  open,
  onClose,
  userId,
  userNome,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  userNome: string;
}) {
  const [descricao, setDescricao] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback((file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione apenas arquivos de imagem.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 5MB.");
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      handleFileChange(file);
    },
    [handleFileChange]
  );

  const handleSubmit = async () => {
    if (!descricao.trim()) {
      toast.error("Por favor, descreva o problema.");
      return;
    }
    setLoading(true);
    try {
      let image_url: string | null = null;

      if (imageFile) {
        const ext = imageFile.name.split(".").pop();
        const fileName = `bug_${Date.now()}_${userId}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("bugs")
          .upload(fileName, imageFile, { upsert: false });
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("bugs")
          .getPublicUrl(fileName);
        image_url = urlData?.publicUrl ?? null;
      }

      const { error } = await supabase.from("bug_reports").insert({
        user_id: userId,
        user_nome: userNome,
        descricao: descricao.trim(),
        image_url,
        status: "aberto",
      });
      if (error) throw error;

      toast.success("Bug reportado com sucesso! Obrigado pelo feedback.");
      setDescricao("");
      setImageFile(null);
      setImagePreview(null);
      onClose();
    } catch (err: unknown) {
      toast.error(
        `Erro ao enviar: ${err instanceof Error ? err.message : "Erro desconhecido"}`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setDescricao("");
    setImageFile(null);
    setImagePreview(null);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-[#1a1917] border border-[#2e2c29] rounded-2xl shadow-2xl shadow-black/60 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2e2c29]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-500/15 border border-orange-500/25 flex items-center justify-center">
              <Bug size={16} className="text-orange-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#e8e2d8]">Reportar Bug</h2>
              <p className="text-[10px] text-[#7a7268]">Descreva o problema encontrado</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="w-7 h-7 flex items-center justify-center rounded-xl text-[#7a7268] hover:text-[#e8e2d8] hover:bg-[#2e2c29] transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Descrição */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#7a7268]">
              Descrição do problema <span className="text-orange-400">*</span>
            </label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Ao clicar no botão 'Exportar', a página congela e não gera o arquivo..."
              rows={4}
              disabled={loading}
              className="w-full bg-[#111010] border border-[#2e2c29] rounded-xl px-4 py-3 text-sm text-[#e8e2d8] placeholder:text-[#4a4844] outline-none focus:border-orange-500/60 transition-colors resize-none disabled:opacity-50"
            />
            <p className="text-[10px] text-[#4a4844]">
              {descricao.length}/500 caracteres
            </p>
          </div>

          {/* Upload de imagem */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#7a7268]">
              Screenshot (opcional)
            </label>

            {imagePreview ? (
              <div className="relative rounded-xl overflow-hidden border border-[#2e2c29] bg-[#111010]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full max-h-40 object-contain"
                />
                <button
                  onClick={() => {
                    setImageFile(null);
                    setImagePreview(null);
                  }}
                  disabled={loading}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-red-500/80 transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => !loading && fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#2e2c29] rounded-xl p-6 flex flex-col items-center gap-2 cursor-pointer hover:border-orange-500/40 hover:bg-orange-500/5 transition-all group"
              >
                <ImageIcon
                  size={22}
                  className="text-[#4a4844] group-hover:text-orange-400 transition-colors"
                />
                <p className="text-xs text-[#7a7268] text-center">
                  Arraste uma imagem ou{" "}
                  <span className="text-orange-400 font-semibold">clique para selecionar</span>
                </p>
                <p className="text-[10px] text-[#4a4844]">PNG, JPG, WEBP — máx. 5MB</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[#2e2c29] flex gap-2">
          <button
            onClick={handleClose}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl border border-[#2e2c29] text-xs font-semibold text-[#7a7268] hover:text-[#e8e2d8] hover:border-[#7a7268] transition-colors disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !descricao.trim()}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500 text-white text-xs font-bold hover:bg-orange-400 active:scale-95 transition-all shadow-[0_2px_12px_rgba(249,115,22,0.3)] disabled:opacity-40 disabled:pointer-events-none"
          >
            {loading ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Bug size={13} />
                Enviar Report
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL: PAINEL DE BUGS (somente admin)
// ═══════════════════════════════════════════════════════════════════════════════

export function AdminBugsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [bugs, setBugs] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"todos" | "aberto" | "resolvido">("todos");

  const fetchBugs = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("bug_reports")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setBugs((data as BugReport[]) ?? []);
    } catch (err: unknown) {
      toast.error(
        `Erro ao carregar bugs: ${err instanceof Error ? err.message : "Erro desconhecido"}`
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchBugs();
  }, [open, fetchBugs]);

  const handleMarkResolved = async (id: string, currentStatus: BugReport["status"]) => {
    const newStatus: BugReport["status"] =
      currentStatus === "resolvido" ? "aberto" : "resolvido";
    setResolvingId(id);
    try {
      const { error } = await supabase
        .from("bug_reports")
        .update({ status: newStatus })
        .eq("id", id);
      if (error) throw error;
      setBugs((prev) =>
        prev.map((b) => (b.id === id ? { ...b, status: newStatus } : b))
      );
      toast.success(
        newStatus === "resolvido" ? "Bug marcado como resolvido" : "Bug reaberto"
      );
    } catch (err: unknown) {
      toast.error(
        `Erro: ${err instanceof Error ? err.message : "Erro desconhecido"}`
      );
    } finally {
      setResolvingId(null);
    }
  };

  const filteredBugs = bugs.filter((b) =>
    filter === "todos" ? true : b.status === filter
  );

  const countAbertos = bugs.filter((b) => b.status === "aberto").length;
  const countResolvidos = bugs.filter((b) => b.status === "resolvido").length;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-[#1a1917] border border-[#2e2c29] rounded-2xl shadow-2xl shadow-black/60 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2e2c29] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="relative w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
              <Bell size={15} className="text-amber-400" />
              {countAbertos > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center rounded-full bg-orange-500 text-[9px] font-bold text-white">
                  {countAbertos > 9 ? "9+" : countAbertos}
                </span>
              )}
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#e8e2d8]">Notificações de Bugs</h2>
              <p className="text-[10px] text-[#7a7268]">
                {countAbertos} aberto{countAbertos !== 1 ? "s" : ""} · {countResolvidos} resolvido{countResolvidos !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchBugs}
              disabled={loading}
              className="w-7 h-7 flex items-center justify-center rounded-xl text-[#7a7268] hover:text-amber-400 hover:bg-[#2e2c29] transition-colors"
              title="Recarregar"
            >
              <Loader2 size={14} className={loading ? "animate-spin text-amber-400" : ""} />
            </button>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-xl text-[#7a7268] hover:text-[#e8e2d8] hover:bg-[#2e2c29] transition-colors"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="px-5 py-3 border-b border-[#2e2c29] shrink-0 flex gap-1.5">
          {(
            [
              { key: "todos", label: "Todos", count: bugs.length },
              { key: "aberto", label: "Abertos", count: countAbertos },
              { key: "resolvido", label: "Resolvidos", count: countResolvidos },
            ] as { key: typeof filter; label: string; count: number }[]
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                filter === tab.key
                  ? "bg-amber-500 border-amber-400 text-[#111]"
                  : "bg-[#111010] border-[#2e2c29] text-[#7a7268] hover:text-[#e8e2d8] hover:border-[#7a7268]"
              }`}
            >
              {tab.label}
              <span
                className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                  filter === tab.key ? "bg-black/20 text-[#111]" : "bg-[#2e2c29] text-[#7a7268]"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Bug list */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-7 h-7 rounded-full border-2 border-amber-500/20 border-t-amber-500 animate-spin" />
              <p className="text-xs text-[#7a7268]">Carregando reports...</p>
            </div>
          ) : filteredBugs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
              <CheckCircle size={36} className="text-emerald-500/40" />
              <div>
                <p className="text-sm font-semibold text-[#e8e2d8]">
                  {filter === "aberto" ? "Nenhum bug aberto" : "Nenhum report aqui"}
                </p>
                <p className="text-xs text-[#7a7268] mt-0.5">
                  {filter === "aberto"
                    ? "Ótimo! Tudo funcionando."
                    : "Tente outro filtro."}
                </p>
              </div>
            </div>
          ) : (
            filteredBugs.map((bug) => (
              <BugCard
                key={bug.id}
                bug={bug}
                onToggleStatus={() => handleMarkResolved(bug.id, bug.status)}
                isResolving={resolvingId === bug.id}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-componente: Card de Bug ──────────────────────────────────────────────

function BugCard({
  bug,
  onToggleStatus,
  isResolving,
}: {
  bug: BugReport;
  onToggleStatus: () => void;
  isResolving: boolean;
}) {
  const [imgOpen, setImgOpen] = useState(false);

  const formattedDate = new Date(bug.created_at).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const isResolved = bug.status === "resolvido";

  return (
    <>
      <div
        className={`rounded-xl border p-4 transition-all ${
          isResolved
            ? "border-emerald-500/20 bg-emerald-500/5 opacity-70"
            : "border-[#2e2c29] bg-[#111010]"
        }`}
      >
        {/* Top row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={`shrink-0 w-2 h-2 rounded-full mt-0.5 ${
                isResolved ? "bg-emerald-500" : "bg-orange-400"
              }`}
            />
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#e8e2d8] truncate">{bug.user_nome}</p>
              <p className="text-[10px] text-[#4a4844]">{formattedDate}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                isResolved
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25"
                  : "bg-orange-500/10 text-orange-400 border-orange-500/25"
              }`}
            >
              {isResolved ? "RESOLVIDO" : "ABERTO"}
            </span>
            <button
              onClick={onToggleStatus}
              disabled={isResolving}
              title={isResolved ? "Reabrir bug" : "Marcar como resolvido"}
              className={`w-7 h-7 flex items-center justify-center rounded-xl border transition-all ${
                isResolved
                  ? "border-[#2e2c29] text-[#7a7268] hover:text-orange-400 hover:border-orange-500/40 bg-[#1a1917]"
                  : "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 bg-emerald-500/5"
              } disabled:opacity-40 disabled:pointer-events-none`}
            >
              {isResolving ? (
                <Loader2 size={12} className="animate-spin" />
              ) : isResolved ? (
                <X size={12} />
              ) : (
                <CheckCircle size={12} />
              )}
            </button>
          </div>
        </div>

        {/* Descrição */}
        <p className="text-xs text-[#c8c0b4] leading-relaxed whitespace-pre-wrap break-words">
          {bug.descricao}
        </p>

        {/* Imagem (miniatura clicável) */}
        {bug.image_url && (
          <div className="mt-3">
            <button
              onClick={() => setImgOpen(true)}
              className="group relative overflow-hidden rounded-lg border border-[#2e2c29] hover:border-amber-500/40 transition-all"
              title="Ver imagem em tamanho completo"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={bug.image_url}
                alt="Screenshot do bug"
                className="w-full max-h-28 object-cover group-hover:opacity-90 transition-opacity"
              />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 transition-opacity">
                <span className="text-[10px] font-bold text-white bg-black/60 px-2 py-1 rounded-lg">
                  Ver completo
                </span>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* Lightbox */}
      {imgOpen && bug.image_url && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
          onClick={() => setImgOpen(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={bug.image_url}
            alt="Screenshot completo"
            className="max-w-full max-h-full rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setImgOpen(false)}
            className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-red-500/70 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL: PAINEL DE AUDITORIA (somente admin)
// ═══════════════════════════════════════════════════════════════════════════════

interface AuditLog {
  id: string;
  user_id: string;
  user_nome: string;
  acao: string;
  entidade: string;
  entidade_id: string | null;
  detalhes: string;
  created_at: string;
}

const ACAO_STYLE: Record<string, { badge: string; dot: string }> = {
  CRIAR_CLIENTE:   { badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",  dot: "bg-emerald-500"  },
  EDITAR_CLIENTE:  { badge: "bg-blue-500/15 text-blue-400 border-blue-500/30",           dot: "bg-blue-500"     },
  EXCLUIR_CLIENTE: { badge: "bg-red-500/15 text-red-400 border-red-500/30",              dot: "bg-red-500"      },
  MUDAR_STATUS:    { badge: "bg-amber-500/15 text-amber-400 border-amber-500/30",        dot: "bg-amber-500"    },
  EXCLUIR_LEADS:   { badge: "bg-red-500/15 text-red-400 border-red-500/30",              dot: "bg-red-400"      },
  DEFAULT:         { badge: "bg-[#2e2c29] text-[#7a7268] border-[#3a3835]",             dot: "bg-[#7a7268]"    },
};

function getAcaoStyle(acao: string) {
  return ACAO_STYLE[acao] ?? ACAO_STYLE.DEFAULT;
}

export function AuditLogsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [logs, setLogs]       = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      setLogs((data as AuditLog[]) ?? []);
    } catch (err: unknown) {
      toast.error(`Erro ao carregar logs: ${err instanceof Error ? err.message : "Erro desconhecido"}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchLogs();
  }, [open, fetchLogs]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-3xl bg-[#1a1917] border border-[#2e2c29] rounded-2xl shadow-2xl shadow-black/70 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300 flex flex-col max-h-[88vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2e2c29] shrink-0 bg-[#111010]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
              <Shield size={15} className="text-violet-400" />
            </div>
            <div>
              <p className="text-[0.6rem] font-bold uppercase tracking-[0.18em] text-violet-400 mb-0.5">Governança</p>
              <h2 className="text-sm font-bold text-[#e8e2d8] flex items-center gap-2">
                <History size={13} className="text-[#7a7268]" /> Audit Trail — Últimas 100 ações
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchLogs}
              disabled={loading}
              title="Recarregar logs"
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#201f1d] border border-[#2e2c29] text-[#7a7268] hover:text-violet-400 hover:border-violet-500/40 transition-colors disabled:opacity-40"
            >
              {loading
                ? <Loader2 size={14} className="animate-spin" />
                : <RotateCcw size={14} />}
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#201f1d] border border-[#2e2c29] text-[#7a7268] hover:text-[#e8e2d8] transition-colors"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Contagem */}
        {!loading && (
          <div className="px-5 py-2.5 border-b border-[#2e2c29] bg-[#161514] shrink-0 flex items-center gap-2">
            <Activity size={11} className="text-violet-400" />
            <span className="text-[10px] font-semibold text-[#7a7268]">
              {logs.length} registro{logs.length !== 1 ? "s" : ""} encontrado{logs.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-violet-500/20 border-t-violet-500 animate-spin" />
              <p className="text-[#7a7268] text-sm">Buscando registros...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Shield size={36} className="text-[#2e2c29]" />
              <p className="text-[#7a7268] text-sm">Nenhuma ação registrada ainda.</p>
            </div>
          ) : (
            <>
              {/* Cabeçalho da tabela — só em desktop */}
              <div className="hidden sm:grid grid-cols-[140px_120px_130px_1fr] gap-3 px-5 py-2 border-b border-[#2e2c29] bg-[#111010] shrink-0">
                <span className="text-[9px] font-bold uppercase tracking-widest text-[#4a4844]">Data / Hora</span>
                <span className="text-[9px] font-bold uppercase tracking-widest text-[#4a4844]">Usuário</span>
                <span className="text-[9px] font-bold uppercase tracking-widest text-[#4a4844]">Ação</span>
                <span className="text-[9px] font-bold uppercase tracking-widest text-[#4a4844]">Detalhes</span>
              </div>

              <div className="divide-y divide-[#1e1c1a]">
                {logs.map((log) => {
                  const style = getAcaoStyle(log.acao);
                  const dt = new Date(log.created_at);
                  const dataHora = dt.toLocaleString("pt-BR", {
                    day:    "2-digit",
                    month:  "2-digit",
                    year:   "numeric",
                    hour:   "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <div
                      key={log.id}
                      className="px-5 py-3 hover:bg-[#1e1c1a]/60 transition-colors"
                    >
                      {/* Desktop: grid de 4 colunas */}
                      <div className="hidden sm:grid grid-cols-[140px_120px_130px_1fr] gap-3 items-start">
                        {/* Data/Hora */}
                        <div className="flex items-center gap-1.5">
                          <div className={`w-1.5 h-1.5 rounded-full shrink-0 mt-0.5 ${style.dot}`} />
                          <span className="text-[10px] text-[#7a7268] font-mono">{dataHora}</span>
                        </div>

                        {/* Usuário */}
                        <span className="text-xs font-semibold text-[#c8c0b4] truncate">{log.user_nome}</span>

                        {/* Ação */}
                        <span className={`inline-flex items-center self-start px-2 py-0.5 rounded-lg text-[9px] font-bold border tracking-wide ${style.badge}`}>
                          {log.acao.replace(/_/g, " ")}
                        </span>

                        {/* Detalhes */}
                        <span className="text-xs text-[#7a7268] leading-relaxed">{log.detalhes}</span>
                      </div>

                      {/* Mobile: card compacto */}
                      <div className="sm:hidden space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[9px] font-bold border tracking-wide ${style.badge}`}>
                            {log.acao.replace(/_/g, " ")}
                          </span>
                          <span className="text-[10px] text-[#4a4844] font-mono">{dataHora}</span>
                        </div>
                        <p className="text-xs font-semibold text-[#c8c0b4]">{log.user_nome}</p>
                        <p className="text-xs text-[#7a7268] leading-relaxed">{log.detalhes}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 py-3.5 border-t border-[#2e2c29] bg-[#111010] flex items-center justify-between">
          <p className="text-[10px] text-[#4a4844]">
            Registros ordenados do mais recente para o mais antigo.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#201f1d] border border-[#2e2c29] text-[#7a7268] text-xs font-semibold hover:text-[#e8e2d8] transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
