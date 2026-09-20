import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Tela } from '../LayoutApp'
import { Botao, BotaoLink } from '../../ui/Botao'
import { Campo } from '../../ui/Campo'
import { Cartao } from '../../ui/Cartao'
import { Titulo } from '../../ui/Titulo'
import { usarSessao } from '../../contexto/Sessao'
import { descricaoNivelSuporte } from '../../dominio/regras'
import { ErroServico, servicos, type NivelSuporte, type Profissional } from '../../servicos'

/**
 * Tela 4b · Cadastrar paciente · /app/clinica/pacientes/novo (UC01)
 *
 * O erro de validacao do servico aparece no proprio campo, ligado por
 * aria-describedby, e nao so num aviso no topo — WCAG 3.3.1 / e-MAG 6.6.
 */

const NIVEIS: NivelSuporte[] = [1, 2, 3]

export function NovoPaciente() {
  const { usuario, perfilAtivo } = usarSessao()
  const navegar = useNavigate()
  const primeiroCampo = useRef<HTMLInputElement>(null)

  const [profissionais, setProfissionais] = useState<Profissional[]>([])
  const [nome, setNome] = useState('')
  const [dataNascimento, setDataNascimento] = useState('')
  const [nivelSuporte, setNivelSuporte] = useState('')
  // Quem cadastra sendo terapeuta ja vem como responsavel pelo caso, e pode trocar.
  const [profissionalResponsavelId, setProfissionalResponsavelId] = useState(
    perfilAtivo === 'TERAPEUTA' ? usuario?.id ?? '' : '',
  )
  const [erros, setErros] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    let ativo = true
    servicos.profissionais.listar({ porPagina: 100 })
      .then((p) => { if (ativo) setProfissionais(p.itens) })
      .catch(() => { if (ativo) setProfissionais([]) })
    return () => { ativo = false }
  }, [])

  const enviar = async (evento: FormEvent) => {
    evento.preventDefault()
    setErros({})
    setSalvando(true)
    try {
      const criado = await servicos.pacientes.criar({
        nome,
        dataNascimento,
        nivelSuporte: Number(nivelSuporte) as NivelSuporte,
        profissionalResponsavelId,
      })
      navegar(`/app/clinica/pacientes/${criado.id}`, { replace: true })
    } catch (e) {
      const erro = e as ErroServico
      setErros(erro instanceof ErroServico && Object.keys(erro.campos).length > 0
        ? erro.campos
        : { geral: erro.message ?? 'Não foi possível cadastrar agora.' })
      primeiroCampo.current?.focus()
    } finally {
      setSalvando(false)
    }
  }

  const campo = 'min-h-11 w-full rounded-lg border-2 border-linha bg-sup px-3 py-2.5 text-tinta'
  const erroDe = (chave: string) => erros[chave]
    ? { 'aria-describedby': `${chave}-erro`, 'aria-invalid': true as const }
    : {}
  const Erro = ({ chave }: { chave: string }) => erros[chave]
    ? <p id={`${chave}-erro`} className="text-sm font-bold text-cr">{erros[chave]}</p>
    : null

  return (
    <Tela area="cli" caminho={['Área clínica', 'Pacientes', 'Cadastrar paciente']} estreito>
      <Titulo sub="Os dados de identificação. O plano terapêutico vem depois, na ficha.">
        Cadastrar paciente
      </Titulo>

      <Cartao>
        <form className="flex flex-col gap-4" onSubmit={enviar} noValidate>
          <div role="alert" aria-live="assertive">
            {erros.geral && (
              <p className="rounded-xl border border-linha border-l-4 border-l-cr bg-cr-sup p-3 font-bold text-cr">
                <span aria-hidden="true">▲ </span>{erros.geral}
              </p>
            )}
          </div>

          <Campo id="nome" rotulo="Nome completo">
            <input ref={primeiroCampo} id="nome" type="text" className={campo}
              value={nome} onChange={(e) => setNome(e.target.value)} {...erroDe('nome')} />
            <Erro chave="nome" />
          </Campo>

          <Campo id="dataNascimento" rotulo="Data de nascimento">
            <input id="dataNascimento" type="date" className={campo}
              value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)}
              {...erroDe('dataNascimento')} />
            <Erro chave="dataNascimento" />
          </Campo>

          <Campo id="nivelSuporte" rotulo="Nível de suporte" dica="Conforme o DSM-5-TR, registrado no laudo.">
            <select id="nivelSuporte" className={campo} value={nivelSuporte}
              onChange={(e) => setNivelSuporte(e.target.value)} {...erroDe('nivelSuporte')}>
              <option value="">Escolha o nível</option>
              {NIVEIS.map((n) => <option key={n} value={n}>{descricaoNivelSuporte(n)}</option>)}
            </select>
            <Erro chave="nivelSuporte" />
          </Campo>

          <Campo id="profissionalResponsavelId" rotulo="Profissional responsável pelo caso">
            <select id="profissionalResponsavelId" className={campo} value={profissionalResponsavelId}
              onChange={(e) => setProfissionalResponsavelId(e.target.value)}
              {...erroDe('profissionalResponsavelId')}>
              <option value="">Escolha o profissional</option>
              {profissionais.map((p) => (
                <option key={p.id} value={p.id}>{p.nome} · {p.especialidade}</option>
              ))}
            </select>
            <Erro chave="profissionalResponsavelId" />
          </Campo>

          <div className="flex flex-wrap gap-2">
            <Botao area="cli" type="submit" disabled={salvando}>
              {salvando ? 'Cadastrando…' : 'Cadastrar paciente'}
            </Botao>
            <BotaoLink para="/app/clinica/pacientes" area="cli" variante="secundaria">Cancelar</BotaoLink>
          </div>
        </form>
      </Cartao>
    </Tela>
  )
}
