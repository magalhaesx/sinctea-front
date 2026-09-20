import { Link } from 'react-router-dom'
import { Tela } from '../LayoutApp'
import { DEMONSTRACAO } from '../perfis'
import { Aviso, Botao, Etiqueta, Titulo } from '../../componentes/ui'

const agenda = [
  { hora: '08h00', nome: 'Miguel Santana', idade: 7, estado: 'concluida' as const },
  { hora: '09h00', nome: 'Helena Duarte', idade: 5, estado: 'concluida' as const },
  { hora: '14h00', nome: 'Rafael Lins', idade: 9, estado: 'aberta' as const },
  { hora: '15h00', nome: 'Bruna Alencar', idade: 6, estado: 'agendada' as const },
]

export function PainelClinica() {
  return (
    <Tela area="cli" nome="Ana Lúcia Ferraz" papel="Terapeuta ocupacional · CREFITO 12345-TO" caminho={['Início']}>
      <Titulo sub="Quatro atendimentos hoje · 1 aviso novo">Segunda-feira, 14 de setembro</Titulo>

      <Aviso tom="at" titulo="A escola registrou uma ocorrência">
        <p>Miguel S. · ontem, 14h20 · relatado por Prof.ª Carla Nunes (EMEF Jardim das Palmeiras)</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Botao area="cli">Ver a ocorrência</Botao>
          <Botao area="cli" variante="secundaria">Marcar como lida</Botao>
        </div>
      </Aviso>

      <section aria-labelledby="h-agenda">
        <h2 id="h-agenda" className="mb-3 text-lg font-bold">Agenda de hoje</h2>
        <ul className="flex flex-col gap-2.5">
          {agenda.map((a) => (
            <li key={a.hora} className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-linha bg-sup px-3.5 py-3">
              <span>
                <b className="tabular-nums">{a.hora}</b> · {a.nome}{' '}
                <span className="text-sm text-tinta2">— {a.idade} anos</span>
              </span>
              {a.estado === 'concluida' && <Etiqueta tom="ok" simbolo="✓">Concluída</Etiqueta>}
              {a.estado === 'agendada' && <Etiqueta simbolo="○">Agendada</Etiqueta>}
              {a.estado === 'aberta' && (
                <span className="flex flex-wrap items-center gap-2.5">
                  <Etiqueta tom="at" simbolo="●">Em aberto</Etiqueta>
                  <Link to={`/app/clinica/pacientes/${DEMONSTRACAO.paciente}/sessao`}>
                    <Botao area="cli">Iniciar sessão</Botao>
                  </Link>
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <Aviso titulo="3 registros aguardando sincronização">
        Foram feitos sem conexão e serão enviados assim que a rede voltar. Nada se perde — você pode
        continuar registrando normalmente.
      </Aviso>

      <div className="flex flex-wrap gap-2">
        <Link to={`/app/clinica/pacientes/${DEMONSTRACAO.paciente}/plano`}><Botao area="cli" variante="secundaria">Abrir o plano do Miguel</Botao></Link>
        <Link to={`/app/clinica/pacientes/${DEMONSTRACAO.paciente}/evolucao`}><Botao area="cli" variante="secundaria">Ver evolução por objetivo</Botao></Link>
      </div>
    </Tela>
  )
}
