/* ============================================================
   Acesso ao Supabase pelas funções de /api.

   Usa a chave `service_role`, que ignora o RLS. A tabela
   `docebrasa_pedidos` está com RLS ligado e sem nenhuma política,
   então só quem tem essa chave enxerga os pedidos — a chave pública
   do Supabase não lê nada de cliente.

   Esta chave NUNCA pode ir para o navegador. Só é lida aqui, que
   roda no servidor da Vercel.
============================================================ */

const URL_BASE = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const TABELA = 'docebrasa_pedidos';
export const bancoConfigurado = Boolean(URL_BASE && SERVICE_KEY);

export async function sb(caminho, opcoes = {}) {
  if (!bancoConfigurado) {
    throw new Error('Supabase não configurado (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)');
  }

  const resposta = await fetch(`${URL_BASE}/rest/v1/${caminho}`, {
    ...opcoes,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(opcoes.headers || {})
    }
  });

  const texto = await resposta.text();
  let dados;
  try { dados = texto ? JSON.parse(texto) : null; } catch { dados = texto; }

  if (!resposta.ok) {
    const detalhe = dados?.message || dados?.hint || texto || `HTTP ${resposta.status}`;
    const erro = new Error(`Supabase: ${detalhe}`);
    erro.status = resposta.status;
    throw erro;
  }
  return dados;
}

/* Grava o pedido. Nunca derruba o checkout: se falhar, registra no log
   e devolve null — a cobrança no Asaas já existe e vale mais que a linha
   no banco. O pedido pode ser recuperado depois pelo painel do Asaas. */
export async function salvarPedido(pedido) {
  try {
    const [linha] = await sb(TABELA, {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(pedido)
    });
    return linha;
  } catch (erro) {
    console.error('[banco] não consegui gravar o pedido %s: %s', pedido.referencia, erro.message);
    return null;
  }
}

/* Atualiza o pedido pela referência (o externalReference do Asaas). */
export async function atualizarPedido(referencia, campos) {
  try {
    const linhas = await sb(`${TABELA}?referencia=eq.${encodeURIComponent(referencia)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ ...campos, atualizado_em: new Date().toISOString() })
    });
    return linhas?.[0] || null;
  } catch (erro) {
    console.error('[banco] não consegui atualizar o pedido %s: %s', referencia, erro.message);
    return null;
  }
}
