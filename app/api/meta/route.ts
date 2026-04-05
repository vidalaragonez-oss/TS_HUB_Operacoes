import { NextRequest, NextResponse } from "next/server";

const META_API_VERSION = "v21.0";
const META_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

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

type ActionEntry = { action_type: string; value: string };
interface AdInsights { spend: number; results: number; cpr: number; matchedType?: string; formLeads: number; msgLeads: number; }
interface AdNode { id: string; name: string; status: string; insights: AdInsights; }
interface AdSetNode { id: string; name: string; status: string; insights: AdInsights; ads: AdNode[]; }
interface CampaignNode {
  id: string; name: string; objective: string; objective_label: string;
  status: string; insights: AdInsights; adsets: AdSetNode[];
}
interface ObjectiveGroup {
  objective: string; objective_label: string;
  total_spend: number; total_results: number; cpr: number;
  campaigns: CampaignNode[];
}

const OBJECTIVE_LABEL: Record<string, string> = {
  OUTCOME_LEADS: "Leads", OUTCOME_ENGAGEMENT: "Engajamento",
  OUTCOME_AWARENESS: "Reconhecimento", OUTCOME_TRAFFIC: "Tráfego",
  OUTCOME_SALES: "Vendas", OUTCOME_APP_PROMOTION: "App",
  MESSAGES: "Mensagens", UNKNOWN: "—",
};

// Action types que representam FORMULÁRIOS (lead nativo Meta)
const FORM_LEAD_TYPES = [
  "onsite_conversion.lead_grouped",
  "leadgen_grouped",
  "leadgen",
  "lead",
] as const;

// Action types que representam MENSAGENS (WhatsApp/Direct/Messenger)
// Dados brutos confirmados: a Meta sempre retorna "onsite_conversion.messaging_conversation_started_7d"
// com valor 14 em TODAS as janelas de atribuição para campanhas WhatsApp sob OUTCOME_LEADS.
const MSG_LEAD_TYPES = [
  "onsite_conversion.messaging_conversation_started_7d",
  "messaging_conversation_started_7d", // variante sem prefixo (fallback)
] as const;

const OBJECTIVE_ACTION_MAP: Record<string, string[]> = {
  // Para OUTCOME_LEADS usamos lógica especial em extractInsights (soma form + msg)
  OUTCOME_LEADS:      [...FORM_LEAD_TYPES, ...MSG_LEAD_TYPES],
  OUTCOME_ENGAGEMENT: [...MSG_LEAD_TYPES, "post_engagement"],
  MESSAGES:           [...MSG_LEAD_TYPES],
  OUTCOME_TRAFFIC:    ["link_click"],
  OUTCOME_SALES:      ["purchase", "omni_purchase", ...MSG_LEAD_TYPES],
};

function getActionValue(actions: ActionEntry[], types: readonly string[]): { value: number; type: string } {
  for (const t of types) {
    const found = actions.find(a => a.action_type === t);
    const v = parseInt(found?.value ?? "0", 10);
    if (v > 0) return { value: v, type: t };
  }
  return { value: 0, type: "" };
}

function extractInsights(
  actions: ActionEntry[], cpaList: ActionEntry[], spend: number, objective = "UNKNOWN",
): AdInsights {
  let formLeads = 0;
  let msgLeads  = 0;
  let matchedType = "";

  if (objective === "OUTCOME_LEADS" || objective === "LEAD_GENERATION") {
    // A Meta registra o mesmo resultado em múltiplos action_types simultâneos.
    // Ex: campanha WhatsApp retorna lead_grouped=4 E messaging_started=14.
    // Esses NÃO são aditivos — são representações do mesmo funil.
    // Regra: se houver mensagens, usar APENAS mensagens (objetivo da campanha).
    // Se não houver mensagens, usar formulários.
    const msg  = getActionValue(actions, MSG_LEAD_TYPES);
    const form = getActionValue(actions, FORM_LEAD_TYPES);
    if (msg.value > 0) {
      // Campanha WhatsApp/Direct/Messenger sob objetivo Leads
      msgLeads    = msg.value;
      matchedType = msg.type;
    } else if (form.value > 0) {
      // Campanha de formulário nativo
      formLeads   = form.value;
      matchedType = form.type;
    }
  } else if (objective === "MESSAGES" || objective === "OUTCOME_ENGAGEMENT") {
    const msg = getActionValue(actions, MSG_LEAD_TYPES);
    msgLeads    = msg.value;
    matchedType = msg.type;
  } else if (objective === "OUTCOME_SALES") {
    const salesTypes = ["purchase", "omni_purchase"] as const;
    const sale = getActionValue(actions, salesTypes);
    if (sale.value > 0) {
      msgLeads    = sale.value;
      matchedType = sale.type;
    } else {
      const msg = getActionValue(actions, MSG_LEAD_TYPES);
      msgLeads    = msg.value;
      matchedType = msg.type;
    }
  } else {
    // Outros objetivos: usa o mapa genérico
    const targetTypes = OBJECTIVE_ACTION_MAP[objective];
    if (targetTypes) {
      const generic = getActionValue(actions, targetTypes);
      msgLeads    = generic.value;
      matchedType = generic.type;
    }
  }

  const results = formLeads + msgLeads;

  let cpr = 0;
  if (matchedType) {
    const foundCpa = cpaList.find(c => c.action_type === matchedType);
    if (foundCpa && parseFloat(foundCpa.value ?? "0") > 0) {
      cpr = parseFloat(foundCpa.value);
    }
  }
  if (cpr === 0 && results > 0) cpr = spend / results;
  return { spend, results, cpr, matchedType, formLeads, msgLeads };
}

// ─── Descobre page_ids vinculados a uma conta de anúncios ─────────────────────
// Usa múltiplas estratégias para ser robusto mesmo quando promoted_object está vazio.
async function discoverPageIds(accountId: string, token: string): Promise<Set<string>> {
  const pageIds = new Set<string>();

  // Estratégia A: promoted_object nas campanhas (mais confiável, mas pode estar vazio)
  try {
    // Busca todas as campanhas, paginando até 500
    let after: string | null = null;
    for (let i = 0; i < 3; i++) {
      const params: Record<string, string> = {
        access_token: token, fields: "promoted_object", limit: "200",
      };
      if (after) params.after = after;
      const campData = await metaFetch(`/${accountId}/campaigns`, params);
      for (const c of (campData.data ?? []) as { promoted_object?: { page_id?: string } }[]) {
        const pid = c.promoted_object?.page_id;
        if (pid) pageIds.add(pid);
      }
      const nextAfter = campData.paging?.cursors?.after;
      if (!nextAfter || !campData.paging?.next) break;
      after = nextAfter;
    }
  } catch { /* continua */ }

  if (pageIds.size > 0) return pageIds;

  // Estratégia B: ads com creative.object_story_spec (page_id no criativo)
  // Também extrai lead_gen_form_id para uso direto se necessário
  try {
    let afterB: string | null = null;
    for (let i = 0; i < 5; i++) {
      const paramsB: Record<string, string> = {
        access_token: token,
        fields: "creative{object_story_spec}",
        limit: "100",
      };
      if (afterB) paramsB.after = afterB;
      const adsData = await metaFetch(`/${accountId}/ads`, paramsB);
      for (const ad of (adsData.data ?? []) as { creative?: { object_story_spec?: { page_id?: string } } }[]) {
        const pid = ad.creative?.object_story_spec?.page_id;
        if (pid) pageIds.add(pid);
      }
      const nextAfterB = adsData.paging?.cursors?.after;
      if (!nextAfterB || !adsData.paging?.next) break;
      afterB = nextAfterB;
    }
  } catch (e) { console.error(`[discoverPageIds] estratégia B: ${e instanceof Error ? e.message : String(e)}`); }

  if (pageIds.size > 0) return pageIds;

  // Estratégia C: páginas vinculadas à conta via endpoint dedicado
  try {
    const linked = await metaFetch(`/${accountId}/advertised_account`, {
      access_token: token, fields: "id", limit: "50",
    });
    for (const p of (linked.data ?? []) as { id: string }[]) pageIds.add(p.id);
  } catch { /* continua */ }

  // Estratégia D: business owner da conta → páginas do negócio
  try {
    const bizData = await metaFetch(`/${accountId}`, {
      access_token: token, fields: "owner",
    });
    const bizId = (bizData.owner as { id?: string } | undefined)?.id;
    if (bizId) {
      const bizPages = await metaFetch(`/${bizId}/owned_pages`, {
        access_token: token, fields: "id", limit: "100",
      });
      for (const p of (bizPages.data ?? []) as { id: string }[]) pageIds.add(p.id);
    }
  } catch { /* continua */ }

  return pageIds;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const action      = searchParams.get("action");
  const clientToken = searchParams.get("token");

  try {
    const token = resolveToken(clientToken);

    // ── Contas ─────────────────────────────────────────────────────────────────
    if (action === "accounts") {
      const data = await metaFetch("/me/adaccounts", {
        access_token: token, fields: "id,name,account_status,currency", limit: "100",
      });
      return NextResponse.json({
        accounts: (data.data ?? []).map((a: Record<string, unknown>) => ({
          id: a.id, name: a.name, status: a.account_status, currency: a.currency,
        })),
      });
    }

    // ── Auto-sync de leads ─────────────────────────────────────────────────────
    //
    // GARANTIA DE ISOLAMENTO POR CLIENTE:
    //  - Descobre page_ids EXCLUSIVAMENTE das campanhas desta conta (accountId)
    //  - Nunca processa páginas de outras contas/clientes
    //  - Usa page_access_token específico de cada página (obrigatório pela API)
    //
    if (action === "leads") {
      const accountId = searchParams.get("account_id");
      if (!accountId) return NextResponse.json({ error: "account_id obrigatório" }, { status: 400 });

      type LeadRow = {
        meta_lead_id: string; nome: string; email: string; telefone: string;
        created_time: string; form_id: string; form_name: string;
      };
      const leads: LeadRow[] = [];

      const fifteenDaysAgo = Math.floor((Date.now() - 15 * 24 * 60 * 60 * 1000) / 1000);
      const leadsFiltering = JSON.stringify([
        { field: "time_created", operator: "GREATER_THAN", value: fifteenDaysAgo },
      ]);

      function parseFieldData(fd: { name: string; values: string[] }[]) {
        let nome = ""; let email = ""; let telefone = "";
        for (const f of (fd ?? [])) {
          const key = (f.name ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
          const val = f.values?.[0] ?? "";
          if (!val) continue;
          if (["fullname", "nome", "name", "firstname"].includes(key)) nome = nome ? `${nome} ${val}` : val;
          else if (key === "lastname") nome = nome ? `${nome} ${val}` : val;
          else if (["email", "emailaddress"].includes(key)) email = val;
          else if (["phonenumber", "phone", "telefone", "celular", "whatsapp"].includes(key)) telefone = val;
        }
        if (!email) { const ef = fd?.find(f => (f.values?.[0] ?? "").includes("@")); if (ef) email = ef.values?.[0] ?? ""; }
        if (!telefone) { const pf = fd?.find(f => /^[+() 0-9\-\.]{9,20}$/.test(f.values?.[0] ?? "")); if (pf) telefone = pf.values?.[0] ?? ""; }
        return { nome: nome || "Lead Meta", email, telefone };
      }

      async function fetchLeadsForForm(formId: string, formName: string, pageToken: string) {
        let cursor: string | null = null;
        for (let p = 0; p < 5; p++) {
          const params: Record<string, string> = {
            access_token: pageToken, fields: "id,field_data,created_time",
            limit: "100", filtering: leadsFiltering,
          };
          if (cursor) params.after = cursor;
          let data: Record<string, unknown>;
          try { data = await metaFetch(`/${formId}/leads`, params); }
          catch (e) { console.error(`[leads] form ${formId}: ${e instanceof Error ? e.message : String(e)}`); break; }
          for (const row of (data.data ?? []) as { id: string; created_time: string; field_data: { name: string; values: string[] }[] }[]) {
            const parsed = parseFieldData(row.field_data ?? []);
            leads.push({ meta_lead_id: row.id, ...parsed, created_time: row.created_time, form_id: formId, form_name: formName });
          }
          const paging = data.paging as { cursors?: { after?: string }; next?: string } | undefined;
          cursor = paging?.cursors?.after ?? null;
          if (!cursor || !paging?.next) break;
        }
      }

      // PASSO 1: Descobre page_ids desta conta (4 estratégias em cascata)
      const accountPageIds = await discoverPageIds(accountId, token);

      if (accountPageIds.size === 0) {
        // Fallback: extrai form_ids diretamente dos criativos dos ads e busca leads por form
        // Funciona para contas onde page_id não aparece em campaigns nem em /me/accounts
        console.warn(`[leads] Nenhum page_id para ${accountId} — extraindo form_ids dos ads`);
        try {
          const formIds = new Map<string, string>(); // id -> name
          let afterAds: string | null = null;
          for (let i = 0; i < 10; i++) {
            const pAds: Record<string, string> = {
              access_token: token,
              fields: "creative{object_story_spec}",
              limit: "100",
            };
            if (afterAds) pAds.after = afterAds;
            const adsData = await metaFetch(`/${accountId}/ads`, pAds);
            for (const ad of (adsData.data ?? []) as { creative?: { object_story_spec?: { page_id?: string; link_data?: { call_to_action?: { value?: { lead_gen_form_id?: string } } }; video_data?: { call_to_action?: { value?: { lead_gen_form_id?: string } } } } } }[]) {
              const spec = ad.creative?.object_story_spec;
              const fid = spec?.link_data?.call_to_action?.value?.lead_gen_form_id
                       ?? spec?.video_data?.call_to_action?.value?.lead_gen_form_id;
              if (fid && !formIds.has(fid)) formIds.set(fid, fid);
            }
            const nextAds = adsData.paging?.cursors?.after;
            if (!nextAds || !adsData.paging?.next) break;
            afterAds = nextAds;
          }
          // Busca leads de cada formulário diretamente
          for (const [fid] of formIds) {
            try { await fetchLeadsForForm(fid, fid, token); } catch { /* segue */ }
          }
          // Se ainda não achou, tenta /account/leadgen_forms como último recurso
          if (leads.length === 0) {
            const formsData = await metaFetch(`/${accountId}/leadgen_forms`, {
              access_token: token, fields: "id,name", limit: "100",
            });
            for (const form of (formsData.data ?? []) as { id: string; name: string }[]) {
              if (!formIds.has(form.id)) {
                try { await fetchLeadsForForm(form.id, form.name, token); } catch { /* segue */ }
              }
            }
          }
        } catch (e) {
          console.error(`[leads] fallback form_ids falhou: ${e instanceof Error ? e.message : String(e)}`);
        }
        return NextResponse.json({ leads, pages_scanned: 0 });
      }

      // PASSO 2: Mapeia page_id → page_access_token (necessário para leadgen_forms)
      const pageTokenMap = new Map<string, string>();
      try {
        const pagesData = await metaFetch("/me/accounts", {
          access_token: token, fields: "id,access_token", limit: "200",
        });
        for (const pg of (pagesData.data ?? []) as { id: string; access_token?: string }[]) {
          if (pg.access_token) pageTokenMap.set(pg.id, pg.access_token);
        }
      } catch (e) { console.error(`[leads] page tokens: ${e instanceof Error ? e.message : String(e)}`); }

      // PASSO 3: Processa SOMENTE as páginas desta conta
      for (const pageId of accountPageIds) {
        const pageToken = pageTokenMap.get(pageId) ?? token;

        let forms: { id: string; name: string }[] = [];
        try {
          const fd = await metaFetch(`/${pageId}/leadgen_forms`, {
            access_token: pageToken, fields: "id,name,status", limit: "100",
          });
          forms = (fd.data ?? []) as { id: string; name: string }[];
        } catch (e) { console.error(`[leads] forms de ${pageId}: ${e instanceof Error ? e.message : String(e)}`); continue; }

        for (const form of forms) {
          try { await fetchLeadsForForm(form.id, form.name, pageToken); } catch { /* segue */ }
        }
      }

      return NextResponse.json({ leads, pages_scanned: accountPageIds.size });
    }


    // ── Listagem de Campanhas (para Blacklist UI) ─────────────────────────────
    if (action === "campaign_list") {
      const accountId = searchParams.get("account_id");
      if (!accountId) return NextResponse.json({ error: "account_id obrigatório" }, { status: 400 });

      const data = await metaFetch(`/${accountId}/campaigns`, {
        access_token: token,
        fields: "id,name,status,objective",
        limit: "500",
      });

      const campaigns = ((data.data ?? []) as Record<string, unknown>[]).map(c => ({
        id:        c.id        as string,
        name:      c.name      as string,
        status:    c.status    as string,
        objective: (c.objective as string) ?? "UNKNOWN",
      }));

      return NextResponse.json({ campaigns });
    }

    // ── Árvore Radar ───────────────────────────────────────────────────────────
    if (action === "tree") {
      const accountId = searchParams.get("account_id");
      const since     = searchParams.get("since");
      const until     = searchParams.get("until");
      // IDs de campanhas a ignorar (blacklist) — passados como JSON array no query param
      const ignoredIds: string[] = searchParams.get("ignore_ids")?.split(",").filter(Boolean) ?? [];
      if (!accountId) return NextResponse.json({ error: "account_id obrigatório" }, { status: 400 });

      const accountData = await metaFetch(`/${accountId}`, {
        access_token: token, fields: "account_status,name,currency",
      });

      // IMPORTANTE: A Meta API ignora time_range/date_preset em insights inline (insights{...}).
      // O filtro de período deve ser passado como parâmetro separado na query de insights.
      // Por isso buscamos campanhas sem filtro de período, e depois buscamos insights
      // separadamente usando /{id}/insights com o parâmetro correto.
      const insightParams: Record<string, string> = since && until
        ? { time_range: JSON.stringify({ since, until }) }
        : { date_preset: "last_7d" };

      // Helper: busca insights de um nó (campanha, adset, ad) com período correto
      async function fetchNodeInsights(nodeId: string): Promise<{ actions: ActionEntry[]; cpaList: ActionEntry[]; spend: number }> {
        try {
          const iData = await metaFetch(`/${nodeId}/insights`, {
            access_token: token,
            fields: "spend,actions,cost_per_action_type",
            // Janela igual ao Gerenciador de Anúncios: 1d_view + 7d_click
            // Isso garante que "Conversas por mensagem" batam com o painel oficial
            action_attribution_windows: '["1d_view","7d_click"]',
            ...insightParams,
          });
          const row = (iData.data ?? [])[0] as Record<string, unknown> | undefined ?? {};
          return {
            spend:   parseFloat((row.spend as string) ?? "0") || 0,
            actions: (row.actions as ActionEntry[]) ?? [],
            cpaList: (row.cost_per_action_type as ActionEntry[]) ?? [],
          };
        } catch {
          return { spend: 0, actions: [], cpaList: [] };
        }
      }

      const campaignData = await metaFetch(`/${accountId}/campaigns`, {
        access_token: token,
        fields: "id,name,objective,status",
        limit: "100",
      });

      const campaignNodes: CampaignNode[] = [];
      for (const camp of (campaignData.data ?? []) as Record<string, unknown>[]) {
        const campId    = camp.id as string;
        const objective = (camp.objective as string) ?? "UNKNOWN";
        const status    = (camp.status as string) ?? "UNKNOWN";

        // Blacklist: ignora campanhas selecionadas pelo gestor
        if (ignoredIds.includes(campId)) continue;

        // Busca insights da campanha com período correto (endpoint separado)
        const campIns = await fetchNodeInsights(campId);
        // FILTRO ANTI-POLUIÇÃO: Ignora campanhas não-ativas que não gastaram nada no período
        if (status !== "ACTIVE" && campIns.spend === 0) {
          continue;
        }
        const campInsights = extractInsights(campIns.actions, campIns.cpaList, campIns.spend, objective);

        let adsetNodes: AdSetNode[] = [];
        try {
          const adsetData = await metaFetch(`/${campId}/adsets`, {
            access_token: token, fields: "id,name,status", limit: "100",
          });
          for (const adset of (adsetData.data ?? []) as Record<string, unknown>[]) {
            const adsetId = adset.id as string;

            // Busca insights do adset com período correto
            const adsetIns = await fetchNodeInsights(adsetId);
            const adsetInsights = extractInsights(adsetIns.actions, adsetIns.cpaList, adsetIns.spend, objective);

            let adNodes: AdNode[] = [];
            try {
              const adsData = await metaFetch(`/${adsetId}/ads`, {
                access_token: token, fields: "id,name,status", limit: "100",
              });
              // Busca insights de todos os ads em paralelo
              adNodes = await Promise.all(
                ((adsData.data ?? []) as Record<string, unknown>[]).map(async ad => {
                  const adId = ad.id as string;
                  const adIns = await fetchNodeInsights(adId);
                  return {
                    id: adId, name: (ad.name as string) ?? "Anúncio",
                    status: (ad.status as string) ?? "UNKNOWN",
                    insights: extractInsights(adIns.actions, adIns.cpaList, adIns.spend, objective),
                  };
                })
              );
            } catch { /* sem ads */ }

            adsetNodes.push({
              id: adsetId, name: (adset.name as string) ?? "Conjunto",
              status: (adset.status as string) ?? "UNKNOWN",
              insights: adsetInsights, ads: adNodes,
            });
          }
        } catch { /* sem adsets */ }

        campaignNodes.push({
          id: campId, name: (camp.name as string) ?? "Campanha",
          objective, objective_label: OBJECTIVE_LABEL[objective] ?? objective,
          status: (camp.status as string) ?? "UNKNOWN",
          insights: campInsights, adsets: adsetNodes,
        });
      }

      const groupMap = new Map<string, ObjectiveGroup>();
      for (const camp of campaignNodes) {
        if (!groupMap.has(camp.objective)) {
          groupMap.set(camp.objective, {
            objective: camp.objective, objective_label: camp.objective_label,
            total_spend: 0, total_results: 0, cpr: 0, campaigns: [],
          });
        }
        const g = groupMap.get(camp.objective)!;
        g.total_spend += camp.insights.spend;
        g.total_results += camp.insights.results;
        g.campaigns.push(camp);
      }
      const groups: ObjectiveGroup[] = [];
      for (const g of groupMap.values()) {
        g.cpr = g.total_results > 0 ? g.total_spend / g.total_results : 0;
        g.campaigns.sort((a, b) => b.insights.spend - a.insights.spend);
        groups.push(g);
      }
      groups.sort((a, b) => b.total_spend - a.total_spend);

      return NextResponse.json({
        account_status: accountData.account_status as number,
        account_name: accountData.name as string,
        currency: (accountData.currency as string) ?? "BRL",
        groups,
      });
    }

    // ── Insights legado ────────────────────────────────────────────────────────
    if (action === "insights") {
      const accountId = searchParams.get("account_id");
      const since = searchParams.get("since");
      const until = searchParams.get("until");
      // IDs de campanhas a ignorar (blacklist)
      const ignoredIds: string[] = searchParams.get("ignore_ids")?.split(",").filter(Boolean) ?? [];
      if (!accountId) return NextResponse.json({ error: "account_id obrigatório" }, { status: 400 });

      const accountData = await metaFetch(`/${accountId}`, { access_token: token, fields: "account_status,name,currency" });
      const objectiveMap = new Map<string, string>();
      try {
        const cd = await metaFetch(`/${accountId}/campaigns`, { access_token: token, fields: "id,objective", limit: "500" });
        for (const c of (cd.data ?? []) as { id: string; objective: string }[]) objectiveMap.set(c.id, c.objective ?? "UNKNOWN");
      } catch { /* sem permissão */ }

      const iParams: Record<string, string> = {
        access_token: token,
        fields: "campaign_id,campaign_name,spend,actions,cost_per_action_type",
        level: "campaign",
        limit: "500",
        // Janela igual ao Gerenciador de Anúncios: 1d_view + 7d_click
        // Sem isso a API usa padrão diferente e retorna menos conversas de mensagem
        action_attribution_windows: '["1d_view","7d_click"]',
      };
      if (since && until) iParams.time_range = JSON.stringify({ since, until }); else iParams.date_preset = "maximum";

      const OL: Record<string, string> = {
        OUTCOME_LEADS: "Leads", OUTCOME_ENGAGEMENT: "Engajamento", OUTCOME_AWARENESS: "Reconhecimento",
        OUTCOME_TRAFFIC: "Tráfego", OUTCOME_SALES: "Vendas", OUTCOME_APP_PROMOTION: "App", MESSAGES: "Mensagens", UNKNOWN: "—",
      };
      let totalSpend = 0; let totalFormLeads = 0; let totalMsgLeads = 0;
      type CR = { campaign_name: string; objective: string; objective_label: string; spend: string; form_leads: number; msg_leads: number; form_cpl: number; msg_cpl: number; };
      const campaigns: CR[] = [];

      try {
        const insightData = await metaFetch(`/${accountId}/insights`, iParams);
        for (const row of (insightData.data ?? []) as Record<string, unknown>[]) {
          const campId = (row.campaign_id as string) ?? "";
          // Blacklist: ignora campanhas selecionadas pelo gestor
          if (ignoredIds.includes(campId)) continue;
          const campSpend = parseFloat((row.spend as string) ?? "0");
          totalSpend += campSpend;
          const objective = objectiveMap.get(campId) ?? "UNKNOWN";
          const ins = extractInsights((row.actions as ActionEntry[]) ?? [], (row.cost_per_action_type as ActionEntry[]) ?? [], campSpend, objective);
          // formLeads e msgLeads já vêm separados do extractInsights (dual-bucket)
          const campFormLeads = ins.formLeads;
          const campMsgLeads  = ins.msgLeads;
          totalFormLeads += campFormLeads; totalMsgLeads += campMsgLeads;
          campaigns.push({ campaign_name: (row.campaign_name as string) ?? "Campanha", objective, objective_label: OL[objective] ?? objective, spend: campSpend.toFixed(2), form_leads: campFormLeads, msg_leads: campMsgLeads, form_cpl: campFormLeads > 0 ? ins.cpr : 0, msg_cpl: campMsgLeads > 0 ? ins.cpr : 0 });
        }
      } catch { /* sem dados */ }

      const totalLeads = totalFormLeads + totalMsgLeads;
      const cpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
      const formSpend = totalLeads > 0 && totalFormLeads > 0 ? totalSpend * (totalFormLeads / totalLeads) : 0;
      const msgSpend  = totalLeads > 0 && totalMsgLeads  > 0 ? totalSpend * (totalMsgLeads  / totalLeads) : 0;

      return NextResponse.json({
        account_status: accountData.account_status as number, account_name: accountData.name as string,
        currency: (accountData.currency as string) ?? "BRL",
        spend: totalSpend, leads: totalFormLeads, messages: totalMsgLeads, total_leads: totalLeads, cpl,
        form_leads: totalFormLeads, form_spend: formSpend, form_cpl: totalFormLeads > 0 ? formSpend / totalFormLeads : 0,
        msg_leads: totalMsgLeads,  msg_spend: msgSpend,   msg_cpl:  totalMsgLeads > 0  ? msgSpend  / totalMsgLeads  : 0,
        campaigns,
      });
    }

    // ── DEBUG: despeja todos os action_types brutos da API ────────────────────
    // Uso: /api/meta?action=debug&account_id=ACT_xxx&since=2026-03-28&until=2026-04-03
    // Descobre EXATAMENTE qual action_type a Meta usa para "Conversas" nesta conta
    if (action === "debug") {
      const accountId = searchParams.get("account_id") ?? "";
      const since     = searchParams.get("since");
      const until     = searchParams.get("until");
      if (!accountId) return NextResponse.json({ error: "account_id obrigatorio" }, { status: 400 });

      const report: Record<string, unknown> = {
        account_id: accountId,
        period: since && until ? `${since} -> ${until}` : "last_7d",
        note: "Compara action_types em diferentes janelas de atribuicao para achar o valor correto",
      };

      const windowCombos = [
        { label: "1d_view+7d_click (padrao Gerenciador)", windows: '["1d_view","7d_click"]' },
        { label: "7d_click only",                          windows: '["7d_click"]' },
        { label: "1d_click only",                          windows: '["1d_click"]' },
        { label: "sem janela (API default)",               windows: "" },
      ];

      const windowResults = [];
      for (const combo of windowCombos) {
        try {
          const p: Record<string, string> = {
            access_token: token,
            fields: "campaign_id,campaign_name,objective,spend,actions",
            level: "campaign",
            limit: "10",
          };
          if (since && until) p.time_range = JSON.stringify({ since, until });
          else p.date_preset = "last_7d";
          if (combo.windows) p.action_attribution_windows = combo.windows;

          const data = await metaFetch(`/${accountId}/insights`, p);
          const campaigns = ((data.data ?? []) as Record<string, unknown>[]).map(row => ({
            campaign_name: row.campaign_name,
            objective:     row.objective ?? "unknown",
            spend:         row.spend,
            all_actions: ((row.actions as ActionEntry[]) ?? []).map(a => ({
              type: a.action_type,
              value: a.value,
            })),
          }));
          windowResults.push({ window: combo.label, campaigns });
        } catch (e) {
          windowResults.push({ window: combo.label, error: String(e) });
        }
      }
      report.results_by_window = windowResults;
      return NextResponse.json(report);
    }

    return NextResponse.json({ error: "action inválida" }, { status: 400 });

  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erro desconhecido" }, { status: 500 });
  }
}
