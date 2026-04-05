import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ─── Supabase Admin Client (factory — instanciado dentro do handler) ─────────
// NÃO instanciar no top-level: env vars não estão disponíveis no build time.
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// ─── Meta API ─────────────────────────────────────────────────────────────────
const META_API_VERSION = "v21.0";
const META_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

type ActionEntry = { action_type: string; value: string };

async function metaFetch(path: string, params: Record<string, string>) {
  const url = new URL(`${META_BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { next: { revalidate: 0 } });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message ?? "Erro Meta API");
  return json;
}

// ─── Lógica de extração de leads (idêntica ao route.ts principal) ─────────────

const FORM_LEAD_TYPES = [
  "onsite_conversion.lead_grouped",
  "leadgen_grouped",
  "leadgen",
  "lead",
] as const;

const MSG_LEAD_TYPES = [
  "onsite_conversion.messaging_conversation_started_7d",
  "messaging_conversation_started_7d",
] as const;

const OBJECTIVE_ACTION_MAP: Record<string, string[]> = {
  OUTCOME_LEADS:      [...FORM_LEAD_TYPES, ...MSG_LEAD_TYPES],
  OUTCOME_ENGAGEMENT: [...MSG_LEAD_TYPES, "post_engagement"],
  MESSAGES:           [...MSG_LEAD_TYPES],
  OUTCOME_TRAFFIC:    ["link_click"],
  OUTCOME_SALES:      ["purchase", "omni_purchase", ...MSG_LEAD_TYPES],
};

function getActionValue(
  actions: ActionEntry[],
  types: readonly string[],
): { value: number; type: string } {
  for (const t of types) {
    const found = actions.find(a => a.action_type === t);
    const v = parseInt(found?.value ?? "0", 10);
    if (v > 0) return { value: v, type: t };
  }
  return { value: 0, type: "" };
}

function extractLeads(
  actions: ActionEntry[],
  objective: string,
): { formLeads: number; msgLeads: number; totalLeads: number } {
  let formLeads = 0;
  let msgLeads  = 0;

  if (objective === "OUTCOME_LEADS" || objective === "LEAD_GENERATION") {
    const msg  = getActionValue(actions, MSG_LEAD_TYPES);
    const form = getActionValue(actions, FORM_LEAD_TYPES);
    if (msg.value > 0) {
      msgLeads = msg.value;
    } else if (form.value > 0) {
      formLeads = form.value;
    }
  } else if (objective === "MESSAGES" || objective === "OUTCOME_ENGAGEMENT") {
    msgLeads = getActionValue(actions, MSG_LEAD_TYPES).value;
  } else if (objective === "OUTCOME_SALES") {
    const sale = getActionValue(actions, ["purchase", "omni_purchase"] as const);
    if (sale.value > 0) {
      msgLeads = sale.value;
    } else {
      msgLeads = getActionValue(actions, MSG_LEAD_TYPES).value;
    }
  } else {
    const targetTypes = OBJECTIVE_ACTION_MAP[objective];
    if (targetTypes) {
      msgLeads = getActionValue(actions, targetTypes).value;
    }
  }

  return { formLeads, msgLeads, totalLeads: formLeads + msgLeads };
}

// ─── Busca insights do MÊS CORRENTE para uma conta ───────────────────────────

async function fetchInsightsMesCorrente(
  accountId: string,
  token: string,
  ignoredCampaigns: string[] = [],
): Promise<{ spend: number; totalLeads: number; cpl: number } | null> {
  try {
    // Período: 1º do mês corrente até hoje
    const today = new Date();
    const since = new Date(today.getFullYear(), today.getMonth(), 1)
      .toISOString()
      .slice(0, 10);
    const until = today.toISOString().slice(0, 10);

    // Busca objectives das campanhas
    const campData = await metaFetch(`/${accountId}/campaigns`, {
      access_token: token,
      fields: "id,objective",
      limit: "500",
    });
    const objectiveMap = new Map<string, string>();
    for (const c of (campData.data ?? []) as { id: string; objective: string }[]) {
      objectiveMap.set(c.id, c.objective ?? "UNKNOWN");
    }

    // Busca insights por campanha no período
    const insightData = await metaFetch(`/${accountId}/insights`, {
      access_token: token,
      fields: "campaign_id,spend,actions",
      level: "campaign",
      limit: "500",
      time_range: JSON.stringify({ since, until }),
      action_attribution_windows: '["1d_view","7d_click"]',
    });

    let totalSpend = 0;
    let totalLeads = 0;

    for (const row of (insightData.data ?? []) as Record<string, unknown>[]) {
      const campId    = (row.campaign_id as string) ?? "";
      // Blacklist: ignora campanhas selecionadas pelo gestor
      if (ignoredCampaigns.includes(campId)) continue;
      const campSpend = parseFloat((row.spend as string) ?? "0");
      const objective = objectiveMap.get(campId) ?? "UNKNOWN";
      const actions   = (row.actions as ActionEntry[]) ?? [];
      const { totalLeads: leads } = extractLeads(actions, objective);

      totalSpend += campSpend;
      totalLeads += leads;
    }

    const cpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
    return { spend: totalSpend, totalLeads, cpl };
  } catch (err) {
    console.error(`[sync-meta] Erro ao buscar insights para ${accountId}:`, err);
    return null;
  }
}

// ─── Tipo do cliente retornado pelo Supabase ──────────────────────────────────

interface ClienteRow {
  id: string;
  nome: string;
  meta_ad_account_id: string;
  meta_access_token: string | null;
  meta_ignored_campaigns: string[] | null;
}

// ─── CRON ENDPOINT ────────────────────────────────────────────────────────────
//
// Uso:
//   GET /api/cron/sync-meta                   → sincroniza TODOS os clientes ativos
//   GET /api/cron/sync-meta?cliente_id=xxx    → sincroniza apenas UM cliente (refresh manual)
//
// Segurança:
//   - Verifica header CRON_SECRET (configure na Vercel como env var)
//   - Para chamadas manuais do front-end (refresh do card), aceita sem secret
//     mas limita ao cliente_id especificado
//
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const clienteId        = searchParams.get("cliente_id");
  const cronSecret       = req.headers.get("x-cron-secret");
  const isManual         = !!clienteId; // chamada manual do front-end (botão refresh card)

  // Valida secret para chamadas do scheduler (não para refresh manual de um cliente)
  if (!isManual) {
    const expectedSecret = process.env.CRON_SECRET;
    if (expectedSecret && cronSecret !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const started = Date.now();

  // Instancia dentro do handler — env vars disponíveis em runtime
  const supabaseAdmin = getSupabaseAdmin();

  try {
    // ── Busca clientes a sincronizar ─────────────────────────────────────────
    let query = supabaseAdmin
      .from("clientes")
      .select("id, nome, meta_ad_account_id, meta_access_token, meta_ignored_campaigns")
      .not("meta_ad_account_id", "is", null)
      .neq("status", "INATIVO")
      .neq("status", "CANCELAMENTO");

    if (clienteId) {
      query = query.eq("id", clienteId) as typeof query;
    }

    const { data: clientes, error: fetchError } = await query;
    if (fetchError) throw fetchError;

    const rows = (clientes ?? []) as ClienteRow[];
    if (rows.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "Nenhum cliente para sincronizar.",
        synced: 0,
        elapsed_ms: Date.now() - started,
      });
    }

    // ── Processa em lotes de 5 para não explodir o rate limit da Meta ────────
    const BATCH = 5;
    const results: { id: string; nome: string; ok: boolean; error?: string }[] = [];

    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);

      const settled = await Promise.allSettled(
        batch.map(async cliente => {
          const token = cliente.meta_access_token?.trim() ||
            process.env.META_GENERAL_TOKEN || "";

          if (!token) {
            return { id: cliente.id, nome: cliente.nome, ok: false, error: "Sem token" };
          }

          const insights = await fetchInsightsMesCorrente(
            cliente.meta_ad_account_id,
            token,
            cliente.meta_ignored_campaigns ?? [],
          );

          if (!insights) {
            return { id: cliente.id, nome: cliente.nome, ok: false, error: "Falha na API Meta" };
          }

          // Salva cache no Supabase
          const { error: updateError } = await supabaseAdmin
            .from("clientes")
            .update({
              meta_spend_cache: insights.spend,
              meta_leads_cache: insights.totalLeads,
              meta_cpl_cache:   insights.cpl,
              meta_last_sync:   new Date().toISOString(),
            })
            .eq("id", cliente.id);

          if (updateError) {
            return { id: cliente.id, nome: cliente.nome, ok: false, error: updateError.message };
          }

          return { id: cliente.id, nome: cliente.nome, ok: true };
        }),
      );

      for (const s of settled) {
        if (s.status === "fulfilled") {
          results.push(s.value);
        } else {
          results.push({ id: "?", nome: "?", ok: false, error: String(s.reason) });
        }
      }

      // Pausa entre lotes para respeitar rate limits da Meta (20 req/s por token)
      if (i + BATCH < rows.length) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    const synced  = results.filter(r => r.ok).length;
    const failed  = results.filter(r => !r.ok).length;

    console.log(`[sync-meta] Concluído: ${synced} ok, ${failed} falhas em ${Date.now() - started}ms`);

    return NextResponse.json({
      ok: true,
      synced,
      failed,
      elapsed_ms: Date.now() - started,
      results,
    });

  } catch (err: unknown) {
    console.error("[sync-meta] Erro geral:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Erro desconhecido" },
      { status: 500 },
    );
  }
}
