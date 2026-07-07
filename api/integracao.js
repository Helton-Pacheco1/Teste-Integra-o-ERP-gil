// api/integracao.js
// Função serverless (Vercel) que recebe os envios dos formulários da SOW Books
// e encaminha cada lead para o ERP.
//
// Autenticação: o ERP aceita DOIS headers possíveis —
//   X-Form-Token  -> token por formulário (Gestão Comercial → Formulários)
//   X-API-Token   -> token por empresa (legado)
// Para não depender de adivinhar qual é, enviamos o mesmo token nos dois
// headers. O ERP usa o que reconhecer e ignora o outro.
//
// Variáveis de ambiente (Vercel → Settings → Environment Variables):
//   ERP_API_URL    -> ex: https://SEUDOMINIO.com/api/public/leads
//   ERP_API_TOKEN  -> o token gerado no ERP (de formulário OU de empresa)
//
// Sem ERP_API_URL, roda em MODO SIMULAÇÃO (valida sem encaminhar).

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, erro: 'Use o método POST.' });
  }

  const { tipo, dados } = req.body || {};

  const tiposValidos = ['visita', 'corporativo', 'consultor'];
  if (!tipo || !tiposValidos.includes(tipo)) {
    return res.status(400).json({
      ok: false,
      erro: `Campo "tipo" obrigatório. Valores aceitos: ${tiposValidos.join(', ')}.`,
    });
  }
  if (!dados || typeof dados !== 'object' || Object.keys(dados).length === 0) {
    return res.status(400).json({ ok: false, erro: 'Campo "dados" vazio ou ausente.' });
  }

  // ---- Mapeia os campos do formulário para o formato do ERP ----
  const nome = dados.nome || dados.responsavel || '';
  if (!nome) {
    return res.status(400).json({ ok: false, erro: 'Nome do lead ausente (o ERP exige "name").' });
  }

  const sourcePorTipo = {
    visita: 'site-solicitacao-visita',
    corporativo: 'site-corporativo',
    consultor: 'site-candidatura-consultor',
  };

  const leadERP = {
    name: nome,
    email: dados.email || '',
    phone: dados.whatsapp || '',
    source: sourcePorTipo[tipo],
    ...dados,
  };

  const erpUrl = process.env.ERP_API_URL;
  const erpToken = process.env.ERP_API_TOKEN;

  // MODO SIMULAÇÃO
  if (!erpUrl) {
    return res.status(200).json({
      ok: true,
      modo: 'simulacao',
      mensagem:
        'ERP_API_URL não configurada. Lead validado e montado, mas não encaminhado. ' +
        'Configure ERP_API_URL e ERP_API_TOKEN no Vercel para ativar a integração real.',
      lead: leadERP,
    });
  }

  if (!erpToken) {
    return res.status(200).json({
      ok: false,
      modo: 'real',
      erro: 'ERP_API_TOKEN não configurada no Vercel. Adicione a variável e faça Redeploy.',
      lead: leadERP,
    });
  }

  // MODO REAL — envia o token nos dois headers aceitos pelo ERP
  try {
    const resposta = await fetch(erpUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Form-Token': erpToken,
        'X-API-Token': erpToken,
      },
      body: JSON.stringify(leadERP),
    });

    const texto = await resposta.text();
    let corpo;
    try { corpo = JSON.parse(texto); } catch { corpo = texto; }

    if (!resposta.ok) {
      return res.status(resposta.status).json({
        ok: false,
        modo: 'real',
        erro: `ERP respondeu com status ${resposta.status}.`,
        resposta_erp: corpo,
        lead: leadERP,
      });
    }

    return res.status(200).json({
      ok: true,
      modo: 'real',
      mensagem: 'Lead enviado ao ERP com sucesso.',
      resposta_erp: corpo,
      lead: leadERP,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      modo: 'real',
      erro: `Falha ao conectar com o ERP: ${err.message}`,
      lead: leadERP,
    });
  }
}
