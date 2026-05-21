CREATE INDEX IF NOT EXISTS idx_votacoes_data
ON grupo4.votacoes_2026 (data);

CREATE INDEX IF NOT EXISTS idx_votacoes_siglaorgao
ON grupo4.votacoes_2026 (siglaorgao);

CREATE INDEX IF NOT EXISTS idx_votos_votacao
ON grupo4.votacoesvotos_2026 (idvotacao);

CREATE INDEX IF NOT EXISTS idx_eventos_datahorainicio
ON grupo4.eventos_2026 (datahorainicio);

CREATE INDEX IF NOT EXISTS idx_proposicoes_ano
ON grupo4.proposicoes_2026 (ano);

CREATE INDEX IF NOT EXISTS idx_temas_codtema
ON grupo4.proposicoestemas_2026 (codtema);
