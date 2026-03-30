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

      // 1. Status + moeda da conta
      const accountData = await metaFetch(`/${accountId}`, {
        access_token: token,
        fields: "account_status,name,currency",
      });

      // 2. Objetivos reais das campanhas (campo `objective` — fonte da verdade)
      //    Busca todas as campanhas da conta para montar um mapa campaign_id → objective
      const objectiveMap = new Map<string, string>();
      try {
        let url: string | null = `/${accountId}/campaigns`;
        while (url) {
          const campData = await metaFetch(url, {
            access_token: token,
            fields: "id,objective",
            limit: "500",
          });
          for (const c of (campData.data ?? []) as { id: string; objective: string }[]) {
            objectiveMap.set(c.id, c.objective ?? "UNKNOWN");
          }
          // Paginação (cursor-based)
          url = campData.paging?.cursors?.after
            ? `/${accountId}/campaigns?after=${campData.paging.cursors.after}`
            : null;
          // Segurança: sai após 5 páginas (2500 campanhas)
          if (campData.paging?.next === undefined) break;
        }
      } catch {
        // Sem permissão para ler campanhas — segue sem objectives
      }

      // 3. Insights por campanha com campaign_id para cruzar com o mapa de objetivos
      const insightParams: Record<string, string> = {
        access_token: token,
        fields: "campaign_id,campaign_name,spend,actions,cost_per_action_type",
        level: "campaign",
        limit: "500",
      };

      if (since && until) {
        insightParams.time_range = JSON.stringify({ since, until });
      } else {
        insightParams.date_preset = "maximum";
      }

      // Mapa de objectives para labels amigáveis exibidos na UI
      const OBJECTIVE_LABEL: Record<string, string> = {
        OUTCOME_LEADS:            "Leads",
        OUTCOME_ENGAGEMENT:       "Engajamento",
        OUTCOME_AWARENESS:        "Reconhecimento",
        OUTCOME_TRAFFIC:          "Tráfego",
        OUTCOME_SALES:            "Vendas",
        OUTCOME_APP_PROMOTION:    "App",
        MESSAGES:                 "Mensagens",
        UNKNOWN:                  "—",
      };

      // Tipos de lead que NÃO devem ser somados (aliases duplicados)
      const FORM_LEAD_TYPE  = "lead";
      const MSG_LEAD_TYPES  = new Set([
        "onsite_conversion.messaging_conversation_started_7d",
        "onsite_conversion.lead_grouped",
      ]);
      const SKIP_LEAD_TYPES = new Set(["leadgen_grouped"]);

      type CampaignRow = {
        campaign_name: string;
        objective: string;       // valor bruto ex: OUTCOME_LEADS
        objective_label: string; // label amigável ex: "Leads"
        spend: string;
        form_leads: number;
        msg_leads: number;
        form_cpl: number;
        msg_cpl: number;
      };

      let totalSpend     = 0;
      let totalFormLeads = 0;
      let totalMsgLeads  = 0;
      const campaigns: CampaignRow[] = [];

      try {
        const insightData = await metaFetch(`/${accountId}/insights`, insightParams);
        const rows: Record<string, unknown>[] = insightData.data ?? [];

        for (const row of rows) {
          const campId    = (row.campaign_id as string) ?? "";
          const campSpend = parseFloat((row.spend as string) ?? "0");
          totalSpend += campSpend;

          const objective      = objectiveMap.get(campId) ?? "UNKNOWN";
          const objectiveLabel = OBJECTIVE_LABEL[objective] ?? objective;

          const actions: { action_type: string; value: string }[] =
            (row.actions as { action_type: string; value: string }[]) ?? [];
          const cpaList: { action_type: string; value: string }[] =
            (row.cost_per_action_type as { action_type: string; value: string }[]) ?? [];

          let campFormLeads = 0;
          let campMsgLeads  = 0;

          for (const act of actions) {
            if (SKIP_LEAD_TYPES.has(act.action_type)) continue;
            if (act.action_type === FORM_LEAD_TYPE) {
              campFormLeads += parseInt(act.value ?? "0", 10);
            }
            if (MSG_LEAD_TYPES.has(act.action_type)) {
              campMsgLeads += parseInt(act.value ?? "0", 10);
            }
          }

          totalFormLeads += campFormLeads;
          totalMsgLeads  += campMsgLeads;

          let campFormCpl = 0;
          let campMsgCpl  = 0;
          for (const cpa of cpaList) {
            if (SKIP_LEAD_TYPES.has(cpa.action_type)) continue;
            if (cpa.action_type === FORM_LEAD_TYPE) {
              const v = parseFloat(cpa.value ?? "0");
              if (v > 0) campFormCpl = v;
            }
            if (MSG_LEAD_TYPES.has(cpa.action_type)) {
              const v = parseFloat(cpa.value ?? "0");
              if (v > 0 && (campMsgCpl === 0 || v < campMsgCpl)) campMsgCpl = v;
            }
          }

          // Fallback proporcional
          const campTotal = campFormLeads + campMsgLeads;
          if (campTotal > 0) {
            if (campFormCpl === 0 && campFormLeads > 0) {
              campFormCpl = (campSpend * (campFormLeads / campTotal)) / campFormLeads;
            }
            if (campMsgCpl === 0 && campMsgLeads > 0) {
              campMsgCpl = (campSpend * (campMsgLeads / campTotal)) / campMsgLeads;
            }
          }

          campaigns.push({
            campaign_name:  (row.campaign_name as string) ?? "Campanha",
            objective,
            objective_label: objectiveLabel,
            spend:           campSpend.toFixed(2),
            form_leads:      campFormLeads,
            msg_leads:       campMsgLeads,
            form_cpl:        campFormCpl,
            msg_cpl:         campMsgCpl,
          });
        }
      } catch {
        // Sem dados de insight
      }

      const totalLeads = totalFormLeads + totalMsgLeads;
      const cpl        = totalLeads > 0 ? totalSpend / totalLeads : 0;

      const formSpend = totalLeads > 0 && totalFormLeads > 0
        ? totalSpend * (totalFormLeads / totalLeads) : 0;
      const msgSpend = totalLeads > 0 && totalMsgLeads > 0
        ? totalSpend * (totalMsgLeads / totalLeads) : 0;
      const formCpl = totalFormLeads > 0 ? formSpend / totalFormLeads : 0;
      const msgCpl  = totalMsgLeads  > 0 ? msgSpend  / totalMsgLeads  : 0;

      return NextResponse.json({
        account_status: accountData.account_status as number,
        account_name:   accountData.name as string,
        currency:       (accountData.currency as string) ?? "BRL",
        spend:          totalSpend,
        leads:          totalFormLeads,
        messages:       totalMsgLeads,
        total_leads:    totalLeads,
        cpl,
        form_leads: totalFormLeads,
        form_spend: formSpend,
        form_cpl:   formCpl,
        msg_leads:  totalMsgLeads,
        msg_spend:  msgSpend,
        msg_cpl:    msgCpl,
        campaigns,
      });
    }

    return NextResponse.json({ error: "action inválida" }, { status: 400 });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
