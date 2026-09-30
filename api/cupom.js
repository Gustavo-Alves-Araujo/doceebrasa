/* ============================================================
   POST /api/cupom
   Confere um cupom antes de finalizar o pedido.

   Body: { codigo, cpf }
   Resp: { valido, percentual, rotulo } ou { valido: false, motivo }
============================================================ */

import { validarCupom } from '../lib/cupons.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ erro: 'Método não permitido' });
  }

  const corpo = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const resultado = await validarCupom(corpo.codigo, corpo.cpf);

  return res.status(200).json(resultado);
}
