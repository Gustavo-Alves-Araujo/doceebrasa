/* ============================================================
   Cupons de desconto.

   A regra vive só aqui, no servidor. O navegador manda o código
   digitado; quem decide se vale, e quanto, é esta função.
============================================================ */

import { sb, TABELA, bancoConfigurado } from './supabase.js';

export const CUPONS = {
  SELAMBUZE: {
    percentual: 0.10,
    primeiraCompraApenas: true,
    rotulo: 'Primeira compra'
  }
};

/* Status que contam como "já comprou de verdade". Pedido abandonado
   no meio do caminho não queima o cupom de ninguém. */
const STATUS_DE_COMPRA = ['pago', 'separando', 'enviado', 'entregue'];

export function normalizar(codigo) {
  return String(codigo || '').trim().toUpperCase();
}

function digitos(v) {
  return String(v || '').replace(/\D/g, '');
}

/* Procura um pedido anterior do mesmo CPF que tenha sido efetivamente pago. */
async function jaComprouAntes(cpf) {
  const doc = digitos(cpf);
  if (!doc || !bancoConfigurado) return false;
  try {
    const lista = STATUS_DE_COMPRA.map((s) => `"${s}"`).join(',');
    const linhas = await sb(
      `${TABELA}?select=referencia&cliente_cpf=eq.${doc}&status=in.(${lista})&limit=1`
    );
    return Array.isArray(linhas) && linhas.length > 0;
  } catch (erro) {
    /* Banco fora do ar não pode impedir uma venda: na dúvida, o cupom passa. */
    console.error('[cupom] não consegui checar compras anteriores:', erro.message);
    return false;
  }
}

/**
 * @returns {{ valido: boolean, codigo?: string, percentual?: number,
 *             rotulo?: string, motivo?: string }}
 */
export async function validarCupom(codigo, cpf) {
  const c = normalizar(codigo);
  if (!c) return { valido: false, motivo: 'Digite o código do cupom.' };

  const cupom = CUPONS[c];
  if (!cupom) return { valido: false, motivo: 'Cupom não encontrado. Confira o código.' };

  if (cupom.primeiraCompraApenas && await jaComprouAntes(cpf)) {
    return {
      valido: false,
      motivo: 'Este cupom vale só na primeira compra, e já encontramos um pedido anterior neste CPF.'
    };
  }

  return {
    valido: true,
    codigo: c,
    percentual: cupom.percentual,
    rotulo: cupom.rotulo
  };
}
