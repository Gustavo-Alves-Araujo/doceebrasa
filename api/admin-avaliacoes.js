/* ============================================================
   /api/admin-avaliacoes  —  moderação das avaliações no painel

   GET     ?status=pendente   lista (mais recentes primeiro)
   PATCH   { id, status }     aprova, recusa ou volta para pendente
   DELETE  ?id=123            apaga de vez

   Mesma senha do painel de pedidos (header `x-admin-senha`).
============================================================ */

import { sb, bancoConfigurado } from '../lib/supabase.js';
import { SENHA_ADMIN, senhaConfere } from '../lib/admin.js';

const TABELA = 'docebrasa_avaliacoes';
const STATUS = ['pendente', 'aprovada', 'recusada'];
const CAMPOS = 'id,criado_em,produto,nota,texto,nome,cidade,email,status,aprovada_em';

export default async function handler(req, res) {
  if (!SENHA_ADMIN) {
    return res.status(503).json({ erro: 'Painel sem senha configurada (ADMIN_SENHA).' });
  }
  if (!bancoConfigurado) {
    return res.status(503).json({ erro: 'Banco de dados não configurado.' });
  }
  if (!senhaConfere(req.headers['x-admin-senha'])) {
    return res.status(401).json({ erro: 'Senha incorreta.' });
  }

  try {
    if (req.method === 'GET') {
      const status = String(req.query?.status || '');
      let caminho = `${TABELA}?select=${CAMPOS}&order=criado_em.desc&limit=300`;
      if (STATUS.includes(status)) caminho += `&status=eq.${status}`;
      const avaliacoes = await sb(caminho);

      /* Contagem por status para as abas do painel. */
      const todas = await sb(`${TABELA}?select=status`);
      const contagem = { pendente: 0, aprovada: 0, recusada: 0 };
      for (const a of todas) contagem[a.status] = (contagem[a.status] || 0) + 1;

      return res.status(200).json({ avaliacoes, contagem });
    }

    if (req.method === 'PATCH') {
      const corpo = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const id = parseInt(corpo.id, 10);
      if (!id) return res.status(400).json({ erro: 'Informe a avaliação.' });
      if (!STATUS.includes(corpo.status)) return res.status(400).json({ erro: `Status inválido: ${corpo.status}` });

      const linhas = await sb(`${TABELA}?id=eq.${id}&select=${CAMPOS}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          status: corpo.status,
          aprovada_em: corpo.status === 'aprovada' ? new Date().toISOString() : null
        })
      });
      if (!linhas?.length) return res.status(404).json({ erro: 'Avaliação não encontrada.' });
      return res.status(200).json({ avaliacao: linhas[0] });
    }

    if (req.method === 'DELETE') {
      const id = parseInt(req.query?.id, 10);
      if (!id) return res.status(400).json({ erro: 'Informe a avaliação.' });
      await sb(`${TABELA}?id=eq.${id}`, { method: 'DELETE' });
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, PATCH, DELETE');
    return res.status(405).json({ erro: 'Método não permitido' });
  } catch (erro) {
    console.error('[admin-avaliacoes]', erro);
    return res.status(500).json({ erro: erro.message || 'Falha ao consultar as avaliações' });
  }
}
