/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Endereco da API real. Ausente: usa a implementacao simulada. */
  readonly VITE_API_URL?: string
  /** Probabilidade de falha do mock, de 0 a 1. Ex.: 0.1 falha 10% das chamadas. */
  readonly VITE_MOCK_FALHA?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
