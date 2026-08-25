/* ============================================================
   POST /api/frete
   Calcula preço e prazo dos Correios (API CWS oficial).

   Body: { cepDestino, peso, comprimento, largura, altura, valorDeclarado }
   Resp: { opcoes: [{ codigo, nome, valor, prazo }], simulado, origem }

   Sem credenciais configuradas, devolve uma tabela simulada
   (`simulado: true`) para a prévia continuar funcionando.
============================================================ */

const CORREIOS = {
  usuario:   process.env.CORREIOS_USUARIO,
  codigo:    process.env.CORREIOS_CODIGO_ACESSO,
  cartao:    process.env.CORREIOS_CARTAO_POSTAGEM,
  contrato:  process.env.CORREIOS_CONTRATO,
  dr:        process.env.CORREIOS_DR,
  base:      process.env.CORREIOS_API_BASE || 'https://api.correios.com.br',
  cepOrigem: (process.env.CEP_ORIGEM || '38400000').replace(/\D/g, '')
};

/* Serviços consultados. Sobrescreva com CORREIOS_SERVICOS="03220:SEDEX,03298:PAC" */
const SERVICOS = (process.env.CORREIOS_SERVICOS || '03220:SEDEX,03298:PAC')
  .split(',')
  .map((par) => {
    const [codigo, nome] = par.split(':');
    return { codigo: (codigo || '').trim(), nome: (nome || codigo || '').trim() };
  })
  .filter((s) => s.codigo);

const temCredenciais = Boolean(CORREIOS.usuario && CORREIOS.codigo && CORREIOS.cartao);

/* ------------------------------------------------------------
   TOKEN (cache em memória enquanto a lambda estiver quente)
------------------------------------------------------------ */
let tokenCache = { valor: null, expiraEm: 0 };

async function obterToken() {
  const agora = Date.now();
  if (tokenCache.valor && tokenCache.expiraEm > agora + 60_000) return tokenCache.valor;

  const basic = Buffer.from(`${CORREIOS.usuario}:${CORREIOS.codigo}`).toString('base64');
  const corpo = { numero: CORREIOS.cartao };
  if (CORREIOS.contrato) corpo.contrato = CORREIOS.contrato;
  if (CORREIOS.dr) corpo.dr = Number(CORREIOS.dr);

  const resposta = await fetch(`${CORREIOS.base}/token/v1/autentica/cartaopostagem`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify(corpo)
  });

  const texto = await resposta.text();
  if (!resposta.ok) {
    throw new Error(`Autenticação Correios falhou (${resposta.status}): ${texto.slice(0, 300)}`);
  }

  const dados = JSON.parse(texto);
  const expira = dados.expiraEm ? new Date(dados.expiraEm).getTime() : agora + 20 * 60 * 60 * 1000;
  tokenCache = { valor: dados.token, expiraEm: expira };
  return dados.token;
}

/* ------------------------------------------------------------
   CONSULTAS
------------------------------------------------------------ */
function paraNumero(valorBr) {
  /* "27,80" -> 27.8 · "1.234,50" -> 1234.5 */
  if (typeof valorBr === 'number') return valorBr;
  if (!valorBr) return 0;
  return Number(String(valorBr).replace(/\./g, '').replace(',', '.')) || 0;
}

async function consultarServico(token, servico, params) {
  const comum = {
    cepOrigem: CORREIOS.cepOrigem,
    cepDestino: params.cepDestino
  };

  const qsPreco = new URLSearchParams({
    ...comum,
    nuRequisicao: `${Date.now()}`.slice(-8),
    psObjeto: String(params.peso),
    tpObjeto: '2', // 2 = pacote/caixa
    comprimento: String(params.comprimento),
    largura: String(params.largura),
    altura: String(params.altura)
  });
  if (CORREIOS.contrato) qsPreco.set('nuContrato', CORREIOS.contrato);
  if (CORREIOS.dr) qsPreco.set('nuDR', CORREIOS.dr);
  if (params.valorDeclarado > 0) {
    qsPreco.set('vlDeclarado', params.valorDeclarado.toFixed(2));
  }

  const qsPrazo = new URLSearchParams(comum);

  const cabecalhos = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Content-Type': 'application/json'
  };

  const [respPreco, respPrazo] = await Promise.all([
    fetch(`${CORREIOS.base}/preco/v1/nacional/${servico.codigo}?${qsPreco}`, { headers: cabecalhos }),
    fetch(`${CORREIOS.base}/prazo/v1/nacional/${servico.codigo}?${qsPrazo}`, { headers: cabecalhos })
  ]);

  if (!respPreco.ok) {
    const detalhe = await respPreco.text();
    throw new Error(`Preço ${servico.nome} (${respPreco.status}): ${detalhe.slice(0, 200)}`);
  }

  const preco = await respPreco.json();
  const prazo = respPrazo.ok ? await respPrazo.json() : {};

  if (preco.txErro) throw new Error(`Correios · ${servico.nome}: ${preco.txErro}`);

  return {
    codigo: servico.codigo,
    nome: servico.nome,
    valor: paraNumero(preco.pcFinal),
    prazo: Number(prazo.prazoEntrega) || 7,
    entregaDomiciliar: prazo.entregaDomiciliar !== 'N'
  };
}

/* ------------------------------------------------------------
   TABELA SIMULADA (usada quando não há credenciais)
------------------------------------------------------------ */
const TABELA_SIMULADA = {
  '0': { pac: 24.90, sedex: 38.90, prazoPac: 5,  prazoSedex: 2 },
  '1': { pac: 24.90, sedex: 38.90, prazoPac: 5,  prazoSedex: 2 },
  '2': { pac: 21.90, sedex: 33.90, prazoPac: 4,  prazoSedex: 2 },
  '3': { pac: 19.90, sedex: 31.90, prazoPac: 3,  prazoSedex: 1 },
  '4': { pac: 32.90, sedex: 49.90, prazoPac: 8,  prazoSedex: 4 },
  '5': { pac: 32.90, sedex: 49.90, prazoPac: 8,  prazoSedex: 4 },
  '6': { pac: 38.90, sedex: 57.90, prazoPac: 10, prazoSedex: 5 },
  '7': { pac: 27.90, sedex: 42.90, prazoPac: 6,  prazoSedex: 3 },
  '8': { pac: 29.90, sedex: 45.90, prazoPac: 7,  prazoSedex: 3 },
  '9': { pac: 29.90, sedex: 45.90, prazoPac: 7,  prazoSedex: 3 }
};

function simular(params) {
  const regiao = TABELA_SIMULADA[params.cepDestino[0]] || TABELA_SIMULADA['0'];
  /* Tabela base cobre até 1 kg; acima disso soma R$ 6,50 por quilo extra. */
  const kgExtras = Math.max(0, Math.ceil(params.peso / 1000) - 1);
  const adicional = kgExtras * 6.5;

  return [
    { codigo: '03298', nome: 'PAC',   valor: +(regiao.pac + adicional).toFixed(2),   prazo: regiao.prazoPac,   entregaDomiciliar: true },
    { codigo: '03220', nome: 'SEDEX', valor: +(regiao.sedex + adicional).toFixed(2), prazo: regiao.prazoSedex, entregaDomiciliar: true }
  ].sort((a, b) => a.valor - b.valor);
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

  const params = {
    cepDestino: String(corpo.cepDestino || '').replace(/\D/g, ''),
    peso: Math.min(30000, Math.max(300, Number(corpo.peso) || 600)),
    comprimento: Math.min(100, Math.max(16, Number(corpo.comprimento) || 16)),
    largura: Math.min(100, Math.max(11, Number(corpo.largura) || 12)),
    altura: Math.min(100, Math.max(2, Number(corpo.altura) || 11)),
    valorDeclarado: Number(corpo.valorDeclarado) || 0
  };

  if (params.cepDestino.length !== 8) {
    return res.status(400).json({ erro: 'CEP de destino inválido' });
  }

  if (!temCredenciais) {
    return res.status(200).json({
      opcoes: simular(params),
      simulado: true,
      origem: CORREIOS.cepOrigem,
      aviso: 'Credenciais dos Correios não configuradas — valores estimados.'
    });
  }

  try {
    const token = await obterToken();
    const resultados = await Promise.allSettled(
      SERVICOS.map((s) => consultarServico(token, s, params))
    );

    const opcoes = resultados
      .filter((r) => r.status === 'fulfilled' && r.value.valor > 0)
      .map((r) => r.value)
      .sort((a, b) => a.valor - b.valor);

    if (!opcoes.length) {
      const motivo = resultados.find((r) => r.status === 'rejected');
      throw new Error(motivo ? motivo.reason.message : 'Nenhum serviço disponível para este CEP');
    }

    return res.status(200).json({ opcoes, simulado: false, origem: CORREIOS.cepOrigem });
  } catch (erro) {
    console.error('[frete] erro:', erro);
    /* Token pode ter expirado antes do previsto — força renovação na próxima chamada. */
    tokenCache = { valor: null, expiraEm: 0 };
    return res.status(502).json({ erro: erro.message || 'Falha ao consultar os Correios' });
  }
}
