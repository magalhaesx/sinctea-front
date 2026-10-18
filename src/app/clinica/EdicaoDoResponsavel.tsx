import { useState, type FormEvent } from 'react'
import { Botao } from '../../ui/Botao'
import { Campo } from '../../ui/Campo'
import { ErroServico, servicos, type ResponsavelNaFicha } from '../../servicos'

/**
 * Edicao do responsavel na rede de apoio (item 8), pela equipe do paciente
 * ou pela coordenacao. Nome, telefone e parentesco mudam a qualquer momento.
 * O e-mail, so enquanto o primeiro acesso esta pendente: depois, ele e o
 * login da pessoa. Quem responde legalmente aparece, mas nao se edita.
 */
export function EdicaoDoResponsavel({ pacienteId, pessoa, aoSalvar, aoCancelar }: {
  pacienteId: string
  pessoa: ResponsavelNaFicha
  aoSalvar: (editado: ResponsavelNaFicha) => void
  aoCancelar: () => void
}) {
  const [dados, setDados] = useState({ nome: pessoa.nome, email: pessoa.email, telefone: pessoa.telefone, parentesco: pessoa.parentesco })
  const [erros, setErros] = useState<Record<string, string>>({})
  const [ocupado, setOcupado] = useState(false)
  const prefixo = `edicao-${pessoa.responsavelId}`

  const salvar = async (evento: FormEvent) => {
    evento.preventDefault()
    setErros({})
    setOcupado(true)
    try {
      const editado = await servicos.pacientes.editarResponsavel(pacienteId, pessoa.responsavelId, {
        nome: dados.nome, telefone: dados.telefone, parentesco: dados.parentesco,
        // Com a senha definida, o e-mail nem vai: ele e o login da pessoa.
        ...(pessoa.primeiroAcessoPendente ? { email: dados.email } : {}),
      })
      aoSalvar(editado)
    } catch (e) {
      const erro = e as ErroServico
      setErros(erro instanceof ErroServico && Object.keys(erro.campos).length > 0
        ? erro.campos
        : { geral: (erro as Error).message ?? 'Não foi possível salvar agora.' })
    } finally {
      setOcupado(false)
    }
  }

  const campo = 'min-h-11 w-full min-w-0 rounded-lg border-2 border-linha bg-sup px-3 py-2.5 text-tinta'
  const Erro = ({ chave }: { chave: string }) => erros[chave]
    ? <p id={`${prefixo}-${chave}-erro`} className="text-sm font-bold text-cr">{erros[chave]}</p>
    : null
  const descrito = (chave: string) => erros[chave]
    ? { 'aria-describedby': `${prefixo}-${chave}-erro`, 'aria-invalid': true as const }
    : {}
  const texto = (chave: keyof typeof dados, rotulo: string, tipo = 'text', dica?: string) => (
    <Campo id={`${prefixo}-${chave}`} rotulo={rotulo} dica={dica}>
      <input id={`${prefixo}-${chave}`} type={tipo} className={campo} value={dados[chave]} {...descrito(chave)}
        onChange={(e) => setDados((d) => ({ ...d, [chave]: e.target.value }))} />
      <Erro chave={chave} />
    </Campo>
  )

  return (
    <form onSubmit={(e) => void salvar(e)} noValidate className="flex w-full flex-col gap-4 border-t border-linha pt-3">
      <h3 className="text-base font-bold">Editar os dados de {pessoa.nome}</h3>
      {erros.geral && <p role="alert" className="text-sm font-bold text-cr">{erros.geral}</p>}
      <div className="grid gap-3 [&>*]:min-w-0 sm:grid-cols-2">
        {texto('nome', 'Nome')}
        {pessoa.primeiroAcessoPendente
          ? texto('email', 'E-mail', 'email', 'Só se corrige enquanto a pessoa não definiu a senha: depois, é o login dela.')
          : (
            <div className="flex flex-col gap-1">
              <span className="text-sm font-bold">E-mail</span>
              <span className="break-words">{pessoa.email}</span>
              <span className="text-sm text-tinta2">É o login da pessoa, que já definiu a senha: a clínica não o troca.</span>
              <Erro chave="email" />
            </div>
          )}
        {texto('telefone', 'Telefone', 'tel')}
        {texto('parentesco', 'Parentesco', 'text', 'Mãe, pai, avó, tio, madrasta.')}
      </div>
      <p className="text-sm text-tinta2">
        {pessoa.responsavelLegal ? 'Responde legalmente' : 'Não responde legalmente'} por este paciente. Isso não se
        altera depois do cadastro.
      </p>
      <div className="flex flex-wrap gap-2">
        <Botao area="cli" type="submit" disabled={ocupado}>{ocupado ? 'Salvando…' : 'Salvar'}</Botao>
        <Botao area="cli" variante="secundaria" disabled={ocupado} onClick={aoCancelar}>Cancelar</Botao>
      </div>
    </form>
  )
}
