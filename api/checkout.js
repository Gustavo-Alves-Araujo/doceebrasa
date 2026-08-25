/* ============================================================
   POST /api/checkout
   Cria (ou reaproveita) o cliente no Asaas e gera a cobrança.

   Body: { cliente, entrega, frete, metodo, itens }
   Resp: { referencia, invoiceUrl, totais, simulado }

   Sem ASAAS_API_KEY configurada, devolve `simulado: true` para
   a prévia rodar do começo ao fim sem cobrar ninguém.
============================================================ */

const ASAAS_KEY = process.env.ASAAS_API_KEY;
const ASAAS_BASE = process.env.ASAAS_API_BASE ||
  (String(ASAAS_KEY || '').includes('_hmlg_')
    ? 'https://api-sandbox.asaas.com/v3'
    : 'https://api.asaas.com/v3');

const SITE = process.env.SITE_URL || 'https://docebrasa.com.br';

/* ------------------------------------------------------------
   CATÁLOGO DO SERVIDOR
   Fonte da verdade dos preços — o que vem do navegador é só
   `{ id, qtd }`. Mantenha em sincronia com assets/loja.js.
------------------------------------------------------------ */
const PRECOS = {
  abacaxi:      { nome: 'Geleia de Abacaxi com Pimenta 300g',   preco: 39.90 },
  cebola:       { nome: 'Geleia de Cebola Roxa com Vinho 300g', preco: 39.90 },
  'kit-brasa':  { nome: 'Kit Brasa · 4 potes 300g',             preco: 134.90 },
  presente:     { nome: 'Embalagem Presente',                   preco: 12.90 }
};

const DESCONTO_PIX = 0.05;
const FRETE_GRATIS_ACIMA_DE = 199.90;
const METODOS = ['PIX', 'BOLETO', 'CREDIT_CARD'];

/* ------------------------------------------------------------
   HELPERS
------------------------------------------------------------ */
function digitos(v) { return String(v || '').replace(/\D/g, ''); }

function cpfValido(v) {
  const d = digitos(v);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  let soma = 0, resto;
  for (let i = 1; i <= 9; i++) soma += parseInt(d.substring(i - 1, i), 10) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto >= 10) resto = 0;
  if (resto !== parseInt(d.substring(9, 10), 10)) return false;
  soma = 0;
  for (let i = 1; i <= 10; i++) soma += parseInt(d.substring(i - 1, i), 10) * (12 - i);
  resto = (soma * 10) % 11;
  if (resto >= 10) resto = 0;
  return resto === parseInt(d.substring(10, 11), 10);
}

function dataEm(dias) {
  const d = new Date(Date.now() + dias * 86400000);
  return d.toISOString().slice(0, 10);
}

function gerarReferencia() {
  return 'DB-' + Date.now().toString(36).toUpperCase() +
         '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
}

async function asaas(caminho, opcoes = {}) {
  const resposta = await fetch(`${ASAAS_BASE}${caminho}`, {
    ...opcoes,
    headers: {
      access_token: ASAAS_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'DoceEBrasa/1.0',
      ...(opcoes.headers || {})
    }
  });

  const texto = await resposta.text();
  let dados;
  try { dados = texto ? JSON.parse(texto) : {}; } catch { dados = { raw: texto }; }

  if (!resposta.ok) {
    const detalhe = dados?.errors?.[0]?.description || dados.raw || `HTTP ${resposta.status}`;
    const erro = new Error(detalhe);
    erro.status = resposta.status;
    throw erro;
  }
  return dados;
}

/* ------------------------------------------------------------
   HANDLER
------------------------------------------------------------ */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ erro: 'Método não permitido' });
  }

  const corpo = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const { cliente = {}, entrega = {}, frete = {}, metodo = 'PIX', itens = [] } = corpo;

  /* ---- Validação ---- */
  if (!Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({ erro: 'Carrinho vazio' });
  }
  if (!cliente.nome || String(cliente.nome).trim().split(/\s+/).length < 2) {
    return res.status(400).json({ erro: 'Nome completo é obrigatório' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(cliente.email || ''))) {
    return res.status(400).json({ erro: 'E-mail inválido' });
  }
  if (!cpfValido(cliente.cpf)) {
    return res.status(400).json({ erro: 'CPF inválido' });
  }
  if (digitos(cliente.telefone).length < 10) {
    return res.status(400).json({ erro: 'Telefone inválido' });
  }
  if (digitos(entrega.cep).length !== 8 || !entrega.logradouro || !entrega.numero || !entrega.cidade || !entrega.uf) {
    return res.status(400).json({ erro: 'Endereço de entrega incompleto' });
  }
  if (!METODOS.includes(metodo)) {
    return res.status(400).json({ erro: 'Forma de pagamento inválida' });
  }

  /* ---- Totais recalculados no servidor ---- */
  const linhas = [];
  for (const item of itens) {
    const produto = PRECOS[item.id];
    if (!produto) return res.status(400).json({ erro: `Produto desconhecido: ${item.id}` });
    const qtd = Math.min(99, Math.max(1, parseInt(item.qtd, 10) || 0));
    linhas.push({ nome: produto.nome, qtd, preco: produto.preco, subtotal: +(produto.preco * qtd).toFixed(2) });
  }

  const subtotal = +linhas.reduce((t, l) => t + l.subtotal, 0).toFixed(2);
  const valorFreteInformado = Math.max(0, Number(frete.valor) || 0);
  const valorFrete = subtotal >= FRETE_GRATIS_ACIMA_DE ? 0 : valorFreteInformado;
  const desconto = metodo === 'PIX' ? +(subtotal * DESCONTO_PIX).toFixed(2) : 0;
  const total = +(subtotal + valorFrete - desconto).toFixed(2);

  if (total < 5) {
    return res.status(400).json({ erro: 'Valor mínimo de cobrança é R$ 5,00' });
  }

  const referencia = gerarReferencia();
  const totais = { subtotal, frete: valorFrete, desconto, total };

  const descricao = [
    `Pedido ${referencia} · Doce e Brasa`,
    ...linhas.map((l) => `${l.qtd}× ${l.nome}`),
    `Envio: ${frete.nome || 'Correios'}${valorFrete === 0 ? ' (grátis)' : ` — R$ ${valorFrete.toFixed(2)}`}`
  ].join(' | ').slice(0, 500);

  /* ---- Modo demonstração ---- */
  if (!ASAAS_KEY) {
    return res.status(200).json({
      referencia,
      invoiceUrl: `${SITE}/pedido.html`,
      totais,
      simulado: true,
      aviso: 'ASAAS_API_KEY não configurada — nenhuma cobrança real foi criada.'
    });
  }

  /* ---- Asaas ---- */
  try {
    const cpf = digitos(cliente.cpf);
    const telefone = digitos(cliente.telefone);

    /* 1. Reaproveita o cliente se já existir (evita duplicata a cada compra) */
    const busca = await asaas(`/customers?cpfCnpj=${cpf}&limit=1`);
    let idCliente = busca?.data?.[0]?.id;

    const dadosCliente = {
      name: String(cliente.nome).trim(),
      cpfCnpj: cpf,
      email: String(cliente.email).trim(),
      mobilePhone: telefone,
      postalCode: digitos(entrega.cep),
      address: entrega.logradouro,
      addressNumber: String(entrega.numero),
      complement: entrega.complemento || null,
      province: entrega.bairro || null,
      notificationDisabled: false
    };

    if (idCliente) {
      await asaas(`/customers/${idCliente}`, { method: 'POST', body: JSON.stringify(dadosCliente) });
    } else {
      const novo = await asaas('/customers', { method: 'POST', body: JSON.stringify(dadosCliente) });
      idCliente = novo.id;
    }

    /* 2. Cria a cobrança */
    const cobranca = await asaas('/payments', {
      method: 'POST',
      body: JSON.stringify({
        customer: idCliente,
        billingType: metodo,
        value: total,
        dueDate: dataEm(metodo === 'BOLETO' ? 3 : 1),
        description: descricao,
        externalReference: referencia,
        callback: {
          successUrl: `${SITE}/pedido.html`,
          autoRedirect: true
        }
      })
    });

    return res.status(200).json({
      referencia,
      idCobranca: cobranca.id,
      invoiceUrl: cobranca.invoiceUrl,
      bankSlipUrl: cobranca.bankSlipUrl || null,
      totais,
      simulado: false
    });
  } catch (erro) {
    console.error('[checkout] Asaas:', erro);
    return res.status(erro.status === 400 ? 400 : 502).json({
      erro: erro.message || 'Falha ao gerar a cobrança no Asaas'
    });
  }
}
