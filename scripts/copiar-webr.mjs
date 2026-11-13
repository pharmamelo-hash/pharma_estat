// Copia os arquivos de execução do webR para public/webr (servidos pelo próprio site).
// Roda antes do build. Não copia testes, REPL, mapas de depuração nem tipos.
import { cpSync, rmSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const origem = 'node_modules/webr/dist';
const destino = 'public/webr';
const ARQUIVOS = ['R.js', 'R.wasm', 'webr-worker.js', 'libRblas.so', 'libRlapack.so'];

if (!existsSync(origem)) throw new Error('webR não instalado: rode npm install.');
rmSync(destino, { recursive: true, force: true });
mkdirSync(destino, { recursive: true });
for (const a of ARQUIVOS) cpSync(join(origem, a), join(destino, a));
cpSync(join(origem, 'vfs'), join(destino, 'vfs'), { recursive: true });

const contar = (dir) => readdirSync(dir).reduce((s, f) => {
  const p = join(dir, f); const st = statSync(p);
  return st.isDirectory() ? { n: s.n + contar(p).n, b: s.b + contar(p).b } : { n: s.n + 1, b: s.b + st.size };
}, { n: 0, b: 0 });
const { n, b } = contar(destino);
console.log(`webR copiado: ${n} arquivos, ${(b / 1048576).toFixed(1)} MB`);
