import type { ServicoEscola, ServicoPaciente, ServicoProfissional } from '../contratos'
import type { Paciente, PacienteDetalhe, PacienteResumo, SituacaoPlano } from '../tipos'
import { idadeEmAnos, situacaoConsentimento } from '../../dominio/regras'
import { alcancaClinicamente, exigirPacienteClinico } from './acesso'
import {
  auditar, banco, exigirPerfil, exigirValido, gerarId, paginar, relogio, responder, usuarioPorId,
} from './infra'

const normalizar = (texto: string) =>
  texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

export function situacaoPlanoDe(pacienteId: string): SituacaoPlano {
  return banco.planos.find((p) => p.pacienteId === pacienteId)?.status ?? 'SEM_PLANO'
}

export function ultimaSessaoDe(pacienteId: string): string | null {
  const datas = banco.sessoes
    .filter((s) => s.pacienteId === pacienteId && s.situacao === 'ENCERRADA' && s.inicio)
    .map((s) => s.inicio!)
    .sort()
  return datas[datas.length - 1] ?? null
}

function resumo(p: Paciente): PacienteResumo {
  const responsavel = usuarioPorId(p.profissionalResponsavelId)
  return {
    id: p.id,
    nome: p.nome,
    idade: idadeEmAnos(p.dataNascimento, relogio.agora()),
    nivelSuporte: p.nivelSuporte,
    profissionalResponsavel: { id: p.profissionalResponsavelId, nome: responsavel?.nome ?? '—' },
    situacaoPlano: situacaoPlanoDe(p.id),
    ultimaSessaoEm: ultimaSessaoDe(p.id),
  }
}

function detalhe(p: Paciente): PacienteDetalhe {
  const agora = relogio.agora()
  return {
    ...p,
    idade: idadeEmAnos(p.dataNascimento, agora),
    redeApoio: banco.vinculosFamiliares
      .filter((v) => v.pacienteId === p.id)
      .map((v) => {
        const resp = banco.responsaveis.find((u) => u.id === v.responsavelId)
        return { ...v, nome: resp?.nome ?? '—', telefone: resp?.telefone ?? '' }
      }),
    equipe: p.equipeIds.map((id) => {
      const prof = banco.profissionais.find((u) => u.id === id)
      return { id, nome: prof?.nome ?? '—', especialidade: prof?.especialidade ?? '' }
    }),
    vinculosEscolares: banco.vinculos
      .filter((v) => v.pacienteId === p.id)
      .map((v) => {
        const c = banco.consentimentos.find((x) => x.id === v.consentimentoId)!
        return {
          vinculoId: v.id,
          escola: banco.escolas.find((e) => e.id === v.escolaId)?.nome ?? '—',
          turma: v.turma,
          turno: v.turno,
          professor: banco.professores.find((u) => u.id === v.professorId)?.nome ?? '—',
          situacaoConsentimento: situacaoConsentimento(c, agora),
        }
      }),
    situacaoPlano: situacaoPlanoDe(p.id),
    totalSessoes: banco.sessoes.filter((s) => s.pacienteId === p.id && s.situacao === 'ENCERRADA').length,
    ultimaSessaoEm: ultimaSessaoDe(p.id),
  }
}

export const pacientesMock: ServicoPaciente = {
  listar: (filtro = {}) => responder(() => {
    const sessao = exigirPerfil(['TERAPEUTA', 'COORDENADOR'], 'Paciente')
    const busca = filtro.busca ? normalizar(filtro.busca.trim()) : ''
    const itens = banco.pacientes
      .filter((p) => p.ativo && alcancaClinicamente(sessao, p))
      .filter((p) => !busca || normalizar(p.nome).includes(busca))
      .filter((p) => !filtro.profissionalId || p.profissionalResponsavelId === filtro.profissionalId)
      .filter((p) => !filtro.nivelSuporte || p.nivelSuporte === filtro.nivelSuporte)
      .filter((p) => !filtro.situacaoPlano || situacaoPlanoDe(p.id) === filtro.situacaoPlano)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      .map(resumo)
    return paginar(itens, filtro)
  }),

  obter: (id) => responder(() => {
    const { sessao, paciente } = exigirPacienteClinico(id, 'Paciente')
    auditar(sessao, { acao: 'LEITURA_AUTORIZADA', entidade: 'Paciente', idEntidade: id, pacienteId: id, detalhe: 'Ficha do paciente.' })
    return detalhe(paciente)
  }),

  criar: (dados) => responder(() => {
    const sessao = exigirPerfil(['TERAPEUTA', 'COORDENADOR'], 'Paciente')
    const erros: Record<string, string> = {}
    if (!dados.nome.trim()) erros.nome = 'Informe o nome do paciente.'
    if (Number.isNaN(Date.parse(dados.dataNascimento))) erros.dataNascimento = 'Informe a data de nascimento.'
    if (![1, 2, 3].includes(dados.nivelSuporte)) erros.nivelSuporte = 'Escolha o nível de suporte.'
    if (!banco.profissionais.some((p) => p.id === dados.profissionalResponsavelId)) {
      erros.profissionalResponsavelId = 'Escolha o profissional responsável.'
    }
    exigirValido(erros)
    const paciente: Paciente = {
      id: gerarId('p'),
      nome: dados.nome.trim(),
      dataNascimento: dados.dataNascimento,
      nivelSuporte: dados.nivelSuporte,
      profissionalResponsavelId: dados.profissionalResponsavelId,
      equipeIds: [...new Set([dados.profissionalResponsavelId, sessao.usuario.id])]
        .filter((id) => banco.profissionais.some((p) => p.id === id)),
      ativo: true,
    }
    banco.pacientes.push(paciente)
    auditar(sessao, { acao: 'CRIACAO', entidade: 'Paciente', idEntidade: paciente.id, pacienteId: paciente.id, detalhe: 'Cadastro de paciente.' })
    return detalhe(paciente)
  }),
}

export const profissionaisMock: ServicoProfissional = {
  listar: (filtro = {}) => responder(() => {
    exigirPerfil(['TERAPEUTA', 'COORDENADOR', 'ADMINISTRADOR'], 'Profissional')
    const busca = filtro.busca ? normalizar(filtro.busca) : ''
    const itens = banco.profissionais
      .filter((p) => p.ativo && (!busca || normalizar(p.nome).includes(busca)))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    return paginar(itens, filtro)
  }),
}

export const escolasMock: ServicoEscola = {
  listar: (filtro = {}) => responder(() => {
    exigirPerfil(['TERAPEUTA', 'COORDENADOR', 'ADMINISTRADOR', 'RESPONSAVEL'], 'Escola')
    return paginar([...banco.escolas].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), filtro)
  }),
}
