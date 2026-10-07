/* ============================================================
   /api/avaliacoes  —  avaliações dos clientes

   GET   ?produto=abacaxi   lista as avaliações APROVADAS (sem
                            o filtro, de todos os sabores)
   POST  { produto, nota, texto, nome, cidade?, email? }
                            grava uma avaliação PENDENTE, que só
                            aparece no site depois de aprovada em
                            /admin.html → Avaliações.

   Tabela criada por sql/avaliacoes.sql.
============================================================ */

import crypto from 'node:crypto';
import { sb, bancoConfigurado } from '../lib/supabase.js';

const TABELA = 'docebrasa_avaliacoes';
const PRODUTOS = ['abacaxi', 'cebola', 'morango', 'morango-zero'];
const PUBLICOS = 'id,produto,nota,texto,nome,cidade,aprovada_em';

/* No máximo 5 avaliações por IP a cada hora — segura robô sem
   atrapalhar quem está avaliando os quatro sabores de uma vez. */
const LIMITE_POR_HORA = 5;

function texto(v, max) {
  return String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

/* O IP não é guardado: só um hash dele, para o limite acima. */
function hashIp(req) {
  const ip = String(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '')
    .split(',')[0].trim();
  if (!ip) return null;
  return crypto.createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY || 'docebrasa')
    .update(ip).digest('hex').slice(0, 32);
}

export default async function handler(req, res) {
  /* ---- Listar aprovadas ---- */
  if (req.method === 'GET') {
    const produto = String(req.query?.produto || '');
    if (produto && !PRODUTOS.includes(produto)) {
      return res.status(400).json({ erro: 'Produto inválido.' });
    }
    /* Sem banco ou sem a tabela, o site segue só com os depoimentos fixos. */
    if (!bancoConfigurado) return res.status(200).json({ avaliacoes: [] });

    try {
      let caminho = `${TABELA}?select=${PUBLICOS}&status=eq.aprovada&order=aprovada_em.desc&limit=60`;
      if (produto) caminho += `&produto=eq.${produto}`;
      const avaliacoes = await sb(caminho);
      res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
      return res.status(200).json({ avaliacoes });
    } catch (erro) {
      console.error('[avaliacoes] listar:', erro.message);
      return res.status(200).json({ avaliacoes: [] });
    }
  }

  /* ---- Receber nova ---- */
  if (req.method === 'POST') {
    let corpo;
    try {
      corpo = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    } catch {
      return res.status(400).json({ erro: 'Dados inválidos.' });
    }

    /* Campo-isca invisível: gente não preenche, robô preenche. Fingimos
       que deu certo para o robô não tentar de novo. */
    if (corpo.site) return res.status(200).json({ ok: true });

    const avaliacao = {
      produto: String(corpo.produto || ''),
      nota: parseInt(corpo.nota, 10),
      texto: texto(corpo.texto, 600),
      nome: texto(corpo.nome, 60),
      cidade: texto(corpo.cidade, 60) || null,
      email: texto(corpo.email, 120).toLowerCase() || null
    };

    if (!PRODUTOS.includes(avaliacao.produto)) return res.status(400).json({ erro: 'Escolha o sabor que você provou.' });
    if (!(avaliacao.nota >= 1 && avaliacao.nota <= 5)) return res.status(400).json({ erro: 'Dê uma nota de 1 a 5 estrelas.' });
    if (avaliacao.texto.length < 10) return res.status(400).json({ erro: 'Conte um pouco mais sobre a geleia (pelo menos 10 letras).' });
    if (avaliacao.nome.length < 2) return res.status(400).json({ erro: 'Informe seu nome.' });
    if (avaliacao.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(avaliacao.email)) {
      return res.status(400).json({ erro: 'Confira o e-mail — ou deixe em branco.' });
    }

    if (!bancoConfigurado) {
      return res.status(503).json({ erro: 'Avaliações indisponíveis no momento. Tente mais tarde.' });
    }

    try {
      const ip_hash = hashIp(req);
      if (ip_hash) {
        const umaHora = new Date(Date.now() - 3600e3).toISOString();
        const recentes = await sb(`${TABELA}?select=id&ip_hash=eq.${ip_hash}&criado_em=gte.${umaHora}`);
        if (recentes.length >= LIMITE_POR_HORA) {
          return res.status(429).json({ erro: 'Recebemos várias avaliações suas agora há pouco. Tente de novo mais tarde.' });
        }
      }

      await sb(TABELA, {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ ...avaliacao, ip_hash })
      });
      return res.status(201).json({ ok: true });
    } catch (erro) {
      console.error('[avaliacoes] gravar:', erro.message);
      return res.status(500).json({ erro: 'Não consegui enviar sua avaliação. Tente de novo em instantes.' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ erro: 'Método não permitido' });
}
