/**
 * O primeiro foco de toda tela (WCAG 2.4.1, Ignorar blocos): leva ao
 * <main id="conteudo" tabIndex={-1}> dos dois layouts.
 *
 * Item 25: com o HashRouter, o href="#conteudo" sozinho trocava a rota — o
 * "#conteudo" virava o endereco de uma tela que nao existe, o app voltava ao
 * inicio e o foco caia no corpo da pagina. O link continua com o href, para
 * dizer aonde leva, mas o clique (e o Enter) so move o foco, sem navegar.
 */
export function PularParaOConteudo() {
  return (
    <a
      className="pular"
      href="#conteudo"
      onClick={(evento) => {
        evento.preventDefault()
        document.getElementById('conteudo')?.focus()
      }}
    >
      Pular para o conteúdo
    </a>
  )
}
