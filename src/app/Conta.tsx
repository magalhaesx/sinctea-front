import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Botao } from '../ui/Botao'
import { Cartao } from '../ui/Cartao'
import { Titulo } from '../ui/Titulo'
import { usarPreferencias, type Preferencias } from '../contexto/Preferencias'
import { usarSessao } from '../contexto/Sessao'
import type { Perfil } from '../servicos'
import { Tela } from './LayoutApp'
import { AREA_DO_PERFIL, NOME_DO_PERFIL, PAINEL_DO_PERFIL } from './perfis'

/**
 * Tela 21 · Perfil e preferências · /app/conta
 *
 * Dados da conta, troca do perfil ativo quando ha mais de um, preferencias
 * sensoriais persistidas e sair.
 */

const PREFERENCIAS: { chave: keyof Preferencias; rotulo: string; efeito: string }[] = [
  { chave: 'textoMaior', rotulo: 'Texto maior', efeito: 'Amplia todo o texto em 22%, sem quebrar o leiaute.' },
  { chave: 'altoContraste', rotulo: 'Alto contraste', efeito: 'Troca as cores por um conjunto de contraste mais alto.' },
  { chave: 'semAnimacao', rotulo: 'Reduzir animação', efeito: 'Zera as transições e as animações da interface.' },
]

export function Conta() {
  const { usuario, perfilAtivo, trocarPerfil, sair } = usarSessao()
  const prefs = usarPreferencias()
  const navegar = useNavigate()
  const [aviso, setAviso] = useState<string | null>(null)
  const [trocando, setTrocando] = useState(false)

  if (!usuario || !perfilAtivo) return null

  const trocar = async (perfil: Perfil) => {
    setTrocando(true)
    try {
      await trocarPerfil(perfil)
      setAviso(`Perfil ativo agora: ${NOME_DO_PERFIL[perfil]}.`)
    } catch {
      setAviso('Não foi possível trocar de perfil agora. Tente de novo em alguns segundos.')
    } finally {
      setTrocando(false)
    }
  }

  const encerrar = async () => {
    await sair()
    navegar('/app/entrar', { replace: true })
  }

  return (
    <Tela
      area={AREA_DO_PERFIL[perfilAtivo]}
      nome={usuario.nome}
      papel={NOME_DO_PERFIL[perfilAtivo]}
      caminho={['Apoio', 'Perfil e preferências']}
      estreito
    >
      <Titulo sub="Seus dados, o perfil com que você está trabalhando e o ajuste da interface">
        Perfil e preferências
      </Titulo>

      <Cartao>
        <h2 className="text-lg font-bold">Dados da conta</h2>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[15px]">
          <dt className="font-bold">Nome</dt><dd>{usuario.nome}</dd>
          <dt className="font-bold">E-mail</dt><dd className="break-words">{usuario.email}</dd>
          <dt className="font-bold">Perfis</dt>
          <dd>{usuario.perfis.map((p) => NOME_DO_PERFIL[p]).join(' · ')}</dd>
        </dl>
      </Cartao>

      <Cartao>
        <h2 className="text-lg font-bold">Perfil ativo</h2>
        {usuario.perfis.length > 1 ? (
          <>
            <p className="mt-1 text-sm text-tinta2">
              Você tem mais de um perfil. O perfil ativo define as telas que aparecem no menu.
            </p>
            <fieldset className="mt-3 flex flex-col gap-2" disabled={trocando}>
              <legend className="sr-only">Escolha o perfil ativo</legend>
              {usuario.perfis.map((perfil) => (
                <label
                  key={perfil}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-linha bg-sup px-3 py-2"
                >
                  <input
                    type="radio"
                    name="perfil"
                    className="h-5 w-5"
                    checked={perfil === perfilAtivo}
                    onChange={() => void trocar(perfil)}
                  />
                  <span className="font-bold">{NOME_DO_PERFIL[perfil]}</span>
                </label>
              ))}
            </fieldset>
            <p className="mt-3">
              <Botao
                variante="secundaria"
                area={AREA_DO_PERFIL[perfilAtivo]}
                onClick={() => navegar(PAINEL_DO_PERFIL[perfilAtivo])}
              >
                Ir para o painel de {NOME_DO_PERFIL[perfilAtivo].toLowerCase()}
              </Botao>
            </p>
          </>
        ) : (
          <p className="mt-1 text-[15px]">
            Sua conta tem um perfil: <b>{NOME_DO_PERFIL[perfilAtivo]}</b>.
          </p>
        )}
        <p role="status" aria-live="polite" className="mt-3 text-sm text-tinta2">{aviso}</p>
      </Cartao>

      <Cartao>
        <h2 className="text-lg font-bold">Preferências de leitura</h2>
        <p className="mt-1 text-sm text-tinta2">
          Ficam guardadas neste aparelho e valem para todas as telas, inclusive a de entrada.
        </p>
        <ul className="mt-3 flex flex-col gap-2">
          {PREFERENCIAS.map(({ chave, rotulo, efeito }) => (
            <li key={chave}>
              <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-linha bg-sup px-3 py-2.5">
                <input
                  type="checkbox"
                  className="mt-0.5 h-5 w-5"
                  checked={prefs[chave]}
                  onChange={() => prefs.alternar(chave)}
                />
                <span>
                  <span className="block font-bold">{rotulo}</span>
                  <span className="block text-sm text-tinta2">{efeito}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </Cartao>

      <Cartao>
        <h2 className="text-lg font-bold">Sair</h2>
        <p className="mt-1 text-sm text-tinta2">
          Encerra a sessão neste aparelho. Nada do que você registrou se perde.
        </p>
        <p className="mt-3"><Botao variante="secundaria" area={AREA_DO_PERFIL[perfilAtivo]} onClick={encerrar}>Sair da conta</Botao></p>
      </Cartao>
    </Tela>
  )
}
