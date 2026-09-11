/* ============================================================
   /api/admin-pedidos  —  dados do painel de pedidos

   GET    lista os pedidos (mais recentes primeiro)
   PATCH  atualiza status, rastreio ou observação de um pedido

   A senha vai no header `x-admin-senha` e é conferida contra a
   variável ADMIN_SENHA. Os dados de cliente só saem daqui, que
   roda no servidor — a página admin.html não tem chave nenhuma.
============================================================ */

import crypto from 'node:crypto';
import { sb, TABELA, bancoConfigurado } from '../lib/supabase.js';

const SENHA = process.env.ADMIN_SENHA;

/* Comparação em tempo constante, para a senha não vazar pelo tempo de resposta. */
function senhaConfere(enviada) {
  if (!SENHA || !enviada) return false;
  const a = Buffer.from(String(enviada));
  const b = Buffer.from(SENHA);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

const STATUS_VALIDOS = [
  'aguardando', 'pago', 'separando', 'enviado', 'entregue',
  'vencido', 'cancelado', 'estornado', 'chargeback', 'recusado'
];

const CAMPOS = [
  'referencia', 'criado_em', 'pago_em', 'status', 'metodo',
  'cliente_nome', 'cliente_email', 'cliente_telefone', 'cliente_cpf',
  'cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf',
  'frete_servico', 'frete_valor', 'frete_prazo',
  'itens', 'subtotal', 'total', 'invoice_url', 'rastreio', 'observacoes'
].join(',');

export default async function handler(req, res) {
  if (!SENHA) {
    return res.status(503).json({ erro: 'Painel sem senha configurada (ADMIN_SENHA).' });
  }
  if (!bancoConfigurado) {
    return res.status(503).json({ erro: 'Banco de dados não configurado.' });
  }
  if (!senhaConfere(req.headers['x-admin-senha'])) {
    return res.status(401).json({ erro: 'Senha incorreta.' });
  }

  try {
    /* ---- Listar ---- */
    if (req.method === 'GET') {
      const filtro = String(req.query?.status || '').trim();
      const busca = String(req.query?.busca || '').trim();

      let caminho = `${TABELA}?select=${CAMPOS}&order=criado_em.desc&limit=300`;
      if (filtro && STATUS_VALIDOS.includes(filtro)) {
        caminho += `&status=eq.${filtro}`;
      }
      if (busca) {
        const t = encodeURIComponent(`*${busca}*`);
        caminho += `&or=(referencia.ilike.${t},cliente_nome.ilike.${t},cliente_email.ilike.${t},rastreio.ilike.${t})`;
      }

      const pedidos = await sb(caminho);

      /* Resumo para o topo do painel. */
      const resumo = { total: pedidos.length, aguardando: 0, pago: 0, enviado: 0, faturado: 0 };
      for (const p of pedidos) {
        if (resumo[p.status] !== undefined) resumo[p.status] += 1;
        if (['pago', 'separando', 'enviado', 'entregue'].includes(p.status)) {
          resumo.faturado += Number(p.total) || 0;
        }
      }
      resumo.faturado = +resumo.faturado.toFixed(2);

      return res.status(200).json({ pedidos, resumo });
    }

    /* ---- Atualizar ---- */
    if (req.method === 'PATCH') {
      const corpo = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const { referencia, status, rastreio, observacoes } = corpo;

      if (!referencia) return res.status(400).json({ erro: 'Informe a referência do pedido.' });

      const campos = { atualizado_em: new Date().toISOString() };
      if (status !== undefined) {
        if (!STATUS_VALIDOS.includes(status)) {
          return res.status(400).json({ erro: `Status inválido: ${status}` });
        }
        campos.status = status;
      }
      if (rastreio !== undefined) campos.rastreio = String(rastreio).trim() || null;
      if (observacoes !== undefined) campos.observacoes = String(observacoes).trim() || null;

      const linhas = await sb(`${TABELA}?referencia=eq.${encodeURIComponent(referencia)}&select=${CAMPOS}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(campos)
      });

      if (!linhas?.length) return res.status(404).json({ erro: 'Pedido não encontrado.' });
      return res.status(200).json({ pedido: linhas[0] });
    }

    res.setHeader('Allow', 'GET, PATCH');
    return res.status(405).json({ erro: 'Método não permitido' });
  } catch (erro) {
    console.error('[admin-pedidos]', erro);
    return res.status(500).json({ erro: erro.message || 'Falha ao consultar os pedidos' });
  }
}
