import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Tela, type ItemDoCaminho } from './LayoutApp'
import { PACIENTES, doPaciente } from './clinica/caminho'
import { Botao } from '../ui/Botao'
import { Titulo } from '../ui/Titulo'
import { EstadoCarregando } from '../ui/EstadoCarregando'
import { EstadoErro } from '../ui/EstadoErro'
import { FolhaTrilha } from '../componentes/FolhaTrilha'
import { TITULO_DA_TRILHA } from '@sinctea/compartilhado/dominio/trilha'
import { ErroServico, servicos, type TrilhaAutonomia as Trilha } from '../servicos'

/**
 * Tela 26 · Trilha de autonomia (item 24; objetivo 5.6 do pre-projeto)
 * /app/clinica/pacientes/:id/trilha · equipe do paciente e coordenacao
 * /app/familia/filhos/:id/trilha · qualquer responsavel vinculado
 *
 * A mesma tela e a mesma folha nas duas areas: so muda a porta da API, a cor
 * e a trilha de navegacao. O que aparece e so o que a equipe ja escreveu no
 * plano vigente — as habilidades dominadas e os cartoes de estrategia —, e
 * nada e gerado aqui (regra 4). A escola nao le a trilha.
 *
 * O PDF e do navegador, por window.print(), como o do relatorio (tela 10b): a
 * folha vai para o papel sem a barra, o menu e os botoes.
 */

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; erro: unknown }
  | { tipo: 'pronto'; trilha: Trilha }

export function TrilhaDeAutonomia({ area }: { area: 'cli' | 'fam' }) {
  const { id = '' } = useParams()
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' })
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    let ativo = true
    setEstado({ tipo: 'carregando' })
    const leitura = area === 'cli' ? servicos.pacientes.obterTrilhaAutonomia(id) : servicos.familia.obterTrilhaAutonomia(id)
    leitura
      .then((trilha) => { if (ativo) setEstado({ tipo: 'pronto', trilha }) })
      .catch((erro) => { if (ativo) setEstado({ tipo: 'erro', erro }) })
    return () => { ativo = false }
  }, [area, id, tentativa])

  const negado = estado.tipo === 'erro' && estado.erro instanceof ErroServico && estado.erro.codigo === 'ACESSO_NEGADO'
  // O nome vem da propria trilha: a tela nao le a ficha so para a navegacao.
  const nome = estado.tipo === 'pronto' ? estado.trilha.nome : null
  const caminho: Array<string | ItemDoCaminho> = area === 'cli'
    ? ['Área clínica', PACIENTES, doPaciente(id, nome), TITULO_DA_TRILHA]
    : [{ rotulo: 'Início', para: '/app/familia' }, TITULO_DA_TRILHA]

  return (
    <Tela area={area} caminho={caminho}>
      <div className="nao-imprimir flex flex-col gap-4">
        <Titulo>{TITULO_DA_TRILHA}</Titulo>
        {estado.tipo === 'pronto' && (
          <div className="flex flex-wrap gap-2">
            <Botao area={area} onClick={() => window.print()} className="w-full sm:w-auto">Imprimir</Botao>
          </div>
        )}
      </div>

      {estado.tipo === 'carregando' && (
        <EstadoCarregando forma="cartoes" quantidade={2} rotulo="Carregando a trilha de autonomia" />
      )}

      {estado.tipo === 'erro' && (
        <EstadoErro
          erro={estado.erro}
          oQue="a trilha de autonomia"
          area={area}
          titulo={negado ? 'Esta trilha não é do seu alcance' : undefined}
          texto={negado
            ? area === 'cli'
              ? 'A trilha é de um paciente que você não acompanha. Se precisar consultá-la, fale com a coordenação da clínica.'
              : 'A trilha é de uma criança que não está vinculada à sua conta. Se for um engano, fale com a clínica.'
            : undefined}
          aoTentarDeNovo={negado ? undefined : () => setTentativa((t) => t + 1)}
        />
      )}

      {estado.tipo === 'pronto' && <FolhaTrilha trilha={estado.trilha} />}
    </Tela>
  )
}
