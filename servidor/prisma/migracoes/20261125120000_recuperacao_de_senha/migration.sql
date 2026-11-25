-- Item 23: "Esqueci minha senha". O link de definir senha ganha a terceira
-- finalidade, a recuperacao que a propria pessoa pede pelo e-mail, sem passar
-- pela clinica. Vale 1 hora, e de uso unico e nao tem autor: o CHECK
-- acesso_inicial_nova_senha_com_autor ja exige geradoPorId nulo fora de
-- NOVA_SENHA, e o acesso_inicial_ciencia_depois_do_uso, a ciencia so na
-- NOVA_SENHA — a recuperacao nao tem o aviso "redefinida pela clinica".

-- AlterEnum
ALTER TYPE "finalidade_acesso" ADD VALUE 'RECUPERACAO';
