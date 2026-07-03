// api/integracao.js
// Função serverless (Vercel) que recebe os envios dos formulários
// e encaminha o payload para o ERP Ágil.
//
// Variáveis de ambiente (configurar no painel do Vercel):
//   ERP_API_URL  -> endpoint do ERP que recebe os dados (ex: https://api.erpagil.com/v1/integracao)
//   ERP_API_KEY  -> chave/token de autenticação (enviada como Bearer token)
//
// Sem ERP_API_URL configurada, a função opera em MODO SIMULAÇÃO:
// valida e devolve o payload sem encaminhar, para você testar o front antes.

export default async function handler(req, res) {
  // CORS básico (permite testar de outros domínios se precisar)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

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

  const payload = {
    origem: 'teste-integracao-vercel',
    tipo,
    dados,
    recebido_em: new Date().toISOString(),
  };

  const erpUrl = process.env.ERP_API_URL;
  const erpKey = process.env.ERP_API_KEY;

  // MODO SIMULAÇÃO: sem endpoint configurado, apenas ecoa o payload
  if (!erpUrl) {
    return res.status(200).json({
      ok: true,
      modo: 'simulacao',
      mensagem:
        'ERP_API_URL não configurada. Payload validado, mas não encaminhado. ' +
        'Configure as variáveis de ambiente no Vercel para ativar a integração real.',
      payload,
    });
  }

  // MODO REAL: encaminha ao ERP
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (erpKey) headers['Authorization'] = `Bearer ${erpKey}`;

    const resposta = await fetch(erpUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const texto = await resposta.text();
    let corpo;
    try {
      corpo = JSON.parse(texto);
    } catch {
      corpo = texto;
    }

    if (!resposta.ok) {
      return res.status(502).json({
        ok: false,
        modo: 'real',
        erro: `ERP respondeu com status ${resposta.status}.`,
        resposta_erp: corpo,
        payload,
      });
    }

    return res.status(200).json({
      ok: true,
      modo: 'real',
      mensagem: 'Payload encaminhado ao ERP com sucesso.',
      resposta_erp: corpo,
      payload,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      modo: 'real',
      erro: `Falha ao conectar com o ERP: ${err.message}`,
      payload,
    });
  }
}
