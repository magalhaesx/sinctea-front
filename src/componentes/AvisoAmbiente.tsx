/**
 * O aviso do ambiente (docs/07, secao 0). Nao e aviso de demonstracao: e o que
 * impede que dado de saude de crianca de verdade entre num sistema academico
 * sem as bases que a lei pede. Fica na tela de entrada e no rodape. Tira-lo e
 * decisao do Lucas com a orientadora.
 */
export const AVISO_AMBIENTE = 'Ambiente acadêmico do TCC SINCTEA. Não cadastre dados de pacientes reais.'

export function RodapeAmbiente() {
  return (
    <footer className="border-t border-cromo-linha px-5 py-3 text-center text-xs text-cromo-tinta2">
      {AVISO_AMBIENTE}
    </footer>
  )
}
