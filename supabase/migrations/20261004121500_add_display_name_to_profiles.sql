-- Separa o "nome de exibição" (apelido livre, usado no site público)
-- do "nome completo" (full_name), que permanece reservado ao nome legal
-- usado na Carteira para titularidade de saques/PIX.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name text;

COMMENT ON COLUMN public.profiles.display_name IS
  'Nome de exibição opcional (apelido) mostrado no site público. Quando nulo, o nome legal (full_name) é usado como fallback.';
COMMENT ON COLUMN public.profiles.full_name IS
  'Nome completo legal. Usado para titularidade de recebimento/PIX na Carteira. Trava após a carteira ser ativada (cpf_cnpj preenchido).';
