/* ============================================================
   Senha do painel (/admin.html), compartilhada pelas rotas
   /api/admin-*. Vai no header `x-admin-senha` e é conferida
   contra a variável ADMIN_SENHA.
============================================================ */

import crypto from 'node:crypto';

export const SENHA_ADMIN = process.env.ADMIN_SENHA;

/* Comparação em tempo constante, para a senha não vazar pelo tempo de resposta. */
export function senhaConfere(enviada) {
  if (!SENHA_ADMIN || !enviada) return false;
  const a = Buffer.from(String(enviada));
  const b = Buffer.from(SENHA_ADMIN);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
