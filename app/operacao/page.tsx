"use client";

import { useState, useCallback, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Papa from "papaparse";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { createClient } from "@/utils/supabase";
import { ClienteDashboard } from "@/app/components/Dashboard";
import { motion, AnimatePresence } from "framer-motion";
import { 
  BarChart3, 
  Plus, 
  Settings as SettingsIcon, 
  User, 
  Users, 
  Layers, 
  Download, 
  Search, 
  Trash2, 
  ChevronDown, 
  ChevronLeft, 
  ChevronRight, 
  FileText, 
  Table, 
  Loader2, 
  FolderOpen,
  PlusCircle,
  Clock,
  LogOut,
  Target,
  Filter,
  Check,
  X,
  Sparkles,
  Zap,
  Activity,
  Circle,
  Pencil,
  Calendar,
  MoreHorizontal,
  Bug,
  Bell,
  CreditCard,
  AlertTriangle,
  ShieldCheck,
  History,
  LayoutGrid,
} from "lucide-react";
import {
  NovaOperacaoModal,
  SettingsModal,
  ClienteModal,
  NewLeadDialog,
  ReportBugModal,
  AdminBugsModal,
  AuditLogsModal,
  registrarLog,
  type Cliente,
  type ClienteStatus,
  type Operacao,
  type PlatformKey,
  type Platform,
  type Lead,
  type OperacaoSimples,
} from "@/app/components/Modais";

// ─── Types ────────────────────────────────────────────────────────────────────



interface GestorPerfil {
  id: string;
  nome: string;
  role: "admin" | "gestor";
  operacao_id: string[] | null;
  user_id: string;
}

// Augmenta o tipo Cliente importado para incluir o novo campo
type ClienteComAlerta = Cliente & { alerta_pagamento?: boolean };

type PeriodPreset = "7d" | "15d" | "30d" | "90d" | "this_month" | "custom" | "max";
type ViewMode    = "grid" | "list";
type SortMode   = "alfabetica" | "personalizada";

// ─── Opções de Paginação ──────────────────────────────────────────────────────
const ITEMS_PER_PAGE_OPTIONS = [10, 20, 50, 100] as const;
// ─── Platform definitions ─────────────────────────────────────────────────────

const PLATFORM_SVG: Record<PlatformKey, React.ReactNode> = {
  meta: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M24 12.073c0-6.627-5.372-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" fill="#1877F2" />
    </svg>
  ),
  google: (
    <svg width="15" height="15" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  ),
  gls: (
    <svg width="15" height="15" viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="20" fill="#34A853" />
      <path d="M34.5858 17.5858L21.4142 30.7574L14.8284 24.1716L12 27L21.4142 36.4142L37.4142 20.4142L34.5858 17.5858Z" fill="white" />
    </svg>
  ),
  nextdoor: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="11" fill="#00B246" />
      <path d="M7 12.5L10.5 16L17 9" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  thumbtack: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
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

function getPlatformBadgeStyle(plataforma: string): string {
  const p = plataforma.toLowerCase();
  if (p.includes("meta"))                                  return "bg-blue-500/15 text-blue-400 border-blue-500/30";
  if (p.includes("google local") || p.includes("gls"))     return "bg-purple-500/15 text-purple-400 border-purple-500/30";
  if (p.includes("google"))                                return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (p.includes("elementor"))                             return "bg-pink-500/15 text-pink-400 border-pink-500/30";
  if (p.includes("nextdoor"))                              return "bg-green-500/15 text-green-400 border-green-500/30";
  if (p.includes("thumbtack"))                             return "bg-cyan-500/15 text-cyan-400 border-cyan-500/30";
  return "bg-amber-500/15 text-amber-400 border-amber-500/30";
}

function getPlatformAccordionStyle(plataforma: string): { header: string; icon: string } {
  const p = plataforma.toLowerCase();
  if (p.includes("meta"))                               return { header: "border-blue-500/30 bg-blue-500/5",      icon: "text-blue-400"    };
  if (p.includes("google local") || p.includes("gls")) return { header: "border-purple-500/30 bg-purple-500/5",  icon: "text-purple-400"  };
  if (p.includes("google"))                             return { header: "border-emerald-500/30 bg-emerald-500/5",icon: "text-emerald-400" };
  if (p.includes("elementor"))                          return { header: "border-pink-500/30 bg-pink-500/5",      icon: "text-pink-400"    };
  return { header: "border-amber-500/30 bg-amber-500/5", icon: "text-amber-400" };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CSV PARSER
// ═══════════════════════════════════════════════════════════════════════════════

function normalizeH(h: string): string {
  return h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g,"");
}

function formatDate(raw: any): string {
  if (!raw) return "";
  const s = String(raw).trim();

  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const monthMap: Record<string, string> = {
    jan:"01",feb:"02",mar:"03",apr:"04",may:"05",jun:"06",
    jul:"07",aug:"08",sep:"09",oct:"10",nov:"11",dec:"12",
  };
  const textualMatch = s.match(/^([A-Za-z]{3})\s+(\d{1,2})\s+(\d{4})/);
  if (textualMatch) {
    const m = monthMap[textualMatch[1].toLowerCase()] ?? "01";
    return `${textualMatch[3]}-${m}-${textualMatch[2].padStart(2, "0")}`;
  }

  const dateMatch = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (dateMatch) {
    const v1 = parseInt(dateMatch[1]);
    const v2 = parseInt(dateMatch[2]);
    const year = dateMatch[3];
    if (v1 > 12) return `${year}-${dateMatch[2].padStart(2,"0")}-${dateMatch[1].padStart(2,"0")}`;
    if (v2 > 12) return `${year}-${dateMatch[1].padStart(2,"0")}-${dateMatch[2].padStart(2,"0")}`;
    return `${year}-${dateMatch[2].padStart(2,"0")}-${dateMatch[1].padStart(2,"0")}`;
  }

  try {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  } catch { /* ignora */ }

  return s;
}

function detectSource(fileName: string, headers: string[]): "gls"|"meta"|"elementor"|"generic" {
  const fn = String(fileName || "").toLowerCase();
  const hn = headers.map(h => String(h || "").toLowerCase().replace(/[^a-z0-9]/g, ''));
  const has = (w: string) => hn.includes(w);

  if (fn.includes("leads-inbox") || fn.includes("leadsinbox")) return "gls";
  if (has("customer") && has("jobreceived")) return "gls";
  if (has("customer") && has("leadreceived")) return "gls";
  if (has("customer") && has("jobtype")) return "gls";
  if (has("fullname") && has("phonenumber") && has("createdtime")) return "meta";
  if (has("firstname") && has("phonenumber") && has("createdtime")) return "meta";
  if (fn.includes("leads_") && (fn.includes("_leads_") || fn.includes("lead"))) return "meta";
  if (fn.includes("elementor") || fn.includes("submissions")) return "elementor";
  if (has("firstname") && has("youremail")) return "elementor";
  if (has("firstname") && has("lastname")) return "elementor";
  
  return "generic";
}

const KEYWORD_MAP: Record<string, string[]> = {
  nome:      ['fullname', 'nome', 'name', 'customer', 'customername', 'cliente', 'firstname', 'lastname', 'personalinformation'],
  email:     ['email', 'emailaddress', 'address'],
  telefone:  ['phonenumber', 'phone', 'telefone', 'celular', 'whatsapp', 'customerphone'],
  data:      ['createdtime', 'date', 'data', 'leadreceived', 'submissiondate', 'createdat', 'datacriacao'],
  plataforma:['platform', 'plataforma', 'source', 'origem', 'formname'],
  charge_status: ['chargestatus'],
};

const NOISE_KEYWORDS = ['whatcanwedo', 'question', 'pergunta', 'howdidyou', 'message', 'searchintent', 'location', 'lastactivity', 'jobtype', 'leadtype', 'anyotherinformation'];

const GLS_NOISE_NAMES = new Set([
  'deepclean','standardclean','moveoutclean','moveinclean','recurringclean','onetimeclean',
  'officeclean','commercialclean','postconstruction','carpetcleaning',
  'windowcleaning','pressurewashing','nan','na','undefined','',
]);

function isGlsNoiseName(val: string): boolean {
  return GLS_NOISE_NAMES.has(String(val || "").toLowerCase().replace(/[^a-z0-9]/g, ''));
}

function parseGeneric(rows: Record<string,any>[], platformOverride?: string, sourceType?: "gls"|"meta"|"elementor"|"generic"): Lead[] {
  if (!rows.length) return [];
  const headers = Object.keys(rows[0]);
  const fieldMapping: Record<string, keyof Lead> = {};

  for (const h of headers) {
    const normalized = String(h || "").toLowerCase().replace(/[^a-z0-9]/g, '');
    if (NOISE_KEYWORDS.some(kw => normalized.includes(kw))) continue;
    for (const [field, keywords] of Object.entries(KEYWORD_MAP)) {
      if (keywords.includes(normalized)) {
        fieldMapping[h] = field as keyof Lead;
        break;
      }
    }
  }

  const parsedLeads = rows.map((r, i) => {
    const lead: Partial<Lead> = {
      id: `l-${Date.now()}-${i}`,
      nome: "",
      email: "",
      telefone: "",
      data: "",
      plataforma: platformOverride || "Upload CSV",
    };

    // 1. Preenche Mapeados
    for (const [header, field] of Object.entries(fieldMapping)) {
      // Aqui está a Mágica: String() força a ser texto antes do trim()
      const value = String(r[header] ?? "").trim();
      if (!value) continue;

      if (field === "data") {
        lead.data = formatDate(value);
      } else if (field === "plataforma") {
        const pv = value.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (["fb","ig","facebook","instagram","meta","facebookads","metaads"].includes(pv)) {
          lead.plataforma = "Meta Ads";
        } else if (["google","googleads","googlelocalservices","gls"].includes(pv)) {
          lead.plataforma = "Google Local Services";
        } else {
          lead.plataforma = value;
        }
      } else if (field === "telefone") {
        lead.telefone = value.includes(":") ? value.split(":").slice(1).join(":").trim() : value;
      } else if (field === "nome") {
        lead.nome = lead.nome ? `${lead.nome} ${value}`.trim() : value;
      } else if (field !== "id") {
        (lead as Record<string, unknown>)[field] = value;
      }
    }

    // 2. Visão de Raio-X
    for (const header of headers) {
      if (!fieldMapping[header]) {
        // Blindagem no Raio-X também
        const val = String(r[header] ?? "").trim();
        if (!val) continue;

        if (!lead.email && val.includes('@') && val.includes('.') && !val.includes(' ')) {
          lead.email = val;
        } 
        else if (!lead.telefone && /^[\+\(\)0-9\-\.\s]{9,20}$/.test(val) && !/[a-zA-Z]/.test(val)) {
          lead.telefone = val;
        }
      }
    }

    // Tratamento específico GLS
    if (sourceType === "gls") {
      if (lead.nome && /^[\+\(\)0-9\-\.\s]{10,}$/.test(lead.nome)) {
        lead.telefone = lead.nome;
        lead.nome = "Lead não identificado";
      }
      if (!lead.nome || isGlsNoiseName(lead.nome)) {
        lead.nome = "Lead não identificado";
      }
    }

    if (sourceType === "gls")       lead.plataforma = "Google Local Services";
    else if (sourceType === "meta") lead.plataforma = "Meta Ads";
    else if (sourceType === "elementor") lead.plataforma = "Elementor Form";

    return lead as Lead;
  });

  return parsedLeads.filter(l => {
    if (sourceType === "gls") return true; 
    return !!(l.nome || l.telefone || l.email);
  });
}

function parseCSV(rows: Record<string,any>[], fileName: string): Lead[] {
  if (!rows.length) return [];

  const source = detectSource(fileName, Object.keys(rows[0]));

  if (source === "meta") {
    const filteredRows = rows.filter(r => {
      // Blindagem final no filtro do Meta
      const isOrg = String(r["is_organic"] ?? r[" is_organic"] ?? "").trim().toLowerCase();
      return isOrg !== "true";
    });
    return parseGeneric(filteredRows, "Meta Ads", "meta");
  }

  if (source === "gls")       return parseGeneric(rows, "Google Local Services", "gls");
  if (source === "elementor") return parseGeneric(rows, "Elementor Form", "elementor");

  return parseGeneric(rows, undefined, "generic");
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function parseDateForSort(dateStr: string): number {
  if (!dateStr) return 0;
  // Handle DD/MM/YYYY
  const dmY = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (dmY) return new Date(`${dmY[3]}-${dmY[2]}-${dmY[1]}`).getTime();
  // Handle ISO YYYY-MM-DD
  const iso = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(dateStr).getTime();
  
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

function parseDMY(str: string): Date | null {
  if (!str) return null;
  const m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return new Date(`${m[3]}-${m[2]}-${m[1]}`);
  
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function clienteStatus(c: Cliente) {
  const s = c.status;
  if (s === "INATIVO" || s === "CANCELAMENTO")
    return { label:"CANCELAMENTO", dot:"bg-red-500",     badge:"bg-red-500/10 text-red-400 border-red-500/30" };
  if (s === "SEM CAMPANHA" || !c.platforms?.length)
    return { label:"SEM CAMPANHA",  dot:"bg-amber-500",   badge:"bg-amber-500/10 text-amber-400 border-amber-500/30" };
  return   { label:"ATIVO",         dot:"bg-emerald-500", badge:"bg-emerald-500/10 text-emerald-400 border-emerald-500/30" };
}

function isClienteInativo(c: Cliente): boolean {
  return c.status === "INATIVO" || c.status === "CANCELAMENTO";
}

// ─── Export helpers ───────────────────────────────────────────────────────────

function exportCSV(leads: Lead[], clienteNome: string) {
  if (!leads.length) { toast.error("Nenhum lead para exportar."); return; }
  const headers = ["#","Nome","Email","Telefone","Data","Plataforma"];
  const rows = leads.map((l,i) => [i+1,l.nome||"",l.email||"",l.telefone||"",l.data||"",l.plataforma||""]);
  const csv = [headers,...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href=url; a.download=`leads_${clienteNome.replace(/\s+/g,"_")}_${new Date().toISOString().slice(0,10)}.csv`; a.click();
  URL.revokeObjectURL(url);
  toast.success("CSV exportado!");
}

// ─── Tipos para exportação de performance ─────────────────────────────────────

interface PdfExportOptions {
  includeDashboard: boolean;
  includeRadar: boolean;
  includeLeads: boolean;
}

interface RadarCampaignRow {
  campaign_name: string;
  objective_label: string;
  spend: string;
  form_leads: number;
  msg_leads: number;
  form_cpl: number;
  msg_cpl: number;
}

interface RadarSnapshot {
  spend: number;
  cpl: number;
  total_leads: number;
  currency: string;
  campaigns: RadarCampaignRow[];
}

interface DashboardSnapshot {
  leadsPorPlataforma: { name: string; value: number }[];
  leadsPorData: { data: string; leads: number }[];
  totalLeads: number;
}

// ─── Modal de seleção de conteúdo do PDF ──────────────────────────────────────

function ExportPDFModal({
  open,
  hasRadar,
  onConfirm,
  onClose,
}: {
  open: boolean;
  hasRadar: boolean;
  onConfirm: (opts: PdfExportOptions) => void;
  onClose: () => void;
}) {
  const [opts, setOpts] = useState<PdfExportOptions>({
    includeDashboard: true,
    includeRadar: hasRadar,
    includeLeads: true,
  });
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (open) {
      setOpts({ includeDashboard: true, includeRadar: hasRadar, includeLeads: true });
      setExporting(false);
    }
  }, [open, hasRadar]);

  if (!open) return null;

  const toggle = (k: keyof PdfExportOptions) =>
    setOpts(prev => ({ ...prev, [k]: !prev[k] }));

  const noneSelected = !opts.includeDashboard && !opts.includeRadar && !opts.includeLeads;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full sm:max-w-sm bg-[#1a1917] border border-[#2e2c29] rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2e2c29] bg-[#111010]">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-amber-500 mb-0.5">Exportar</p>
            <h2 className="text-sm font-bold text-[#e8e2d8] flex items-center gap-2">
              <FileText size={14} className="text-amber-500" /> Relatório de Performance
            </h2>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#201f1d] border border-[#2e2c29] text-[#7a7268] hover:text-[#e8e2d8] transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-3">
          <p className="text-[10px] text-[#7a7268]">Selecione o que incluir no PDF:</p>

          {([
            { key: "includeDashboard" as const, label: "Resumo do Dashboard", desc: "Totais por plataforma e gráfico de leads por dia" },
            ...(hasRadar ? [{ key: "includeRadar" as const, label: "Radar Meta Ads", desc: "Tabela de campanhas com gasto, leads e CPL" }] : []),
            { key: "includeLeads" as const, label: "Lista Detalhada de Leads", desc: "Tabela completa com nome, telefone, data e plataforma" },
          ]).map(item => (
            <button key={item.key} type="button" onClick={() => toggle(item.key)}
              className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl border transition-all text-left ${
                opts[item.key]
                  ? "border-amber-500/40 bg-amber-500/5"
                  : "border-[#2e2c29] bg-[#201f1d] hover:border-[#3a3835]"
              }`}>
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                opts[item.key] ? "bg-amber-500 border-amber-500" : "border-[#3a3835]"
              }`}>
                {opts[item.key] && <Check size={10} className="text-[#111] stroke-[3]" />}
              </div>
              <div>
                <p className={`text-xs font-semibold transition-colors ${opts[item.key] ? "text-[#e8e2d8]" : "text-[#7a7268]"}`}>
                  {item.label}
                </p>
                <p className="text-[10px] text-[#4a4844] mt-0.5">{item.desc}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-[#201f1d] border border-[#2e2c29] text-[#7a7268] text-xs font-semibold hover:text-[#e8e2d8] transition-colors">
            Cancelar
          </button>
          <button
            disabled={noneSelected || exporting}
            onClick={async () => { setExporting(true); await onConfirm(opts); setExporting(false); onClose(); }}
            className="flex-1 py-2.5 rounded-xl bg-amber-500 text-[#111] text-xs font-bold hover:bg-amber-400 active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2 shadow-[0_2px_12px_rgba(245,166,35,0.3)]">
            {exporting
              ? <><Loader2 size={12} className="animate-spin" /> Gerando...</>
              : <><Download size={12} /> Gerar PDF</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── exportPDF refatorado — Relatório de Performance ─────────────────────────

async function exportPDF(
  leads: Lead[],
  clienteNome: string,
  operacaoNome: string,
  opts: PdfExportOptions,
  periodLabel: string,
  dashboard: DashboardSnapshot | null,
  radar: RadarSnapshot | null,
) {
  if (!opts.includeLeads && !opts.includeDashboard && !opts.includeRadar) {
    toast.error("Selecione ao menos uma seção para exportar.");
    return;
  }
  if (opts.includeLeads && !leads.length) {
    toast.error("Nenhum lead encontrado para o período selecionado.");
    return;
  }

  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const now = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const fmt2 = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const symbol = radar && radar.currency === "USD" ? "$" : "R$";

  // ─── HELPERS ──────────────────────────────────────────────────────────────

  const drawPageHeader = () => {
    doc.setFillColor(17, 16, 16);
    doc.rect(0, 0, pageW, 22, "F");
    doc.setFillColor(245, 166, 35);
    doc.rect(0, 22, pageW, 0.6, "F");
    doc.rect(0, 0, 3, 22, "F");
    doc.setTextColor(245, 166, 35);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("TS HUB", 8, 10);
    doc.setTextColor(80, 78, 75);
    doc.setFontSize(13);
    doc.text("·", 31, 10);
    doc.setTextColor(232, 226, 216);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(clienteNome.toUpperCase(), 36, 10);
    doc.setTextColor(110, 106, 100);
    doc.setFontSize(7);
    doc.text(`OPERAÇÃO: ${operacaoNome.toUpperCase()}`, 8, 17);
    doc.text(`PERÍODO: ${periodLabel.toUpperCase()}`, 80, 17);
    doc.text(`GERADO EM: ${now}`, pageW - 8, 17, { align: "right" });
  };

  const drawFooter = () => {
    const pg = (doc.internal as any).getCurrentPageInfo?.()?.pageNumber ?? "–";
    doc.setFontSize(6.5);
    doc.setTextColor(180, 177, 173);
    doc.text(`TS HUB  ·  CONFIDENCIAL  ·  PÁGINA ${pg}`, pageW / 2, pageH - 5, { align: "center" });
  };

  const drawBadge = (x: number, y: number, label: string, bgR: number, bgG: number, bgB: number, tR = 255, tG = 255, tB = 255) => {
    doc.setFillColor(bgR, bgG, bgB);
    doc.roundedRect(x, y - 3.5, 30, 5, 1.5, 1.5, "F");
    doc.setTextColor(tR, tG, tB);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.text(label.toUpperCase(), x + 15, y - 0.5, { align: "center" });
  };

  const getBadgeColors = (plataforma: string): [number, number, number, number, number, number] => {
    const p = (plataforma || "").toLowerCase();
    if (p.includes("google"))    return [52, 168, 83, 255, 255, 255];
    if (p.includes("meta") || p.includes("facebook")) return [24, 119, 242, 255, 255, 255];
    return [80, 78, 75, 200, 198, 195];
  };

  // ─── CAPA ─────────────────────────────────────────────────────────────────

  doc.setFillColor(17, 16, 16);
  doc.rect(0, 0, pageW, pageH, "F");
  doc.setFillColor(245, 166, 35);
  doc.rect(0, 0, 4, pageH, "F");
  doc.setFillColor(40, 38, 35);
  doc.rect(20, pageH / 2 - 22, pageW - 40, 0.4, "F");
  doc.rect(20, pageH / 2 + 18, pageW - 40, 0.4, "F");
  doc.setTextColor(245, 166, 35);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.text("RELATÓRIO DE PERFORMANCE", 20, pageH / 2 - 8);
  doc.setTextColor(232, 226, 216);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(17);
  doc.text(clienteNome.toUpperCase(), 20, pageH / 2 + 6);
  doc.setFontSize(8);
  doc.setTextColor(80, 78, 75);
  const sections = [
    opts.includeDashboard && "Dashboard",
    opts.includeRadar && radar && "Radar Meta Ads",
    opts.includeLeads && `${leads.length} Leads`,
  ].filter(Boolean).join("  ·  ");
  doc.text(`${sections}  ·  PERÍODO: ${periodLabel}  ·  ${now}`, 20, pageH - 18);
  doc.text("TS HUB  •  SISTEMA DE GESTÃO E PERFORMANCE", pageW - 20, pageH - 18, { align: "right" });

  // ─── SEÇÃO: DASHBOARD ──────────────────────────────────────────────────────

  if (opts.includeDashboard && dashboard) {
    doc.addPage();
    drawPageHeader();

    let y = 32;
    doc.setFillColor(245, 166, 35);
    doc.rect(10, y, pageW - 20, 0.4, "F");
    y += 5;
    doc.setTextColor(245, 166, 35);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("RESUMO DO PERÍODO", 10, y);
    y += 6;

    // Cards totais
    const cardW = (pageW - 20) / 3 - 3;
    const cardH = 18;
    const cardItems = [
      { label: "TOTAL DE LEADS", value: String(dashboard.totalLeads) },
      { label: "PLATAFORMA CAMPEÃ", value: dashboard.leadsPorPlataforma[0]?.name ?? "—" },
      { label: "LEADS NESSE PERÍODO", value: `${dashboard.totalLeads} lead${dashboard.totalLeads !== 1 ? "s" : ""}` },
    ];
    cardItems.forEach((card, i) => {
      const cx = 10 + i * (cardW + 3);
      doc.setFillColor(26, 25, 23);
      doc.roundedRect(cx, y, cardW, cardH, 2, 2, "F");
      doc.setTextColor(120, 116, 110);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.text(card.label, cx + 4, y + 5);
      doc.setTextColor(232, 226, 216);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(card.value, cx + 4, y + 13);
    });
    y += cardH + 6;

    // Tabela: leads por plataforma
    autoTable(doc, {
      startY: y,
      margin: { left: 10, right: pageW / 2 + 3 },
      head: [["PLATAFORMA", "LEADS", "%"]],
      body: dashboard.leadsPorPlataforma.map(p => [
        p.name,
        p.value,
        `${Math.round((p.value / dashboard.totalLeads) * 100)}%`,
      ]),
      styles: { font: "helvetica", fontSize: 8, cellPadding: { top: 3, bottom: 3, left: 4, right: 4 }, textColor: [40, 38, 35], fillColor: [255, 255, 255] },
      headStyles: { fillColor: [26, 26, 26], textColor: [245, 166, 35], fontStyle: "bold", fontSize: 7.5 },
      alternateRowStyles: { fillColor: [249, 249, 249] },
      columnStyles: { 1: { halign: "center" }, 2: { halign: "center" } },
    });

    // Tabela: leads por dia
    const maxY = (doc as any).lastAutoTable?.finalY ?? y;
    autoTable(doc, {
      startY: y,
      margin: { left: pageW / 2 + 3, right: 10 },
      head: [["DIA", "LEADS"]],
      body: dashboard.leadsPorData.map(d => [d.data, d.leads]),
      styles: { font: "helvetica", fontSize: 8, cellPadding: { top: 3, bottom: 3, left: 4, right: 4 }, textColor: [40, 38, 35], fillColor: [255, 255, 255] },
      headStyles: { fillColor: [26, 26, 26], textColor: [245, 166, 35], fontStyle: "bold", fontSize: 7.5 },
      alternateRowStyles: { fillColor: [249, 249, 249] },
      columnStyles: { 1: { halign: "center" } },
    });

    drawFooter();
  }

  // ─── SEÇÃO: RADAR META ADS ─────────────────────────────────────────────────

  if (opts.includeRadar && radar) {
    doc.addPage();
    drawPageHeader();

    let y = 32;
    doc.setFillColor(24, 119, 242);
    doc.rect(10, y, pageW - 20, 0.4, "F");
    y += 5;
    doc.setTextColor(24, 119, 242);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("RADAR META ADS", 10, y);
    y += 7;

    // Totais
    const totaisItems = [
      { label: "GASTO TOTAL", value: `${symbol} ${fmt2(radar.spend)}` },
      { label: "CPL MÉDIO",   value: radar.cpl > 0 ? `${symbol} ${fmt2(radar.cpl)}` : "—" },
      { label: "TOTAL LEADS", value: String(radar.total_leads) },
    ];
    const tW = (pageW - 20) / 3 - 3;
    totaisItems.forEach((item, i) => {
      const cx = 10 + i * (tW + 3);
      doc.setFillColor(17, 30, 51);
      doc.roundedRect(cx, y, tW, 16, 2, 2, "F");
      doc.setTextColor(100, 140, 200);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.text(item.label, cx + 4, y + 5);
      doc.setTextColor(232, 226, 216);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(item.value, cx + 4, y + 13);
    });
    y += 22;

    // Tabela de campanhas
    autoTable(doc, {
      startY: y,
      margin: { left: 10, right: 10 },
      tableWidth: pageW - 20,
      head: [["CAMPANHA", "OBJETIVO", "GASTO", "LEADS", "CPL"]],
      body: radar.campaigns.map(c => {
        const leads = c.form_leads + c.msg_leads;
        const cpl = c.form_cpl || c.msg_cpl || 0;
        return [
          c.campaign_name,
          c.objective_label || "—",
          `${symbol} ${parseFloat(c.spend).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
          leads > 0 ? String(leads) : "—",
          leads > 0 && cpl > 0 ? `${symbol} ${fmt2(cpl)}` : "—",
        ];
      }),
      styles: { font: "helvetica", fontSize: 8, cellPadding: { top: 3.5, bottom: 3.5, left: 4, right: 4 }, textColor: [40, 38, 35], fillColor: [255, 255, 255] },
      headStyles: { fillColor: [17, 30, 51], textColor: [100, 160, 240], fontStyle: "bold", fontSize: 7.5 },
      alternateRowStyles: { fillColor: [249, 249, 249] },
      columnStyles: {
        0: { cellWidth: "auto" },
        1: { cellWidth: 30, halign: "center" },
        2: { cellWidth: 28, halign: "right" },
        3: { cellWidth: 16, halign: "center" },
        4: { cellWidth: 28, halign: "right" },
      },
      foot: [[
        "TOTAL", "",
        `${symbol} ${fmt2(radar.spend)}`,
        radar.total_leads > 0 ? String(radar.total_leads) : "—",
        radar.cpl > 0 ? `${symbol} ${fmt2(radar.cpl)}` : "—",
      ]],
      footStyles: { fillColor: [26, 26, 26], textColor: [245, 166, 35], fontStyle: "bold", fontSize: 7.5, halign: "right" },
      didDrawPage: drawFooter,
    });
  }

  // ─── SEÇÃO: LISTA DE LEADS ─────────────────────────────────────────────────

  if (opts.includeLeads && leads.length) {
    doc.addPage();
    drawPageHeader();

    autoTable(doc, {
      startY: 28,
      margin: { left: 10, right: 10 },
      tableWidth: pageW - 20,
      head: [["#", "NOME", "EMAIL", "TELEFONE", "DATA", "PLATAFORMA"]],
      body: leads.map((l, i) => [i + 1, l.nome || "Não Identificado", l.email || "—", l.telefone || "—", l.data || "—", l.plataforma || "—"]),
      styles: { font: "helvetica", fontSize: 8, cellPadding: { top: 3.5, bottom: 3.5, left: 4, right: 4 }, textColor: [40, 38, 35], fillColor: [255, 255, 255], lineWidth: 0 },
      headStyles: { fillColor: [26, 26, 26], textColor: [245, 166, 35], fontStyle: "bold", fontSize: 7.5, lineWidth: 0 },
      alternateRowStyles: { fillColor: [249, 249, 249] },
      columnStyles: {
        0: { cellWidth: 10, halign: "center", textColor: [160, 157, 153] },
        1: { cellWidth: 48 },
        2: { cellWidth: 58 },
        3: { cellWidth: 40 },
        4: { cellWidth: 25, halign: "center" },
        5: { cellWidth: 57, halign: "center" },
      },
      didParseCell: (data) => {
        if (data.section !== "body") return;
        const raw = (data.cell.raw as string) || "";
        if (data.column.index === 1 && (raw.toLowerCase().includes("não identificado") || raw.toLowerCase().includes("nao identificado"))) {
          data.cell.styles.textColor = [170, 167, 163];
          data.cell.styles.fontStyle = "italic";
        }
        if (data.column.index === 5) data.cell.styles.textColor = [255, 255, 255];
      },
      didDrawCell: (data) => {
        if (data.section !== "body" || data.column.index !== 5) return;
        const raw = (data.cell.raw as string) || "—";
        if (raw === "—") return;
        const [bgR, bgG, bgB, tR, tG, tB] = getBadgeColors(raw);
        drawBadge(data.cell.x + (data.cell.width - 30) / 2, data.cell.y + data.cell.height / 2 + 2, raw, bgR, bgG, bgB, tR, tG, tB);
      },
      didDrawPage: drawFooter,
    });
  }

  const suffix = [
    opts.includeDashboard && "dash",
    opts.includeRadar && radar && "radar",
    opts.includeLeads && "leads",
  ].filter(Boolean).join("-");

  doc.save(`relatorio_${clienteNome.replace(/\s+/g, "_")}_${suffix}_${new Date().toISOString().slice(0, 10)}.pdf`);
  toast.success("Relatório de Performance exportado!");
}

// ═══════════════════════════════════════════════════════════════════════════════
// DROPZONE
// ═══════════════════════════════════════════════════════════════════════════════

function Dropzone({ onParsed }: { onParsed: (leads: Lead[]) => void }) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading]   = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  const process = useCallback((file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv")) { toast.error("Envie um arquivo .CSV"); return; }
    setLoading(true);
    const reader = new FileReader();
    reader.onload = e => {
      const buffer = e.target?.result as ArrayBuffer;

      // Auto-detectar encoding: tenta UTF-16 se detectar BOM ou padrão específico
      const bytes = new Uint8Array(buffer);
      let encoding = "utf-8";

      // Detectar UTF-16 LE BOM (FF FE)
      if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) {
        encoding = "utf-16le";
      }
      // Detectar UTF-16 BE BOM (FE FF)
      else if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) {
        encoding = "utf-16be";
      }
      // Detectar UTF-16 sem BOM: verifica padrão de null bytes entre caracteres ASCII
      else if (bytes.length >= 10) {
        const hasNullPattern =
          (bytes[1] === 0 && bytes[3] === 0 && bytes[5] === 0) || // UTF-16 LE
          (bytes[0] === 0 && bytes[2] === 0 && bytes[4] === 0);   // UTF-16 BE
        if (hasNullPattern) {
          encoding = bytes[0] === 0 ? "utf-16be" : "utf-16le";
        }
      }

      const decoder = new TextDecoder(encoding);
      let text = decoder.decode(buffer);

      // Remove BOM se presente (U+FEFF)
      if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

      Papa.parse<Record<string,string>>(text, {
        header:true,
        skipEmptyLines: "greedy",
        delimiter: "", // String vazia = auto-detecção de delimitador (vírgula, tab, pipe, etc)
        complete: result => {
          const parsed = parseCSV(result.data, file.name);
          setLoading(false);
          if (!parsed.length) { toast.error("Nenhum lead encontrado no CSV."); return; }
          onParsed(parsed);
          toast.success(`${parsed.length} leads encontrados no CSV.`);
        },
        error: () => { setLoading(false); toast.error("Erro ao processar o CSV."); },
      });
    };
    reader.readAsArrayBuffer(file);
  }, [onParsed]);

  return (
    <div
      onDragOver={e=>{e.preventDefault();setDragging(true);}}
      onDragLeave={()=>setDragging(false)}
      onDrop={e=>{e.preventDefault();setDragging(false);const f=e.dataTransfer.files[0];if(f)process(f);}}
      onClick={()=>ref.current?.click()}
      className={`rounded-xl border-2 border-dashed p-6 flex flex-col items-center gap-2 cursor-pointer transition-all ${dragging?"border-amber-500/60 bg-amber-500/5":"border-[#2e2c29] hover:border-amber-500/30 hover:bg-amber-500/3"}`}>
      <input ref={ref} type="file" accept=".csv" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)process(f);e.target.value="";}}/>
      {loading ? (
        <><Loader2 size={24} className="animate-spin text-amber-500" /><p className="text-xs text-[#7a7268]">Processando CSV...</p></>
      ) : (
        <><FolderOpen size={24} className="text-amber-500" /><p className="text-xs text-[#7a7268] text-center">Arraste um <strong className="text-amber-400">.CSV</strong> aqui ou clique para selecionar<br/><span className="text-[#4a4844] text-[10px]">Meta Ads · Google Local Services · Elementor</span></p></>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT BAR
// ═══════════════════════════════════════════════════════════════════════════════

function ExportBar({
  leads, clienteNome, operacaoNome, onNewLead,
  periodLabel, dashboard, radar,
}: {
  leads: Lead[];
  clienteNome: string;
  operacaoNome: string;
  onNewLead: () => void;
  periodLabel: string;
  dashboard: DashboardSnapshot | null;
  radar: RadarSnapshot | null;
}) {
  const [pdfModalOpen, setPdfModalOpen] = useState(false);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
        <button onClick={() => exportCSV(leads, clienteNome)}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#201f1d] border border-[#2e2c29] text-[#7a7268] text-xs font-semibold hover:text-[#e8e2d8] hover:border-[#7a7268] transition-colors w-full sm:w-auto">
          <Download size={12} /> CSV
        </button>
        <button onClick={() => setPdfModalOpen(true)}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#201f1d] border border-[#2e2c29] text-[#7a7268] text-xs font-semibold hover:text-[#e8e2d8] hover:border-[#7a7268] transition-colors w-full sm:w-auto">
          <Download size={12} /> PDF
        </button>
      </div>

      <ExportPDFModal
        open={pdfModalOpen}
        hasRadar={!!radar && (radar.campaigns?.length ?? 0) > 0}
        onClose={() => setPdfModalOpen(false)}
        onConfirm={async (opts) => {
          await exportPDF(leads, clienteNome, operacaoNome, opts, periodLabel, dashboard, radar);
        }}
      />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEAD CARD MOBILE
// ═══════════════════════════════════════════════════════════════════════════════

function LeadMobileCard({ lead, selected, onToggle }: { lead: Lead; selected: boolean; onToggle: () => void }) {
  const platStyle = getPlatformBadgeStyle(lead.plataforma || "");
  return (
    <div className={`rounded-xl border p-3.5 transition-all ${selected ? "border-amber-500/50 bg-amber-500/5" : "border-[#2e2c29] bg-[#1a1917]"}`}>
      <div className="flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="mt-0.5 w-3.5 h-3.5 accent-amber-500 rounded cursor-pointer shrink-0"
        />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-[#e8e2d8] truncate">{lead.nome || "—"}</p>
            {lead.plataforma && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap shrink-0 ${platStyle}`}>
                {lead.plataforma}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-[#4a4844]">Telefone</p>
              <p className="text-xs text-[#e8e2d8]">{lead.telefone || "—"}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-[#4a4844]">Data</p>
              <p className="text-xs text-[#e8e2d8]">{lead.data || "—"}</p>
            </div>
            {lead.email && (
              <div className="col-span-2">
                <p className="text-[9px] font-bold uppercase tracking-widest text-[#4a4844]">E-mail</p>
                <p className="text-xs text-[#e8e2d8] truncate">{lead.email}</p>
              </div>
            )}
            {lead.charge_status && lead.plataforma?.toLowerCase().includes("google local") && (
              <div className="col-span-2">
                <p className="text-[9px] font-bold uppercase tracking-widest text-[#4a4844]">Cobrança</p>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                  lead.charge_status.toLowerCase() === "charged"
                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                    : lead.charge_status.toLowerCase() === "not charged"
                    ? "bg-red-500/15 text-red-400 border-red-500/30"
                    : "bg-amber-500/15 text-amber-400 border-amber-500/30"
                }`}>{lead.charge_status}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEAD ACCORDION
// ═══════════════════════════════════════════════════════════════════════════════

function LeadAccordion({ leads, paginatedLeads, search, platFilter, dateFrom, dateTo, onDeleteSelected, currentPage, onPageChange, totalLeads, itemsPerPage, onItemsPerPageChange }: {
  leads:Lead[]; paginatedLeads:Lead[]; search:string; platFilter:string; dateFrom:string; dateTo:string;
  onDeleteSelected:(ids:string[])=>void;
  currentPage: number;
  onPageChange: (page: number) => void;
  totalLeads: number;
  itemsPerPage: number;
  onItemsPerPageChange: (items: number) => void;
}) {
  const [openPlats, setOpenPlats] = useState<Set<string>>(new Set());
  const [selected, setSelected]   = useState<Set<string>>(new Set());
  const [isMobile, setIsMobile]   = useState(false);
  const [activeTab, setActiveTab] = useState<string>("__all__");

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // O componente recebe 'leads' já filtrados do componente pai.
  const filtered = leads;

  const totalPages = Math.ceil(totalLeads / itemsPerPage);

  // Agrupa todos os leads por plataforma para derivar as abas
  const allGrouped = filtered.reduce<Record<string,Lead[]>>((acc,l) => {
    const k = l.plataforma||"Sem Plataforma";
    if (!acc[k]) acc[k]=[];
    acc[k].push(l);
    return acc;
  },{});

  const tabKeys = Object.keys(allGrouped).sort((a,b)=>a.localeCompare(b));

  // Filtra pela aba ativa (ou mostra tudo se "__all__")
  const grouped = activeTab === "__all__"
    ? allGrouped
    : Object.fromEntries(Object.entries(allGrouped).filter(([k]) => k === activeTab));

  const toggle = (k:string) => setOpenPlats(prev => {
    const n=new Set(prev); n.has(k)?n.delete(k):n.add(k); return n;
  });

  const toggleSelect = (id:string) => setSelected(prev => {
    const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n;
  });

  // Para o 'selecionar tudo', usamos TODOS os leads filtrados (todas as páginas)
  const allFilteredIds = filtered.map(l=>l.id);
  const allSelected = allFilteredIds.length>0&&allFilteredIds.every(id=>selected.has(id));
  const toggleAll = () => setSelected(allSelected?new Set():new Set(allFilteredIds));

  const handleDelete = async () => {
    if (!selected.size) return;
    if (!confirm(`Excluir ${selected.size} lead(s) permanentemente? Esta ação afetará leads selecionados em todas as páginas.`)) return;
    const ids = [...selected];
    await onDeleteSelected(ids);
    setSelected(new Set());
  };

  if (!filtered.length) return (
    <div className="flex flex-col items-center justify-center py-14 gap-3 rounded-xl border border-dashed border-[#2e2c29]">
      <Search size={32} className="text-[#4a4844]" />
      <p className="text-[#7a7268] text-sm">Nenhum lead encontrado com os filtros aplicados.</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {selected.size>0&&(
        <div className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-red-500/25 bg-red-500/8">
          <span className="text-xs text-[#e8e2d8] font-semibold">{selected.size} lead(s) selecionado(s)</span>
          <button onClick={handleDelete} className="text-xs font-bold text-red-400 hover:text-red-300 transition-colors flex items-center gap-1.5">
            <Trash2 size={12} /> Excluir selecionados
          </button>
        </div>
      )}
      <div className="flex items-center gap-2 px-1">
        <input type="checkbox" checked={allSelected} onChange={toggleAll}
          className="w-3.5 h-3.5 accent-amber-500 rounded cursor-pointer"/>
        <span className="text-[10px] text-[#7a7268] font-semibold uppercase tracking-widest">Selecionar TODOS os {totalLeads} leads encontrados</span>
      </div>

      {/* ── Tabs de plataforma ───────────────────────────────────────────── */}
      {tabKeys.length > 1 && (
        <div className="flex flex-wrap gap-1.5 border-b border-[#2e2c29] pb-3">
          <button
            onClick={() => setActiveTab("__all__")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              activeTab === "__all__"
                ? "bg-amber-500 border-amber-400 text-[#111]"
                : "bg-[#201f1d] border-[#2e2c29] text-[#7a7268] hover:text-[#e8e2d8] hover:border-[#7a7268]"
            }`}>
            Todas <span className="opacity-60 text-[10px]">({filtered.length})</span>
          </button>
          {tabKeys.map(tab => {
            const tabStyle = getPlatformBadgeStyle(tab);
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  activeTab === tab
                    ? "bg-amber-500 border-amber-400 text-[#111]"
                    : `bg-[#201f1d] border-[#2e2c29] text-[#7a7268] hover:text-[#e8e2d8] hover:border-[#7a7268]`
                }`}>
                {tab} <span className="opacity-60 text-[10px]">({allGrouped[tab].length})</span>
              </button>
            );
          })}
        </div>
      )}

      {isMobile ? (
        <div className="space-y-4">
          {Object.entries(grouped).sort(([a],[b])=>a.localeCompare(b)).map(([plat,items]) => {
            const style = getPlatformAccordionStyle(plat);
            const isOpen = openPlats.has(plat);
            // Mostrar apenas leads desta categoria que estão na página atual
            const itemsInThisPage = items.filter(l => paginatedLeads.some(pl => pl.id === l.id))
                                         .sort((a,b)=>parseDateForSort(b.data)-parseDateForSort(a.data));
            return (
              <div key={plat} className={`rounded-xl border overflow-hidden ${style.header}`}>
                <button onClick={()=>toggle(plat)}
                  className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${style.header}`}>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${style.icon}`}>{plat}</span>
                    <span className="text-[10px] font-semibold text-[#7a7268] bg-[#1a1917] border border-[#2e2c29] px-2 py-0.5 rounded-full">{items.length}</span>
                  </div>
                  <div className="flex items-center gap-2" onClick={e=>e.stopPropagation()}>
                    <button onClick={()=>{ const ids=itemsInThisPage.map(l=>l.id); const all=ids.length>0&&ids.every(id=>selected.has(id)); setSelected(prev=>{ const n=new Set(prev); if(all){ids.forEach(id=>n.delete(id));}else{ids.forEach(id=>n.add(id));} return n; }); }} className={`text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-lg border transition-all ${itemsInThisPage.length>0&&itemsInThisPage.every(l=>selected.has(l.id))?`${style.icon} border-current bg-current/10`:"text-[#7a7268] border-[#2e2c29] hover:text-[#e8e2d8]"}`}>Selecionar</button>
                    <ChevronDown size={14} className={`transition-transform ${isOpen?"rotate-180":""} ${style.icon}`} />
                  </div>
                </button>
                {isOpen && (
                  <div className="p-3 space-y-2 bg-[#111010]/40">
                    {itemsInThisPage.length > 0 ? (
                      itemsInThisPage.map(l => (
                        <LeadMobileCard
                          key={l.id}
                          lead={l}
                          selected={selected.has(l.id)}
                          onToggle={() => toggleSelect(l.id)}
                        />
                      ))
                    ) : (
                      <p className="text-[10px] text-[#4a4844] italic text-center py-2">Nenhum lead nesta categoria na página atual.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        Object.entries(grouped).sort(([a],[b])=>a.localeCompare(b)).map(([plat,items])=>{
          const isOpen=openPlats.has(plat);
          const style=getPlatformAccordionStyle(plat);
          // Mostrar apenas leads desta categoria que estão na página atual
          const itemsInThisPage = items.filter(l => paginatedLeads.some(pl => pl.id === l.id))
                                       .sort((a,b)=>parseDateForSort(b.data)-parseDateForSort(a.data));

          return (
            <div key={plat} className={`rounded-xl border overflow-hidden ${style.header}`}>
              <button onClick={()=>toggle(plat)}
                className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${style.header}`}>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${style.icon}`}>{plat}</span>
                  <span className="text-[10px] font-semibold text-[#7a7268] bg-[#1a1917] border border-[#2e2c29] px-2 py-0.5 rounded-full">{items.length}</span>
                </div>
                <div className="flex items-center gap-2" onClick={e=>e.stopPropagation()}>
                  <button onClick={()=>{ const ids=itemsInThisPage.map(l=>l.id); const all=ids.length>0&&ids.every(id=>selected.has(id)); setSelected(prev=>{ const n=new Set(prev); if(all){ids.forEach(id=>n.delete(id));}else{ids.forEach(id=>n.add(id));} return n; }); }} className={`text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-lg border transition-all ${itemsInThisPage.length>0&&itemsInThisPage.every(l=>selected.has(l.id))?`${style.icon} border-current bg-current/10`:"text-[#7a7268] border-[#2e2c29] hover:text-[#e8e2d8]"}`}>Selecionar desta plataforma</button>
                  <ChevronDown size={14} className={`transition-transform ${isOpen?"rotate-180":""} ${style.icon}`} />
                </div>
              </button>
              {isOpen&&(
                <div className="divide-y divide-[#2e2c29]/50">
                  {/* Cabeçalho fixo alinhado com as colunas de dados */}
                  <div className="w-full overflow-x-auto pb-2">
                  <div className={`flex items-center gap-3 px-4 py-2 bg-[#111010]/60 ${plat.toLowerCase().includes("google local")?"min-w-[950px]":"min-w-[800px]"}`}>
                    <div className="w-3.5 h-3.5 shrink-0" />
                    <div className={`flex-1 min-w-0 grid ${plat.toLowerCase().includes("google local")?"grid-cols-[minmax(150px,_2fr)_minmax(130px,_1fr)_minmax(150px,_2fr)_minmax(100px,_1fr)_minmax(110px,_1fr)]":"grid-cols-[minmax(150px,_2fr)_minmax(130px,_1fr)_minmax(150px,_2fr)_minmax(100px,_1fr)]"} gap-x-4`}>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-[#4a4844]">Nome</p>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-[#4a4844]">Telefone</p>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-[#4a4844]">E-mail</p>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-[#4a4844]">Data</p>
                      {plat.toLowerCase().includes("google local")&&<p className="text-[9px] font-bold uppercase tracking-widest text-[#4a4844]">Cobrança</p>}
                    </div>
                  </div>
                  {itemsInThisPage.length > 0 ? (
                    itemsInThisPage.map(l=>(
                      <div key={l.id} className={`flex items-start gap-3 px-4 py-3 hover:bg-[#201f1d]/40 transition-colors ${plat.toLowerCase().includes("google local")?"min-w-[950px]":"min-w-[800px]"}`}>
                        <input type="checkbox" checked={selected.has(l.id)} onChange={()=>toggleSelect(l.id)}
                          className="mt-0.5 w-3.5 h-3.5 accent-amber-500 rounded cursor-pointer shrink-0"/>
                        <div className={`flex-1 min-w-0 grid ${plat.toLowerCase().includes("google local")?"grid-cols-[minmax(150px,_2fr)_minmax(130px,_1fr)_minmax(150px,_2fr)_minmax(100px,_1fr)_minmax(110px,_1fr)]":"grid-cols-[minmax(150px,_2fr)_minmax(130px,_1fr)_minmax(150px,_2fr)_minmax(100px,_1fr)]"} gap-x-4 gap-y-1`}>
                          <div><p className="text-sm text-[#e8e2d8] truncate">{l.nome||"—"}</p></div>
                          <div><p className="text-sm text-[#e8e2d8]">{l.telefone||"—"}</p></div>
                          <div><p className="text-sm text-[#e8e2d8] truncate">{l.email||"—"}</p></div>
                          <div><p className="text-sm text-[#e8e2d8]">{l.data||"—"}</p></div>
                          {plat.toLowerCase().includes("google local")&&(
                            <div>{l.charge_status?(<span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${l.charge_status.toLowerCase()==="charged"?"bg-emerald-500/15 text-emerald-400 border-emerald-500/30":l.charge_status.toLowerCase()==="not charged"?"bg-red-500/15 text-red-400 border-red-500/30":"bg-amber-500/15 text-amber-400 border-amber-500/30"}`}>{l.charge_status}</span>):(<span className="text-xs text-[#4a4844]">—</span>)}</div>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-4 text-center min-w-[800px]">
                      <p className="text-xs text-[#4a4844] italic">Nenhum lead nesta categoria na página atual.</p>
                    </div>
                  )}
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}

      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row flex-wrap justify-between items-center gap-4 text-sm mt-4 p-4 border-t border-[#2e2c29]">
          {/* Bloco esquerdo: contagem e itens por página */}
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs text-[#7a7268] whitespace-nowrap">
              Página <span className="text-[#e8e2d8] font-semibold">{currentPage}</span> de{" "}
              <span className="text-[#e8e2d8] font-semibold">{totalPages}</span>
              {" "}·{" "}
              <span className="text-[#e8e2d8] font-semibold">{totalLeads}</span> leads no total
            </p>
            {/* Dropdown de itens por página */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#7a7268] font-semibold uppercase tracking-widest whitespace-nowrap">Por página:</span>
              <div className="relative">
                <select
                  value={itemsPerPage}
                  onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
                  className="appearance-none bg-[#201f1d] border border-[#2e2c29] rounded-lg px-3 pr-7 py-1.5 text-xs text-[#e8e2d8] outline-none focus:border-amber-500/60 transition-colors cursor-pointer hover:border-[#7a7268]"
                >
                  {ITEMS_PER_PAGE_OPTIONS.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#7a7268]" size={12} />
              </div>
            </div>
          </div>
          {/* Bloco direito: botões de navegação */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#201f1d] border border-[#2e2c29] text-[#7a7268] text-xs font-semibold hover:text-[#e8e2d8] hover:border-[#7a7268] transition-colors disabled:opacity-30 disabled:pointer-events-none">
              <ChevronLeft size={14} /> Anterior
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let page: number;
                if (totalPages <= 5) page = i + 1;
                else if (currentPage <= 3) page = i + 1;
                else if (currentPage >= totalPages - 2) page = totalPages - 4 + i;
                else page = currentPage - 2 + i;
                return (
                  <button
                    key={page}
                    onClick={() => onPageChange(page)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                      page === currentPage
                        ? "bg-amber-500 text-[#111] shadow-[0_2px_8px_rgba(245,166,35,0.3)]"
                        : "bg-[#201f1d] border border-[#2e2c29] text-[#7a7268] hover:text-[#e8e2d8] hover:border-[#7a7268]"
                    }`}>
                    {page}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#201f1d] border border-[#2e2c29] text-[#7a7268] text-xs font-semibold hover:text-[#e8e2d8] hover:border-[#7a7268] transition-colors disabled:opacity-30 disabled:pointer-events-none">
              Próximo <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLIENT ACTION MENU
// ═══════════════════════════════════════════════════════════════════════════════

function ClientActionMenu({ onEdit, onDeactivate, onDelete, isInactive }: {
  onEdit:()=>void; onDeactivate:()=>void; onDelete:()=>void; isInactive:boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e:MouseEvent) => { if (ref.current&&!ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown",handler);
    return ()=>document.removeEventListener("mousedown",handler);
  },[open]);
  return (
    <div ref={ref} className="relative" onClick={e=>e.stopPropagation()}>
      <button onClick={()=>setOpen(v=>!v)}
        className="w-7 h-7 flex items-center justify-center rounded-lg text-[#7a7268] hover:text-[#e8e2d8] hover:bg-[#2e2c29] transition-colors leading-none">
        <MoreHorizontal size={14} />
      </button>
      {open&&(
        <div className="absolute right-0 top-8 z-50 w-44 rounded-xl border border-[#2e2c29] bg-[#1a1917] shadow-xl shadow-black/60 py-1 overflow-hidden">
          {[
            {label:"Editar", icon: <Pencil size={12} />, action:onEdit, cls:"text-[#e8e2d8]"},
            {label:isInactive?"Reativar":"Desativar", icon: isInactive ? <Check size={12} /> : <X size={12} />, action:onDeactivate, cls:isInactive?"text-emerald-400":"text-amber-400"},
            {label:"Excluir", icon: <Trash2 size={12} />, action:onDelete, cls:"text-red-400"},
          ].map(item=>(
            <button key={item.label} onClick={()=>{item.action();setOpen(false);}}
              className={`w-full text-left px-4 py-2 text-xs font-semibold hover:bg-[#2e2c29] transition-colors flex items-center gap-2 ${item.cls}`}>
              {item.icon} {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLIENT CARD
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Meta status dot ─────────────────────────────────────────────────────────
type OtherCampaignDetail = {
  name: string;
  objective: string;
  result_label: string;
  result_count: number;
  spend: number;
};

// ─── Tipos para a árvore Radar ────────────────────────────────────────────────
interface TreeAdInsights { spend: number; results: number; cpr: number; }
interface TreeAd      { id: string; name: string; status: string; insights: TreeAdInsights; }
interface TreeAdSet   { id: string; name: string; status: string; insights: TreeAdInsights; ads: TreeAd[]; }
interface TreeCampaign {
  id: string; name: string; objective: string; objective_label: string;
  status: string; insights: TreeAdInsights; adsets: TreeAdSet[];
}
interface TreeObjectiveGroup {
  objective: string; objective_label: string;
  total_spend: number; total_results: number; cpr: number;
  campaigns: TreeCampaign[];
}
interface MetaTreeData {
  account_status: number;
  account_name:   string;
  currency:       string;
  groups:         TreeObjectiveGroup[];
  loading:        boolean;
  error?:         string;
}

type MetaInsightData = {
  account_status: number;
  spend: number;
  leads: number;
  messages: number;
  total_leads: number;
  cpl: number;
  currency: string;
  // Formulário
  form_leads: number;
  form_spend: number;
  form_cpl: number;
  // Mensagens
  msg_leads: number;
  msg_spend: number;
  msg_cpl: number;
  // Outros Objetivos (tráfego, awareness, engajamento, etc.)
  other_spend: number;
  other_count: number;
  other_campaigns: OtherCampaignDetail[];
  loading: boolean;
  error?: string;
} | null;

function MetaDot({ accountId, lastSync, onRefresh }: {
  accountId?: string | null;
  lastSync?: string | null;
  onRefresh: () => void;
}) {
  if (!accountId) {
    return (
      <span title="Sem conta Meta vinculada"
        className="w-2 h-2 rounded-full bg-[#3a3835] shrink-0 inline-block" />
    );
  }
  if (!lastSync) {
    return (
      <button onClick={e=>{e.stopPropagation();onRefresh();}}
        title="Sem dados em cache — aguardando próximo sync"
        className="w-2 h-2 rounded-full bg-[#3a3835] shrink-0 inline-block hover:scale-125 transition-transform animate-pulse" />
    );
  }
  // Considera cache "fresco" se sincronizado há menos de 25h
  const horasDesdeSync = (Date.now() - new Date(lastSync).getTime()) / 3_600_000;
  const fresco = horasDesdeSync < 25;
  const syncLabel = new Date(lastSync).toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" });
  return (
    <button onClick={e=>{e.stopPropagation();onRefresh();}}
      title={`Meta Ads · Sync: ${syncLabel} — clique para forçar atualização`}
      className={`w-2 h-2 rounded-full shrink-0 inline-block hover:scale-125 transition-transform ${fresco ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]" : "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.7)]"}`} />
  );
}

// MetaSummary — Visão Externa (lista de clientes)
// Exibe dados do cache (meta_*_cache) gravados pelo cron de sync.
// Zero chamadas à API no carregamento — performance instantânea.
function MetaSummary({ client }: { client: Cliente }) {
  const spend = client.meta_spend_cache;
  const leads = client.meta_leads_cache;
  const cpl   = client.meta_cpl_cache;
  const moeda = client.moeda ?? "BRL";

  if (!spend && !leads) return null;

  const fmt    = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtInt = (v: number) => v.toLocaleString("pt-BR");
  const symbol = moeda === "USD" ? "US$" : "R$";

  return (
    <div className="flex items-center gap-1.5 flex-wrap mt-1">
      {/* Gasto */}
      {spend != null && spend > 0 && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#201f1d] border border-[#2e2c29] text-[#7a7268]">
          <Activity size={9} className="text-[#4a4844]" />
          {symbol} {fmt(spend)}
        </span>
      )}
      {/* Leads */}
      {leads != null && leads > 0 && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/8 border border-blue-500/25 text-blue-400">
          <Target size={9} />
          {fmtInt(leads)} leads/msg
        </span>
      )}
      {/* CPL */}
      {cpl != null && cpl > 0 && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/8 border border-emerald-500/25 text-emerald-400">
          <Zap size={9} />
          CPL {symbol} {fmt(cpl)}
        </span>
      )}
    </div>
  );
}

// ─── calcPacing — lógica centralizada de pacing (D-1 como base) ──────────────
function calcPacing(meta: number, leadsDoMes: number) {
  const hoje = new Date();
  const ano  = hoje.getFullYear();
  const mes  = hoje.getMonth(); // 0-based

  // Total de dias do mês vigente (considera anos bissextos automaticamente)
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();

  // D-1: ontem é a base consolidada.
  // Se hoje for dia 1 → leads do mês atual = 0 (novo mês), reset visual.
  const diaHoje  = hoje.getDate();
  const diaOntem = diaHoje === 1 ? 0 : diaHoje - 1;

  // Meta proporcional até ontem (D-1)
  const metaEsperadaHoje = (meta / diasNoMes) * diaOntem;

  // % da barra: progresso real sobre a meta total (capped em 100%)
  const pct        = meta > 0 ? Math.min((leadsDoMes / meta) * 100, 100) : 0;
  const pctDisplay = Math.round(pct);

  // Posição do marcador "onde deveria estar" na barra (0–99%)
  const marcadorPct = Math.min((diaOntem / diasNoMes) * 100, 99);

  // Ritmo: desvio % de leadsReais em relação à meta proporcional D-1
  // Ex: +5 = 5% acima do ritmo; -12 = 12% abaixo
  let ritmo = 0;
  if (metaEsperadaHoje > 0) {
    ritmo = Math.round(((leadsDoMes - metaEsperadaHoje) / metaEsperadaHoje) * 100);
  } else if (diaHoje === 1) {
    ritmo = 0; // reset visual do novo mês
  } else {
    ritmo = leadsDoMes > 0 ? 100 : 0;
  }

  // Saúde: baseada no ratio leads reais / meta esperada D-1
  const ratio: number =
    metaEsperadaHoje > 0 ? leadsDoMes / metaEsperadaHoje :
    diaHoje === 1 ? 1 :
    leadsDoMes > 0 ? 2 : 1;

  const saude: "verde" | "amarelo" | "vermelho" =
    ratio >= 1   ? "verde"    :
    ratio >= 0.8 ? "amarelo"  :
                   "vermelho";

  const paleta = {
    verde:    { bar: "bg-emerald-500", glow: "shadow-[0_0_8px_rgba(16,185,129,0.5)]",  badge: "bg-emerald-500/10 border-emerald-500/25 text-emerald-400", ritmo: "text-emerald-400" },
    amarelo:  { bar: "bg-amber-400",   glow: "shadow-[0_0_8px_rgba(251,191,36,0.4)]",   badge: "bg-amber-500/10 border-amber-500/25 text-amber-400",   ritmo: "text-amber-400"   },
    vermelho: { bar: "bg-red-500",     glow: "shadow-[0_0_8px_rgba(239,68,68,0.4)]",    badge: "bg-red-500/10 border-red-500/30 text-red-400",         ritmo: "text-red-400"     },
  };
  const cor = paleta[saude];

  return { pct, pctDisplay, marcadorPct, ritmo, saude, cor, metaEsperadaHoje, diaOntem, diasNoMes };
}

// ─── MetaGoalBar — Barra de Progresso de Meta Mensal com Pacing ──────────────
function MetaGoalBar({
  meta,
  leadsDoMes,
}: {
  meta: number;
  leadsDoMes: number;
}) {
  if (!meta || meta <= 0) return null;

  const { pct, pctDisplay, marcadorPct, ritmo, cor } = calcPacing(meta, leadsDoMes);

  const ritmoLabel =
    ritmo === 0 ? "No ritmo" :
    ritmo > 0   ? `Ritmo: +${ritmo}%` :
                  `Ritmo: ${ritmo}%`;

  return (
    <div className="mt-1 space-y-1">
      {/* Cabeçalho: label + ritmo + badge de contagem */}
      <div className="flex items-center justify-between gap-1">
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#4a4844] flex items-center gap-1">
          <Target size={9} className="text-amber-500/60" /> Meta Mensal
        </span>
        <div className="flex items-center gap-1.5">
          <span className={`text-[9px] font-semibold tabular-nums ${cor.ritmo}`}>
            {ritmoLabel}
          </span>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${cor.badge}`}>
            {leadsDoMes}/{meta} · {pctDisplay}%
          </span>
        </div>
      </div>

      {/* Barra de progresso com marcador D-1 */}
      <div className="relative h-1.5 rounded-full bg-[#2e2c29]">
        {/* Barra de progresso real */}
        <div
          className={`absolute top-0 left-0 h-full rounded-full transition-all duration-700 ${cor.bar} ${cor.glow}`}
          style={{ width: `${pct}%` }}
        />
        {/* Marcador "onde deveria estar hoje" — linha com halo */}
        {marcadorPct > 0 && (
          <div
            className="absolute top-0 h-full z-10"
            style={{ left: `${marcadorPct}%` }}
          >
            <div className="absolute h-full w-[3px] -translate-x-1/2 rounded-full bg-[#7a7268]/20" />
            <div className="absolute h-full w-px -translate-x-1/2 bg-[#c8c2b8]/75" />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Client Card ──────────────────────────────────────────────────────────────
function ClientCard({ client, onSelect, onEdit, onDeactivate, onDelete, onToggleAlerta, onRefreshMeta, isDragging, leadsDoMes }: {
  client:Cliente; onSelect:()=>void; onEdit:()=>void; onDeactivate:()=>void; onDelete:()=>void;
  onToggleAlerta:()=>void; onRefreshMeta:()=>void; isDragging?:boolean;
  leadsDoMes?: number;
}) {
  const st=clienteStatus(client);
  const gestorColor=client.gestor_estrategico==="Duda"?"bg-blue-600/20 text-blue-400 border-blue-500/30":
    client.gestor_estrategico==="Diego"?"bg-purple-600/20 text-purple-400 border-purple-500/30":
    "bg-[#201f1d] text-[#7a7268] border-[#2e2c29]";
  const uniquePlats=client.platforms.filter((p,i,a)=>a.findIndex(x=>x.key===p.key)===i);
  const isInactive=isClienteInativo(client);
  const temAlerta = client.alerta_pagamento === true;

  // Altura unificada: 220px sem meta | 264px com meta — todos os cards de mesmo tipo têm tamanho idêntico
  const temMeta = client.meta_leads_mensal != null && client.meta_leads_mensal > 0;
  const cardH   = temMeta ? "h-[264px]" : "h-[220px]";

  return (
    <div onClick={onSelect}
      className={`rounded-2xl border p-4 flex flex-col cursor-pointer transition-all duration-200 ${cardH} overflow-hidden hover:border-amber-500/40 hover:shadow-[0_4px_20px_rgba(245,166,35,0.08)] ${isDragging?"bg-zinc-800 border-amber-500/50 shadow-[0_8px_32px_rgba(0,0,0,0.4)]":temAlerta?"border-red-500/30 bg-red-500/5":isInactive?"border-red-500/30 bg-[#1e1b1b] opacity-60":!client.platforms?.length?"border-amber-500/25 bg-[#1e1d1a]":"border-[#2e2c29] bg-[#1a1917]"}`}>

      {/* Row 1 — Nome + Status + Menu */}
      <div className="flex items-start justify-between gap-2 shrink-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <MetaDot accountId={client.meta_ad_account_id} lastSync={client.meta_last_sync} onRefresh={onRefreshMeta} />
            <button
              onClick={e=>{e.stopPropagation();onToggleAlerta();}}
              title={temAlerta ? "Remover alerta de pagamento" : "Marcar alerta de pagamento"}
              className="shrink-0 transition-colors hover:scale-110">
              <CreditCard size={14} className={temAlerta ? "text-red-500" : "text-[#3a3835]"} />
            </button>
            <p className="font-bold text-[#e8e2d8] text-sm leading-tight truncate">{client.nome}</p>
          </div>
          <span className={`inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${st.badge}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`}/>{st.label}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <ClientActionMenu onEdit={onEdit} onDeactivate={onDeactivate} onDelete={onDelete} isInactive={isInactive}/>
        </div>
      </div>

      {/* Row 2 — Plataformas + Orçamento Planejado + Meta de Leads */}
      <div className="flex-1 flex flex-col gap-1.5 min-h-0 overflow-hidden mt-2">
        <div className="flex flex-wrap gap-1.5 content-start">
          {uniquePlats.length ? uniquePlats.map(p=>(
            <span key={p.key} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${PLATFORM_CHIP_COLOR[p.key]}`}>
              {PLATFORM_SVG[p.key]}{p.label}
            </span>
          )) : <span className="text-[#7a7268] text-xs italic">Nenhuma plataforma</span>}
        </div>
        {/* Orçamento Mensal Planejado + Meta de Leads (estático, sem dados em tempo real) */}
        {(() => {
          const totalOrc = (client.verba_meta_ads ?? 0) + (client.verba_gls ?? 0) + (client.verba_outros ?? 0);
          const temOrc = totalOrc > 0;
          const temMeta = (client.meta_leads_mensal ?? 0) > 0;
          if (!temOrc && !temMeta) return null;
          const orcSymbol = (client.moeda ?? "USD") === "USD" ? "US$" : "R$";
          const orcCurrency = (client.moeda ?? "USD") === "USD" ? "USD" : "BRL";
          return (
            <div className="flex items-center gap-1.5 flex-wrap mt-0.5 group/budget">
              {temOrc && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/8 border border-amber-500/20 text-amber-400">
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                  {orcSymbol} {totalOrc.toLocaleString(orcCurrency === "USD" ? "en-US" : "pt-BR", { maximumFractionDigits: 0 })}
                </span>
              )}
              {temMeta && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/8 border border-blue-500/25 text-blue-400">
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
                  Meta: {client.meta_leads_mensal} leads
                </span>
              )}
              {/* Atalho de edição rápida — abre direto na aba Financeiro */}
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  onEdit();
                }}
                title="Editar orçamento e metas"
                className="opacity-0 group-hover/budget:opacity-100 transition-opacity inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#2e2c29] border border-[#3a3835] text-[#7a7268] hover:text-amber-400 hover:border-amber-500/40 hover:bg-amber-500/10"
              >
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
            </div>
          );
        })()}
      </div>

      {/* Row 3 — MetaGoalBar ancorada acima do rodapé (só aparece se tiver meta) */}
      {temMeta && (() => {
        // Usa cache do mês corrente (meta_leads_cache) gravado pelo cron.
        // Fallback: banco local (uploads CSV). Nunca chama a API no carregamento.
        const cacheLeads = client.meta_leads_cache ?? 0;
        const totalResultados = cacheLeads > 0 ? cacheLeads : (leadsDoMes ?? 0);
        return (
          <div className="shrink-0 mt-1">
            <MetaGoalBar meta={client.meta_leads_mensal!} leadsDoMes={totalResultados} />
          </div>
        );
      })()}

      {/* Row 4 — Gestores + Data (sempre no rodapé) */}
      <div className="flex items-center gap-2 flex-wrap border-t border-[#2e2c29]/50 pt-2 mt-2 shrink-0">
        <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#201f1d] border border-[#2e2c29] text-[#7a7268]">
          <Layers size={10} /> {client.gestor}
        </span>
        <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${gestorColor}`}>
          <User size={10} /> {client.gestor_estrategico}
        </span>
        <span className="flex items-center gap-1 text-[10px] text-[#7a7268] ml-auto">
          <Calendar size={10} /> {client.created_at ? new Date(client.created_at).toLocaleDateString("pt-BR") : "—"}
        </span>
      </div>
    </div>
  );
}

function ClientRow({ client, onSelect, onEdit, onDeactivate, onDelete, onToggleAlerta, onRefreshMeta, dragHandleProps, dragRef, draggableProps, isDragging, showDragHandle }: {
  client:Cliente; onSelect:()=>void; onEdit:()=>void; onDeactivate:()=>void; onDelete:()=>void;
  onToggleAlerta:()=>void; onRefreshMeta:()=>void;
  dragHandleProps?: Record<string, unknown> | null;
  dragRef?: (el: HTMLElement | null) => void;
  draggableProps?: Record<string, unknown>;
  isDragging?: boolean;
  showDragHandle?: boolean;
}) {
  const st=clienteStatus(client);
  const gestorColor=client.gestor_estrategico==="Duda"?"bg-blue-600/20 text-blue-400 border-blue-500/30":
    client.gestor_estrategico==="Diego"?"bg-purple-600/20 text-purple-400 border-purple-500/30":
    "bg-[#201f1d] text-[#7a7268] border-[#2e2c29]";
  const uniquePlats=client.platforms.filter((p,i,a)=>a.findIndex(x=>x.key===p.key)===i);
  const isInactive=isClienteInativo(client);
  const temAlerta = client.alerta_pagamento === true;
  return (
    <tr
      ref={dragRef as React.Ref<HTMLTableRowElement>}
      {...(draggableProps as React.HTMLAttributes<HTMLTableRowElement>)}
      onClick={onSelect}
      style={{ ...((draggableProps as {style?: React.CSSProperties})?.style), boxShadow: isDragging?"0 4px 20px rgba(0,0,0,0.4)":undefined }}
      className={`border-b border-[#2e2c29]/60 cursor-pointer transition-colors hover:bg-amber-500/5 ${temAlerta?"bg-red-500/5":""} ${isInactive?"opacity-50":""} ${isDragging?"bg-zinc-800/90":""}`}>
      {showDragHandle && (
        <td className="pl-3 pr-1 py-3 w-6" {...(dragHandleProps as React.HTMLAttributes<HTMLTableCellElement>)} onClick={e=>e.stopPropagation()}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" className="text-[#3a3835] cursor-grab active:cursor-grabbing">
            <rect x="2" y="2" width="4" height="2" rx="1"/><rect x="10" y="2" width="4" height="2" rx="1"/>
            <rect x="2" y="7" width="4" height="2" rx="1"/><rect x="10" y="7" width="4" height="2" rx="1"/>
            <rect x="2" y="12" width="4" height="2" rx="1"/><rect x="10" y="12" width="4" height="2" rx="1"/>
          </svg>
        </td>
      )}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <MetaDot accountId={client.meta_ad_account_id} lastSync={client.meta_last_sync} onRefresh={onRefreshMeta} />
          <button onClick={e=>{e.stopPropagation();onToggleAlerta();}} title={temAlerta?"Remover alerta":"Marcar alerta de pagamento"} className="shrink-0 hover:scale-110 transition-transform">
            <CreditCard size={13} className={temAlerta ? "text-red-500" : "text-[#3a3835]"} />
          </button>
          <div className="min-w-0">
            <p className="font-semibold text-[#e8e2d8] text-sm truncate max-w-[160px]">{client.nome}</p>
            {(() => {
              const totalOrc = (client.verba_meta_ads ?? 0) + (client.verba_gls ?? 0) + (client.verba_outros ?? 0);
              const temOrc = totalOrc > 0;
              const temMeta = (client.meta_leads_mensal ?? 0) > 0;
              if (!temOrc && !temMeta) return null;
              const orcSymbol = (client.moeda ?? "USD") === "USD" ? "US$" : "R$";
              const orcCurrency = (client.moeda ?? "USD") === "USD" ? "USD" : "BRL";
              return (
                <div className="flex items-center gap-1 flex-wrap mt-0.5">
                  {temOrc && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-amber-500/8 border border-amber-500/20 text-amber-400">
                      <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                      {orcSymbol} {totalOrc.toLocaleString(orcCurrency === "USD" ? "en-US" : "pt-BR", { maximumFractionDigits: 0 })}
                    </span>
                  )}
                  {temMeta && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-blue-500/8 border border-blue-500/25 text-blue-400">
                      <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
                      {client.meta_leads_mensal} leads/mês
                    </span>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${st.badge}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`}/>{st.label}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {uniquePlats.length?uniquePlats.map(p=>(
            <span key={p.key} className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${PLATFORM_CHIP_COLOR[p.key]}`}>
              {PLATFORM_SVG[p.key]}{p.label}
            </span>
          )):<span className="text-[#7a7268] text-xs italic">—</span>}
        </div>
      </td>
      <td className="px-4 py-3"><span className="text-xs text-[#7a7268]">{client.gestor}</span></td>
      <td className="px-4 py-3">
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${gestorColor}`}>{client.gestor_estrategico}</span>
      </td>
      <td className="px-4 py-3 text-[#7a7268] text-xs whitespace-nowrap">{client.created_at ? new Date(client.created_at).toLocaleDateString("pt-BR") : "—"}</td>
      <td className="px-4 py-3" onClick={e=>e.stopPropagation()}>
        <ClientActionMenu onEdit={onEdit} onDeactivate={onDeactivate} onDelete={onDelete} isInactive={isInactive}/>
      </td>
    </tr>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CANONICAL PLATFORM DEFS — fonte única de verdade para todo o app
// ═══════════════════════════════════════════════════════════════════════════════

const CANONICAL_PLATFORM_DEFS: { key: PlatformKey; label: string; campaigns: string[] }[] = [
  {
    key: "meta", label: "Meta Ads",
    campaigns: [
      "Direct Messages (Meta)", "Engagement (Meta)", "Lead Generation (Meta)",
      "Leads Form (Meta)", "WhatsApp Leads", "Website Traffic", "Sales/Conversion",
    ],
  },
  {
    key: "google", label: "Google Ads",
    campaigns: [
      "Search Network (G-Ads)", "Performance Max", "Display Network",
      "YouTube Ads", "App Install",
    ],
  },
  {
    key: "gls", label: "Google Local Services",
    campaigns: ["Local Service Ads (GLS)", "Local Awareness"],
  },
  {
    key: "nextdoor", label: "Nextdoor Ads",
    campaigns: ["Nextdoor Local Deals", "Nextdoor Awareness"],
  },
  {
    key: "thumbtack", label: "Thumbtack",
    campaigns: ["Thumbtack Leads", "Thumbtack Pro Spotlight"],
  },
];

function getCampanhaPlatKey(camp: string): PlatformKey | null {
  for (const def of CANONICAL_PLATFORM_DEFS) {
    if (def.campaigns.includes(camp)) return def.key;
  }
  return null;
}

function buildEditCamps(cliente: Cliente): Record<PlatformKey, string[]> {
  const result: Record<PlatformKey, string[]> = { meta: [], google: [], gls: [], nextdoor: [], thumbtack: [] };

  if (Array.isArray(cliente.tipo_campanha) && cliente.tipo_campanha.length > 0) {
    for (const camp of cliente.tipo_campanha) {
      const key = getCampanhaPlatKey(camp);
      if (key) result[key] = [...result[key], camp];
    }
    return result;
  }

  for (const plat of (cliente.platforms ?? [])) {
    const def = CANONICAL_PLATFORM_DEFS.find(d => d.key === plat.key);
    if (def && plat.key in result) {
      result[plat.key as PlatformKey] = (plat.campaigns ?? []).filter(c => def.campaigns.includes(c));
    }
  }

  return result;
}

const CAMP_CHIP_COLOR: Record<PlatformKey, string> = {
  meta:      "bg-blue-500/10 text-blue-300 border-blue-500/20",
  google:    "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  gls:       "bg-purple-500/10 text-purple-300 border-purple-500/20",
  nextdoor:  "bg-green-500/10 text-green-300 border-green-500/20",
  thumbtack: "bg-cyan-500/10 text-cyan-300 border-cyan-500/20",
};

// ═══════════════════════════════════════════════════════════════════════════════
// EDIT CLIENTE MODAL
// ═══════════════════════════════════════════════════════════════════════════════

const EDIT_STATUS_OPTIONS: { value: ClienteStatus; label: string }[] = [
  { value: "ATIVO",        label: "Ativo"            },
  { value: "SEM CAMPANHA", label: "Sem Campanha"     },
  { value: "CANCELAMENTO", label: "Cancelamento"     },
];

function EditClienteModal({
  cliente, gestoresEstrat, gestoresTrafego, onSaved, onClose, perfil,
}: {
  cliente: Cliente; gestoresEstrat: string[]; gestoresTrafego: string[];
  onSaved: (c: Cliente) => void; onClose: () => void;
  perfil?: { user_id: string; nome: string } | null;
}) {
  const [nome,        setNome]       = useState(cliente.nome);
  const [gestor,      setGestor]     = useState(cliente.gestor);
  const [gestorEstr, setGestorEstr] = useState(cliente.gestor_estrategico);

  const [statusMode, setStatusMode] = useState<ClienteStatus>(() => {
    const s = cliente.status;
    if (s === "INATIVO" || s === "CANCELAMENTO") return "CANCELAMENTO";
    if (s === "SEM CAMPANHA" || !cliente.platforms?.length) return "SEM CAMPANHA";
    return "ATIVO";
  });

  const [activePlats, setActivePlats] = useState<Set<PlatformKey>>(
    () => new Set((cliente.platforms ?? []).map(p => p.key as PlatformKey))
  );

  const [camps, setCamps] = useState<Record<PlatformKey, string[]>>(
    () => buildEditCamps(cliente)
  );

  const [saving, setSaving] = useState(false);

  // ── Metas e Verbas ──────────────────────────────────────────────────────────
  const [metaLeadsMensal, setMetaLeadsMensal] = useState<string>(
    cliente.meta_leads_mensal != null ? String(cliente.meta_leads_mensal) : ""
  );
  const [verbaMeta, setVerbaMeta] = useState<string>(
    cliente.verba_meta_ads != null ? String(cliente.verba_meta_ads) : ""
  );
  const [verbaGls, setVerbaGls] = useState<string>(
    cliente.verba_gls != null ? String(cliente.verba_gls) : ""
  );
  const [verbaOutros, setVerbaOutros] = useState<string>(
    cliente.verba_outros != null ? String(cliente.verba_outros) : ""
  );

  const togglePlatform = (key: PlatformKey) => {
    setActivePlats(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        // Limpa campanhas da plataforma removida
        setCamps(c => ({ ...c, [key]: [] }));
        // Reseta verba da plataforma removida no estado local
        if (key === 'meta')    setVerbaMeta("");
        if (key === 'gls')     setVerbaGls("");
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleCamp = (key: PlatformKey, camp: string) => {
    setCamps(prev => ({
      ...prev,
      [key]: prev[key].includes(camp)
        ? prev[key].filter(c => c !== camp)
        : [...prev[key], camp],
    }));
  };

  const handleSave = async () => {
    if (!nome.trim()) { toast.error("Nome é obrigatório."); return; }
    setSaving(true);
    try {
      const newStatus: ClienteStatus =
        statusMode === "CANCELAMENTO" ? "INATIVO"
        : statusMode === "SEM CAMPANHA" ? "ATIVO"
        : "ATIVO";

      const newPlatforms: Platform[] =
        statusMode === "SEM CAMPANHA" || statusMode === "CANCELAMENTO"
          ? []
          : CANONICAL_PLATFORM_DEFS
              .filter(d => activePlats.has(d.key))
              .map(d => ({ key: d.key, label: d.label, campaigns: camps[d.key] ?? [] }));

      const tipoCampanhaArray: string[] =
        statusMode === "SEM CAMPANHA" || statusMode === "CANCELAMENTO"
          ? []
          : CANONICAL_PLATFORM_DEFS
              .filter(d => activePlats.has(d.key))
              .flatMap(d => camps[d.key] ?? []);

      const payload = {
        nome: nome.trim(),
        gestor,
        gestor_estrategico: gestorEstr,
        platforms: newPlatforms,
        status: newStatus,
        tipo_campanha: tipoCampanhaArray.length > 0 ? tipoCampanhaArray.join(',') : null,
        meta_leads_mensal: metaLeadsMensal !== "" ? Number(metaLeadsMensal) : null,
        verba_meta_ads:    verbaMeta   !== "" ? Number(verbaMeta)   : null,
        verba_gls:         verbaGls    !== "" ? Number(verbaGls)    : null,
        verba_outros:      verbaOutros !== "" ? Number(verbaOutros) : null,
      };

      const { data, error } = await supabase
        .from("clientes").update(payload).eq("id", cliente.id).select().single();
      if (error) throw error;

      const saved = normalizeCliente(data);
      toast.success(`${nome} atualizado com sucesso!`);
      if (perfil) {
        await registrarLog(
          perfil.user_id,
          perfil.nome,
          "EDITAR_CLIENTE",
          "clientes",
          cliente.id,
          `Gestor alterou configurações do cliente "${nome.trim()}"`
        );
      }
      onSaved(saved);
      onClose();
    } catch (err: unknown) {
      toast.error(`Erro ao salvar: ${err instanceof Error ? err.message : "Erro desconhecido"}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-[#2e2c29] bg-[#1a1917] shadow-2xl shadow-black/80 flex flex-col"
        style={{ maxHeight: "90dvh" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2e2c29] bg-[#111010] shrink-0">
          <div>
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.18em] text-amber-500 mb-0.5">Gestão de Cliente</p>
            <h3 className="text-sm font-extrabold text-[#e8e2d8] flex items-center gap-2">
              <Pencil size={14} className="text-amber-500" /> Editar {cliente.nome}
            </h3>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-[#7a7268] hover:text-[#e8e2d8] hover:bg-[#2e2c29] transition-colors leading-none">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5" style={{ WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}>

          {/* Nome */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#7a7268]">Nome do Cliente</label>
            <input value={nome} onChange={e => setNome(e.target.value)}
              className="w-full bg-[#201f1d] border border-[#2e2c29] rounded-xl px-4 py-2.5 text-sm text-[#e8e2d8] outline-none focus:border-amber-500/60 transition-colors placeholder:text-[#4a4844]"
              placeholder="Nome do cliente"/>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#7a7268]">Status</label>
            <div className="flex flex-wrap gap-2">
              {EDIT_STATUS_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setStatusMode(opt.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    statusMode === opt.value
                      ? opt.value === "ATIVO"         ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                        : opt.value === "CANCELAMENTO" ? "bg-red-500/15 border-red-500/40 text-red-400"
                        : "bg-amber-500/15 border-amber-500/40 text-amber-400"
                      : "bg-[#201f1d] border-[#2e2c29] text-[#7a7268] hover:border-[#7a7268]"
                  }`}>{opt.label}</button>
              ))}
            </div>
          </div>

          {/* Gestores */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#7a7268]">Gestor de Tráfego</label>
              <div className="relative">
                <select value={gestor} onChange={e => setGestor(e.target.value)}
                  className="w-full appearance-none bg-[#201f1d] border border-[#2e2c29] rounded-xl px-4 pr-9 py-2.5 text-sm text-[#e8e2d8] outline-none focus:border-amber-500/60 transition-colors cursor-pointer">
                  <option value="">Selecionar</option>
                  {gestoresTrafego.map(g => <option key={g}>{g}</option>)}
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#7a7268]" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#7a7268]">Gestor Estratégico</label>
              <div className="relative">
                <select value={gestorEstr} onChange={e => setGestorEstr(e.target.value)}
                  className="w-full appearance-none bg-[#201f1d] border border-[#2e2c29] rounded-xl px-4 pr-9 py-2.5 text-sm text-[#e8e2d8] outline-none focus:border-amber-500/60 transition-colors cursor-pointer">
                  <option value="">Selecionar</option>
                  {gestoresEstrat.map(g => <option key={g}>{g}</option>)}
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#7a7268]" />
              </div>
            </div>
          </div>

          {/* Plataformas & Campanhas */}
          {statusMode === "ATIVO" && (
            <div className="space-y-4">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#7a7268]">Plataformas &amp; Campanhas</label>

              {CANONICAL_PLATFORM_DEFS.map(def => {
                const isActive = activePlats.has(def.key);
                return (
                  <div key={def.key} className={`rounded-xl border overflow-hidden transition-all ${
                    isActive ? "border-amber-500/30" : "border-[#2e2c29]"
                  }`}>
                    <button
                      type="button"
                      onClick={() => togglePlatform(def.key)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all ${
                        isActive ? "bg-amber-500/5" : "bg-[#201f1d] hover:bg-[#252321]"
                      }`}
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                        isActive ? "bg-amber-500 border-amber-500" : "border-[#3a3835]"
                      }`}>
                        {isActive && <span className="text-[#111] text-xs font-bold leading-none">✓</span>}
                      </div>
                      <span className="shrink-0">{PLATFORM_SVG[def.key]}</span>
                      <span className={`font-semibold text-sm flex-1 transition-colors ${isActive ? "text-[#e8e2d8]" : "text-[#7a7268]"}`}>
                        {def.label}
                      </span>
                      {isActive && (camps[def.key]?.length ?? 0) > 0 && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${CAMP_CHIP_COLOR[def.key]}`}>
                          {camps[def.key].length} camp.
                        </span>
                      )}
                    </button>

                    {isActive && (
                      <div className="px-4 pb-4 pt-2 bg-[#111010]/50 border-t border-amber-500/10">
                        <div className="flex items-center justify-between mb-2.5">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-amber-500/60">
                            Campanhas
                          </p>
                          <div className="flex gap-3">
                            <button type="button"
                              onClick={() => setCamps(prev => ({ ...prev, [def.key]: [...def.campaigns] }))}
                              className="text-[9px] font-semibold text-amber-500/70 hover:text-amber-400 transition-colors">
                              ✓ Todas
                            </button>
                            <button type="button"
                              onClick={() => setCamps(prev => ({ ...prev, [def.key]: [] }))}
                              className="text-[9px] font-semibold text-[#7a7268] hover:text-[#e8e2d8] transition-colors">
                              ✕ Limpar
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-y-0.5">
                          {def.campaigns.map(camp => {
                            const checked = (camps[def.key] ?? []).includes(camp);
                            return (
                              <button
                                key={camp}
                                type="button"
                                onClick={() => toggleCamp(def.key, camp)}
                                className={`flex items-center gap-2.5 w-full text-left px-2 py-2 rounded-lg transition-colors group ${
                                  checked ? "bg-amber-500/8 hover:bg-amber-500/12" : "hover:bg-[#201f1d]"
                                }`}
                              >
                                <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                                  checked ? "bg-amber-500 border-amber-500" : "border-[#3a3835] group-hover:border-amber-500/40"
                                }`}>
                                  {checked && <span className="text-[#111] text-[8px] font-bold leading-none">✓</span>}
                                </div>
                                <span className={`text-xs leading-snug transition-colors ${
                                  checked ? "text-[#e8e2d8] font-medium" : "text-[#7a7268] group-hover:text-[#a09890]"
                                }`}>{camp}</span>
                              </button>
                            );
                          })}
                        </div>

                        {(camps[def.key]?.length ?? 0) > 0 && (
                          <p className="text-[9px] text-amber-500/50 mt-2 pl-1">
                            {camps[def.key].length}/{def.campaigns.length} selecionada{camps[def.key].length !== 1 ? "s" : ""}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Metas & Controle de Investimento ────────────────────────────── */}
        <div className="px-6 py-5 border-t border-[#2e2c29] space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-amber-500/20 flex items-center justify-center shrink-0">
              <Target size={10} className="text-amber-400" />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#7a7268]">Metas &amp; Controle de Investimento</p>
          </div>

          {/* Meta Mensal de Leads */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-[#4a4844] font-medium">Meta Mensal de Leads</label>
            <input
              type="number"
              min="0"
              value={metaLeadsMensal}
              onChange={e => setMetaLeadsMensal(e.target.value)}
              placeholder="Ex: 50"
              className="w-full bg-[#201f1d] border border-[#2e2c29] rounded-xl px-4 py-2.5 text-sm text-[#e8e2d8] placeholder:text-[#4a4844] outline-none focus:border-amber-500/60 transition-colors"
            />
          </div>

          {/* Verbas lado a lado — grid simétrico, altura padronizada */}
          <div className="grid grid-cols-2 gap-3">
            {activePlats.has('meta') && (
            <div className="space-y-1.5">
              <label className="text-[10px] text-[#4a4844] font-medium flex items-center gap-1 min-h-[1.25rem]">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.372-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                Verba Meta Ads (R$)
              </label>
              <input
                type="number" min="0" step="0.01" value={verbaMeta}
                onChange={e => setVerbaMeta(e.target.value)}
                placeholder="Ex: 3000.00"
                className="w-full h-[42px] bg-[#201f1d] border border-[#2e2c29] rounded-xl px-4 py-2.5 text-sm text-[#e8e2d8] placeholder:text-[#4a4844] outline-none focus:border-blue-500/50 transition-colors"
              />
            </div>
            )}
            {activePlats.has('gls') && (
            <div className="space-y-1.5">
              <label className="text-[10px] text-[#4a4844] font-medium flex items-center gap-1 min-h-[1.25rem]">
                <svg width="9" height="9" viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="20" fill="#34A853"/><path d="M34.5858 17.5858L21.4142 30.7574L14.8284 24.1716L12 27L21.4142 36.4142L37.4142 20.4142L34.5858 17.5858Z" fill="white"/></svg>
                Verba GLS (R$)
              </label>
              <input
                type="number" min="0" step="0.01" value={verbaGls}
                onChange={e => setVerbaGls(e.target.value)}
                placeholder="Ex: 1500.00"
                className="w-full h-[42px] bg-[#201f1d] border border-[#2e2c29] rounded-xl px-4 py-2.5 text-sm text-[#e8e2d8] placeholder:text-[#4a4844] outline-none focus:border-purple-500/50 transition-colors"
              />
            </div>
            )}
          </div>
          {/* Outras verbas */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-[#4a4844] font-medium">Outras Verbas (R$)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={verbaOutros}
              onChange={e => setVerbaOutros(e.target.value)}
              placeholder="Ex: 500.00"
              className="w-full bg-[#201f1d] border border-[#2e2c29] rounded-xl px-4 py-2.5 text-sm text-[#e8e2d8] placeholder:text-[#4a4844] outline-none focus:border-amber-500/50 transition-colors"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[#2e2c29] bg-[#111010] shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-[#2e2c29] bg-[#201f1d] text-[#7a7268] text-xs font-semibold hover:text-[#e8e2d8] hover:border-[#7a7268] transition-colors">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-amber-500 text-[#111] text-xs font-bold hover:bg-amber-400 active:scale-95 transition-all disabled:opacity-40 shadow-[0_2px_12px_rgba(245,166,35,0.3)]">
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} className="fill-current" />}
            {saving ? "Salvando..." : "Salvar Alterações"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RADAR META ADS — Painel inline no cliente ativo, filtro independente
// ═══════════════════════════════════════════════════════════════════════════════

type RadarPreset = "today" | "yesterday" | "7d" | "30d" | "this_month" | "custom";

function computeRadarDates(preset: RadarPreset): { since: string; until: string } {
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const today = new Date();
  // yesterday: dados de hoje são parciais — o Meta Ads Manager também usa D-1 como limite
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (preset === "today") {
    const s = fmt(today); return { since: s, until: s };
  }
  if (preset === "yesterday") {
    const s = fmt(yesterday); return { since: s, until: s };
  }
  if (preset === "7d") {
    const from = new Date(yesterday); from.setDate(yesterday.getDate() - 6);
    return { since: fmt(from), until: fmt(yesterday) };
  }
  if (preset === "30d") {
    const from = new Date(yesterday); from.setDate(yesterday.getDate() - 29);
    return { since: fmt(from), until: fmt(yesterday) };
  }
  if (preset === "this_month") {
    const from = new Date(today.getFullYear(), today.getMonth(), 1);
    return { since: fmt(from), until: fmt(today) };
  }
  return { since: fmt(yesterday), until: fmt(yesterday) };
}

const RADAR_PRESET_LABELS: Record<RadarPreset, string> = {
  today: "Hoje", yesterday: "Ontem", "7d": "7 dias", "30d": "30 dias", this_month: "Este Mês", custom: "Custom",
};

// ─── Status badge helper ──────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const s = (status ?? "").toUpperCase();
  const cls = s === "ACTIVE" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
    : s === "PAUSED"  ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
    : "bg-[#2e2c29] text-[#7a7268] border-[#2e2c29]";
  const label = s === "ACTIVE" ? "Ativo" : s === "PAUSED" ? "Pausado" : s;
  return <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${cls}`}>{label}</span>;
}

// ─── Skeleton Radar ───────────────────────────────────────────────────────────
function RadarSkeleton() {
  return (
    <div className="rounded-xl border border-blue-500/20 bg-[#111827]/60 p-4 space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded bg-blue-500/20" />
          <div className="h-3 w-28 bg-[#2e2c29] rounded" />
        </div>
        <div className="flex gap-1">
          {[1,2,3,4,5].map(i => <div key={i} className="h-6 w-12 bg-[#2e2c29] rounded-lg" />)}
        </div>
      </div>
      {/* Totais skeleton */}
      <div className="grid grid-cols-3 gap-3 pb-3 border-b border-[#2e2c29]">
        {[1,2,3].map(i => (
          <div key={i} className="space-y-1.5">
            <div className="h-2 w-16 bg-[#2e2c29] rounded" />
            <div className="h-5 w-24 bg-[#2e2c29] rounded" />
          </div>
        ))}
      </div>
      {/* Grupos skeleton */}
      {[1,2].map(i => (
        <div key={i} className="rounded-lg border border-[#2e2c29] p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="h-3 w-20 bg-[#2e2c29] rounded" />
            <div className="flex gap-4">
              <div className="h-3 w-16 bg-[#2e2c29] rounded" />
              <div className="h-3 w-12 bg-[#2e2c29] rounded" />
              <div className="h-3 w-16 bg-[#2e2c29] rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Radar Tree Drill-down ────────────────────────────────────────────────────
function RadarTree({
  treeData,
  symbol,
}: {
  treeData: MetaTreeData;
  symbol: string;
}) {
  const [openGroups,    setOpenGroups]    = useState<Set<string>>(new Set());
  const [openCampaigns, setOpenCampaigns] = useState<Set<string>>(new Set());
  const [openAdSets,    setOpenAdSets]    = useState<Set<string>>(new Set());

  const fmt    = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtInt = (v: number) => v.toLocaleString("pt-BR");

  const toggle = (set: Set<string>, key: string, setter: (s: Set<string>) => void) => {
    const n = new Set(set); n.has(key) ? n.delete(key) : n.add(key); setter(n);
  };

  const totalSpend = treeData.groups.reduce((s, g) => s + g.total_spend, 0);

  // Resultados NÃO devem ser somados entre objectives diferentes
  // (leads + engajamentos são unidades incomparáveis).
  // O cabeçalho mostra apenas o gasto total e um resumo por objetivo.
  // O CPR global só faz sentido se há um único grupo.
  const singleGroup  = treeData.groups.length === 1 ? treeData.groups[0] : null;
  const globalResults = singleGroup?.total_results ?? null;
  const globalCpr     = singleGroup && singleGroup.total_results > 0
    ? singleGroup.total_spend / singleGroup.total_results
    : null;

  return (
    <div className="space-y-3">
      {/* ── Totais globais ── */}
      <div className="grid grid-cols-3 gap-3 pb-3 border-b border-[#2e2c29]">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-[#4a4844]">Gasto Total</p>
          <p className="text-sm font-extrabold text-[#e8e2d8]">{symbol} {fmt(totalSpend)}</p>
        </div>
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-[#4a4844]">
            {singleGroup ? `Resultados · ${singleGroup.objective_label}` : "Resultados"}
          </p>
          {globalResults !== null
            ? <p className="text-sm font-extrabold text-[#e8e2d8]">{fmtInt(globalResults)}</p>
            : <p className="text-[10px] text-[#4a4844] italic mt-1">Ver por objetivo ↓</p>
          }
        </div>
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-[#4a4844]">Custo/Resultado</p>
          <p className="text-sm font-extrabold text-[#e8e2d8]">
            {globalCpr !== null ? `${symbol} ${fmt(globalCpr)}` : "—"}
          </p>
        </div>
      </div>

      {/* ── Sem dados ── */}
      {treeData.groups.length === 0 && (
        <p className="text-[10px] text-[#4a4844] italic text-center py-2">Nenhum dado para o período selecionado.</p>
      )}

      {/* ── Nível 1: Grupos por Objetivo ── */}
      {treeData.groups.map(group => {
        const gKey   = group.objective;
        const gOpen  = openGroups.has(gKey);
        return (
          <div key={gKey} className="rounded-xl border border-[#2e2c29] overflow-hidden bg-[#0f1520]/60">
            {/* Header do grupo */}
            <button
              onClick={() => toggle(openGroups, gKey, setOpenGroups)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-blue-500/5 transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <ChevronDown size={13} className={`text-blue-400 transition-transform shrink-0 ${gOpen ? "rotate-180" : ""}`} />
                <span className="text-xs font-bold text-blue-300">{group.objective_label}</span>
                <span className="text-[10px] text-[#7a7268] bg-[#1a1917] border border-[#2e2c29] px-1.5 py-0.5 rounded-full">
                  {group.campaigns.length} camp.
                </span>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <div className="text-right">
                  <p className="text-[9px] text-[#4a4844] font-bold uppercase">Gasto</p>
                  <p className="text-xs font-extrabold text-[#e8e2d8]">{symbol} {fmt(group.total_spend)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] text-[#4a4844] font-bold uppercase">Resultados</p>
                  <p className="text-xs font-extrabold text-emerald-400">{fmtInt(group.total_results)}</p>
                </div>
                <div className="text-right hidden sm:block">
                  <p className="text-[9px] text-[#4a4844] font-bold uppercase">Custo/Res.</p>
                  <p className="text-xs font-extrabold text-[#c8c0b4]">{group.total_results > 0 ? `${symbol} ${fmt(group.cpr)}` : "—"}</p>
                </div>
              </div>
            </button>

            {/* ── Nível 2: Campanhas ── */}
            {gOpen && (
              <div className="border-t border-[#2e2c29] bg-[#0c1018]/40">
                {group.campaigns.map(camp => {
                  const cKey  = camp.id;
                  const cOpen = openCampaigns.has(cKey);
                  return (
                    <div key={cKey} className="border-b border-[#1e2330]/60 last:border-b-0">
                      <button
                        onClick={() => toggle(openCampaigns, cKey, setOpenCampaigns)}
                        className="w-full flex items-center justify-between px-5 py-2.5 hover:bg-[#1a2235]/60 transition-colors text-left"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <ChevronDown size={11} className={`text-[#4a4844] transition-transform shrink-0 ${cOpen ? "rotate-180" : ""}`} />
                          <span className="text-[11px] font-semibold text-[#c8c0b4] truncate">{camp.name}</span>
                          <StatusBadge status={camp.status} />
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-2">
                          <div className="text-right">
                            <p className="text-[8px] text-[#4a4844] font-bold uppercase">Gasto</p>
                            <p className="text-[10px] font-bold text-[#e8e2d8]">{camp.insights.spend > 0 ? `${symbol} ${fmt(camp.insights.spend)}` : "—"}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[8px] text-[#4a4844] font-bold uppercase">Res.</p>
                            <p className="text-[10px] font-bold text-emerald-400">{camp.insights.results > 0 ? fmtInt(camp.insights.results) : "—"}</p>
                          </div>
                          <div className="text-right hidden sm:block">
                            <p className="text-[8px] text-[#4a4844] font-bold uppercase">C/Res.</p>
                            <p className="text-[10px] font-bold text-[#a09890]">{camp.insights.results > 0 ? `${symbol} ${fmt(camp.insights.cpr)}` : "—"}</p>
                          </div>
                        </div>
                      </button>

                      {/* ── Nível 3: AdSets ── */}
                      {cOpen && camp.adsets.length > 0 && (
                        <div className="bg-[#09111e]/50 border-t border-[#1e2330]/40">
                          {camp.adsets.map(adset => {
                            const aKey  = adset.id;
                            const aOpen = openAdSets.has(aKey);
                            return (
                              <div key={aKey} className="border-b border-[#1e2330]/30 last:border-b-0">
                                <button
                                  onClick={() => toggle(openAdSets, aKey, setOpenAdSets)}
                                  className="w-full flex items-center justify-between px-7 py-2 hover:bg-[#1a2235]/40 transition-colors text-left"
                                >
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <ChevronDown size={10} className={`text-[#3a3835] transition-transform shrink-0 ${aOpen ? "rotate-180" : ""}`} />
                                    <span className="text-[10px] font-medium text-[#a09890] truncate">{adset.name}</span>
                                    <StatusBadge status={adset.status} />
                                  </div>
                                  <div className="flex items-center gap-3 shrink-0 ml-2">
                                    <span className="text-[9px] text-[#7a7268]">{adset.insights.spend > 0 ? `${symbol} ${fmt(adset.insights.spend)}` : "—"}</span>
                                    <span className="text-[9px] text-emerald-500/70">{adset.insights.results > 0 ? `${fmtInt(adset.insights.results)} res.` : "—"}</span>
                                    <span className="text-[9px] text-[#7a7268] hidden sm:inline">{adset.insights.results > 0 ? `${symbol} ${fmt(adset.insights.cpr)}/res.` : ""}</span>
                                  </div>
                                </button>

                                {/* ── Nível 4: Anúncios ── */}
                                {aOpen && adset.ads.length > 0 && (
                                  <div className="bg-[#060e18]/60 border-t border-[#1a2235]/30">
                                    {adset.ads.map(ad => (
                                      <div key={ad.id}
                                        className="flex items-center justify-between px-9 py-1.5 border-b border-[#1a2235]/20 last:border-b-0">
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                          <span className="w-1 h-1 rounded-full bg-[#2e2c29] shrink-0" />
                                          <span className="text-[9px] text-[#7a7268] truncate">{ad.name}</span>
                                          <StatusBadge status={ad.status} />
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0 ml-2">
                                          <span className="text-[9px] text-[#4a4844]">{ad.insights.spend > 0 ? `${symbol} ${fmt(ad.insights.spend)}` : "—"}</span>
                                          <span className="text-[9px] text-emerald-600/60">{ad.insights.results > 0 ? `${fmtInt(ad.insights.results)} res.` : "—"}</span>
                                          <span className="text-[9px] text-[#4a4844] hidden sm:inline">{ad.insights.results > 0 ? `${symbol} ${fmt(ad.insights.cpr)}/res.` : ""}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {aOpen && adset.ads.length === 0 && (
                                  <p className="text-[9px] text-[#4a4844] italic px-9 py-2">Nenhum anúncio encontrado.</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {cOpen && camp.adsets.length === 0 && (
                        <p className="text-[9px] text-[#4a4844] italic px-7 py-2 bg-[#09111e]/50">Nenhum conjunto encontrado.</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── RadarWrapper: componente com estado próprio ──────────────────────────────
function RadarWrapper({
  clienteId, accountId, token, treeData, onFetch, moedaCliente, ignoreIds,
}: {
  clienteId:    string;
  accountId:    string;
  token:        string | null;
  treeData:     MetaTreeData | null;
  onFetch:      (clienteId: string, accountId: string, token: string | null, since: string, until: string, preset?: string, ignoreIds?: string[] | null) => void;
  ignoreIds?:   string[] | null;
  moedaCliente?: 'BRL' | 'USD' | null;
}) {
  const [preset,     setPreset]     = useState<RadarPreset>("7d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo,   setCustomTo]   = useState("");
  const [showCustom, setShowCustom] = useState(false);

  const symbol = (moedaCliente ?? (treeData?.currency ?? "BRL")) === "USD" ? "US$" : "R$";

  // Dispara fetch apenas ao montar ou trocar de cliente
  useEffect(() => {
    doFetch("7d");
    setPreset("7d");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId]);

  const handlePresetClick = (p: RadarPreset) => {
    setPreset(p);
    setShowCustom(p === "custom");
    if (p === "custom") return;
    doFetch(p);
  };
  const handleCustomApply = () => {
    if (!customFrom || !customTo) return;
    doFetch("custom", customFrom, customTo);
  };

  const [activeDates, setActiveDates] = useState<{ since: string; until: string }>(() => computeRadarDates("7d"));

  const isLoading = !treeData || treeData.loading;

  const doFetch = (p: RadarPreset, from?: string, to?: string) => {
    if (p === "custom" && from && to) {
      setActiveDates({ since: from, until: to });
      onFetch(clienteId, accountId, token, from, to, undefined, ignoreIds);
    } else if (p !== "custom") {
      const dates = computeRadarDates(p);
      setActiveDates(dates);
      // Passa o preset e blacklist para o route
      onFetch(clienteId, accountId, token, dates.since, dates.until, p, ignoreIds);
    }
  };

  return (
    <div className="rounded-xl border border-blue-500/20 bg-[#111827]/60 p-4 space-y-3">
      {/* Header + seletor de período */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M24 12.073c0-6.627-5.372-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" fill="#1877F2"/>
          </svg>
          <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400">Radar Meta Ads</span>
          {isLoading && <span className="text-[9px] text-blue-400/60 font-semibold animate-pulse">Carregando...</span>}
          {treeData && !treeData.loading && !treeData.error && (
            <span className="text-[9px] text-[#4a4844]">{treeData.account_name}</span>
          )}
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {(["today","yesterday","7d","30d","this_month","custom"] as RadarPreset[]).map(p => (
            <button key={p} onClick={() => { setPreset(p); setShowCustom(p === "custom"); doFetch(p); }}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                preset === p
                  ? "bg-blue-500 border-blue-400 text-white"
                  : "bg-[#1a1917] border-[#2e2c29] text-[#7a7268] hover:text-[#e8e2d8] hover:border-[#4a4844]"
              }`}>
              {RADAR_PRESET_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Período ativo — para confirmar visualmente as datas */}
      {!isLoading && preset !== "custom" && (
        <p className="text-[9px] text-[#4a4844] font-mono">
          {activeDates.since.split("-").reverse().join("/")} → {activeDates.until.split("-").reverse().join("/")}
        </p>
      )}

      {/* Campos de data personalizada */}
      {showCustom && (
        <div className="flex flex-col sm:flex-row gap-2">
          <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
            className="flex-1 bg-[#1a1917] border border-[#2e2c29] rounded-lg px-3 py-1.5 text-xs text-[#e8e2d8] outline-none focus:border-blue-500/60 transition-colors [color-scheme:dark]"/>
          <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
            className="flex-1 bg-[#1a1917] border border-[#2e2c29] rounded-lg px-3 py-1.5 text-xs text-[#e8e2d8] outline-none focus:border-blue-500/60 transition-colors [color-scheme:dark]"/>
          <button onClick={handleCustomApply} disabled={!customFrom || !customTo}
            className="px-3 py-1.5 rounded-lg bg-blue-500 text-white text-[10px] font-bold hover:bg-blue-400 transition-colors disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap">
            Aplicar
          </button>
        </div>
      )}

      {/* Erro */}
      {treeData?.error && (
        <div className="flex items-center gap-2 py-1">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
          <p className="text-[10px] text-red-400 font-semibold">Erro: {treeData.error}</p>
        </div>
      )}

      {/* Loading skeleton bonito */}
      {isLoading && !treeData?.error && (
        <div className="space-y-4 animate-pulse">
          <div className="grid grid-cols-3 gap-3 pb-3 border-b border-[#2e2c29]">
            {[1,2,3].map(i => (
              <div key={i} className="space-y-1.5">
                <div className="h-2 w-14 bg-[#2e2c29] rounded" />
                <div className="h-5 w-20 bg-[#2e2c29] rounded" />
              </div>
            ))}
          </div>
          {[1,2].map(i => (
            <div key={i} className="rounded-xl border border-[#2e2c29] p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="h-3 w-20 bg-[#2e2c29] rounded" />
                <div className="flex gap-3">
                  <div className="h-3 w-16 bg-[#2e2c29] rounded" />
                  <div className="h-3 w-12 bg-[#2e2c29] rounded" />
                  <div className="h-3 w-16 bg-[#2e2c29] rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Árvore de dados */}
      {treeData && !treeData.loading && !treeData.error && (
        <RadarTree treeData={treeData} symbol={symbol} />
      )}
    </div>
  );
}
// ═══════════════════════════════════════════════════════════════════════════════
// SKELETON LOADER
// ═══════════════════════════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════════════════════
// MASTER DASHBOARD — Visão Global da Diretoria (apenas admin)
// Agrega dados de cache de todos os clientes da operação em tempo real (zero API)
// ═══════════════════════════════════════════════════════════════════════════════

function MasterDashboard({ clientes }: { clientes: Cliente[] }) {
  const comMeta = clientes.filter(c => c.meta_ad_account_id && !isClienteInativo(c));
  if (comMeta.length === 0) return null;

  const totalSpend    = comMeta.reduce((s, c) => s + (c.meta_spend_cache ?? 0), 0);
  const totalLeads    = comMeta.reduce((s, c) => s + (c.meta_leads_cache ?? 0), 0);
  const totalOrc      = clientes.reduce((s, c) => s + (c.verba_meta_ads ?? 0) + (c.verba_gls ?? 0) + (c.verba_outros ?? 0), 0);
  const cplGlobal     = totalLeads > 0 ? totalSpend / totalLeads : 0;
  const pctGasto      = totalOrc > 0 ? Math.min((totalSpend / totalOrc) * 100, 100) : 0;
  const syncTimes     = comMeta.map(c => c.meta_last_sync).filter(Boolean) as string[];
  const lastSync      = syncTimes.length > 0
    ? new Date(Math.max(...syncTimes.map(s => new Date(s).getTime())))
    : null;

  const fmt    = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtInt = (v: number) => v.toLocaleString("pt-BR");

  // Cor da barra de progresso
  const barColor = pctGasto >= 95 ? "bg-red-500" : pctGasto >= 75 ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[0.6rem] font-bold uppercase tracking-[0.18em] text-violet-400 mb-0.5 flex items-center gap-1.5">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
            Dashboard Global · Diretoria
          </p>
          <h2 className="text-sm font-extrabold text-[#e8e2d8]">
            Visão Consolidada da Operação
          </h2>
        </div>
        {lastSync && (
          <span className="text-[10px] text-[#4a4844] flex items-center gap-1">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Sync: {lastSync.toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" })}
          </span>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {[
          { label: "Gasto Total Meta", value: fmt(totalSpend), sub: `${comMeta.filter(c => (c.meta_spend_cache ?? 0) > 0).length} clientes ativos`, color: "text-[#e8e2d8]" },
          { label: "Leads / Conversões", value: fmtInt(totalLeads), sub: "acumulado mês corrente", color: "text-blue-400" },
          { label: "CPL Médio Global", value: cplGlobal > 0 ? fmt(cplGlobal) : "—", sub: "custo por lead/msg", color: "text-emerald-400" },
          { label: "Orçamento Planejado", value: totalOrc > 0 ? fmt(totalOrc) : "—", sub: "soma verbas cadastradas", color: "text-amber-400" },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-xl border border-[#2e2c29] bg-[#111010] p-3">
            <p className="text-[9px] font-bold uppercase tracking-widest text-[#4a4844] mb-1">{kpi.label}</p>
            <p className={`text-lg font-extrabold leading-tight ${kpi.color}`}>{kpi.value}</p>
            <p className="text-[10px] text-[#4a4844] mt-0.5">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Barra de Progresso: Gasto vs Orçamento */}
      {totalOrc > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#7a7268]">Gasto Atual vs Orçamento Planejado</span>
            <span className={`text-[10px] font-bold ${pctGasto >= 95 ? "text-red-400" : pctGasto >= 75 ? "text-amber-400" : "text-emerald-400"}`}>
              {Math.round(pctGasto)}% utilizado
            </span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-[#2e2c29] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${barColor}`}
              style={{ width: `${pctGasto}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-[#4a4844]">
            <span>Gasto: {fmt(totalSpend)}</span>
            <span>Orçamento: {fmt(totalOrc)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-[#2e2c29] bg-[#1a1917] p-4 min-h-[178px] space-y-3 animate-pulse">
      <div className="flex justify-between items-start gap-2">
        <div className="space-y-2 flex-1">
          <div className="h-4 w-3/4 bg-[#2e2c29] rounded-lg" />
          <div className="h-3 w-1/3 bg-[#2e2c29] rounded-full" />
        </div>
        <div className="w-7 h-7 bg-[#2e2c29] rounded-lg shrink-0" />
      </div>
      <div className="flex gap-2">
        <div className="h-5 w-20 bg-[#2e2c29] rounded-full" />
        <div className="h-5 w-24 bg-[#2e2c29] rounded-full" />
      </div>
      <div className="border-t border-[#2e2c29]/50 pt-2 flex gap-2">
        <div className="h-4 w-16 bg-[#2e2c29] rounded-full" />
        <div className="h-4 w-14 bg-[#2e2c29] rounded-full" />
        <div className="h-4 w-20 bg-[#2e2c29] rounded-full ml-auto" />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// NORMALIZAR CLIENTE — Fix de Leitura do Banco (Array vs String)
// ═══════════════════════════════════════════════════════════════════════════════

const STATUS_LEGACY_MAP: Record<string, ClienteStatus> = {
  active:      "ATIVO",
  inactive:    "INATIVO",
  ATIVO:       "ATIVO",
  INATIVO:     "INATIVO",
  "SEM CAMPANHA": "SEM CAMPANHA",
  CANCELAMENTO:   "CANCELAMENTO",
};

function normalizeCliente(raw: Record<string, unknown>): Cliente {
  const rawStatus = (raw.status as string) ?? "";
  const status: ClienteStatus = STATUS_LEGACY_MAP[rawStatus] ?? "ATIVO";
  
  // ── AQUI ACONTECE A MÁGICA DE LEITURA ──
  // Converte a string vinda do banco (ex: "Campanha A, Campanha B") para Array
  let tcArray: string[] | null = null;
  if (Array.isArray(raw.tipo_campanha)) {
    tcArray = raw.tipo_campanha as string[];
  } else if (typeof raw.tipo_campanha === "string" && raw.tipo_campanha.trim() !== "") {
    tcArray = raw.tipo_campanha.split(",").map(s => s.trim()).filter(Boolean);
  }

  return {
    ...raw,
    status,
    platforms: Array.isArray(raw.platforms) ? (raw.platforms as Platform[]) : [],
    tipo_campanha: tcArray,
    alerta_pagamento: raw.alerta_pagamento === true,
    meta_ad_account_id: (raw.meta_ad_account_id as string) ?? null,
    meta_access_token:  (raw.meta_access_token  as string) ?? null,
    meta_status:        (raw.meta_status         as string) ?? "sem_link",
    meta_leads_mensal:  raw.meta_leads_mensal  != null ? Number(raw.meta_leads_mensal)  : null,
    verba_meta_ads:     raw.verba_meta_ads     != null ? Number(raw.verba_meta_ads)     : null,
    verba_gls:          raw.verba_gls          != null ? Number(raw.verba_gls)          : null,
    verba_outros:       raw.verba_outros       != null ? Number(raw.verba_outros)       : null,
    gls_account_id:     (raw.gls_account_id    as string) ?? null,
    moeda:              (raw.moeda as 'BRL' | 'USD' | null) ?? 'USD',
    // Cache de métricas Meta (preenchido pelo cron de sync)
    meta_spend_cache:   raw.meta_spend_cache != null ? Number(raw.meta_spend_cache) : null,
    meta_leads_cache:   raw.meta_leads_cache != null ? Number(raw.meta_leads_cache) : null,
    meta_cpl_cache:     raw.meta_cpl_cache   != null ? Number(raw.meta_cpl_cache)   : null,
    meta_last_sync:     (raw.meta_last_sync  as string) ?? null,
    // Blacklist de campanhas ignoradas nas métricas
    meta_ignored_campaigns: Array.isArray(raw.meta_ignored_campaigns)
      ? (raw.meta_ignored_campaigns as string[])
      : typeof raw.meta_ignored_campaigns === "string" && raw.meta_ignored_campaigns.trim()
        ? JSON.parse(raw.meta_ignored_campaigns)
        : null,
    // Input Express: gasto manual de Google/GLS/outras redes sem API
    gasto_manual_outras_redes: raw.gasto_manual_outras_redes != null ? Number(raw.gasto_manual_outras_redes) : null,
  } as Cliente;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════════════════

function OperacaoContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [perfil, setPerfil]           = useState<GestorPerfil | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError]     = useState<string | null>(null);

  const [operacoes, setOperacoes]               = useState<Operacao[]>([]);
  const [operacaoAtiva, setOperacaoAtiva]       = useState<Operacao | null>(null);
  const [operacoesLoading, setOperacoesLoading] = useState(true);
  const [novaOpOpen, setNovaOpOpen]             = useState(false);
  const [opDropdownOpen, setOpDropdownOpen]     = useState(false);

  const [clientes, setClientes]               = useState<Cliente[]>([]);
  const [clientesLoading, setClientesLoading] = useState(false);
  const [clienteAtivo, setClienteAtivo]       = useState<Cliente | null>(null);
  const [clienteModal, setClienteModal]       = useState<{ mode:"new"|"edit"; client?: Cliente; initialTab?: "perfil"|"campanhas"|"financeiro"|"integracoes" } | null>(null);
  const [editModal, setEditModal]             = useState<Cliente | null>(null);

  // ── Leads do Mês por Cliente (para barra de meta) ──────────────────────────
  const [leadsDoMesPorCliente, setLeadsDoMesPorCliente] = useState<Record<string, number>>({});

  const [leadsLoading, setLeadsLoading] = useState(false);
  const [currentPage, setCurrentPage]   = useState(1);
  const [newLeadOpen, setNewLeadOpen]   = useState(false);
  // Dashboard: dataset completo (sem paginação) para cálculos de métricas
  const [allLeadsForDashboard, setAllLeadsForDashboard] = useState<Lead[]>([]);
  const [leadSearch, setLeadSearch]     = useState("");
  const [platFilter, setPlatFilter]     = useState("");
  const _initDates = (() => { const fmt=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; const y=new Date(); y.setDate(y.getDate()-1); const f=new Date(y); f.setDate(f.getDate()-6); return {from:fmt(f),to:fmt(y)}; })();
  const [dateFrom, setDateFrom]         = useState(_initDates.from);
  const [dateTo, setDateTo]             = useState(_initDates.to);
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("7d");
  const [itemsPerPage, setItemsPerPage] = useState(10); // Padrão: 10 itens por página

  const [clientSearch, setClientSearch] = useState("");
  const [gestorFilter, setGestorFilter] = useState("");       // Gestor Estratégico
  const [trafegoFilter, setTrafegoFilter] = useState("");     // Gestor de Tráfego (novo)
  const [statusFilter, setStatusFilter] = useState("todos");
  const [pendenciasFilter, setPendenciasFilter] = useState(false);
  const [metaInsights, setMetaInsights] = useState<Record<string, {
    account_status: number;
    spend: number;
    leads: number;
    messages: number;
    total_leads: number;
    cpl: number;
    currency: string;
    form_leads: number;
    form_spend: number;
    form_cpl: number;
    msg_leads: number;
    msg_spend: number;
    msg_cpl: number;
    loading: boolean;
    error?: string;
  }>>({});

  // Estado separado para insights do período filtrado (usado no Painel Visual)
  // metaInsights = sempre mês corrente (para pacing/MetaGoalBar)
  // metaInsightsFiltro = período do filtro do usuário (para Painel Visual)
  const [metaInsightsFiltro, setMetaInsightsFiltro] = useState<Record<string, {
    total_leads: number;
    messages: number;
    form_leads: number;
    spend: number;
    cpl: number;
    since: string;
    until: string;
  }>>({});

  // ── Árvore Radar Meta (Campaigns → AdSets → Ads) ──────────────────────────
  const [metaTree, setMetaTree] = useState<Record<string, MetaTreeData>>({});
  const [viewMode, setViewMode]         = useState<ViewMode>("grid");
  const [sortMode, setSortMode]         = useState<SortMode>("personalizada");
  const [settingsOpen, setSettingsOpen] = useState(false);
  
  // ── Botão Voltar ao Topo ──────────────────────────────────────────────────────
  const [showScrollTop, setShowScrollTop] = useState(false);

  // ── Bug Reports ───────────────────────────────────────────────────────────────
  const [isBugModalOpen, setIsBugModalOpen]   = useState(false);
  const [isAdminBugsOpen, setIsAdminBugsOpen] = useState(false);
  const [isAuditOpen, setIsAuditOpen]         = useState(false);

  useEffect(() => {
    // Escuta erros globais para sabermos exatamente o que quebrou em produção
    const handleError = (e: ErrorEvent) => toast.error(`Render Error: ${e.message}`);
    window.addEventListener("error", handleError);
    
    const handleScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("error", handleError);
    };
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });
  const scrollPosRef = useRef<number>(0);

  const [gestoresEstrat, setGestoresEstrat]   = useState<string[]>([]);
  const [gestoresTrafego, setGestoresTrafego] = useState<string[]>([]);

  const handleLogout = useCallback(async () => {
    try {
      const supabaseClient = createClient();
      await supabaseClient.auth.signOut();
    } catch {
      // ignora
    } finally {
      router.push("/login");
      router.refresh();
    }
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    const bootstrap = async () => {
      setAuthLoading(true);
      try {
        const supabaseClient = createClient();
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
        if (cancelled) return;
        if (userError || !user) { router.replace("/login"); return; }
        const { data: gestorData, error: gestorError } = await supabaseClient
          .from("gestores").select("id, nome, role, operacao_id, user_id").eq("user_id", user.id).single();
        if (cancelled) return;
        if (gestorError || !gestorData) { setAuthError("Acesso não autorizado. Contate o administrador."); return; }
        // Normaliza operacao_id: filtra nulls e garante array limpo
        const rawPerfil = gestorData as Record<string, unknown>;
        const rawOpId = rawPerfil.operacao_id;
        const cleanOpId: string[] = Array.isArray(rawOpId)
          ? (rawOpId as unknown[]).filter((v): v is string => typeof v === "string" && v.length > 0)
          : [];
        setPerfil({ ...(rawPerfil as GestorPerfil), operacao_id: cleanOpId.length > 0 ? cleanOpId : null });
      } catch (err) {
        if (!cancelled) { console.error("Bootstrap error:", err); setAuthError("Erro ao verificar acesso. Tente novamente."); }
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    };
    bootstrap();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!perfil) return;
    fetchGestores();
    fetchOperacoes(perfil);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil]);

  useEffect(() => {
    document.documentElement.style.height="auto"; document.documentElement.style.overflow="visible";
    document.body.style.height="auto"; document.body.style.overflow="visible";
    document.body.style.overflowX="hidden"; document.body.style.position="static";
  }, []);

  const fetchGestores = async () => {
    try {
      const { data, error } = await supabase.from("gestores").select("nome, tipo").order("created_at",{ascending:true});
      if (error) throw error;
      const rows = (data??[]) as { nome:string; tipo:string }[];
      setGestoresEstrat(rows.filter(r=>r.tipo==="estrategico").map(r=>r.nome));
      setGestoresTrafego(rows.filter(r=>r.tipo==="trafego").map(r=>r.nome));
    } catch (err: unknown) {
      toast.error(`Erro ao carregar gestores: ${err instanceof Error ? err.message : "Erro desconhecido"}`);
    }
  };

  const fetchOperacoes = async (p: GestorPerfil) => {
    setOperacoesLoading(true);
    try {
      // Admin: busca todas as operações
      // Gestor: filtra pelas operações associadas ao perfil
      const isGestorSemOp = p.role === "gestor" && (!p.operacao_id || p.operacao_id.length === 0);
      if (isGestorSemOp) {
        setOperacoes([]);
        toast.error("Seu usuário não está associado a nenhuma operação. Contate o administrador.");
        return;
      }

      let query = supabase.from("operacoes").select("*").order("created_at", { ascending: true });
      if (p.role === "gestor" && p.operacao_id && p.operacao_id.length > 0) {
        query = query.in("id", p.operacao_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      const ops = (data as Operacao[]) ?? [];
      setOperacoes(ops);
      if (ops.length > 0) { setOperacaoAtiva(ops[0]); fetchClientes(ops[0].id); }
    } catch (err: unknown) {
      toast.error(`Erro ao carregar operações: ${err instanceof Error ? err.message : "Erro desconhecido"}`);
    } finally {
      setOperacoesLoading(false);
    }
  };

  // ── Abre modal de Nova Operação quando ?nova=1 está na URL ──────────────────
  useEffect(() => {
    if (!operacoesLoading && searchParams.get("nova") === "1") {
      setNovaOpOpen(true);
      // Limpa o parâmetro da URL sem recarregar a página
      router.replace("/operacao");
    }
  }, [operacoesLoading, searchParams, router]);

  const fetchClientes = useCallback(async (operacaoId: string) => {
    setClientesLoading(true); setClientes([]);
    try {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome, operacao_id, gestor, gestor_estrategico, platforms, status, created_at, ordem, tipo_campanha, alerta_pagamento, meta_ad_account_id, meta_access_token, meta_status, meta_leads_mensal, verba_meta_ads, verba_gls, verba_outros, gls_account_id, moeda, meta_spend_cache, meta_leads_cache, meta_cpl_cache, meta_last_sync, meta_ignored_campaigns, gasto_manual_outras_redes")
        .eq("operacao_id",operacaoId)
        .order("ordem",{ascending:true,nullsFirst:false})
        .order("created_at",{ascending:false});
      if (error) throw error;
      const rows = ((data as Record<string, unknown>[]) ?? []).map(normalizeCliente);
      setClientes(rows);
      // Busca leads do mês atual por cliente (para barra de meta — banco local)
      // fetchMetaInsights removido do carregamento automático: os cards agora usam
      // meta_*_cache (preenchido pelo cron). Chamada só ocorre ao entrar num cliente.
      fetchLeadsDoMesBatch(rows.map(r => r.id));
    } catch (err: unknown) {
      toast.error(`Erro ao carregar clientes: ${err instanceof Error ? err.message : "Erro desconhecido"}`);
    } finally {
      setClientesLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Busca contagem de leads do mês atual para cada cliente (base D-1 — pacing)
  const fetchLeadsDoMesBatch = useCallback(async (clienteIds: string[]) => {
    if (!clienteIds.length) return;
    try {
      const now     = new Date();
      const ano     = now.getFullYear();
      const mes     = now.getMonth(); // 0-based
      const diaHoje = now.getDate();

      // Início do mês vigente
      const mesInicio = new Date(ano, mes, 1).toISOString().slice(0, 10);

      // Limite superior: D-1 (dados consolidados até ontem).
      // Se hoje for dia 1, ontem pertence ao mês anterior — leads do mês atual = 0.
      let ontem: string;
      if (diaHoje === 1) {
        ontem = new Date(ano, mes, 0).toISOString().slice(0, 10); // último dia do mês anterior
      } else {
        ontem = new Date(ano, mes, diaHoje - 1).toISOString().slice(0, 10);
      }

      const { data, error } = await supabase
        .from("leads")
        .select("cliente, data")
        .in("cliente", clienteIds)
        .gte("data", mesInicio)
        .lte("data", ontem); // apenas leads consolidados até D-1
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of (data ?? []) as { cliente: string; data: string }[]) {
        if (row.cliente) counts[row.cliente] = (counts[row.cliente] ?? 0) + 1;
      }
      setLeadsDoMesPorCliente(counts);
    } catch {
      // silencia — não é crítico
    }
  }, []);

  const handleSelectOperacao = (op: Operacao) => {
    setOperacaoAtiva(op); setClienteAtivo(null);
    setClientSearch(""); setGestorFilter(""); setTrafegoFilter(""); setOpDropdownOpen(false);
    fetchClientes(op.id);
  };

  const fetchLeads = useCallback(async (clienteId: string) => {
    setLeadsLoading(true);
    try {
      const { data, error } = await supabase
        .from("leads").select("*").eq("cliente", clienteId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data as Lead[]) ?? [];
      setAllLeadsForDashboard(rows);
    } catch (err: unknown) {
      toast.error(`Erro ao buscar leads: ${err instanceof Error ? err.message : "Erro desconhecido"}`);
      setAllLeadsForDashboard([]);
    } finally {
      setLeadsLoading(false);
    }
  }, []);

  // Obsolete pagination functions removed. Logic now handled by filteredLeads/paginatedLeads derivations.

  const handleSelectCliente = useCallback((cliente: Cliente) => {
    scrollPosRef.current = window.scrollY; // Salva a posição
    setClienteAtivo(cliente); setLeadSearch(""); setPlatFilter("");
    const _fmtL=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; const _y=new Date(); _y.setDate(_y.getDate()-1); const _f=new Date(_y); _f.setDate(_f.getDate()-6);
    setDateFrom(_fmtL(_f)); setDateTo(_fmtL(_y)); setPeriodPreset("7d"); setCurrentPage(1);
    fetchLeads(cliente.id);
    // Auto-sync silencioso de leads Meta
    if (cliente.meta_ad_account_id && operacaoAtiva) {
      syncMetaLeads(
        cliente.id,
        cliente.meta_ad_account_id,
        cliente.meta_access_token ?? null,
        operacaoAtiva.id,
        operacaoAtiva.nome,
      );
    }
    window.scrollTo({ top: 0, behavior: "smooth" }); // Sobe suavemente
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchLeads, operacaoAtiva]);

  const handleLeadsParsed = useCallback(async (parsedLeads: Lead[]) => {
    if (!clienteAtivo||!operacaoAtiva) return;
    const rows = parsedLeads.map(l => ({
      nome:l.nome||null, email:l.email||null, telefone:l.telefone||null,
      data:l.data||null, plataforma:l.plataforma||null, charge_status:l.charge_status||null,
      cliente:clienteAtivo.id, operacao:operacaoAtiva.nome, operacao_id:operacaoAtiva.id,
    }));
    try {
      const { data, error } = await supabase.from("leads").insert(rows).select();
      if (error) throw error;
      toast.success(`${rows.length} leads salvos no banco!`);
      // Simplesmente atualiza o estado local para evitar re-fetch de tudo
      setAllLeadsForDashboard(prev => [...((data as Lead[]) ?? []), ...prev].sort((a,b) => {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return timeB - timeA;
      }));
    } catch (err: unknown) {
      toast.error(`Erro ao salvar leads: ${err instanceof Error ? err.message : "Erro desconhecido"}`);
    }
  }, [clienteAtivo, operacaoAtiva]);

  const handleDeleteLeads = useCallback(async (ids: string[]) => {
    try {
      const { error } = await supabase.from("leads").delete().in("id",ids);
      if (error) throw error;
      toast.success(`${ids.length} lead(s) excluído(s).`);
      setAllLeadsForDashboard(prev => prev.filter(l=>!ids.includes(l.id)));
      if (perfil) {
        await registrarLog(
          perfil.user_id,
          perfil.nome,
          "EXCLUIR_LEADS",
          "leads",
          clienteAtivo?.id ?? null,
          `Gestor excluiu ${ids.length} lead(s) do cliente "${clienteAtivo?.nome ?? "desconhecido"}"`
        );
      }
    } catch (err: unknown) {
      toast.error(`Erro ao excluir leads: ${err instanceof Error ? err.message : "Erro desconhecido"}`);
    }
  }, [perfil, clienteAtivo]);

  const handleSaveNewLead = useCallback(async (leadData: Omit<Lead,"id">) => {
    if (!clienteAtivo||!operacaoAtiva) return;
    try {
      const row = {
        nome:leadData.nome||null, email:leadData.email||null,
        telefone:leadData.telefone||null, data:leadData.data||null,
        plataforma:leadData.plataforma||null,
        cliente:clienteAtivo.id, operacao:operacaoAtiva.nome, operacao_id:operacaoAtiva.id,
      };
      const { data, error } = await supabase.from("leads").insert([row]).select().single();
      if (error) throw error;
      toast.success("Lead adicionado com sucesso!"); setNewLeadOpen(false);
      setAllLeadsForDashboard(prev => [data as Lead,...prev]);
    } catch (err: unknown) {
      toast.error(`Erro ao salvar lead: ${err instanceof Error ? err.message : "Erro desconhecido"}`);
    }
  }, [clienteAtivo, operacaoAtiva]);

  const handleClienteSaved = (cliente: Cliente) => {
    const normalized = normalizeCliente(cliente as unknown as Record<string, unknown>);
    setClientes(prev => {
      const exists = prev.find(c=>c.id===normalized.id);
      if (exists) return prev.map(c=>c.id===normalized.id?normalized:c);
      return [normalized,...prev];
    });
    // Se o modal foi aberto a partir da tela de detalhe, sincroniza clienteAtivo imediatamente
    if (clienteAtivo?.id === normalized.id) setClienteAtivo(normalized);
    setClienteModal(null);
  };

  const handleEditClienteSaved = (cliente: Cliente) => {
    setClientes(prev => prev.map(c=>c.id===cliente.id?cliente:c));
    if (clienteAtivo?.id === cliente.id) setClienteAtivo(cliente);
    setEditModal(null);
  };

  const handleDeactivate = async (id: string) => {
    const c = clientes.find(x=>x.id===id); if (!c) return;
    const newStatus: ClienteStatus = isClienteInativo(c) ? "ATIVO" : "INATIVO";
    try {
      const { data, error } = await supabase.from("clientes").update({status:newStatus}).eq("id",id).select().single();
      if (error) throw error;
      const normalized = normalizeCliente(data as Record<string, unknown>);
      setClientes(prev=>prev.map(x=>x.id===id?normalized:x));
      toast.success(newStatus==="ATIVO"?`${c.nome} reativado.`:`${c.nome} desativado.`);
      if (perfil) {
        await registrarLog(
          perfil.user_id,
          perfil.nome,
          "MUDAR_STATUS",
          "clientes",
          id,
          `Gestor alterou status do cliente "${c.nome}" para ${newStatus}`
        );
      }
    } catch (err: unknown) {
      toast.error(`Erro: ${err instanceof Error ? err.message : "Erro desconhecido"}`);
    }
  };

  const handleDelete = async (id: string) => {
    const c = clientes.find(x=>x.id===id);
    if (!confirm(`Excluir "${c?.nome}" permanentemente? Esta ação não pode ser desfeita.`)) return;
    try {
      const { error } = await supabase.from("clientes").delete().eq("id",id);
      if (error) throw error;
      setClientes(prev=>prev.filter(x=>x.id!==id));
      if (clienteAtivo?.id===id) { setClienteAtivo(null); }
      toast.success("Cliente removido.");
      if (perfil) {
        await registrarLog(
          perfil.user_id,
          perfil.nome,
          "EXCLUIR_CLIENTE",
          "clientes",
          id,
          `Gestor excluiu permanentemente o cliente "${c?.nome ?? id}"`
        );
      }
    } catch (err: unknown) {
      toast.error(`Erro: ${err instanceof Error ? err.message : "Erro desconhecido"}`);
    }
  };

  const handleToggleAlerta = async (id: string) => {
    const c = clientes.find(x=>x.id===id);
    if (!c) return;
    const novoValor = !c.alerta_pagamento;
    try {
      const { error } = await supabase.from("clientes").update({ alerta_pagamento: novoValor }).eq("id", id);
      if (error) throw error;
      setClientes(prev => prev.map(x => x.id===id ? {...x, alerta_pagamento: novoValor} : x));
      toast[novoValor ? "warning" : "success"](
        novoValor ? `Alerta de pagamento ativado para ${c.nome}` : `Alerta removido de ${c.nome}`
      );
    } catch (err: unknown) {
      toast.error(`Erro: ${err instanceof Error ? err.message : "Erro desconhecido"}`);
    }
  };

  // ── Busca insights Meta Ads por cliente ───────────────────────────────────
  const fetchMetaInsights = async (
    clienteId: string,
    accountId: string,
    token: string | null,
    since?: string,
    until?: string,
    ignoreIds?: string[] | null,
  ) => {
    // Com período → atualiza metaInsightsFiltro (Painel Visual do período)
    // Sem período → busca mês corrente e atualiza metaInsights (pacing/MetaGoalBar)
    const isFiltrado = !!(since && until);
    const zero = { account_status: 0, spend: 0, leads: 0, messages: 0, total_leads: 0, cpl: 0, currency: "BRL", form_leads: 0, form_spend: 0, form_cpl: 0, msg_leads: 0, msg_spend: 0, msg_cpl: 0, other_spend: 0, other_count: 0, other_campaigns: [] as OtherCampaignDetail[] };
    if (!isFiltrado) setMetaInsights(prev => ({ ...prev, [clienteId]: { ...zero, loading: true } }));
    try {
      const params = new URLSearchParams({ action: "insights", account_id: accountId });
      if (token) params.set("token", token);
      if (ignoreIds && ignoreIds.length > 0) params.set("ignore_ids", ignoreIds.join(","));
      if (since && until) {
        params.set("since", since);
        params.set("until", until);
      } else {
        // Padrão: mês vigente (do dia 1 até hoje) — garante pacing correto
        const today = new Date();
        const from  = new Date(today.getFullYear(), today.getMonth(), 1);
        const fmt = (d: Date) => d.toISOString().slice(0, 10);
        params.set("since", fmt(from));
        params.set("until", fmt(today));
      }
      const res  = await fetch(`/api/meta?${params}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);

      if (isFiltrado) {
        // Período filtrado → grava em metaInsightsFiltro (Painel Visual)
        // NÃO sobrescreve metaInsights (mês corrente) para não quebrar o pacing
        setMetaInsightsFiltro(prev => ({
          ...prev,
          [clienteId]: {
            total_leads: json.total_leads ?? 0,
            messages:    json.msg_leads   ?? 0,
            form_leads:  json.form_leads  ?? 0,
            spend:       json.spend       ?? 0,
            cpl:         json.cpl         ?? 0,
            since:       since!,
            until:       until!,
          },
        }));
      } else {
        // Sem período → mês corrente → grava em metaInsights (pacing/MetaGoalBar)
        setMetaInsights(prev => ({
          ...prev,
          [clienteId]: {
            account_status:  json.account_status,
            spend:           json.spend,
            leads:           json.leads           ?? 0,
            messages:        json.messages        ?? 0,
            total_leads:     json.total_leads,
            cpl:             json.cpl,
            currency:        json.currency        ?? "BRL",
            form_leads:      json.form_leads      ?? 0,
            form_spend:      json.form_spend      ?? 0,
            form_cpl:        json.form_cpl        ?? 0,
            msg_leads:       json.msg_leads       ?? 0,
            msg_spend:       json.msg_spend       ?? 0,
            msg_cpl:         json.msg_cpl         ?? 0,
            other_spend:     json.other_spend     ?? 0,
            other_count:     json.other_count     ?? 0,
            other_campaigns: json.other_campaigns ?? [],
            loading:         false,
          },
        }));
      }
    } catch (err: unknown) {
      if (!isFiltrado) {
        setMetaInsights(prev => ({
          ...prev,
          [clienteId]: { account_status: -1, spend: 0, leads: 0, messages: 0, total_leads: 0, cpl: 0, currency: "BRL", form_leads: 0, form_spend: 0, form_cpl: 0, msg_leads: 0, msg_spend: 0, msg_cpl: 0, other_spend: 0, other_count: 0, other_campaigns: [], loading: false, error: (err as Error).message },
        }));
      }
    }
  };

  const fetchMetaTree = async (
    clienteId: string,
    accountId: string,
    token: string | null,
    since?: string,
    until?: string,
    preset?: string,
    ignoreIds?: string[] | null,
  ) => {
    setMetaTree(prev => ({ ...prev, [clienteId]: { account_status: 0, account_name: "", currency: "BRL", groups: [], loading: true } }));
    try {
      const params = new URLSearchParams({ action: "tree", account_id: accountId });
      if (token) params.set("token", token);
      if (ignoreIds && ignoreIds.length > 0) params.set("ignore_ids", ignoreIds.join(","));
      if (preset && ["today","yesterday","7d","30d","this_month"].includes(preset)) {
        // Passa o preset diretamente — o route usa date_preset nativo do Meta
        params.set("preset", preset);
        // Mantém since/until para exibição no UI
        if (since && until) { params.set("since", since); params.set("until", until); }
      } else if (since && until) {
        // Custom range — usa time_range
        params.set("since", since);
        params.set("until", until);
      } else {
        params.set("preset", "7d");
      }
      const res  = await fetch(`/api/meta?${params}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setMetaTree(prev => ({ ...prev, [clienteId]: { ...json, loading: false } }));
    } catch (err: unknown) {
      setMetaTree(prev => ({ ...prev, [clienteId]: { account_status: -1, account_name: "", currency: "BRL", groups: [], loading: false, error: (err as Error).message } }));
    }
  };

  // ── Auto-Sync: busca leads Meta e faz upsert no Supabase ─────────────────
  // ── Limpa leads Meta contaminados e re-sincroniza APENAS este cliente ────────
  const cleanupAndResyncMetaLeads = async (
    clienteId: string,
    accountId: string,
    token: string | null,
    operacaoId: string,
    operacaoNome: string,
  ) => {
    try {
      toast.loading("Removendo duplicatas e leads incorretos...", { id: "cleanup" });

      // Passo 1: Remove TODOS os leads com meta_lead_id deste cliente
      // (leads manuais sem meta_lead_id não são afetados)
      const { error: delError } = await supabase
        .from("leads")
        .delete()
        .eq("cliente", clienteId)
        .not("meta_lead_id", "is", null);
      if (delError) throw delError;

      toast.loading("Re-sincronizando leads corretos...", { id: "cleanup" });

      // Passo 2: Re-sincroniza com lógica account-scoped
      await syncMetaLeads(clienteId, accountId, token, operacaoId, operacaoNome);

      // Passo 3: Recarrega leads na tela
      await fetchLeads(clienteId);
      toast.success("Leads Meta re-sincronizados!", { id: "cleanup" });
    } catch (err: unknown) {
      toast.error(`Erro: ${err instanceof Error ? err.message : "Erro desconhecido"}`, { id: "cleanup" });
    }
  };

  // Lock para evitar sync concorrente (auto-sync + cleanup ao mesmo tempo)
  const metaSyncRunning = useRef(false);

  const syncMetaLeads = async (
    clienteId: string,
    accountId: string,
    token: string | null,
    operacaoId: string,
    operacaoNome: string,
  ) => {
    if (metaSyncRunning.current) return;
    metaSyncRunning.current = true;
    try {
      const params = new URLSearchParams({ action: "leads", account_id: accountId });
      if (token) params.set("token", token);
      const res  = await fetch(`/api/meta?${params}`);
      const json = await res.json();
      if (json.error || !json.leads?.length) return;

      // Busca leads existentes deste cliente para deduplicar
      const { data: existing } = await supabase
        .from("leads")
        .select("meta_lead_id, email, nome")
        .eq("cliente", clienteId);

      const existingMetaIds = new Set(
        (existing ?? []).map((r: { meta_lead_id: string }) => r.meta_lead_id).filter(Boolean)
      );
      // Chave secundária: email normalizado (evita duplicar mesmo lead sem meta_lead_id)
      const existingEmails = new Set(
        (existing ?? []).map((r: { email: string }) => (r.email ?? "").toLowerCase().trim()).filter(Boolean)
      );

      // Deduplicação tripla:
      // 1. meta_lead_id já no banco
      // 2. email já no banco
      // 3. duplicatas dentro do próprio array retornado pela API
      const seenInBatch = new Set<string>();
      const novos = (json.leads as {
        meta_lead_id: string; nome: string; email: string;
        telefone: string; created_time: string;
      }[]).filter(l => {
        if (existingMetaIds.has(l.meta_lead_id)) return false;
        const emailKey = (l.email ?? "").toLowerCase().trim();
        if (emailKey && existingEmails.has(emailKey)) return false;
        const batchKey = l.meta_lead_id || emailKey;
        if (batchKey && seenInBatch.has(batchKey)) return false;
        if (batchKey) seenInBatch.add(batchKey);
        return true;
      });

      if (!novos.length) return;

      const rows = novos.map(l => ({
        meta_lead_id: l.meta_lead_id,
        nome:         l.nome || null,
        email:        l.email || null,
        telefone:     l.telefone || null,
        data:         l.created_time ? l.created_time.slice(0, 10) : null,
        plataforma:   "Meta Ads",
        cliente:      clienteId,
        operacao:     operacaoNome,
        operacao_id:  operacaoId,
      }));

      const { data: inserted, error } = await supabase.from("leads").insert(rows).select();
      if (error) throw error;
      if (inserted?.length) {
        setAllLeadsForDashboard(prev => [...((inserted as Lead[]) ?? []), ...prev]);
        toast.success(`${inserted.length} lead(s) Meta sincronizado(s).`);
      }
    } catch (err: unknown) {
      console.error("[syncMetaLeads] Erro:", err instanceof Error ? err.message : String(err));
    } finally {
      metaSyncRunning.current = false;
    }
  };

  const handleDragEnd = useCallback(async (result: { source:{index:number}; destination:{index:number}|null }) => {
    if (!result.destination) return;
    const { source, destination } = result;
    if (source.index===destination.index) return;
    setClientes(prev => {
      const sorted = [...prev].sort((a,b) => {
        if (isClienteInativo(a) && !isClienteInativo(b)) return 1;
        if (!isClienteInativo(a) && isClienteInativo(b)) return -1;
        const aO=a.ordem??Infinity, bO=b.ordem??Infinity;
        return aO - bO;
      });
      const filtered = sorted.filter(c => {
        const matchSearch = !clientSearch||c.nome.toLowerCase().includes(clientSearch.toLowerCase());
        const matchGestor = !gestorFilter||c.gestor_estrategico===gestorFilter;
        const matchTrafego = !trafegoFilter||c.gestor===trafegoFilter;
        return matchSearch && matchGestor && matchTrafego;
      });
      const reordered = [...filtered];
      const [moved] = reordered.splice(source.index,1);
      reordered.splice(destination.index,0,moved);
      const newOrdemMap = new Map<string,number>();
      reordered.forEach((c,i)=>newOrdemMap.set(c.id,i+1));
      const updated = prev.map(c=>newOrdemMap.has(c.id)?{...c,ordem:newOrdemMap.get(c.id)!}:c);
      Promise.all(reordered.map((c,i)=>supabase.from("clientes").update({ordem:i+1}).eq("id",c.id)))
        .catch(()=>toast.error("Erro ao salvar ordem dos clientes."));
      return updated;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientSearch, gestorFilter, trafegoFilter]);

  const handleAddEstrat = async (nome: string) => {
    try { const { error } = await supabase.from("gestores").insert({nome,tipo:"estrategico"}); if (error) throw error; setGestoresEstrat(prev=>[...prev,nome]); }
    catch (err: unknown) { toast.error(`Erro: ${(err as Error).message}`); }
  };
  const handleDeleteEstrat = async (nome: string) => {
    try { const { error } = await supabase.from("gestores").delete().eq("nome",nome).eq("tipo","estrategico"); if (error) throw error; setGestoresEstrat(prev=>prev.filter(g=>g!==nome)); }
    catch (err: unknown) { toast.error(`Erro: ${(err as Error).message}`); }
  };
  const handleRenameEstrat = async (oldName: string, newName: string) => {
    try {
      const { error } = await supabase.from("gestores").update({nome:newName}).eq("nome",oldName).eq("tipo","estrategico"); if (error) throw error;
      await supabase.from("clientes").update({gestor_estrategico:newName}).eq("gestor_estrategico",oldName);
      setClientes(prev=>prev.map(c=>c.gestor_estrategico===oldName?{...c,gestor_estrategico:newName}:c));
      setGestoresEstrat(prev=>prev.map(g=>g===oldName?newName:g));
      toast.success(`"${oldName}" → "${newName}" atualizado em cascata.`);
    } catch (err: unknown) { toast.error(`Erro: ${(err as Error).message}`); }
  };
  const handleAddTrafego = async (nome: string) => {
    try { const { error } = await supabase.from("gestores").insert({nome,tipo:"trafego"}); if (error) throw error; setGestoresTrafego(prev=>[...prev,nome]); }
    catch (err: unknown) { toast.error(`Erro: ${(err as Error).message}`); }
  };
  const handleDeleteTrafego = async (nome: string) => {
    try { const { error } = await supabase.from("gestores").delete().eq("nome",nome).eq("tipo","trafego"); if (error) throw error; setGestoresTrafego(prev=>prev.filter(g=>g!==nome)); }
    catch (err: unknown) { toast.error(`Erro: ${(err as Error).message}`); }
  };
  const handleRenameTrafego = async (oldName: string, newName: string) => {
    try {
      const { error } = await supabase.from("gestores").update({nome:newName}).eq("nome",oldName).eq("tipo","trafego"); if (error) throw error;
      await supabase.from("clientes").update({gestor:newName}).eq("gestor",oldName);
      setClientes(prev=>prev.map(c=>c.gestor===oldName?{...c,gestor:newName}:c));
      setGestoresTrafego(prev=>prev.map(g=>g===oldName?newName:g));
      toast.success(`"${oldName}" → "${newName}" atualizado em cascata.`);
    } catch (err: unknown) { toast.error(`Erro: ${(err as Error).message}`); }
  };

  // ── Handlers: Gestão de Operações via SettingsModal ───────────────────────
  const handleDeleteOperacao = async (id: string) => {
    const { error } = await supabase.from("operacoes").delete().eq("id", id);
    if (error) throw error;
    setOperacoes(prev => prev.filter(op => op.id !== id));
    if (operacaoAtiva?.id === id) { setOperacaoAtiva(null); setClientes([]); }
  };

  const handleRefreshOperacoes = async () => {
    const { data } = await supabase.from("operacoes").select("*").order("created_at", { ascending: true });
    setOperacoes((data ?? []) as Operacao[]);
  };

  // Filtro principal unificado de leads
  const filteredLeads = (() => {
    const dtFrom = dateFrom ? new Date(dateFrom) : null;
    const dtTo   = dateTo   ? new Date(dateTo)   : null;
    if (dtTo) dtTo.setHours(23,59,59,999);
    const s = leadSearch.toLowerCase();
    
    return allLeadsForDashboard.filter(l => {
      const matchText = !s||(l.nome||"").toLowerCase().includes(s)||l.telefone.includes(s)||(l.email||"").toLowerCase().includes(s);
      const matchPlat = !platFilter||(l.plataforma||"").toLowerCase().includes(platFilter.toLowerCase());
      let matchDate = true;
      if (dtFrom||dtTo) {
        const leadDate = parseDMY(l.data??"");
        if (!leadDate) matchDate=false;
        else { if (dtFrom&&leadDate<dtFrom) matchDate=false; if (dtTo&&leadDate>dtTo) matchDate=false; }
      }
      return matchText && matchPlat && matchDate;
    });
  })();

  // Paginação derivativa
  const totalLeadsCount = filteredLeads.length;
  const paginatedLeads = filteredLeads.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Dashboard usa o mesmo set filtrado
  const filteredDashboardLeads = filteredLeads;

  const platOptions    = [...new Set(allLeadsForDashboard.map(l=>l.plataforma).filter(Boolean))].sort();
  // Gestores estratégicos presentes nos clientes da operação
  const gestorOptions  = [...new Set(clientes.map(c=>c.gestor_estrategico).filter(Boolean))].sort();
  // Gestores de tráfego presentes nos clientes da operação (fonte: campo `gestor`)
  const trafegoOptions = [...new Set(clientes.map(c=>c.gestor).filter(Boolean))].sort();

  const filteredClientes = clientes.filter(c => {
    // 1. Busca por nome
    const matchSearch = !clientSearch || (c.nome || "").toLowerCase().includes(clientSearch.toLowerCase());
    // 2. Gestor Estratégico
    const matchGestor = !gestorFilter || c.gestor_estrategico === gestorFilter;
    // 3. Gestor de Tráfego (novo filtro cruzado)
    const matchTrafego = !trafegoFilter || c.gestor === trafegoFilter;
    // 4. Status
    const isInactive = isClienteInativo(c);
    const hasAnyCampaign = c.platforms && c.platforms.length > 0;
    let matchStatus = true;
    if (statusFilter === "ativos") {
      matchStatus = !isInactive && hasAnyCampaign;
    } else if (statusFilter === "sem_camp") {
      matchStatus = !isInactive && !hasAnyCampaign;
    } else if (statusFilter === "cancelados") {
      matchStatus = isInactive;
    }
    // 5. Pendências de pagamento
    const matchPendencia = !pendenciasFilter || c.alerta_pagamento === true;

    return matchSearch && matchGestor && matchTrafego && matchStatus && matchPendencia;
  })
    .sort((a,b) => {
      const aInactive = isClienteInativo(a);
      const bInactive = isClienteInativo(b);

      // Inativos/cancelados sempre no final
      if (aInactive && !bInactive) return 1;
      if (!aInactive && bInactive) return -1;

      if (sortMode === "alfabetica") {
        return (a.nome || "").localeCompare(b.nome || "", "pt-BR", {sensitivity:"base"});
      }

      // Modo personalizado:
      // 1. Sem ordem definida (recém-criados) → topo, por created_at DESC
      // 2. Com ordem numérica → crescente
      const aHasOrdem = a.ordem != null;
      const bHasOrdem = b.ordem != null;

      if (!aHasOrdem && !bHasOrdem) {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bTime - aTime; // mais recente primeiro
      }
      if (!aHasOrdem &&  bHasOrdem) return -1; // novo sobe
      if ( aHasOrdem && !bHasOrdem) return  1; // novo sobe

      return (a.ordem as number) - (b.ordem as number);
    });

  const stats = {
    total:  clientes.length,
    active: clientes.filter(c=>!isClienteInativo(c)&&c.platforms?.length>0).length,
    none:   clientes.filter(c=>!isClienteInativo(c)&&!c.platforms?.length).length,
    cancel: clientes.filter(c=>isClienteInativo(c)).length,
  };

  const sharedProps = (c: Cliente) => ({
    client:c,
    onSelect:        ()=>handleSelectCliente(c),
    onEdit:          ()=>setClienteModal({mode:"edit",client:c,initialTab:"financeiro"}),
    onDeactivate:    ()=>handleDeactivate(c.id),
    onDelete:        ()=>handleDelete(c.id),
    onToggleAlerta:  ()=>handleToggleAlerta(c.id),
    // metaData removido: cards usam cache do banco (meta_*_cache)
    // onRefreshMeta: força sync individual via cron endpoint
    onRefreshMeta:   () => {
      if (!c.meta_ad_account_id) return;
      fetch(`/api/cron/sync-meta?cliente_id=${c.id}`, { method: "GET" })
        .then(r => r.json())
        .then(() => fetchClientes(operacaoAtiva?.id ?? ""))
        .catch(console.error);
    },
    leadsDoMes:      leadsDoMesPorCliente[c.id] ?? 0,
  });

  // Refaz a busca de insights filtrados quando o período muda dentro da view de cliente
  useEffect(() => {
    if (!clienteAtivo?.meta_ad_account_id || !dateFrom || !dateTo) return;
    fetchMetaInsights(
      clienteAtivo.id,
      clienteAtivo.meta_ad_account_id,
      clienteAtivo.meta_access_token ?? null,
      dateFrom,
      dateTo,
      clienteAtivo.meta_ignored_campaigns,
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, clienteAtivo?.id]);

  const backToDashboard = () => {
    setClienteAtivo(null); setLeadSearch(""); setPlatFilter("");
    const _fmtL=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; const _y=new Date(); _y.setDate(_y.getDate()-1); const _f=new Date(_y); _f.setDate(_f.getDate()-6);
    setDateFrom(_fmtL(_f)); setDateTo(_fmtL(_y)); setPeriodPreset("7d");
    setTimeout(() => {
      window.scrollTo({ top: scrollPosRef.current, behavior: "instant" });
    }, 10); // Devolve pro pixel exato
  };

  const isAdmin = perfil?.role === "admin";

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#111010] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-2 border-amber-500/20 border-t-amber-500 animate-spin" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-bold text-[#e8e2d8]">TS <span className="text-amber-500">HUB</span></p>
            <p className="text-[#7a7268] text-xs">Verificando acesso...</p>
          </div>
        </div>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="min-h-screen bg-[#111010] flex items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl border border-red-500/25 bg-[#1a1917] p-8 flex flex-col items-center gap-5 text-center">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/25 flex items-center justify-center text-2xl text-red-500">
            <X size={24} />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-base font-bold text-[#e8e2d8]">Acesso não autorizado</h2>
            <p className="text-xs text-[#7a7268] leading-relaxed">{authError}</p>
          </div>
          <button onClick={handleLogout}
            className="w-full rounded-xl border border-[#2e2c29] bg-[#201f1d] px-4 py-2.5 text-xs font-bold text-[#7a7268] hover:text-[#e8e2d8] hover:border-[#7a7268] transition-colors flex items-center justify-center gap-2">
            <ChevronLeft size={14} /> Voltar ao Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111010] text-[#e8e2d8]">
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 select-none" style={{
        background:"radial-gradient(ellipse 60% 40% at 10% 0%, rgba(245,166,35,0.07) 0%, transparent 60%), radial-gradient(ellipse 40% 30% at 90% 100%, rgba(245,166,35,0.05) 0%, transparent 60%)",
      }}/>

      <header className="sticky top-0 z-50 shrink-0 border-b border-[#2e2c29] bg-[#111010]/90 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-2 px-4 md:px-6 h-14">

          {/* ── Esquerda: Logo + LayoutGrid (Hub) + Voltar ── */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/LOGO-PRINCIPAL.svg" alt="TS HUB" className="h-8 w-auto"/>
            {/* Ícone de grade → volta ao Hub (sem texto TS HUB) */}
            <button
              onClick={() => router.push("/hub")}
              title="Portal de Operações"
              className="ml-1 flex items-center justify-center w-8 h-8 rounded-xl bg-[#201f1d] border border-[#2e2c29] text-[#7a7268] hover:text-amber-400 hover:border-amber-500/40 transition-colors"
            >
              <LayoutGrid size={15} />
            </button>
            {/* Voltar ao dashboard da operação (quando está dentro de um cliente) */}
            {clienteAtivo && (
              <button onClick={backToDashboard}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#201f1d] border border-[#2e2c29] text-[#7a7268] text-xs font-semibold hover:text-[#e8e2d8] hover:border-[#7a7268] transition-colors">
                <ChevronLeft size={14} /> <span className="hidden md:inline">Voltar</span>
              </button>
            )}
          </div>

          {/* ── Centro: Nome da operação ativa + badge de pendências (com respiro) ── */}
          <div className="flex-1 flex items-center justify-center gap-4 mx-4 min-w-0">
            {operacaoAtiva && !clienteAtivo && (
              <span className="text-xs font-bold text-[#4a4844] uppercase tracking-widest truncate">
                {operacaoAtiva.nome}
              </span>
            )}
            {!clienteAtivo && clientes.filter(c => c.alerta_pagamento).length > 0 && (
              <button
                onClick={() => setPendenciasFilter(v => !v)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[0.65rem] font-bold border transition-all ${
                  pendenciasFilter
                    ? "bg-red-500/20 border-red-500/50 text-red-400"
                    : "bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20"
                }`}
              >
                <AlertTriangle size={9} className="shrink-0" />
                {clientes.filter(c => c.alerta_pagamento).length}
              </button>
            )}
          </div>

          {/* ── Direita: Ferramentas essenciais ── */}
          <div className="flex items-center gap-1.5 shrink-0">

            {/* Auditoria — somente admin */}
            {perfil?.role === "admin" && (
              <button onClick={() => setIsAuditOpen(true)} title="Painel de Auditoria"
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#201f1d] border border-[#2e2c29] text-[#7a7268] text-xs font-semibold hover:text-violet-400 hover:border-violet-500/40 transition-colors">
                <ShieldCheck size={14} />
                <span className="hidden md:inline">Auditoria</span>
              </button>
            )}

            {/* Bugs — somente admin */}
            {perfil?.role === "admin" && (
              <button onClick={() => setIsAdminBugsOpen(true)} title="Notificações de Bugs"
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#201f1d] border border-[#2e2c29] text-[#7a7268] text-xs font-semibold hover:text-amber-400 hover:border-amber-500/40 transition-colors">
                <Bug size={14} />
                <span className="hidden md:inline">Bugs</span>
              </button>
            )}

            {/* Reportar Bug — todos */}
            {perfil && (
              <button onClick={() => setIsBugModalOpen(true)} title="Reportar Bug"
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#201f1d] border border-[#2e2c29] text-[#7a7268] text-xs font-semibold hover:text-orange-400 hover:border-orange-500/40 transition-colors">
                <Bug size={14} />
                <span className="hidden md:inline">Reportar Bug</span>
              </button>
            )}

            {/* Config + Novo Cliente — só fora da view de cliente */}
            {!clienteAtivo && (
              <>
                {isAdmin && (
                  <button onClick={() => setSettingsOpen(true)} title="Configurações"
                    className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#201f1d] border border-[#2e2c29] text-[#7a7268] text-xs font-semibold hover:text-[#e8e2d8] hover:border-[#7a7268] transition-colors">
                    <SettingsIcon size={14} />
                    <span className="hidden md:inline">Config.</span>
                  </button>
                )}
                <button onClick={() => operacaoAtiva && setClienteModal({mode: "new"})} disabled={!operacaoAtiva}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500 text-[#111] text-xs font-bold hover:bg-amber-400 active:scale-95 transition-all shadow-[0_2px_12px_rgba(245,166,35,0.3)] disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap">
                  <PlusCircle size={14} />
                  <span className="hidden sm:inline">Novo Cliente</span>
                  <span className="sm:hidden">Novo</span>
                </button>
              </>
            )}

            <div className="w-px h-5 bg-[#2e2c29] mx-0.5 hidden sm:block" />

            {/* Sair */}
            <button onClick={handleLogout} title={`Sair (${perfil?.nome ?? ""})`}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#201f1d] border border-[#2e2c29] text-[#7a7268] text-xs font-semibold hover:text-red-400 hover:border-red-500/40 transition-colors group">
              <LogOut size={13} className="transition-transform group-hover:translate-x-0.5" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      <main className="w-full max-w-6xl mx-auto px-4 md:px-6 py-6 pb-24">
        {!operacaoAtiva && !operacoesLoading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4 animate-in fade-in duration-500">
            <span className="text-5xl text-[#2e2c29] opacity-30"><FolderOpen size={64} /></span>
            <p className="text-[#7a7268] text-sm text-center">Nenhuma operação encontrada.<br/>
              {isAdmin && <>Crie a primeira clicando em <strong className="text-amber-400">Nova Operação</strong>.</>}
            </p>
            {isAdmin && (
              <button onClick={()=>setNovaOpOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 text-[#111] text-sm font-bold hover:bg-amber-400 active:scale-95 transition-all">
                <Plus size={16} /> Nova Operação
              </button>
            )}
          </div>
        )}

        {operacaoAtiva && !clienteAtivo && (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
              <div>
                <p className="text-[0.6rem] font-bold uppercase tracking-[0.18em] text-amber-500 mb-0.5">{operacaoAtiva.nome}</p>
                <h1 className="text-2xl font-extrabold tracking-tight">Clientes da Operação</h1>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {clientesLoading ? (
                  <span className="text-xs text-[#7a7268] animate-pulse flex items-center gap-1.5">
                    <Loader2 size={12} className="animate-spin" /> Carregando...
                  </span>
                ) : (
                  <>
                    {[
                      {dot:"bg-emerald-500",label:`Ativos: ${stats.active}`},
                      {dot:"bg-amber-500",  label:`Sem Camp.: ${stats.none}`},
                      {dot:"bg-red-500",    label:`Cancel.: ${stats.cancel}`},
                    ].map(s=>(
                      <div key={s.label} className="flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${s.dot}`}/>
                        <span className="text-[0.7rem] font-semibold text-[#7a7268]">{s.label}</span>
                      </div>
                    ))}
                    <span className="text-[0.7rem] font-semibold text-[#7a7268]">Total: <span className="text-[#e8e2d8]">{stats.total}</span></span>
                    {clientes.filter(c=>c.alerta_pagamento).length > 0 && (
                      <button
                        onClick={() => setPendenciasFilter(v => !v)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[0.7rem] font-bold border transition-all ${
                          pendenciasFilter
                            ? "bg-red-500/20 border-red-500/50 text-red-400"
                            : "bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20"
                        }`}>
                        <CreditCard size={11} />
                        <><AlertTriangle size={11} className="shrink-0" /> Ver Pendências ({clientes.filter(c=>c.alerta_pagamento).length})</>
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2 w-full mb-6">
              {/* ── Linha 1: Busca + Gestor de Tráfego + Gestor Estratégico ── */}
              <div className="flex flex-col sm:flex-row flex-wrap items-center gap-2 w-full">
                {/* Busca por nome */}
                <div className="relative w-full sm:flex-1 min-w-0">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7a7268] pointer-events-none select-none" />
                  <input
                    type="text"
                    value={clientSearch}
                    onChange={e => setClientSearch(e.target.value)}
                    placeholder="Buscar cliente por nome..."
                    className="w-full bg-[#201f1d] border border-[#2e2c29] rounded-xl pl-9 pr-4 py-2.5 text-sm text-[#e8e2d8] placeholder:text-[#7a7268] outline-none focus:border-amber-500/60 transition-colors"
                  />
                </div>

                {/* Gestor de Tráfego (novo) */}
                <div className="relative w-full sm:w-44">
                  <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
                    <Layers size={13} className={trafegoFilter ? "text-amber-400" : "text-[#4a4844]"} />
                  </div>
                  <select
                    value={trafegoFilter}
                    onChange={e => setTrafegoFilter(e.target.value)}
                    className={`w-full appearance-none rounded-xl pl-8 pr-8 py-2.5 text-sm outline-none transition-colors cursor-pointer border ${
                      trafegoFilter
                        ? "bg-[#201f1d] border-amber-500/40 text-amber-300 focus:border-amber-500/70"
                        : "bg-[#201f1d] border-[#2e2c29] text-[#e8e2d8] focus:border-amber-500/60"
                    }`}
                  >
                    <option value="">Gestor de Tráfego</option>
                    {trafegoOptions.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                  <ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#7a7268]" />
                </div>

                {/* Gestor Estratégico */}
                <div className="relative w-full sm:w-44">
                  <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
                    <User size={13} className={gestorFilter ? "text-amber-400" : "text-[#4a4844]"} />
                  </div>
                  <select
                    value={gestorFilter}
                    onChange={e => setGestorFilter(e.target.value)}
                    className={`w-full appearance-none rounded-xl pl-8 pr-8 py-2.5 text-sm outline-none transition-colors cursor-pointer border ${
                      gestorFilter
                        ? "bg-[#201f1d] border-amber-500/40 text-amber-300 focus:border-amber-500/70"
                        : "bg-[#201f1d] border-[#2e2c29] text-[#e8e2d8] focus:border-amber-500/60"
                    }`}
                  >
                    <option value="">Gestor Estratégico</option>
                    {gestorOptions.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                  <ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#7a7268]" />
                </div>

                {/* Status */}
                <div className="relative w-full sm:w-44">
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="w-full appearance-none bg-[#201f1d] border border-[#2e2c29] rounded-xl px-4 pr-9 py-2.5 text-sm text-[#e8e2d8] outline-none focus:border-amber-500/60 transition-colors cursor-pointer"
                  >
                    <option value="todos">Todos os status</option>
                    <option value="ativos">Ativos</option>
                    <option value="sem_camp">Pausados/Sem Camp.</option>
                    <option value="cancelados">Cancelados</option>
                  </select>
                  <ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#7a7268]" />
                </div>
              </div>

              {/* ── Linha 2: Ordenação + View toggle + badges de filtros ativos ── */}
              <div className="flex items-center justify-between gap-2 w-full">
                {/* Badges de filtros ativos */}
                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                  {trafegoFilter && (
                    <button
                      onClick={() => setTrafegoFilter("")}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-semibold hover:bg-amber-500/20 transition-colors"
                    >
                      <Layers size={9} /> {trafegoFilter} <X size={9} />
                    </button>
                  )}
                  {gestorFilter && (
                    <button
                      onClick={() => setGestorFilter("")}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-semibold hover:bg-amber-500/20 transition-colors"
                    >
                      <User size={9} /> {gestorFilter} <X size={9} />
                    </button>
                  )}
                  {(trafegoFilter || gestorFilter) && (
                    <button
                      onClick={() => { setTrafegoFilter(""); setGestorFilter(""); setClientSearch(""); setStatusFilter("todos"); }}
                      className="text-[10px] text-[#4a4844] hover:text-red-400 font-semibold transition-colors px-1"
                    >
                      Limpar tudo
                    </button>
                  )}
                </div>

                {/* Ordenação + View toggle */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setSortMode(m => m === "alfabetica" ? "personalizada" : "alfabetica")}
                    className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                      sortMode === "personalizada"
                        ? "bg-amber-500/10 border-amber-500/40 text-amber-400 hover:bg-amber-500/20"
                        : "bg-[#201f1d] border-[#2e2c29] text-[#7a7268] hover:text-[#e8e2d8] hover:border-[#7a7268]"
                    }`}
                  >
                    {sortMode === "alfabetica" ? (
                      <><svg width="14" height="14" viewBox="0 0 28 16" fill="currentColor"><text x="0" y="13" fontSize="13" fontWeight="bold">AZ</text></svg><span>A-Z</span></>
                    ) : (
                      <><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="8" y1="2" x2="8" y2="14"/><polyline points="4,6 8,2 12,6"/><polyline points="4,10 8,14 12,10" opacity="0.5"/></svg><span>Ordem</span></>
                    )}
                  </button>
                  <div className="flex items-center bg-[#201f1d] border border-[#2e2c29] rounded-xl p-1">
                    {([["grid","M 0 0 h7v7H0z M9 0h7v7H9z M0 9h7v7H0z M9 9h7v7H9z"],["list","M0 1h16v2.5H0z M0 6.75h16V9.25H0z M0 12.5h16V15H0z"]] as [ViewMode,string][]).map(([v,d])=>(
                      <button key={v} onClick={() => setViewMode(v)}
                        className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${viewMode===v ? "bg-amber-500 text-[#111]" : "text-[#7a7268] hover:text-[#e8e2d8]"}`}>
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d={d}/></svg>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {clientesLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {Array.from({length:6}).map((_,i)=><SkeletonCard key={i}/>)}
              </div>
            ) : filteredClientes.length===0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 rounded-xl border border-dashed border-[#2e2c29]">
                <span className="text-4xl text-[#2e2c29] opacity-30"><FileText size={48} /></span>
                <p className="text-[#7a7268] text-sm text-center px-4">
                  {clientSearch || gestorFilter || trafegoFilter ? "Nenhum cliente encontrado com esses filtros." : "Nenhum cliente cadastrado. Clique em '+ Novo Cliente'."}
                </p>
              </div>
            ) : viewMode==="grid" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-24">
                {filteredClientes.map((c,index) => (
                  sortMode==="personalizada" ? (
                    <div key={c.id} draggable
                      onDragStart={e=>e.dataTransfer.setData("text/plain",String(index))}
                      onDragOver={e=>e.preventDefault()}
                      onDrop={e=>{e.preventDefault();const from=Number(e.dataTransfer.getData("text/plain"));handleDragEnd({source:{index:from},destination:{index}});}}>
                      <ClientCard {...sharedProps(c)}/>
                    </div>
                  ) : <ClientCard key={c.id} {...sharedProps(c)}/>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-[#2e2c29] overflow-hidden pb-24">
                <div className="overflow-x-auto" style={{WebkitOverflowScrolling:"touch"}}>
                  <table className="w-full text-sm min-w-[700px]">
                    <thead>
                      <tr className="border-b border-[#2e2c29] bg-[#1a1917]">
                        {sortMode==="personalizada" && <th className="w-8 px-2"/>}
                        {["Cliente","Status","Plataformas","Gestor","Estratégico","Desde",""].map(h=>(
                          <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-[#7a7268] whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredClientes.map((c,index) => (
                        <ClientRow key={c.id} {...sharedProps(c)}
                          showDragHandle={sortMode==="personalizada"}
                          isDragging={false}
                          draggableProps={sortMode==="personalizada"?{
                            draggable:true,
                            onDragStart:(e:React.DragEvent)=>e.dataTransfer.setData("text/plain",String(index)),
                            onDragOver:(e:React.DragEvent)=>e.preventDefault(),
                            onDrop:(e:React.DragEvent)=>{e.preventDefault();const from=Number(e.dataTransfer.getData("text/plain"));handleDragEnd({source:{index:from},destination:{index}});},
                          }:undefined}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {operacaoAtiva && clienteAtivo && (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-transparent p-5">
              <p className="text-[0.6rem] font-bold uppercase tracking-[0.18em] text-amber-500 mb-3">
                {operacaoAtiva.nome} · Cliente Ativo
              </p>
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-3 flex-1 min-w-0">
                  <h2 className="text-xl font-extrabold tracking-tight">{clienteAtivo.nome}</h2>

                  {/* ── Orçamento Total Planejado — banner de referência estático ── */}
                  {(() => {
                    const vm = clienteAtivo.verba_meta_ads ?? 0;
                    const vg = clienteAtivo.verba_gls ?? 0;
                    const vo = clienteAtivo.verba_outros ?? 0;
                    const total = vm + vg + vo;
                    if (total <= 0) return null;
                    const isUSD = (clienteAtivo.moeda ?? "BRL") === "USD";
                    const detailSym = isUSD ? "US$" : "R$";
                    const detailLocale = isUSD ? "en-US" : "pt-BR";
                    const fmtVal = (v: number) => `${detailSym} ${v.toLocaleString(detailLocale, { maximumFractionDigits: 0 })}`;
                    return (
                      <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/6 border border-amber-500/20">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-amber-500/60 flex items-center gap-1">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                          Orçamento Mensal Planejado
                        </span>
                        <span className="text-sm font-extrabold text-amber-400">
                          {detailSym} {total.toLocaleString(detailLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        {vm > 0 && (
                          <span className="text-[9px] text-[#7a7268] font-semibold">
                            Meta {fmtVal(vm)}
                          </span>
                        )}
                        {vg > 0 && (
                          <span className="text-[9px] text-[#7a7268] font-semibold">
                            · GLS {fmtVal(vg)}
                          </span>
                        )}
                        {vo > 0 && (
                          <span className="text-[9px] text-[#7a7268] font-semibold">
                            · Outros {fmtVal(vo)}
                          </span>
                        )}
                      </div>
                    );
                  })()}

                  {/* ── Barra de Meta Mensal no detalhe (base D-1) ── */}
                  {clienteAtivo.meta_leads_mensal != null && clienteAtivo.meta_leads_mensal > 0 && (() => {
                    const leadsDoMes = leadsDoMesPorCliente[clienteAtivo.id] ?? 0;
                    const cacheLeads = clienteAtivo.meta_leads_cache ?? 0;
                    const totalResultados = cacheLeads > 0 ? cacheLeads : leadsDoMes;
                    return (
                      <div className="mt-1">
                        <MetaGoalBar meta={clienteAtivo.meta_leads_mensal} leadsDoMes={totalResultados} />
                      </div>
                    );
                  })()}

                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-[#4a4844] mb-1.5">Plataformas</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(clienteAtivo.platforms ?? []).filter((p,i,a)=>a.findIndex(x=>x.key===p.key)===i).map(p=>(
                        <span key={p.key} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${PLATFORM_CHIP_COLOR[p.key]}`}>
                          {PLATFORM_SVG[p.key]}{p.label}
                        </span>
                      ))}
                      {!(clienteAtivo.platforms ?? []).length&&<span className="text-xs text-[#7a7268] italic">Nenhuma plataforma cadastrada</span>}
                    </div>
                  </div>

                  {(() => {
                    const tipoCampanha = clienteAtivo.tipo_campanha ?? [];
                    const grouped: Partial<Record<PlatformKey, string[]>> = {};
                    for (const camp of tipoCampanha) {
                      const key = getCampanhaPlatKey(camp);
                      if (key) {
                        if (!grouped[key]) grouped[key] = [];
                        grouped[key]!.push(camp);
                      }
                    }
                    const platsWithoutCamps = (clienteAtivo.platforms ?? []).filter(
                      p => !grouped[p.key as PlatformKey]
                    );
                    const entries = Object.entries(grouped) as [PlatformKey, string[]][];
                    const hasAnything = entries.length > 0 || platsWithoutCamps.length > 0;
                    if (!hasAnything) return null;
                    return (
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-[#4a4844] mb-2">Campanhas Ativas</p>
                        <div className="space-y-2">
                          {entries.map(([platKey, platCamps]) => {
                            const platDef = CANONICAL_PLATFORM_DEFS.find(d => d.key === platKey);
                            if (!platDef) return null;
                            return (
                              <div key={platKey} className="flex items-start gap-2">
                                <span className="text-[9px] font-bold text-[#7a7268] pt-0.5 shrink-0 min-w-[120px]">{platDef.label}:</span>
                                <div className="flex flex-wrap gap-1">
                                  {platCamps.map(camp => (
                                    <span key={camp} className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${CAMP_CHIP_COLOR[platKey]}`}>
                                      {camp}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                          {platsWithoutCamps.map(p => (
                            <div key={p.key} className="flex items-start gap-2">
                              <span className="text-[9px] font-bold text-[#7a7268] pt-0.5 shrink-0 min-w-[120px]">{p.label}:</span>
                              <span className="text-[10px] text-[#4a4844] italic">Nenhuma campanha</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div className="flex sm:flex-col gap-2 shrink-0 flex-wrap">
                
                  <button onClick={()=>setClienteModal({mode:"edit",client:clienteAtivo})}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#201f1d] border border-amber-500/30 text-amber-400 text-xs font-semibold hover:bg-amber-500/10 hover:border-amber-500/60 transition-colors whitespace-nowrap">
                    <Pencil size={14} /> Editar
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 w-full mb-6">
              {/* Título + contagem */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500"/>
                  <span className="text-xs font-semibold text-[#7a7268]">
                    <span className="text-[#e8e2d8]">{totalLeadsCount}</span> leads encontrados
                    {" · "}
                    <span className="text-[#e8e2d8]">{paginatedLeads.length}</span> nesta página
                  </span>
                </div>
                {leadsLoading && <span className="text-xs text-[#7a7268] animate-pulse flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Carregando...</span>}
              </div>
              {/* Grupo de botões de ação */}
              <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                <button onClick={()=>setNewLeadOpen(true)}
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 text-[#111] text-xs font-bold hover:bg-amber-400 active:scale-95 transition-all w-full sm:w-auto">
                  <Plus size={14} /> Novo Lead
                </button>
                <ExportBar
                  leads={filteredLeads}
                  clienteNome={clienteAtivo.nome}
                  operacaoNome={operacaoAtiva.nome}
                  onNewLead={() => setNewLeadOpen(true)}
                  periodLabel={
                    dateFrom && dateTo
                      ? `${dateFrom.split("-").reverse().join("/")} → ${dateTo.split("-").reverse().join("/")}`
                      : periodPreset === "max" ? "Todo o período"
                      : periodPreset === "7d" ? "Últimos 7 dias"
                      : periodPreset === "15d" ? "Últimos 15 dias"
                      : periodPreset === "30d" ? "Últimos 30 dias"
                      : periodPreset === "90d" ? "Últimos 90 dias"
                      : "Período selecionado"
                  }
                  dashboard={(() => {
                    if (!filteredLeads.length) return null;
                    const byPlat: Record<string, number> = {};
                    for (const l of filteredLeads) { const k = l.plataforma || "Sem plataforma"; byPlat[k] = (byPlat[k] ?? 0) + 1; }
                    const leadsPorPlataforma = Object.entries(byPlat).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
                    const byDate: Record<string, number> = {};
                    const byDateLabel: Record<string, string> = {};
                    for (const l of filteredLeads) {
                      const raw = l.data ?? "";
                      const dmy = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
                      const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
                      let label = "—"; let sortKey = "9999-99-99";
                      if (dmy) { label = `${dmy[1]}/${dmy[2]}/${dmy[3].slice(2)}`; sortKey = `${dmy[3]}-${dmy[2]}-${dmy[1]}`; }
                      else if (ymd) { label = `${ymd[3]}/${ymd[2]}/${ymd[1].slice(2)}`; sortKey = raw.slice(0, 10); }
                      byDate[sortKey] = (byDate[sortKey] ?? 0) + 1; byDateLabel[sortKey] = label;
                    }
                    const leadsPorData = Object.keys(byDate).sort().map(k => ({ data: byDateLabel[k] ?? k, leads: byDate[k] }));
                    return { leadsPorPlataforma, leadsPorData, totalLeads: filteredLeads.length };
                  })()}
                  radar={clienteAtivo.meta_ad_account_id && metaInsights[clienteAtivo.id]?.campaigns?.length
                    ? {
                        spend: metaInsights[clienteAtivo.id].spend,
                        cpl: metaInsights[clienteAtivo.id].cpl,
                        total_leads: metaInsights[clienteAtivo.id].total_leads,
                        currency: metaInsights[clienteAtivo.id].currency,
                        campaigns: metaInsights[clienteAtivo.id].campaigns,
                      }
                    : null}
                />
              </div>
            </div>

            <Dropzone onParsed={handleLeadsParsed}/>

            {clienteAtivo.meta_ad_account_id && (
              <RadarWrapper
                clienteId={clienteAtivo.id}
                accountId={clienteAtivo.meta_ad_account_id}
                token={clienteAtivo.meta_access_token ?? null}
                treeData={metaTree[clienteAtivo.id] ?? null}
                onFetch={fetchMetaTree}
                moedaCliente={clienteAtivo.moeda ?? null}
                ignoreIds={clienteAtivo.meta_ignored_campaigns ?? null}
              />
            )}

            {/* Botão de re-sincronização manual de leads Meta */}
            {clienteAtivo.meta_ad_account_id && operacaoAtiva && (
              <div className="flex items-center gap-2 justify-end">
                <button
                  onClick={() => cleanupAndResyncMetaLeads(
                    clienteAtivo.id,
                    clienteAtivo.meta_ad_account_id!,
                    clienteAtivo.meta_access_token ?? null,
                    operacaoAtiva.id,
                    operacaoAtiva.nome,
                  )}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-semibold hover:bg-blue-500/20 transition-colors"
                  title="Limpa leads Meta incorretos e re-sincroniza apenas os leads desta conta"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>
                  </svg>
                  Re-sincronizar Leads Meta
                </button>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7a7268] pointer-events-none select-none" />
                  <input type="text" value={leadSearch} onChange={e=>setLeadSearch(e.target.value)}
                    placeholder="Buscar por nome, email ou telefone..."
                    className="w-full bg-[#201f1d] border border-[#2e2c29] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#e8e2d8] placeholder:text-[#7a7268] outline-none focus:border-amber-500/60 transition-colors"/>
                </div>
                {platOptions.length>0&&(
                  <div className="relative sm:w-52">
                    <select value={platFilter} onChange={e=>setPlatFilter(e.target.value)}
                      className="w-full appearance-none bg-[#201f1d] border border-[#2e2c29] rounded-xl px-4 pr-10 py-2.5 text-sm text-[#e8e2d8] outline-none focus:border-amber-500/60 transition-colors cursor-pointer">
                      <option value="">Todas as plataformas</option>
                      {platOptions.map(p=><option key={p}>{p}</option>)}
                    </select>
                    <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#7a7268] select-none" />
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-[#2e2c29] bg-[#201f1d] p-3 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#7a7268] flex items-center gap-1.5">
                    <Calendar size={12} className="text-amber-500" /> Período
                  </span>
                  {(dateFrom||dateTo)&&(
                    <button onClick={()=>{setDateFrom("");setDateTo("");setPeriodPreset("max");}}
                      className="text-[10px] font-semibold text-amber-500/70 hover:text-amber-400 transition-colors flex items-center gap-1">
                      <X size={10} /> Limpar
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {([
                    {key:"7d",label:"7d"},{key:"15d",label:"15d"},{key:"30d",label:"30d"},
                    {key:"90d",label:"90d"},{key:"this_month",label:"Este Mês"},{key:"custom",label:"Personalizado"},{key:"max",label:"Máximo"},
                  ] as {key:PeriodPreset;label:string}[]).map(p=>(
                    <button key={p.key}
                      onClick={()=>{
                        setPeriodPreset(p.key);
                        if (p.key!=="custom") {
                          const fmt=(d:Date)=>d.toISOString().slice(0,10);
                          if (p.key==="max"){setDateFrom("");setDateTo("");}
                          else if (p.key==="this_month") {
                            const today = new Date();
                            const from = new Date(today.getFullYear(), today.getMonth(), 1);
                            setDateFrom(fmt(from)); setDateTo(fmt(today));
                          }
                          else{
                            // Ontem como data final — exclui o dia de hoje (dados incompletos)
                            const yesterday=new Date(); yesterday.setDate(yesterday.getDate()-1);
                            const days=p.key==="7d"?7:p.key==="15d"?15:p.key==="30d"?30:90;
                            const from=new Date(yesterday); from.setDate(yesterday.getDate()-(days-1));
                            setDateFrom(fmt(from)); setDateTo(fmt(yesterday));
                          }
                        }
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        periodPreset===p.key?"bg-amber-500 border-amber-400 text-[#111]":"bg-[#1a1917] border-[#2e2c29] text-[#7a7268] hover:text-[#e8e2d8] hover:border-[#7a7268]"
                      }`}>{p.label}</button>
                  ))}
                </div>
                {periodPreset==="custom"&&(
                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    <div className="flex-1 space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-[#7a7268]">Data Inicial</label>
                      <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}
                        className="w-full bg-[#1a1917] border border-[#2e2c29] rounded-xl px-4 py-2.5 text-sm text-[#e8e2d8] outline-none focus:border-amber-500/60 transition-colors [color-scheme:dark] cursor-pointer"/>
                    </div>
                    <div className="flex-1 space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-[#7a7268]">Data Final</label>
                      <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}
                        className="w-full bg-[#1a1917] border border-[#2e2c29] rounded-xl px-4 py-2.5 text-sm text-[#e8e2d8] outline-none focus:border-amber-500/60 transition-colors [color-scheme:dark] cursor-pointer"/>
                    </div>
                  </div>
                )}
                {(dateFrom||dateTo)&&(
                  <p className="text-[10px] text-amber-500/70 font-medium">
                    {dateFrom && dateTo
                      ? `${(dateFrom || "").split("-").reverse().join("/")} → ${(dateTo || "").split("-").reverse().join("/")}`
                      : dateFrom ? `A partir de ${(dateFrom || "").split("-").reverse().join("/")}` : (dateTo ? `Até ${(dateTo || "").split("-").reverse().join("/")}` : "")}
                  </p>
                )}
              </div>
            </div>

            {/* ── Painel de Resultados da API (período filtrado) ── */}
            {(() => {
              const filtro = metaInsightsFiltro[clienteAtivo.id];
              const periodoOk = filtro && dateFrom && dateTo &&
                filtro.since === dateFrom && filtro.until === dateTo;
              if (!clienteAtivo.meta_ad_account_id || !periodoOk || filtro.total_leads === 0) return null;
              return (
                <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                      <Activity size={12} /> Resultados Oficiais (Meta API)
                    </p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-[#e8e2d8]">{filtro.total_leads}</span>
                      <span className="text-xs text-[#7a7268]">conversões no período</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-[#7a7268] font-semibold uppercase tracking-widest mb-1">Distribuição</p>
                    {filtro.messages > 0 && (
                      <p className="text-xs text-[#e8e2d8]">
                        <span className="text-blue-400 font-bold">{filtro.messages}</span> Mensagens (Direct/Whats/Msgr)
                      </p>
                    )}
                    {filtro.form_leads > 0 && (
                      <p className="text-xs text-[#e8e2d8]">
                        <span className="text-emerald-400 font-bold">{filtro.form_leads}</span> Formulários Nativos
                      </p>
                    )}
                  </div>
                </div>
              );
            })()}

            {!leadsLoading&&<ClienteDashboard leads={filteredDashboardLeads}/>}

            {leadsLoading ? (
              <div className="flex flex-col items-center justify-center py-14 gap-3 rounded-xl border border-[#2e2c29] bg-[#1a1917]">
                <div className="w-8 h-8 rounded-full border-2 border-amber-500/20 border-t-amber-500 animate-spin" />
                <p className="text-[#7a7268] text-sm">Buscando leads...</p>
              </div>
            ) : (
              <LeadAccordion
                leads={filteredLeads}
                paginatedLeads={paginatedLeads}
                search={leadSearch}
                platFilter={platFilter}
                dateFrom={dateFrom}
                dateTo={dateTo}
                onDeleteSelected={handleDeleteLeads}
                currentPage={currentPage}
                onPageChange={(p) => { setCurrentPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                totalLeads={totalLeadsCount}
                itemsPerPage={itemsPerPage}
                onItemsPerPageChange={(i) => { setItemsPerPage(i); setCurrentPage(1); }}
              />
            )}

            {!leadsLoading && totalLeadsCount === 0 && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-start gap-3">
                <span className="text-xl shrink-0 mt-0.5 text-amber-500"><Sparkles size={20} /></span>
                <div>
                  <p className="text-xs font-semibold text-amber-500 uppercase tracking-wider">Dica</p>
                  <p className="text-xs text-[#7a7268] mt-0.5">
                    Faça o upload do CSV exportado do Meta Ads, Google Local Services ou Elementor. O sistema identifica os campos automaticamente.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="shrink-0 border-t border-[#2e2c29] py-4 px-4 md:px-8">
        <p className="text-center text-[0.65rem] text-[#7a7268]">TS HUB · Sua operação sob controle total. · {new Date().getFullYear()}</p>
      </footer>

      {isAdmin && (
        <NovaOperacaoModal open={novaOpOpen} onClose={()=>setNovaOpOpen(false)}
          onSaved={op=>{setOperacoes(prev=>[...prev,op]);handleSelectOperacao(op);}}/>
      )}
      {isAdmin && (
        <SettingsModal
          open={settingsOpen} onClose={()=>setSettingsOpen(false)}
          gestoresEstrat={gestoresEstrat} gestoresTrafego={gestoresTrafego}
          onRenameEstrat={handleRenameEstrat}   onDeleteEstrat={handleDeleteEstrat}   onAddEstrat={handleAddEstrat}
          onRenameTrafego={handleRenameTrafego} onDeleteTrafego={handleDeleteTrafego} onAddTrafego={handleAddTrafego}
          operacoes={operacoes as OperacaoSimples[]}
          onDeleteOperacao={handleDeleteOperacao}
          onRefreshOperacoes={handleRefreshOperacoes}
          isCallerAdmin={isAdmin}
        />
      )}
      {clienteModal&&operacaoAtiva&&(
        <ClienteModal
          mode={clienteModal.mode} initial={clienteModal.client}
          operacaoId={operacaoAtiva.id}
          gestoresEstrat={gestoresEstrat} gestoresTrafego={gestoresTrafego}
          onSaved={handleClienteSaved} onClose={()=>setClienteModal(null)}
          initialTab={clienteModal.initialTab}
          perfil={perfil}
        />
      )}
      {editModal && (
        <EditClienteModal
          key={editModal.id}
          cliente={editModal}
          gestoresEstrat={gestoresEstrat}
          gestoresTrafego={gestoresTrafego}
          onSaved={handleEditClienteSaved}
          onClose={()=>setEditModal(null)}
          perfil={perfil}
        />
      )}
      <NewLeadDialog open={newLeadOpen} onClose={()=>setNewLeadOpen(false)} onSave={handleSaveNewLead}/>

      {/* ── Modal: Reportar Bug ── */}
      {perfil && (
        <ReportBugModal
          open={isBugModalOpen}
          onClose={() => setIsBugModalOpen(false)}
          userId={perfil.user_id}
          userNome={perfil.nome}
        />
      )}

      {/* ── Modal: Admin — Painel de Bugs (somente admin) ── */}
      {perfil?.role === "admin" && (
        <AdminBugsModal
          open={isAdminBugsOpen}
          onClose={() => setIsAdminBugsOpen(false)}
        />
      )}

      {/* ── Modal: Admin — Audit Trail (somente admin) ── */}
      {perfil?.role === "admin" && (
        <AuditLogsModal
          open={isAuditOpen}
          onClose={() => setIsAuditOpen(false)}
        />
      )}

      {/* ── Botão Flutuante: Voltar ao Topo ── */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-50 w-11 h-11 flex items-center justify-center rounded-full bg-amber-500 text-[#111] shadow-[0_4px_20px_rgba(245,166,35,0.4)] hover:bg-amber-400 hover:-translate-y-1 transition-all animate-in fade-in slide-in-from-bottom-4 duration-300"
          title="Voltar ao topo"
        >
          <ChevronDown size={24} className="rotate-180" />
        </button>
      )}
    </div>
  );
}

export default function OperacaoPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#111010] flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-amber-500" />
      </div>
    }>
      <OperacaoContent />
    </Suspense>
  );
}
