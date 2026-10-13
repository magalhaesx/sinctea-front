import 'reflect-metadata'
import { criarAplicacao } from './aplicacao.js'

const PORTA = Number(process.env.PORT ?? 3000)

const aplicacao = await criarAplicacao()
await aplicacao.listen(PORTA)
