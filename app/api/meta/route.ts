import { NextRequest, NextResponse } from "next/server";

const META_API_VERSION = "v21.0";
const META_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveToken(clientToken?: string | null): string {
  const token = clientToken?.trim() || process.env.META_GENERAL_TOKEN || "";
  if (!token) throw new Error("Nenhum token Meta Ads disponível.");
  return token;
}

async function metaFetch(path: string, params: Record<string, string>) {
  const url = new URL(`${META_BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { next: { revalidate: 0 } });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message ?? "Erro Meta API");
  return json;
}

// ─── GET /api/meta?action=accounts ───────────────────────────────────────────
// ─── GET /api/meta?action=insights&account_id=act_xxx&since=&until= ──────────

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const action     = searchParams.get("action");
  const clientToken = searchParams.get("token");

  try {
    const token = resolveToken(clientToken);

    // ── Listar contas disponíveis ────────────────────────────────────────────
    if (action === "accounts") {
      const data = await metaFetch("/me/adaccounts", {
        access_token: token,
        fields: "id,name,account_status,currency",
        limit: "100",
      });

      const accounts = (data.data ?? []).map((a: Record<string, unknown>) => ({
        id:      a.id,
        name:    a.name,
        status:  a.account_status,
        currency: a.currency,
      }));

      return NextResponse.json({ accounts });
    }

    // ── Buscar insights de uma conta ─────────────────────────────────────────
    if (action === "insights") {
      const accountId = searchParams.get("account_id");
      const since     = searchParams.get("since");
      const until     = searchParams.get("until");

      if (!accountId) return NextResponse.json({ error: "account_id obrigatório" }, { status: 400 });

      // 1. Status da conta
      const accountData = await metaFetch(`/${accountId}`, {
        access_token: token,
        fields: "account_status,name,currency",
      });

      // 2. Insights no nível de campanha — traz objective para agrupar corretamente
      const insightParams: Record<string, string> = {
        access_token: token,
        fields: "campaign_name,objective,spend,actions,cost_per_action_type,clicks",
        level: "campaign",
        limit: "500",
      };

      if (since && until) {
        insightParams.time_range = JSON.stringify({ since, until });
      } else {
        insightParams.date_preset = "maximum";
      }

      // ── Buckets por família de objetivo ──────────────────────────────────────
      // leads   → OUTCOME_LEADS + qualquer objetivo com action type "lead"
      // messages→ OUTCOME_MESSAGES, OUTCOME_ENGAGEMENT (conversas iniciadas)
      // traffic → OUTCOME_TRAFFIC (cliques no link como resultado)
      // awareness → OUTCOME_AWARENESS / outros (interações / post engagement)

      let totalSpend     = 0;
      let formLeads      = 0;   // OUTCOME_LEADS — lead form nativo
      let formSpend      = 0;
      let msgLeads       = 0;   // OUTCOME_MESSAGES / ENGAGEMENT — conversas
      let msgSpend       = 0;
      let trafficClicks  = 0;   // OUTCOME_TRAFFIC — cliques no link
      let trafficSpend   = 0;
      let engagements    = 0;   // OUTCOME_AWARENESS / outros — interações
      let engagementSpend= 0;

      try {
        const insightData = await metaFetch(`/${accountId}/insights`, insightParams);
        const campaigns: Record<string, unknown>[] = insightData.data ?? [];

        for (const row of campaigns) {
          const objective = String(row.objective ?? "").toUpperCase();
          const spend     = parseFloat(String(row.spend ?? "0"));
          const actions: { action_type: string; value: string }[] = (row.actions as typeof actions) ?? [];
          const clicks    = parseInt(String((row.clicks as string) ?? "0"), 10);

          totalSpend += spend;

          // ── Contagem de resultados por objetivo ────────────────────────────

          if (objective === "OUTCOME_LEADS" || objective === "LEAD_GENERATION") {
            // Lead generation nativa (formulário Meta, WhatsApp lead, etc.)
            let campaignLeads = 0;
            for (const act of actions) {
              if (
                act.action_type === "lead" ||
                act.action_type === "leadgen_grouped" ||
                act.action_type === "onsite_conversion.lead_grouped"
              ) {
                campaignLeads += parseInt(act.value ?? "0", 10);
              }
            }
            // Fallback: se a API não retornou actions mas é objetivo de leads, conta cliques
            if (campaignLeads === 0) {
              for (const act of actions) {
                if (act.action_type === "link_click" || act.action_type === "landing_page_view") {
                  campaignLeads += parseInt(act.value ?? "0", 10);
                }
              }
            }
            formLeads += campaignLeads;
            formSpend += spend;

          } else if (
            objective === "OUTCOME_MESSAGES" ||
            objective === "MESSAGES" ||
            objective === "OUTCOME_ENGAGEMENT" ||
            objective === "POST_ENGAGEMENT"
          ) {
            // Mensagens / conversas iniciadas
            let campaignMsgs = 0;
            for (const act of actions) {
              if (
                act.action_type === "onsite_conversion.messaging_conversation_started_7d" ||
                act.action_type === "onsite_conversion.lead_grouped" ||
                act.action_type === "onsite_conversion.total_messaging_connection"
              ) {
                campaignMsgs += parseInt(act.value ?? "0", 10);
              }
            }
            // Fallback: leads gerados em campanha de mensagens
            if (campaignMsgs === 0) {
              for (const act of actions) {
                if (act.action_type === "lead") {
                  campaignMsgs += parseInt(act.value ?? "0", 10);
                }
              }
            }
            msgLeads += campaignMsgs;
            msgSpend += spend;

          } else if (
            objective === "OUTCOME_TRAFFIC" ||
            objective === "LINK_CLICKS" ||
            objective === "LANDING_PAGE_VIEWS"
          ) {
            // Tráfego — resultado principal é clique no link
            let campaignClicks = 0;
            for (const act of actions) {
              if (act.action_type === "link_click" || act.action_type === "landing_page_view") {
                campaignClicks += parseInt(act.value ?? "0", 10);
              }
            }
            trafficClicks += campaignClicks || clicks;
            trafficSpend  += spend;

          } else {
            // OUTCOME_AWARENESS, REACH, VIDEO_VIEWS, APP_INSTALLS, etc.
            let campaignEngagements = 0;
            for (const act of actions) {
              if (
                act.action_type === "post_engagement" ||
                act.action_type === "page_engagement" ||
                act.action_type === "video_view"
              ) {
                campaignEngagements += parseInt(act.value ?? "0", 10);
              }
            }
            // Fallback genérico
            if (campaignEngagements === 0 && actions.length > 0) {
              campaignEngagements = parseInt(actions[0].value ?? "0", 10);
            }
            engagements      += campaignEngagements;
            engagementSpend  += spend;
          }
        }
      } catch {
        // Conta sem dados de insight (ex: sem campanhas ativas) — retorna zeros
      }

      // ── CPL calculado APENAS sobre gasto que gerou leads/mensagens reais ──
      const totalLeads     = formLeads + msgLeads;
      const leadGenSpend   = formSpend + msgSpend;          // gasto "útil" para CPL
      const cpl            = totalLeads > 0 ? leadGenSpend / totalLeads : 0;

      // CPLs individuais
      const formCpl  = formLeads  > 0 ? formSpend / formLeads  : 0;
      const msgCpl   = msgLeads   > 0 ? msgSpend  / msgLeads   : 0;

      return NextResponse.json({
        account_status:   accountData.account_status as number,
        account_name:     accountData.name as string,
        currency:         (accountData.currency as string) ?? "BRL",
        // ── Totais gerais ──────────────────────────────────────────────────
        spend:            totalSpend,
        total_leads:      totalLeads,
        cpl,
        // ── Leads de Formulário ────────────────────────────────────────────
        form_leads:       formLeads,
        form_spend:       formSpend,
        form_cpl:         formCpl,
        // ── Mensagens / Conversas ──────────────────────────────────────────
        msg_leads:        msgLeads,
        msg_spend:        msgSpend,
        msg_cpl:          msgCpl,
        // ── Tráfego ────────────────────────────────────────────────────────
        traffic_clicks:   trafficClicks,
        traffic_spend:    trafficSpend,
        // ── Engajamento / Awareness ────────────────────────────────────────
        engagements:      engagements,
        engagement_spend: engagementSpend,
        // ── Legado (retrocompatibilidade com MetaSummary) ──────────────────
        leads:            formLeads,
        messages:         msgLeads,
      });
    }

    return NextResponse.json({ error: "action inválida" }, { status: 400 });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
