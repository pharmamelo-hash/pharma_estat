import { describe, it, expect } from 'vitest';
import { montarDocumento, extrairSinais, chaveDoTitulo, ehTitulo, textoDe } from '../src/motor/leitor-projeto.js';
import { corrigirProjeto, aplicarCorrecao, respostasPadrao } from '../src/motor/corretor.js';
import { textoAnalise, textoEtica, textoDesenho } from '../src/motor/modelos-texto.js';

// Projeto fictício "com problemas", no formato que sai do Word.
const B = (texto, titulo) => ({ texto, titulo });
const PROJETO = [
  B('USO DE MEROPENÉM EM INFUSÃO ESTENDIDA E MORTALIDADE EM UTI', true),
  B('Autor: Fulano de Tal'),
  B('1 INTRODUÇÃO', true),
  B('A sepse é causa importante de óbito em unidades de terapia intensiva.'),
  B('2 OBJETIVOS', true),
  B('Avaliar a associação entre a infusão estendida e o óbito em 30 dias.'),
  B('3 METODOLOGIA', true),
  B('3.1 Tipo de estudo', true),
  B('Trata-se de um estudo de caso-controle realizado com prontuários do hospital.'),
  B('3.2 População e amostra', true),
  B('Serão incluídos todos os pacientes internados na UTI no período de 2024, totalizando cerca de n = 180 prontuários.'),
  B('3.3 Análise dos dados', true),
  B('Os dados serão analisados pelo teste t de Student e pelo qui-quadrado, e será calculado o risco relativo.'),
  B('REFERÊNCIAS', true),
  B('Fulano A. Sepse. Rev Bras. 2020;1:1-10.'),
];

describe('leitura do projeto', () => {
  it('reconhece títulos numerados e sinônimos', () => {
    expect(chaveDoTitulo('3.3 Análise dos dados')).toBe('analise');
    expect(chaveDoTitulo('MATERIAIS E MÉTODOS')).toBe('metodologia');
    expect(chaveDoTitulo('Critérios de Inclusão')).toBe('criterios');
    expect(ehTitulo('Os dados serão analisados pelo teste t.')).toBe(false);
  });
  it('monta seções e pega o título', () => {
    const doc = montarDocumento(PROJETO);
    expect(doc.titulo).toMatch(/MEROPENÉM/);
    expect(doc.secoes.map((s) => s.chave)).toEqual(['introducao', 'objetivos', 'metodologia', 'desenho', 'populacao', 'analise', 'referencias']);
    expect(doc.preambulo[0].texto).toMatch(/Autor/);
  });
  it('extrai sinais', () => {
    const s = extrairSinais(montarDocumento(PROJETO));
    expect(s.desenhos[0]).toBe('d_caso_controle');
    expect(s.testes).toEqual(expect.arrayContaining(['t_t_welch', 't_qui_quadrado']));
    expect(s.medidas).toContain('rr');
    expect(s.censo).toBe(true);
    expect(s.normalidade).toBe(false);
    expect(s.registros).toBe(true);
    expect(s.n).toBe(180);
  });
  it('lê α e poder escritos de formas diferentes', () => {
    const doc = montarDocumento([B('Cálculo amostral', true), B('Considerou-se nível de significância de 5% e poder de 80%, com acréscimo de 10% para perdas (Silva, 2020).')]);
    const s = extrairSinais(doc);
    expect(s.alfa).toBeCloseTo(0.05); expect(s.poder).toBeCloseTo(0.8); expect(s.perdas).toBeCloseTo(0.1);
    expect(s.temCalculo).toBe(true); expect(s.fonteEfeito).toBe(true);
  });
});

describe('corretor', () => {
  const doc = montarDocumento(PROJETO);
  const { achados } = corrigirProjeto(doc, { desenho: 'd_caso_controle', modelo: 'cep' });
  const ids = achados.map((a) => a.id);
  it('acha os problemas esperados', () => {
    expect(ids).toEqual(expect.arrayContaining(['tx_cc_rr', 'tx_censo', 'tx_normalidade', 'tx_significancia', 'tx_efeito_ic', 'tx_software', 'tx_confundidores', 'tx_faltantes', 'tx_etica', 'tx_riscos', 'tx_criterios', 'tx_desfecho', 'tx_cronograma', 'tx_orcamento', 'tx_diretriz', 'tx_referencias']));
    expect(ids).not.toContain('tx_objetivos');
    expect(ids).not.toContain('tx_sem_analise');
    expect(achados[0].gravidade).toBe('alta');
  });
  it('troca risco relativo por odds ratio no caso-controle', () => {
    const novo = aplicarCorrecao(doc, achados.find((a) => a.id === 'tx_cc_rr'));
    expect(textoDe(novo)).toMatch(/odds ratio/); expect(textoDe(novo)).not.toMatch(/risco relativo/);
    expect(textoDe(doc)).toMatch(/risco relativo/); // original intacto
    expect(novo.secoes.find((s) => s.chave === 'analise').paragrafos[0].marca).toBe('alterado');
  });
  it('acrescenta frase na seção existente', () => {
    const a = achados.find((x) => x.id === 'tx_significancia');
    const novo = aplicarCorrecao(doc, a, { alfa: 5 });
    const an = novo.secoes.find((s) => s.chave === 'analise');
    expect(an.paragrafos.at(-1)).toEqual({ texto: expect.stringMatching(/5%/), marca: 'novo' });
  });
  it('cria seção nova na posição do modelo (ética antes das referências)', () => {
    const novo = aplicarCorrecao(doc, achados.find((x) => x.id === 'tx_etica'), {}, 'cep');
    const chaves = novo.secoes.map((s) => s.chave);
    expect(chaves.indexOf('etica')).toBeLessThan(chaves.indexOf('referencias'));
    expect(chaves.indexOf('etica')).toBeGreaterThan(chaves.indexOf('analise'));
    expect(textoDe(novo)).toMatch(/dispensa do Termo de Consentimento/);
  });
  it('aplicar tudo e reanalisar elimina os achados corrigíveis', () => {
    let atual = doc;
    for (const a of achados) atual = aplicarCorrecao(atual, a, respostasPadrao(a), 'cep');
    const depois = corrigirProjeto(atual, { desenho: 'd_caso_controle', modelo: 'cep' }).achados.filter((a) => a.correcao);
    expect(depois.map((a) => a.id)).toEqual([]);
  });
  it('projeto sem desenho pergunta o desenho', () => {
    const r = corrigirProjeto(montarDocumento([B('Objetivos', true), B('Descrever o perfil.')]), {});
    const a = r.achados.find((x) => x.id === 'tx_desenho_indefinido');
    expect(a.correcao.pergunta[0].tipo).toBe('desenho');
  });
  it('ECR: cobra randomização, ocultação, cegamento e ITT', () => {
    const r = corrigirProjeto(montarDocumento([B('Tipo de estudo', true), B('Ensaio clínico randomizado.'), B('Objetivos', true), B('Comparar.')]), { desenho: 'd_ecr_paralelo' });
    expect(r.achados.map((a) => a.id)).toEqual(expect.arrayContaining(['tx_ocultacao', 'tx_cegamento', 'tx_itt', 'tx_sem_amostra', 'tx_sem_analise']));
  });
});

describe('textos-modelo', () => {
  it('análise com teste paramétrico traz alternativa e efeito', () => {
    const t = textoAnalise({ testesIds: ['t_t_welch'] });
    expect(t).toMatch(/Mann-Whitney/); expect(t).toMatch(/Shapiro-Wilk/); expect(t).toMatch(/IC 95%/);
  });
  it('ética muda com prontuário e crianças', () => {
    expect(textoEtica({ d: 'd_coorte_retrospectiva' })).toMatch(/TCUD/);
    expect(textoEtica({ d: 'd_ecr_paralelo', criancas: true })).toMatch(/TALE/);
    expect(textoEtica({ d: 'd_revisao_sistematica' })).toMatch(/dispensa/);
  });
  it('desenho sem id deixa lacuna', () => expect(textoDesenho(null)).toMatch(/\[/));
});
