/**
 * O aviso do ambiente (docs/07, secao 0). Nao e aviso de demonstracao: e o que
 * impede que dado de saude de crianca de verdade entre num sistema academico
 * sem as bases que a lei pede. Fica no rodape do app, onde os dados se
 * cadastram; saiu das telas de acesso (entrar, convite, definir senha) por
 * decisao do Lucas em 25/10/2026. Tira-lo do rodape e decisao do Lucas com a
 * orientadora.
 */
export const AVISO_AMBIENTE = 'Ambiente acadêmico do TCC SINCTEA. Não cadastre dados de pacientes reais.'

export function RodapeAmbiente() {
  return (
    <footer className="border-t border-cromo-linha px-5 py-3 text-center text-xs text-cromo-tinta2">
      {AVISO_AMBIENTE}
    </footer>
  )
}
