import { useEffect, useState } from 'react'
import { servicos } from '../../servicos'
import type { ItemDoCaminho } from '../LayoutApp'

/**
 * A trilha das telas do paciente: Pacientes › nome do paciente › tela (item 7).
 * Cada passo e um link de volta.
 */
export const PACIENTES: ItemDoCaminho = { rotulo: 'Pacientes', para: '/app/clinica/pacientes' }

export const doPaciente = (pacienteId: string, nome: string | null): ItemDoCaminho =>
  ({ rotulo: nome ?? 'Paciente', para: `/app/clinica/pacientes/${pacienteId}` })

/**
 * O nome do paciente, para a trilha das telas que nao o carregam. E a leitura
 * da ficha, e entra na trilha de auditoria como ela (regra 6). Enquanto nao
 * chega, ou se a leitura falhar, a trilha diz "Paciente". Sem paciente (o
 * filtro vazio da tela 13), nao le nada.
 */
export function usarNomeDoPaciente(pacienteId: string): string | null {
  const [nome, setNome] = useState<string | null>(null)
  useEffect(() => {
    let ativo = true
    setNome(null)
    if (!pacienteId) return
    servicos.pacientes.obter(pacienteId)
      .then((paciente) => { if (ativo) setNome(paciente.nome) })
      .catch(() => { /* a tela mostra o proprio erro; a trilha fica com "Paciente" */ })
    return () => { ativo = false }
  }, [pacienteId])
  return nome
}
