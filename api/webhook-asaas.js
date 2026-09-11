/* ============================================================
   POST /api/webhook-asaas
   Recebe as notificações de pagamento do Asaas e atualiza o
   pedido no banco — é o que faz o status mudar sozinho de
   "aguardando" para "pago" no painel.

   Configurado em: Asaas → Integrações → Webhooks
   URL:   https://www.docebrasa.com.br/api/webhook-asaas
   Token: o mesmo valor de ASAAS_WEBHOOK_TOKEN
============================================================ */

import { atualizarPedido } from '../lib/supabase.js';

const TOKEN = process.env.ASAAS_WEBHOOK_TOKEN;

/* Como cada evento do Asaas se traduz no status do pedido. */
const STATUS_POR_EVENTO = {
  PAYMENT_CONFIRMED:            'pago',
  PAYMENT_RECEIVED:             'pago',
  PAYMENT_RECEIVED_IN_CASH:     'pago',
  PAYMENT_OVERDUE:              'vencido',
  PAYMENT_DELETED:              'cancelado',
  PAYMENT_REFUNDED:             'estornado',
  PAYMENT_PARTIALLY_REFUNDED:   'estornado',
  PAYMENT_CHARGEBACK_REQUESTED: 'chargeback',
  PAYMENT_REPROVED_BY_RISK_ANALYSIS: 'recusado'
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ erro: 'Método não permitido' });
  }

  /* O Asaas envia o token no header `asaas-access-token`. */
  if (TOKEN && req.headers['asaas-access-token'] !== TOKEN) {
    console.warn('[webhook] token inválido');
    return res.status(401).json({ erro: 'Não autorizado' });
  }

  const corpo = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const evento = corpo.event;
  const cobranca = corpo.payment || {};
  const referencia = cobranca.externalReference;

  console.log('[webhook] evento=%s pedido=%s valor=%s status=%s',
    evento, referencia, cobranca.value, cobranca.status);

  const novoStatus = STATUS_POR_EVENTO[evento];

  if (novoStatus && referencia) {
    const campos = { status: novoStatus };
    if (novoStatus === 'pago') {
      campos.pago_em = cobranca.paymentDate || cobranca.confirmedDate || new Date().toISOString();
    }
    const atualizado = await atualizarPedido(referencia, campos);
    console.log('[webhook] pedido %s -> %s %s',
      referencia, novoStatus, atualizado ? '(gravado)' : '(não encontrado no banco)');
  }

  /* O Asaas reenvia o evento enquanto não receber 200. */
  return res.status(200).json({ recebido: true });
}
