import 'reflect-metadata'
import { existsSync } from 'node:fs'
import { criarAplicacao } from './aplicacao.js'

// Na maquina de desenvolvimento, servidor/.env. No Render, o proprio ambiente.
if (existsSync('.env')) process.loadEnvFile('.env')

const PORTA = Number(process.env.PORT ?? 3000)

const aplicacao = await criarAplicacao()
await aplicacao.listen(PORTA)
