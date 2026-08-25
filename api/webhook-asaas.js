/* ============================================================
   POST /api/webhook-asaas
   Recebe as notificações de pagamento do Asaas.

   Configure em: Asaas → Integrações → Webhooks
   URL:    https://SEUDOMINIO/api/webhook-asaas
   Token:  o mesmo valor de ASAAS_WEBHOOK_TOKEN

   Hoje ele só valida e registra o evento no log da Vercel.
   É aqui que entra o e-mail de confirmação / baixa no estoque
   quando o cliente quiser esse passo.
============================================================ */

const TOKEN = process.env.ASAAS_WEBHOOK_TOKEN;

const EVENTOS_PAGOS = new Set([
  'PAYMENT_RECEIVED',
  'PAYMENT_CONFIRMED'
]);

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

  console.log('[webhook] evento=%s pedido=%s valor=%s status=%s',
    evento, cobranca.externalReference, cobranca.value, cobranca.status);

  if (EVENTOS_PAGOS.has(evento)) {
    /* TODO: disparar e-mail de confirmação, dar baixa no estoque,
       gerar a etiqueta dos Correios. */
    console.log('[webhook] PAGAMENTO CONFIRMADO do pedido', cobranca.externalReference);
  }

  /* O Asaas reenvia o evento enquanto não receber 200. */
  return res.status(200).json({ recebido: true });
}
