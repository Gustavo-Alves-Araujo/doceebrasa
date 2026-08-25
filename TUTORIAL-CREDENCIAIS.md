# Doce e Brasa · Loja online

Guia de configuração das credenciais e do deploy.
Enquanto as chaves não forem preenchidas, a loja funciona em **modo demonstração**:
o frete usa uma tabela estimada e o checkout gera um pedido falso, sem cobrar ninguém.

---

## 1 · Correios — API de Preço e Prazo

> ⚠️ **A API dos Correios não é aberta.** O antigo `ws.correios.com.br/CalcPrecoPrazo`
> foi desativado. A atual (`api.correios.com.br`) exige login no **Meu Correios** +
> um **código de acesso**, e as APIs de Preço/Prazo só são liberadas para quem tem
> **contrato ativo com cartão de postagem**. Como a Doce e Brasa já tem contrato,
> é só gerar o acesso.

### Passo a passo (quem faz: o titular do contrato)

1. Entre em **https://cws.correios.com.br** (Correios Web Services) com o login do
   **Meu Correios** — precisa ser um usuário **administrador** do contrato.
2. No menu, abra **"Gerenciar Acesso à API"** (ou "Meu Código de Acesso").
3. Clique em **Gerar código de acesso**. Ele aparece **uma única vez** — copie e guarde.
4. Ainda no CWS, confira em **"Minhas APIs"** se **Preço** e **Prazo** estão liberadas.
   Se aparecerem como bloqueadas, peça a liberação ao **gestor comercial dos Correios**
   (é uma habilitação por serviço dentro do contrato — não custa nada, mas leva alguns dias).
5. Anote os 4 dados abaixo, que ficam no contrato / no painel do CWS:

| Dado | Onde encontrar | Vai na variável |
|---|---|---|
| Usuário do Meu Correios | o login (CNPJ ou usuário) usado no passo 1 | `CORREIOS_USUARIO` |
| Código de acesso | gerado no passo 3 | `CORREIOS_CODIGO_ACESSO` |
| Número do cartão de postagem | contrato / CWS → "Meus Cartões" | `CORREIOS_CARTAO_POSTAGEM` |
| Número do contrato | contrato / CWS → "Meu Contrato" | `CORREIOS_CONTRATO` |

6. Preencha também o **CEP de onde os pedidos são postados** em `CEP_ORIGEM`.

### Códigos de serviço

O padrão do projeto é `03220:SEDEX,03298:PAC` (códigos **com contrato**).
Se os Correios informarem outros códigos para o contrato de vocês, ajuste
`CORREIOS_SERVICOS` no formato `codigo:Nome,codigo:Nome`.

Sem contrato, os códigos públicos são `04014` (SEDEX) e `04510` (PAC) — mas aí o
preço sai sem desconto.

### Testar antes de ir pra produção

Troque `CORREIOS_API_BASE` para `https://apihom.correios.com.br` e use o login de
homologação (`http://cwshom.correios.com.br`). Depois volte para produção.

---

## 2 · Asaas — pagamento (PIX, boleto e cartão)

### Passo a passo (quem faz: um **administrador** da conta Asaas)

1. Entre em **https://www.asaas.com** e faça login.
2. Clique no **nome da empresa** (canto superior direito) → **Integrações**.
3. Vá em **API** → **Gerar chave de API**.
4. Dê um nome à chave (ex.: `site-docebrasa`) e confirme.
5. **Copie na hora.** A chave aparece uma única vez e começa com `$aact_`.

> É possível ter até 10 chaves, dar nome e data de validade a cada uma, e
> desativar qualquer uma sem invalidar as outras. Se a chave vazar, desative e gere outra.

### Sandbox × Produção

| Ambiente | Onde criar a conta | Prefixo da chave | Endpoint |
|---|---|---|---|
| Sandbox (testes) | https://sandbox.asaas.com | `$aact_hmlg_...` | `https://api-sandbox.asaas.com/v3` |
| Produção | https://www.asaas.com | `$aact_prod_...` | `https://api.asaas.com/v3` |

O código detecta o ambiente pelo prefixo da chave — **não precisa mexer em
`ASAAS_API_BASE`**, a não ser que queira forçar.

**Comece pelo sandbox.** Lá dá para simular pagamento aprovado sem mover dinheiro.

### Webhook (confirmação automática de pagamento)

1. Asaas → **Integrações** → **Webhooks** → **Adicionar**.
2. URL: `https://SEUDOMINIO/api/webhook-asaas`
3. Em "Token de autenticação", coloque um valor secreto qualquer que você inventar.
4. Copie esse mesmo valor para a variável `ASAAS_WEBHOOK_TOKEN`.
5. Marque os eventos de **cobrança** (`PAYMENT_RECEIVED` e `PAYMENT_CONFIRMED`).

---

## 3 · Cadastrar as variáveis na Vercel

**Vercel → o projeto → Settings → Environment Variables.**
Cadastre para **Production** (e Preview, se quiser testar em branch):

```
CORREIOS_USUARIO
CORREIOS_CODIGO_ACESSO
CORREIOS_CARTAO_POSTAGEM
CORREIOS_CONTRATO
CEP_ORIGEM
CORREIOS_SERVICOS
ASAAS_API_KEY
ASAAS_WEBHOOK_TOKEN
SITE_URL
```

Os valores e a explicação de cada um estão em **`.env.example`**.
Depois de salvar, faça um **redeploy** — variáveis novas só valem no próximo build.

> 🔒 Essas chaves ficam **só no servidor**. As funções em `/api` leem elas;
> o navegador do cliente nunca as vê.

### Rodando localmente

```bash
npm i -g vercel      # se ainda não tiver
cp .env.example .env.local   # e preencha
vercel dev
```

---

## 4 · Como saber se funcionou

| Sintoma | O que significa |
|---|---|
| No checkout aparece o aviso amarelo **"Valores simulados"** | As variáveis dos Correios não chegaram na função. Confira o nome delas e refaça o deploy. |
| Sumiu o aviso amarelo e o preço mudou | ✅ API dos Correios respondendo de verdade. |
| A tela de pedido diz **"Pedido simulado"** | `ASAAS_API_KEY` não configurada. |
| O botão "Pagar agora" abre a fatura do Asaas | ✅ Integração de pagamento no ar. |

Erros das funções aparecem em **Vercel → Deployments → o deploy → Functions → Logs**,
com os prefixos `[frete]`, `[checkout]` e `[webhook]`.

---

## 5 · Arquitetura

```
index.html          vitrine (hero + 2 produtos + harmonização + processo + depoimentos)
produto.html?id=    ficha do produto (galeria, ficha técnica, harmonização)
carrinho.html       carrinho + upsell
checkout.html       3 etapas: dados → entrega/frete → pagamento
pedido.html         confirmação + link da fatura

assets/loja.js      catálogo, carrinho (localStorage), máscaras e validações
assets/loja.css     estilos das telas de loja

api/frete.js        Correios: token + preço + prazo (com fallback simulado)
api/checkout.js     Asaas: cria/atualiza cliente e gera a cobrança
api/webhook-asaas.js  recebe a confirmação de pagamento
```

### Onde mexer no preço

O preço fica em **dois lugares** e precisa bater nos dois:

- `assets/loja.js` → objeto `PRODUTOS` (o que o cliente vê)
- `api/checkout.js` → objeto `PRECOS` (o que é cobrado de verdade)

A duplicação é proposital: o servidor recalcula o total do zero, então
alguém adulterar o preço no navegador não muda o valor cobrado.

### Pontos que dependem de informação do cliente

- **Ingredientes, validade e conservação** em `assets/loja.js` estão preenchidos por
  estimativa — confirmar com o rótulo real antes de publicar.
- **Peso bruto** (`pesoBruto: 580` g por pote) e as dimensões da caixa em
  `Carrinho.volume()` alimentam o cálculo de frete. Vale pesar uma caixa real
  e ajustar, senão o frete cobrado sai errado.
- **CPF no checkout** é obrigatório porque o Asaas exige para emitir a cobrança.
- **Frete grátis acima de R$ 199,90** — definido em `loja.js` (`freteGratisAcimaDe`)
  e repetido em `api/checkout.js` (`FRETE_GRATIS_ACIMA_DE`).
