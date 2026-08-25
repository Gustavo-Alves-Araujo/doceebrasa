/* ============================================================
   DOCE & BRASA · NÚCLEO DA LOJA
   Catálogo, carrinho (localStorage) e helpers compartilhados.
   Carregado por index.html, produto.html, carrinho.html,
   checkout.html e pedido.html.
============================================================ */
(function (global) {
  'use strict';

  /* ------------------------------------------------------------
     CONFIGURAÇÃO
     >>> Ajuste aqui: preços, frete grátis e peso/volume da caixa.
  ------------------------------------------------------------ */
  var CONFIG = {
    freteGratisAcimaDe: 199.90,
    whatsapp: '553499047484',
    moeda: 'BRL'
  };

  /* ------------------------------------------------------------
     CATÁLOGO
     `pesoBruto` = pote + vidro + embalagem, em gramas (usado no frete).
     `unidades`  = quantos potes o SKU ocupa na caixa.
     ATENÇÃO: ingredientes/validade são sugestões — o cliente
     precisa confirmar os dados reais do rótulo antes de publicar.
  ------------------------------------------------------------ */
  var PRODUTOS = {
    abacaxi: {
      id: 'abacaxi',
      nome: 'Abacaxi com Pimenta',
      nomeCurto: 'Abacaxi',
      titulo: 'Abacaxi<br>com Pimenta',
      numero: '01',
      preco: 39.90,
      precoDe: 49.90,
      peso: '300 g',
      pesoBruto: 580,
      unidades: 1,
      vitrine: true,
      imagem: 'abacaxifinal.png',
      fundo: 'sabor-abacaxi.webp',
      ardencia: 3,
      tags: ['Tropical', 'Picante', 'Irresistível'],
      resumo: 'Suculência tropical do abacaxi encontra o calor da pimenta dedo-de-moça. ' +
              'Cada garfada é uma explosão de doçura seguida de um ardor irresistível.',
      descricao: 'A doçura tropical do abacaxi encontra o calor da pimenta dedo-de-moça numa ' +
                 'combinação que transforma qualquer assado. Cozida lentamente em panela de cobre ' +
                 'até atingir o ponto exato entre o doce e o ardido, é a geleia que faz o convidado ' +
                 'parar no meio da garfada para perguntar o que é aquilo.',
      harmoniza: [
        'Frango na brasa',
        'Picanha selada',
        'Costelinha de porco',
        'Queijo coalho grelhado',
        'Camarão na churrasqueira',
        'Espetinho misto'
      ],
      ficha: [
        ['Peso líquido', '300 g'],
        ['Ingredientes', 'Abacaxi, açúcar cristal, pimenta dedo-de-moça, suco de limão e especiarias'],
        ['Validade', '12 meses fechado · 30 dias refrigerado após aberto'],
        ['Conservação', 'Local seco e arejado. Após aberto, manter refrigerado'],
        ['Restrições', 'Sem glúten · Sem conservantes · Sem corantes artificiais']
      ]
    },

    cebola: {
      id: 'cebola',
      nome: 'Cebola Roxa com Vinho',
      nomeCurto: 'Cebola Roxa',
      titulo: 'Cebola Roxa<br>com Vinho',
      numero: '02',
      preco: 39.90,
      precoDe: 49.90,
      peso: '300 g',
      pesoBruto: 580,
      unidades: 1,
      vitrine: true,
      imagem: 'cebolafinal.png',
      fundo: 'sabor-cebola.webp',
      ardencia: 1,
      tags: ['Sofisticado', 'Agridoce', 'Exótica'],
      resumo: 'Cebola roxa caramelizada lentamente, enriquecida com vinho tinto seco. ' +
              'Profundidade de sabor que transforma qualquer combinação em algo extraordinário.',
      descricao: 'Cebola roxa caramelizada em fogo baixo por horas, enriquecida com vinho tinto ' +
                 'seco até virar um agridoce denso e aveludado. É a geleia dos cortes nobres: ' +
                 'profundidade de sabor que transforma qualquer combinação em algo extraordinário.',
      harmoniza: [
        'Picanha premium',
        'Ancho e chorizo',
        'Queijos nobres',
        'Cordeiro na grelha',
        'Tábua fria gourmet',
        'Hambúrguer artesanal'
      ],
      ficha: [
        ['Peso líquido', '300 g'],
        ['Ingredientes', 'Cebola roxa, vinho tinto seco, açúcar mascavo, azeite, sal e especiarias'],
        ['Validade', '12 meses fechado · 30 dias refrigerado após aberto'],
        ['Conservação', 'Local seco e arejado. Após aberto, manter refrigerado'],
        ['Restrições', 'Sem glúten · Sem conservantes · Sem corantes artificiais']
      ]
    },

    /* ---- SKUs de upsell (não aparecem na vitrine) ---- */
    'kit-brasa': {
      id: 'kit-brasa',
      nome: 'Kit Brasa · 4 potes',
      nomeCurto: 'Kit Brasa',
      preco: 134.90,
      precoDe: 159.60,
      peso: '4 × 300 g',
      pesoBruto: 2320,
      unidades: 4,
      vitrine: false,
      imagem: 'Design sem nome(1).jpg',
      resumo: '2 potes de Abacaxi com Pimenta + 2 de Cebola Roxa com Vinho. O churrasco inteiro resolvido.',
      composicao: [
        { id: 'abacaxi', qtd: 2 },
        { id: 'cebola', qtd: 2 }
      ]
    },

    presente: {
      id: 'presente',
      nome: 'Embalagem Presente',
      nomeCurto: 'Embalagem Presente',
      preco: 12.90,
      peso: '—',
      pesoBruto: 90,
      unidades: 0,
      vitrine: false,
      imagem: 'logo.webp',
      resumo: 'Caixa kraft com lacre da marca, palha e cartão escrito à mão. Chega pronto para presentear.'
    }
  };

  /* Ordem da vitrine */
  var VITRINE = ['abacaxi', 'cebola'];

  /* ------------------------------------------------------------
     HELPERS
  ------------------------------------------------------------ */
  function produto(id) {
    return PRODUTOS[id] || null;
  }

  function catalogo() {
    return VITRINE.map(function (id) { return PRODUTOS[id]; });
  }

  function brl(valor) {
    return (Number(valor) || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: CONFIG.moeda
    });
  }

  function digitos(str) {
    return String(str || '').replace(/\D+/g, '');
  }

  function mascaraCep(v) {
    var d = digitos(v).slice(0, 8);
    return d.length > 5 ? d.slice(0, 5) + '-' + d.slice(5) : d;
  }

  function mascaraTelefone(v) {
    var d = digitos(v).slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 6) return '(' + d.slice(0, 2) + ') ' + d.slice(2);
    if (d.length <= 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
    return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
  }

  function mascaraCpf(v) {
    var d = digitos(v).slice(0, 11);
    return d
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
  }

  function cpfValido(v) {
    var d = digitos(v);
    if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
    var soma = 0, resto, i;
    for (i = 1; i <= 9; i++) soma += parseInt(d.substring(i - 1, i), 10) * (11 - i);
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(d.substring(9, 10), 10)) return false;
    soma = 0;
    for (i = 1; i <= 10; i++) soma += parseInt(d.substring(i - 1, i), 10) * (12 - i);
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    return resto === parseInt(d.substring(10, 11), 10);
  }

  function emailValido(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || '').trim());
  }

  /* ------------------------------------------------------------
     CARRINHO (localStorage)
     Formato: [{ id: 'abacaxi', qtd: 2 }]
  ------------------------------------------------------------ */
  var CHAVE_CARRINHO = 'db_carrinho_v1';
  var CHAVE_PEDIDO = 'db_pedido_v1';

  function lerJson(chave, padrao) {
    try {
      var raw = global.localStorage.getItem(chave);
      return raw ? JSON.parse(raw) : padrao;
    } catch (e) {
      return padrao;
    }
  }

  function gravarJson(chave, valor) {
    try {
      global.localStorage.setItem(chave, JSON.stringify(valor));
    } catch (e) { /* modo anônimo / storage cheio: segue sem persistir */ }
  }

  var Carrinho = {
    itens: function () {
      var bruto = lerJson(CHAVE_CARRINHO, []);
      if (!Array.isArray(bruto)) return [];
      return bruto
        .filter(function (i) { return i && PRODUTOS[i.id] && Number(i.qtd) > 0; })
        .map(function (i) { return { id: i.id, qtd: Math.min(99, Math.max(1, parseInt(i.qtd, 10) || 1)) }; });
    },

    detalhado: function () {
      return Carrinho.itens().map(function (i) {
        var p = PRODUTOS[i.id];
        return {
          id: p.id,
          nome: p.nome,
          imagem: p.imagem,
          preco: p.preco,
          qtd: i.qtd,
          subtotal: p.preco * i.qtd,
          pesoBruto: p.pesoBruto * i.qtd,
          unidades: p.unidades * i.qtd
        };
      });
    },

    gravar: function (itens) {
      gravarJson(CHAVE_CARRINHO, itens);
      Carrinho.notificar();
    },

    adicionar: function (id, qtd) {
      if (!PRODUTOS[id]) return;
      qtd = Math.max(1, parseInt(qtd, 10) || 1);
      var itens = Carrinho.itens();
      var achou = false;
      itens.forEach(function (i) {
        if (i.id === id) { i.qtd = Math.min(99, i.qtd + qtd); achou = true; }
      });
      if (!achou) itens.push({ id: id, qtd: Math.min(99, qtd) });
      Carrinho.gravar(itens);
    },

    definirQtd: function (id, qtd) {
      qtd = parseInt(qtd, 10) || 0;
      var itens = Carrinho.itens().filter(function (i) { return i.id !== id; });
      if (qtd > 0) itens.push({ id: id, qtd: Math.min(99, qtd) });
      Carrinho.gravar(itens);
    },

    remover: function (id) {
      Carrinho.gravar(Carrinho.itens().filter(function (i) { return i.id !== id; }));
    },

    limpar: function () {
      Carrinho.gravar([]);
    },

    contem: function (id) {
      return Carrinho.itens().some(function (i) { return i.id === id; });
    },

    quantidade: function () {
      return Carrinho.itens().reduce(function (t, i) { return t + i.qtd; }, 0);
    },

    subtotal: function () {
      return Carrinho.detalhado().reduce(function (t, i) { return t + i.subtotal; }, 0);
    },

    /* Peso bruto total em gramas + dimensões estimadas da caixa */
    volume: function () {
      var det = Carrinho.detalhado();
      var peso = det.reduce(function (t, i) { return t + i.pesoBruto; }, 0);
      var potes = det.reduce(function (t, i) { return t + i.unidades; }, 0);
      var caixa;
      if (potes <= 2)      caixa = { comprimento: 16, largura: 12, altura: 11 };
      else if (potes <= 4) caixa = { comprimento: 22, largura: 17, altura: 11 };
      else if (potes <= 6) caixa = { comprimento: 27, largura: 19, altura: 12 };
      else                 caixa = { comprimento: 33, largura: 24, altura: 13 };
      return {
        peso: Math.max(300, peso),
        potes: potes,
        comprimento: caixa.comprimento,
        largura: caixa.largura,
        altura: caixa.altura
      };
    },

    freteGratis: function () {
      return Carrinho.subtotal() >= CONFIG.freteGratisAcimaDe;
    },

    /* Sugestões de upsell para o carrinho */
    upsells: function () {
      var sugestoes = [];
      var itens = Carrinho.itens();
      var temAbacaxi = Carrinho.contem('abacaxi');
      var temCebola = Carrinho.contem('cebola');
      var temKit = Carrinho.contem('kit-brasa');

      if (!temKit && !(temAbacaxi && temCebola)) {
        var faltando = temAbacaxi ? 'cebola' : 'abacaxi';
        sugestoes.push({
          produto: PRODUTOS[faltando],
          chamada: 'Complete a dupla',
          motivo: 'Quem leva os dois sabores nunca mais serve churrasco sem eles.'
        });
      }

      if (!temKit && itens.length > 0) {
        sugestoes.push({
          produto: PRODUTOS['kit-brasa'],
          chamada: 'Economize ' + brl(PRODUTOS['kit-brasa'].precoDe - PRODUTOS['kit-brasa'].preco),
          motivo: '2 de cada sabor pelo preço de 3 potes e meio. Estoque para o ano inteiro de brasa.'
        });
      }

      if (!Carrinho.contem('presente')) {
        sugestoes.push({
          produto: PRODUTOS.presente,
          chamada: 'Vai de presente?',
          motivo: 'Caixa kraft, palha, lacre da marca e cartão escrito à mão.'
        });
      }

      return sugestoes;
    },

    /* ---- Observers ---- */
    _ouvintes: [],
    aoMudar: function (fn) {
      Carrinho._ouvintes.push(fn);
      fn();
    },
    notificar: function () {
      Carrinho._ouvintes.forEach(function (fn) {
        try { fn(); } catch (e) { console.error(e); }
      });
    }
  };

  /* Sincroniza entre abas */
  global.addEventListener('storage', function (e) {
    if (e.key === CHAVE_CARRINHO) Carrinho.notificar();
  });

  /* ------------------------------------------------------------
     PEDIDO EM ANDAMENTO (dados do checkout entre etapas/páginas)
  ------------------------------------------------------------ */
  var Pedido = {
    ler: function () { return lerJson(CHAVE_PEDIDO, {}); },
    gravar: function (dados) {
      gravarJson(CHAVE_PEDIDO, Object.assign(Pedido.ler(), dados || {}));
    },
    limpar: function () { gravarJson(CHAVE_PEDIDO, {}); }
  };

  /* ------------------------------------------------------------
     BADGE DO CARRINHO NO HEADER
     Qualquer elemento com [data-cart-count] recebe a quantidade.
  ------------------------------------------------------------ */
  function montarBadge() {
    Carrinho.aoMudar(function () {
      var n = Carrinho.quantidade();
      document.querySelectorAll('[data-cart-count]').forEach(function (el) {
        el.textContent = n;
        el.classList.toggle('vazio', n === 0);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', montarBadge);
  } else {
    montarBadge();
  }

  /* ------------------------------------------------------------
     TOAST "ADICIONADO AO CARRINHO"
  ------------------------------------------------------------ */
  var toastTimer;
  function toast(mensagem, acao) {
    var el = document.getElementById('db-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'db-toast';
      el.className = 'db-toast';
      document.body.appendChild(el);
    }
    el.innerHTML = '<span>' + mensagem + '</span>' +
      (acao ? '<a href="' + acao.href + '">' + acao.texto + '</a>' : '');
    /* força reflow para reiniciar a animação */
    void el.offsetWidth;
    el.classList.add('aberto');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('aberto'); }, 4200);
  }

  /* ------------------------------------------------------------
     API PÚBLICA
  ------------------------------------------------------------ */
  global.Loja = {
    CONFIG: CONFIG,
    PRODUTOS: PRODUTOS,
    VITRINE: VITRINE,
    produto: produto,
    catalogo: catalogo,
    brl: brl,
    digitos: digitos,
    mascaraCep: mascaraCep,
    mascaraTelefone: mascaraTelefone,
    mascaraCpf: mascaraCpf,
    cpfValido: cpfValido,
    emailValido: emailValido,
    Carrinho: Carrinho,
    Pedido: Pedido,
    toast: toast
  };

})(window);
