import { NestFactory } from '@nestjs/core'
import type { INestApplication, NestApplicationOptions } from '@nestjs/common'
import { ModuloAplicacao } from './modulo-aplicacao.js'

/**
 * Monta o servidor sem abrir porta. O main.ts e os testes chamam a mesma
 * funcao: o que o teste confere e o que vai ao ar.
 */
export async function criarAplicacao(opcoes: NestApplicationOptions = {}): Promise<INestApplication> {
  const aplicacao = await NestFactory.create(ModuloAplicacao, opcoes)
  // docs/07, D3: front e API no mesmo endereco. A API mora em /api.
  aplicacao.setGlobalPrefix('api')
  return aplicacao
}
