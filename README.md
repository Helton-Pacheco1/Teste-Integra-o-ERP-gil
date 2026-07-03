# Teste de integração — ERP Ágil

Página web com 3 formulários (cliente, processo, financeiro) que enviam os dados
para uma função serverless (`/api/integracao`), que por sua vez encaminha o
payload ao ERP Ágil. Pronto para deploy no Vercel, sem build.

## Estrutura

```
├── index.html            # Página com os 3 formulários + console de integração
├── api/
│   └── integracao.js     # Função serverless que encaminha ao ERP
└── vercel.json
```

## Deploy no Vercel

**Opção A — via GitHub (recomendado)**
1. Crie um repositório e suba estes arquivos.
2. No Vercel: **Add New → Project → Import** o repositório.
3. Framework preset: **Other**. Não precisa de build command.
4. Deploy.

**Opção B — via CLI**
```bash
npm i -g vercel
cd erpagil-teste-integracao
vercel --prod
```

## Variáveis de ambiente (Vercel → Settings → Environment Variables)

| Variável      | Descrição                                                        |
|---------------|------------------------------------------------------------------|
| `ERP_API_URL` | Endpoint do ERP que recebe os dados (ex: webhook ou rota da API) |
| `ERP_API_KEY` | Token de autenticação — enviado como `Authorization: Bearer ...` |

Sem `ERP_API_URL`, a aplicação roda em **modo simulação**: valida e devolve o
payload sem encaminhar, para você testar o front antes de plugar o ERP.
Depois de adicionar/alterar variáveis, faça um **redeploy**.

## Formato do payload enviado ao ERP

```json
{
  "origem": "teste-integracao-vercel",
  "tipo": "cliente | processo | financeiro",
  "dados": { "...campos do formulário..." },
  "recebido_em": "2026-07-03T14:00:00.000Z"
}
```

## Testando direto por cURL

```bash
curl -X POST https://SEU-PROJETO.vercel.app/api/integracao \
  -H "Content-Type: application/json" \
  -d '{"tipo":"cliente","dados":{"nome":"Teste","documento":"000","email":"t@t.com"}}'
```
