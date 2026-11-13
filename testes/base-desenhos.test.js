// Integridade da base de desenhos (Doc 7.4): toda entrada completa, com referência existente.
import { describe, it, expect } from 'vitest';
import desenhos from '../base/desenhos.json';
import referencias from '../base/referencias.json';

const idsRefs = new Set(referencias.referencias.map((r) => r.id));
const idsCategorias = new Set(desenhos.categorias.map((c) => c.id));
const niveis = new Set(Object.keys(desenhos.escala_forca_causal));
const CAMPOS_TEXTO = ['nome', 'definicao', 'quando_usar', 'exemplo_saude', 'temporalidade', 'unidade_analise'];
const CAMPOS_LISTA = ['medidas', 'vantagens', 'limitacoes', 'vieses', 'analises_tipicas', 'refs'];

describe('referências', () => {
  it('ids únicos e com prefixo r_', () => {
    const ids = referencias.referencias.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id) => expect(id).toMatch(/^r_/));
  });
  it('toda referência tem citação e status de conferência', () => {
    referencias.referencias.forEach((r) => {
      expect(r.citacao?.length, r.id).toBeGreaterThan(20);
      expect(r.conferida === 'pendente' || /^\d{4}-\d{2}-\d{2}$/.test(r.conferida), r.id).toBe(true);
    });
  });
});

describe('desenhos', () => {
  it('ids únicos e com prefixo d_', () => {
    const ids = desenhos.desenhos.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id) => expect(id).toMatch(/^d_/));
  });

  it.each(desenhos.desenhos.map((d) => [d.id, d]))('%s está completo e coerente', (_id, d) => {
    CAMPOS_TEXTO.forEach((c) => expect(typeof d[c] === 'string' && d[c].length > 3, `${d.id}.${c}`).toBe(true));
    CAMPOS_LISTA.forEach((c) => expect(Array.isArray(d[c]) && d[c].length > 0, `${d.id}.${c}`).toBe(true));
    expect(typeof d.intervencao_do_pesquisador).toBe('boolean');
    expect(idsCategorias.has(d.categoria), `${d.id}: categoria ${d.categoria}`).toBe(true);
    expect(niveis.has(d.forca_causal), `${d.id}: força ${d.forca_causal}`).toBe(true);
    expect(idsRefs.has(d.diretriz), `${d.id}: diretriz ${d.diretriz}`).toBe(true);
    d.refs.forEach((r) => expect(idsRefs.has(r), `${d.id}: ref ${r}`).toBe(true));
  });

  it('toda categoria tem ao menos um desenho', () => {
    const usadas = new Set(desenhos.desenhos.map((d) => d.categoria));
    idsCategorias.forEach((c) => expect(usadas.has(c), c).toBe(true));
  });

  it('regras metodológicas básicas', () => {
    const porId = Object.fromEntries(desenhos.desenhos.map((d) => [d.id, d]));
    // Caso-controle não estima incidência nem RR diretamente: medida principal é OR.
    expect(porId.d_caso_controle.medidas.join(' ')).toMatch(/odds ratio/i);
    expect(porId.d_caso_controle.medidas.join(' ')).not.toMatch(/risco relativo/i);
    // Só desenhos com sorteio têm força causal alta (exceto síntese, que depende dos estudos incluídos).
    desenhos.desenhos
      .filter((d) => d.forca_causal === 'alta')
      .forEach((d) => expect(d.categoria === 'experimental' || d.categoria === 'sintese', d.id).toBe(true));
    // Observacionais nunca têm intervenção do pesquisador.
    desenhos.desenhos
      .filter((d) => d.categoria.startsWith('obs_'))
      .forEach((d) => expect(d.intervencao_do_pesquisador, d.id).toBe(false));
  });
});
