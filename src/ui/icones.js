// Ícones próprios em traço (SVG 24×24). Desenho simples, sem bibliotecas externas.
const NS = 'http://www.w3.org/2000/svg';
const P = {
  inicio: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  analisar: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  projetos: 'M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  teste: 'M9 3h6 M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3 M7.5 14h9',
  desenho: 'M4 5h6v5H4z M14 14h6v5h-6z M7 10v4a2 2 0 0 0 2 2h5 M14 5h6 M17 5v6',
  amostra: 'M4 20V10 M10 20V4 M16 20v-7 M22 20H2',
  efeito: 'M3 18c3 0 4-12 9-12s6 12 9 12 M12 6v12',
  manual: 'M4 6h16 M4 12h10 M4 18h7 M17 15l3 3-3 3',
  coleta: 'M3 17l5-5 4 4 8-9 M15 7h5v5',
  revisao: 'M9 11l2 2 4-4 M5 4h14v16H5z',
  trilha: 'M5 4l14 8-14 8z',
  laboratorio: 'M9 3h6 M10 3v5L5 18a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3L14 8V3 M8 15h8',
  glossario: 'M4 4h11a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3z M4 17a3 3 0 0 1 3-3h11',
  catalogo: 'M4 5h4v14H4z M10 5h4v14h-4z M16 6l3.5-1 3 13.5-3.5 1z',
  sobre: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 11v6 M12 7.5v.5',
  busca: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z M21 21l-5-5',
  menu: 'M4 6h16 M4 12h16 M4 18h16',
  fechar: 'M6 6l12 12 M18 6L6 18',
  tema: 'M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z',
  historico: 'M3 12a9 9 0 1 0 3-6.7L3 8 M3 3v5h5 M12 7v5l3 2',
  pdf: 'M6 3h9l4 4v14H6z M14 3v5h5 M9 13h6 M9 17h6',
  salvar: 'M5 3h11l3 3v15H5z M8 3v6h8V3 M8 21v-7h8v7',
  copiar: 'M9 9h11v11H9z M5 15H4V4h11v1',
  citar: 'M7 7h4v4c0 3-1 5-4 6 M15 7h4v4c0 3-1 5-4 6',
  planejar: 'M12 2l9 9-9 9-9-9z',
  aprender: 'M2 8l10-5 10 5-10 5z M6 10v5c3 2 9 2 12 0v-5',
};
export function icone(nome, tamanho = 20) {
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', tamanho); s.setAttribute('height', tamanho);
  s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '1.8');
  s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.setAttribute('aria-hidden', 'true');
  s.classList.add('icone');
  const p = document.createElementNS(NS, 'path'); p.setAttribute('d', P[nome] || P.sobre); s.append(p);
  return s;
}
export const NOMES_ICONES = Object.keys(P);
