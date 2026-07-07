// api/integracao.js
// Função serverless (Vercel) que recebe os envios dos formulários da SOW Books
// e encaminha cada lead para o ERP Ágil.
//
// Cada formulário no ERP tem seu PRÓPRIO token (X-Form-Token), e é esse token
// que roteia o lead para o funil certo. Por isso usamos um token por tipo.
//
// Endpoint (o mesmo para todos os formulários):
//   POST https://app.erpagil.com/api/public/leads
//   Header: X-Form-Token: {token do formulário}
//   Body: { name (obrigatório), email, phone, ...demais campos }
//
// Variáveis de ambiente (Vercel → Settings → Environment Variables):
//   ERP_API_URL          -> https://app.erpagil.com/api/public/leads
//   ERP_TOKEN_VISITA     -> token do formulário "Solicitação de visita"
//   ERP_TOKEN_CORPORATIVO-> token do formulário corporativo
//   ERP_TOKEN_CONSULTOR  -> token do formulário de candidatura de consultor
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

  const leadERP = {
    name: nome,
    email: dados.email || '',
    phone: dados.whatsapp || '',
    ...dados,
  };

  // ---- Seleciona o token do formulário conforme o tipo ----
  const tokenPorTipo = {
    visita: process.env.ERP_TOKEN_VISITA,
    corporativo: process.env.ERP_TOKEN_CORPORATIVO,
    consultor: process.env.ERP_TOKEN_CONSULTOR,
  };
  const formToken = tokenPorTipo[tipo];

  const erpUrl = process.env.ERP_API_URL;

  // MODO SIMULAÇÃO
  if (!erpUrl) {
    return res.status(200).json({
      ok: true,
      modo: 'simulacao',
      mensagem:
        'ERP_API_URL não configurada. Lead validado e montado, mas não encaminhado. ' +
        'Configure ERP_API_URL e os tokens no Vercel para ativar a integração real.',
      lead: leadERP,
    });
  }

  if (!formToken) {
    return res.status(200).json({
      ok: false,
      modo: 'real',
      erro: `Token do formulário "${tipo}" não configurado no Vercel ` +
            `(variável ERP_TOKEN_${tipo.toUpperCase()}). Adicione-a e faça Redeploy.`,
      lead: leadERP,
    });
  }

  // MODO REAL
  try {
    const resposta = await fetch(erpUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Form-Token': formToken,
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
