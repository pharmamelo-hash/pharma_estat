# Biblioteca de análises do app (roda no R via webR, dentro do navegador).
# Regras (Doc 7): nomes de colunas chegam como DADOS (lista papeis_app), nunca colados no código;
# toda análise devolve pressupostos, resultado, medida de efeito com IC 95% e gráfico SVG.
# Só usa pacotes base do R (stats, graphics, grDevices).

# ---------- Utilidades ----------
.esc_json <- function(s) {
  s <- gsub("\\\\", "\\\\\\\\", s)
  s <- gsub('"', '\\\\"', s)
  s <- gsub("\n", "\\\\n", s)
  gsub("[[:cntrl:]]", " ", s)
}
para_json <- function(x) {
  if (is.null(x)) return("null")
  if (is.list(x)) {
    nm <- names(x)
    itens <- vapply(x, para_json, "")
    if (!is.null(nm) && length(nm) > 0 && all(nzchar(nm))) {
      return(paste0("{", paste0('"', .esc_json(nm), '":', itens, collapse = ","), "}"))
    }
    return(paste0("[", paste(itens, collapse = ","), "]"))
  }
  if (is.factor(x)) x <- as.character(x)
  if (length(x) == 0) return("[]")
  v <- if (is.character(x)) ifelse(is.na(x), "null", paste0('"', .esc_json(x), '"'))
       else if (is.logical(x)) ifelse(is.na(x), "null", ifelse(x, "true", "false"))
       else ifelse(is.na(x) | !is.finite(x), "null", formatC(as.numeric(x), digits = 15, format = "g"))
  if (length(x) == 1) v else paste0("[", paste(v, collapse = ","), "]")
}

.svg <- function(desenhar, largura = 7, altura = 4.5) {
  # Desativado: no navegador o dispositivo svg() do Cairo derruba o worker do webR.
  # Os gráficos são desenhados em JavaScript (src/ui/graficos.js) com os mesmos dados.
  return(NULL)
  f <- tempfile(fileext = ".svg")
  svg(f, width = largura, height = altura)
  par(mar = c(4.5, 4.5, 2, 1), las = 1, cex.axis = 0.9)
  try(desenhar(), silent = TRUE)
  dev.off()
  txt <- paste(readLines(f, warn = FALSE), collapse = "\n")
  unlink(f)
  txt
}
.cores <- c("#0F4C5C", "#1A9E8F", "#F2A541", "#C62828", "#6A4C93", "#2E7D32")

col_num <- function(d, nome) {
  if (is.null(nome) || !nome %in% names(d)) stop("Coluna não encontrada: ", nome)
  v <- d[[nome]]
  if (is.character(v)) v <- suppressWarnings(as.numeric(gsub(",", ".", v, fixed = TRUE)))
  as.numeric(v)
}
col_cat <- function(d, nome) {
  if (is.null(nome) || !nome %in% names(d)) stop("Coluna não encontrada: ", nome)
  v <- d[[nome]]
  v[!is.na(v) & trimws(as.character(v)) == ""] <- NA
  factor(as.character(v))
}
desc_num <- function(v) {
  v <- v[!is.na(v)]
  list(n = length(v), media = if (length(v)) mean(v) else NA, dp = if (length(v) > 1) sd(v) else NA,
       mediana = if (length(v)) median(v) else NA,
       q1 = if (length(v)) unname(quantile(v, 0.25)) else NA, q3 = if (length(v)) unname(quantile(v, 0.75)) else NA,
       min = if (length(v)) min(v) else NA, max = if (length(v)) max(v) else NA)
}
item <- function(nome, estado, detalhe) list(nome = nome, estado = estado, detalhe = detalhe)
fmt_p <- function(p) if (is.na(p)) "NA" else if (p < 0.001) "< 0,001" else formatC(p, digits = 3, format = "f", decimal.mark = ",")

normalidade <- function(v, rotulo) {
  v <- v[!is.na(v)]; n <- length(v)
  if (n < 3) return(item(paste("Normalidade:", rotulo), "violado", paste0("apenas ", n, " observações")))
  if (length(unique(v)) < 3) return(item(paste("Normalidade:", rotulo), "violado", "poucos valores distintos"))
  vv <- if (n > 5000) v[seq(1, n, length.out = 5000)] else v
  p <- shapiro.test(vv)$p.value
  estado <- if (p >= 0.05) "ok" else if (n >= 30) "limite" else "violado"
  detalhe <- paste0("Shapiro-Wilk p = ", fmt_p(p), " (n = ", n, ")",
                    if (estado == "limite") "; n ≥ 30 tolera desvios moderados — confira o histograma" else "")
  item(paste("Normalidade:", rotulo), estado, detalhe)
}
levene <- function(y, g) {
  med <- ave(y, g, FUN = median)
  a <- anova(lm(abs(y - med) ~ g))
  p <- a[["Pr(>F)"]][1]
  item("Homogeneidade de variâncias", if (p >= 0.05) "ok" else "limite",
       paste0("Levene (mediana) p = ", fmt_p(p), if (p < 0.05) "; variâncias diferentes: prefira Welch" else ""))
}
tamanho_minimo <- function(n, minimo, rotulo) {
  item(paste("Tamanho:", rotulo), if (n >= minimo) "ok" else "violado", paste0("n = ", n, if (n < minimo) paste0(" (mínimo recomendado ", minimo, ")") else ""))
}
efeito <- function(nome, valor, li = NA, ls = NA, nota = NULL) list(nome = nome, valor = valor, li = li, ls = ls, nota = nota)

# ---------- Dois grupos independentes (t de Welch / Mann-Whitney) ----------
analise_dois_grupos <- function(d, pp, id) {
  y <- col_num(d, pp$y); g <- col_cat(d, pp$g)
  ok <- !is.na(y) & !is.na(g); y <- y[ok]; g <- droplevels(g[ok])
  if (nlevels(g) != 2) stop("A coluna de grupo precisa ter exatamente 2 categorias; tem ", nlevels(g), ".")
  niv <- levels(g)
  desc <- lapply(niv, function(l) c(list(grupo = l), desc_num(y[g == l])))
  n1 <- sum(g == niv[1]); n2 <- sum(g == niv[2])
  pres <- list(normalidade(y[g == niv[1]], niv[1]), normalidade(y[g == niv[2]], niv[2]), levene(y, g),
               tamanho_minimo(min(n1, n2), 5, "menor grupo"))
  normal_ok <- all(vapply(pres[1:2], function(i) i$estado != "violado", TRUE))
  tw <- t.test(y ~ g)
  mw <- suppressWarnings(wilcox.test(y ~ g, conf.int = TRUE))
  sp <- sqrt(((n1 - 1) * var(y[g == niv[1]]) + (n2 - 1) * var(y[g == niv[2]])) / (n1 + n2 - 2))
  r_welch <- list(teste = "t_t_welch", nome = "Teste t de Welch", estatistica = unname(tw$statistic), nome_estatistica = "t",
                  gl = unname(tw$parameter), p = tw$p.value,
                  efeito = efeito(paste0("Diferença de médias (", niv[1], " − ", niv[2], ")"), unname(-diff(tw$estimate)), tw$conf.int[1], tw$conf.int[2],
                                  paste0("d de Cohen = ", formatC(unname(-diff(tw$estimate)) / sp, digits = 2, format = "f", decimal.mark = ","))))
  r_mw <- list(teste = "t_mann_whitney", nome = "Teste de Mann-Whitney", estatistica = unname(mw$statistic), nome_estatistica = "W",
               gl = NA, p = mw$p.value,
               efeito = efeito(paste0("Diferença de localização de Hodges-Lehmann (", niv[1], " − ", niv[2], ")"), unname(mw$estimate), mw$conf.int[1], mw$conf.int[2]))
  sugerido <- if (normal_ok) "t_t_welch" else "t_mann_whitney"
  grafico <- .svg(function() {
    boxplot(y ~ g, col = adjustcolor(.cores[1:2], 0.25), border = .cores[1:2], ylab = pp$y, xlab = pp$g, outline = FALSE)
    set.seed(1); stripchart(y ~ g, vertical = TRUE, method = "jitter", add = TRUE, pch = 16, col = adjustcolor(.cores[1:2], 0.6))
  })
  list(tipo = "dois_grupos", n = length(y), descritivas = desc, pressupostos = pres,
       resultados = list(r_welch, r_mw), principal = id, sugerido = sugerido, grafico = grafico, niveis = niv)
}

# ---------- Duas medidas pareadas ----------
analise_pareada <- function(d, pp, id) {
  a <- col_num(d, pp$y); b <- col_num(d, pp$y2)
  ok <- !is.na(a) & !is.na(b); a <- a[ok]; b <- b[ok]
  dif <- b - a
  pres <- list(normalidade(dif, paste0("diferenças (", pp$y2, " − ", pp$y, ")")), tamanho_minimo(length(dif), 5, "pares completos"))
  tp <- t.test(b, a, paired = TRUE)
  wp <- suppressWarnings(wilcox.test(b, a, paired = TRUE, conf.int = TRUE))
  r_t <- list(teste = "t_t_pareado", nome = "Teste t pareado", estatistica = unname(tp$statistic), nome_estatistica = "t", gl = unname(tp$parameter), p = tp$p.value,
              efeito = efeito(paste0("Média das diferenças (", pp$y2, " − ", pp$y, ")"), unname(tp$estimate), tp$conf.int[1], tp$conf.int[2]))
  r_w <- list(teste = "t_wilcoxon_pareado", nome = "Teste de Wilcoxon pareado", estatistica = unname(wp$statistic), nome_estatistica = "V", gl = NA, p = wp$p.value,
              efeito = efeito(paste0("Pseudomediana das diferenças (", pp$y2, " − ", pp$y, ")"), unname(wp$estimate), wp$conf.int[1], wp$conf.int[2]))
  grafico <- .svg(function() {
    matplot(rbind(1, 2), rbind(a, b), type = "l", lty = 1, col = adjustcolor(.cores[1], 0.25), xaxt = "n", xlab = "", ylab = "Valor", xlim = c(0.7, 2.3))
    axis(1, at = 1:2, labels = c(pp$y, pp$y2))
    points(rep(1, length(a)), a, pch = 16, col = .cores[1]); points(rep(2, length(b)), b, pch = 16, col = .cores[2])
  })
  list(tipo = "pareado", n = length(dif),
       descritivas = list(c(list(grupo = pp$y), desc_num(a)), c(list(grupo = pp$y2), desc_num(b)), c(list(grupo = "diferença"), desc_num(dif))),
       pressupostos = pres, resultados = list(r_t, r_w), principal = id,
       sugerido = if (pres[[1]]$estado != "violado") "t_t_pareado" else "t_wilcoxon_pareado", grafico = grafico)
}

# ---------- Três ou mais grupos independentes ----------
analise_varios_grupos <- function(d, pp, id) {
  y <- col_num(d, pp$y); g <- col_cat(d, pp$g)
  ok <- !is.na(y) & !is.na(g); y <- y[ok]; g <- droplevels(g[ok])
  if (nlevels(g) < 3) stop("A coluna de grupo precisa ter 3 ou mais categorias; tem ", nlevels(g), ". Para 2 grupos use t de Welch ou Mann-Whitney.")
  niv <- levels(g); n <- length(y)
  desc <- lapply(niv, function(l) c(list(grupo = l), desc_num(y[g == l])))
  modelo <- aov(y ~ g)
  pres <- list(normalidade(residuals(modelo), "resíduos"), levene(y, g),
               tamanho_minimo(min(table(g)), 5, "menor grupo"))
  tab <- summary(modelo)[[1]]
  eta2 <- tab[["Sum Sq"]][1] / sum(tab[["Sum Sq"]])
  tk <- TukeyHSD(modelo)$g
  pares_tukey <- lapply(seq_len(nrow(tk)), function(i) list(par = rownames(tk)[i], diferenca = tk[i, "diff"], li = tk[i, "lwr"], ls = tk[i, "upr"], p = tk[i, "p adj"]))
  ow <- oneway.test(y ~ g, var.equal = FALSE)
  kw <- kruskal.test(y ~ g)
  eps2 <- unname(kw$statistic) * (n + 1) / (n^2 - 1)
  pw <- suppressWarnings(pairwise.wilcox.test(y, g, p.adjust.method = "holm"))$p.value
  pares_mw <- list(); for (i in seq_len(nrow(pw))) for (j in seq_len(ncol(pw))) if (!is.na(pw[i, j])) pares_mw[[length(pares_mw) + 1]] <- list(par = paste(rownames(pw)[i], colnames(pw)[j], sep = "-"), p = pw[i, j])
  pt_welch <- pairwise.t.test(y, g, pool.sd = FALSE, p.adjust.method = "holm")$p.value
  pares_welch <- list(); for (i in seq_len(nrow(pt_welch))) for (j in seq_len(ncol(pt_welch))) if (!is.na(pt_welch[i, j])) pares_welch[[length(pares_welch) + 1]] <- list(par = paste(rownames(pt_welch)[i], colnames(pt_welch)[j], sep = "-"), p = pt_welch[i, j])
  r_anova <- list(teste = "t_anova_um_fator", nome = "ANOVA de um fator", estatistica = tab[["F value"]][1], nome_estatistica = "F",
                  gl = paste0(tab[["Df"]][1], "; ", tab[["Df"]][2]), p = tab[["Pr(>F)"]][1],
                  efeito = efeito("Eta ao quadrado (η²)", eta2), pares = pares_tukey, nome_pares = "Tukey (diferença de médias, IC 95%)")
  r_welch <- list(teste = "t_welch_anova", nome = "ANOVA de Welch", estatistica = unname(ow$statistic), nome_estatistica = "F",
                  gl = paste0(formatC(ow$parameter[1], digits = 0, format = "f"), "; ", formatC(ow$parameter[2], digits = 1, format = "f", decimal.mark = ",")), p = ow$p.value,
                  efeito = efeito("Eta ao quadrado da ANOVA clássica (referência)", eta2), pares = pares_welch, nome_pares = "t de Welch par a par (Holm)")
  r_kw <- list(teste = "t_kruskal_wallis", nome = "Teste de Kruskal-Wallis", estatistica = unname(kw$statistic), nome_estatistica = "H",
               gl = unname(kw$parameter), p = kw$p.value, efeito = efeito("Épsilon ao quadrado (ε²)", eps2),
               pares = pares_mw, nome_pares = "Mann-Whitney par a par (Holm)")
  normal_ok <- pres[[1]]$estado != "violado"
  sugerido <- if (!normal_ok) "t_kruskal_wallis" else if (pres[[2]]$estado == "ok") "t_anova_um_fator" else "t_welch_anova"
  grafico <- .svg(function() {
    cores <- rep(.cores, length.out = length(niv))
    boxplot(y ~ g, col = adjustcolor(cores, 0.25), border = cores, ylab = pp$y, xlab = pp$g, outline = FALSE)
    set.seed(1); stripchart(y ~ g, vertical = TRUE, method = "jitter", add = TRUE, pch = 16, col = adjustcolor(cores, 0.6))
  })
  list(tipo = "varios_grupos", n = n, descritivas = desc, pressupostos = pres,
       resultados = list(r_anova, r_welch, r_kw), principal = id, sugerido = sugerido, grafico = grafico,
       alerta = "Comparações par a par já corrigidas para múltiplos testes (Tukey ou Holm).")
}

# ---------- Friedman (3+ medidas repetidas) ----------
analise_friedman <- function(d, pp, id) {
  cols <- unlist(pp$medidas)
  if (length(cols) < 3) stop("Escolha 3 ou mais colunas de medidas (uma por momento).")
  m <- sapply(cols, function(cn) col_num(d, cn))
  m <- m[stats::complete.cases(m), , drop = FALSE]
  if (nrow(m) < 3) stop("Menos de 3 participantes com todas as medidas.")
  fr <- friedman.test(m)
  k <- ncol(m); n <- nrow(m)
  w <- unname(fr$statistic) / (n * (k - 1))
  desc <- lapply(seq_len(k), function(j) c(list(grupo = cols[j]), desc_num(m[, j])))
  pres <- list(item("Medidas completas", "ok", paste0(n, " participantes com todos os momentos")), tamanho_minimo(n, 5, "participantes"))
  res <- list(teste = "t_friedman", nome = "Teste de Friedman", estatistica = unname(fr$statistic), nome_estatistica = "χ²",
              gl = unname(fr$parameter), p = fr$p.value, efeito = efeito("W de Kendall", w))
  grafico <- .svg(function() {
    matplot(t(m), type = "l", lty = 1, col = adjustcolor(.cores[1], 0.25), xaxt = "n", xlab = "", ylab = "Valor")
    axis(1, at = seq_len(k), labels = cols)
    lines(seq_len(k), apply(m, 2, median), lwd = 3, col = .cores[3])
  })
  list(tipo = "friedman", n = n, descritivas = desc, pressupostos = pres, resultados = list(res), principal = id, sugerido = "t_friedman", grafico = grafico)
}

# ---------- Duas variáveis categóricas (qui-quadrado / Fisher) ----------
medidas_2x2 <- function(tab) {
  # tab: linhas = exposição (exposto primeiro), colunas = desfecho (evento primeiro)
  a <- tab[1, 1]; b <- tab[1, 2]; c <- tab[2, 1]; dd <- tab[2, 2]
  r1 <- a / (a + b); r0 <- c / (c + dd)
  rr <- r1 / r0
  se_lrr <- sqrt(1 / a - 1 / (a + b) + 1 / c - 1 / (c + dd))
  or <- (a * dd) / (b * c)
  se_lor <- sqrt(1 / a + 1 / b + 1 / c + 1 / dd)
  dif <- r1 - r0
  se_dif <- sqrt(r1 * (1 - r1) / (a + b) + r0 * (1 - r0) / (c + dd))
  list(risco_expostos = r1, risco_nao_expostos = r0,
       rr = efeito("Razão de riscos / prevalências (RR ou RP)", rr, exp(log(rr) - 1.96 * se_lrr), exp(log(rr) + 1.96 * se_lrr), "IC de Katz (log)"),
       or = efeito("Odds ratio (OR)", or, exp(log(or) - 1.96 * se_lor), exp(log(or) + 1.96 * se_lor), "IC de Woolf (log)"),
       dif = efeito("Diferença de riscos", dif, dif - 1.96 * se_dif, dif + 1.96 * se_dif, "IC de Wald"))
}
analise_categoricas <- function(d, pp, id) {
  x <- col_cat(d, pp$g); y <- col_cat(d, pp$y)
  ok <- !is.na(x) & !is.na(y); x <- droplevels(x[ok]); y <- droplevels(y[ok])
  if (nlevels(x) < 2 || nlevels(y) < 2) stop("As duas colunas precisam ter pelo menos 2 categorias.")
  # ordem: exposto e evento primeiro (escolhidos pelo usuário ou o último nível)
  if (!is.null(pp$nivel_exposto) && pp$nivel_exposto %in% levels(x)) x <- relevel(x, ref = pp$nivel_exposto)
  else x <- factor(x, levels = rev(levels(x)))
  if (!is.null(pp$nivel_evento) && pp$nivel_evento %in% levels(y)) y <- relevel(y, ref = pp$nivel_evento)
  else y <- factor(y, levels = rev(levels(y)))
  tab <- table(x, y)
  esp <- suppressWarnings(chisq.test(tab, correct = FALSE))$expected
  frac5 <- mean(esp < 5); min_esp <- min(esp)
  pres <- list(item("Frequências esperadas", if (min_esp >= 1 && frac5 <= 0.2) "ok" else "violado",
                    paste0("menor esperada = ", formatC(min_esp, digits = 2, format = "f", decimal.mark = ","), "; células < 5: ", round(100 * frac5), "%")),
               item("Observações independentes", "ok", "cada linha da planilha conta uma vez (confira se não há participantes repetidos)"))
  cq <- suppressWarnings(chisq.test(tab, correct = FALSE))
  fi <- tryCatch(fisher.test(tab), error = function(e) { set.seed(123); fisher.test(tab, simulate.p.value = TRUE, B = 1e5) })
  v_cramer <- sqrt(unname(cq$statistic) / (sum(tab) * (min(dim(tab)) - 1)))
  r_cq <- list(teste = "t_qui_quadrado", nome = "Qui-quadrado de independência", estatistica = unname(cq$statistic), nome_estatistica = "χ²",
               gl = unname(cq$parameter), p = cq$p.value, efeito = efeito("V de Cramér", v_cramer))
  r_fi <- list(teste = "t_fisher_exato", nome = "Teste exato de Fisher", estatistica = NA, nome_estatistica = "", gl = NA, p = fi$p.value,
               efeito = if (all(dim(tab) == 2)) efeito("OR condicional (Fisher)", unname(fi$estimate), fi$conf.int[1], fi$conf.int[2]) else efeito("V de Cramér", v_cramer))
  m22 <- if (all(dim(tab) == 2)) medidas_2x2(tab) else NULL
  tabela <- list(linhas = rownames(tab), colunas = colnames(tab), contagens = lapply(seq_len(nrow(tab)), function(i) as.list(as.numeric(tab[i, ]))),
                 percentuais_linha = lapply(seq_len(nrow(tab)), function(i) as.list(as.numeric(100 * tab[i, ] / sum(tab[i, ])))))
  grafico <- .svg(function() {
    pr <- prop.table(tab, 1)
    barplot(t(pr) * 100, beside = TRUE, col = .cores[seq_len(ncol(tab))], ylab = paste0("% de ", pp$y), xlab = pp$g, ylim = c(0, 110),
            legend.text = colnames(tab), args.legend = list(x = "topright", bty = "n", cex = 0.85))
  })
  list(tipo = "categoricas", n = sum(tab), tabela = tabela, medidas_2x2 = m22, pressupostos = pres,
       resultados = list(r_cq, r_fi), principal = id, sugerido = if (pres[[1]]$estado == "ok") "t_qui_quadrado" else "t_fisher_exato",
       grafico = grafico, nivel_exposto = levels(x)[1], nivel_evento = levels(y)[1])
}

# ---------- McNemar (binário pareado) ----------
analise_mcnemar <- function(d, pp, id) {
  a <- col_cat(d, pp$y); b <- col_cat(d, pp$y2)
  ok <- !is.na(a) & !is.na(b); a <- as.character(a[ok]); b <- as.character(b[ok])
  niv <- sort(unique(c(a, b)))
  if (length(niv) != 2) stop("McNemar exige desfecho com exatamente 2 categorias nos dois momentos; há ", length(niv), ".")
  if (!is.null(pp$nivel_evento) && pp$nivel_evento %in% niv) niv <- c(pp$nivel_evento, setdiff(niv, pp$nivel_evento)) else niv <- rev(niv)
  tab <- table(factor(a, levels = niv), factor(b, levels = niv))
  bb <- tab[1, 2]; cc <- tab[2, 1]; n <- sum(tab)
  mc <- mcnemar.test(tab)
  exato <- if ((bb + cc) > 0) binom.test(bb, bb + cc)$p.value else 1
  p1 <- sum(tab[1, ]) / n; p2 <- sum(tab[, 1]) / n
  dif <- p2 - p1
  se <- sqrt((bb + cc) - (bb - cc)^2 / n) / n
  pres <- list(item("Pares discordantes", if (bb + cc >= 25) "ok" else "limite", paste0(bb + cc, " discordantes", if (bb + cc < 25) "; use o p exato (binomial)" else "")))
  res <- list(teste = "t_mcnemar", nome = "Teste de McNemar", estatistica = unname(mc$statistic), nome_estatistica = "χ²", gl = unname(mc$parameter),
              p = if (bb + cc >= 25) mc$p.value else exato,
              efeito = efeito(paste0("Diferença de proporções de '", niv[1], "' (", pp$y2, " − ", pp$y, ")"), dif, dif - 1.96 * se, dif + 1.96 * se, "IC de Wald pareado"),
              nota = paste0("p assintótico (com correção) = ", fmt_p(mc$p.value), "; p exato = ", fmt_p(exato)))
  tabela <- list(linhas = paste(pp$y, niv), colunas = paste(pp$y2, niv), contagens = lapply(1:2, function(i) as.list(as.numeric(tab[i, ]))))
  grafico <- .svg(function() barplot(c(p1, p2) * 100, names.arg = c(pp$y, pp$y2), col = .cores[1:2], ylab = paste0("% ", niv[1]), ylim = c(0, 100)))
  list(tipo = "mcnemar", n = n, tabela = tabela, pressupostos = pres, resultados = list(res), principal = id, sugerido = "t_mcnemar", grafico = grafico)
}

# ---------- Correlação ----------
analise_correlacao <- function(d, pp, id) {
  x <- col_num(d, pp$x); y <- col_num(d, pp$y)
  ok <- !is.na(x) & !is.na(y); x <- x[ok]; y <- y[ok]
  if (length(x) < 5) stop("São necessários pelo menos 5 pares completos.")
  pres <- list(normalidade(x, pp$x), normalidade(y, pp$y), tamanho_minimo(length(x), 10, "pares"))
  cp <- cor.test(x, y, method = "pearson")
  cs <- suppressWarnings(cor.test(x, y, method = "spearman", exact = FALSE))
  r_p <- list(teste = "t_pearson", nome = "Correlação de Pearson", estatistica = unname(cp$statistic), nome_estatistica = "t", gl = unname(cp$parameter), p = cp$p.value,
              efeito = efeito("r de Pearson", unname(cp$estimate), cp$conf.int[1], cp$conf.int[2]))
  r_s <- list(teste = "t_spearman", nome = "Correlação de Spearman", estatistica = unname(cs$statistic), nome_estatistica = "S", gl = NA, p = cs$p.value,
              efeito = efeito("rho de Spearman", unname(cs$estimate)))
  normal_ok <- all(vapply(pres[1:2], function(i) i$estado != "violado", TRUE))
  grafico <- .svg(function() {
    plot(x, y, pch = 16, col = adjustcolor(.cores[1], 0.6), xlab = pp$x, ylab = pp$y)
    abline(lm(y ~ x), col = .cores[3], lwd = 2)
  })
  list(tipo = "correlacao", n = length(x), descritivas = list(c(list(grupo = pp$x), desc_num(x)), c(list(grupo = pp$y), desc_num(y))),
       pressupostos = pres, resultados = list(r_p, r_s), principal = id, sugerido = if (normal_ok) "t_pearson" else "t_spearman", grafico = grafico,
       alerta = "Correlação não implica causalidade. Confira no gráfico se a relação é linear e se há valores extremos.")
}

# ---------- Regressões ----------
.preparar_modelo <- function(d, pp, y) {
  xs <- unlist(pp$x)
  if (length(xs) == 0) stop("Escolha pelo menos uma variável explicativa.")
  df <- data.frame(.y = y)
  for (nm in xs) {
    v <- d[[nm]]
    tipo <- pp$tipos[[nm]]
    df[[nm]] <- if (!is.null(tipo) && tipo %in% c("quantitativo")) col_num(d, nm) else col_cat(d, nm)
  }
  df <- df[stats::complete.cases(df), , drop = FALSE]
  names(df) <- c(".y", paste0("x", seq_along(xs)))
  rotulos <- setNames(xs, paste0("x", seq_along(xs)))
  list(df = df, rotulos = rotulos)
}
.rotular <- function(termos, rotulos) {
  out <- termos
  for (k in names(rotulos)) out <- sub(paste0("^", k), paste0(rotulos[[k]], ": "), out)
  sub(": $", "", out)
}
vif_simples <- function(mm) {
  mm <- mm[, colnames(mm) != "(Intercept)", drop = FALSE]
  if (ncol(mm) < 2) return(NULL)
  sapply(seq_len(ncol(mm)), function(j) { r2 <- summary(lm(mm[, j] ~ mm[, -j]))$r.squared; 1 / (1 - r2) })
}
analise_linear <- function(d, pp, id) {
  y <- col_num(d, pp$y)
  pm <- .preparar_modelo(d, pp, y); df <- pm$df
  if (nrow(df) < 10) stop("Poucas observações completas para o modelo (", nrow(df), ").")
  mod <- lm(.y ~ ., data = df)
  ci <- confint(mod); co <- summary(mod)$coefficients
  termos <- .rotular(rownames(co), pm$rotulos)
  coefs <- lapply(seq_len(nrow(co))[-1], function(i) list(termo = termos[i], beta = co[i, 1], li = ci[i, 1], ls = ci[i, 2], p = co[i, 4]))
  vifs <- vif_simples(model.matrix(mod))
  pres <- list(normalidade(residuals(mod), "resíduos"),
               item("Multicolinearidade", if (is.null(vifs) || max(vifs) < 5) "ok" else "limite", if (is.null(vifs)) "um só preditor" else paste0("maior VIF = ", formatC(max(vifs), digits = 2, format = "f", decimal.mark = ","))),
               tamanho_minimo(nrow(df), 10 * (ncol(model.matrix(mod)) - 1), "≈10 observações por preditor"))
  s <- summary(mod)
  fstat <- s$fstatistic
  res <- list(teste = "t_regressao_linear", nome = "Regressão linear", estatistica = unname(fstat[1]), nome_estatistica = "F",
              gl = paste0(fstat[2], "; ", fstat[3]), p = pf(fstat[1], fstat[2], fstat[3], lower.tail = FALSE),
              efeito = efeito("R² ajustado", s$adj.r.squared), coeficientes = coefs)
  grafico <- .svg(function() { plot(fitted(mod), residuals(mod), pch = 16, col = adjustcolor(.cores[1], 0.6), xlab = "Valores ajustados", ylab = "Resíduos"); abline(h = 0, lty = 2, col = .cores[3]) })
  list(tipo = "linear", n = nrow(df), pressupostos = pres, resultados = list(res), principal = id, sugerido = "t_regressao_linear", grafico = grafico,
       dados_grafico = list(ajustados = as.list(unname(fitted(mod))), residuos = as.list(unname(residuals(mod)))),
       alerta = "Confira no gráfico se os resíduos se espalham sem padrão em torno de zero.")
}
analise_logistica <- function(d, pp, id) {
  yc <- col_cat(d, pp$y)
  niv <- levels(droplevels(yc[!is.na(yc)]))
  if (length(niv) != 2) stop("O desfecho precisa ter exatamente 2 categorias; tem ", length(niv), ".")
  evento <- if (!is.null(pp$nivel_evento) && pp$nivel_evento %in% niv) pp$nivel_evento else niv[2]
  y <- ifelse(is.na(yc), NA, as.numeric(as.character(yc) == evento))
  pm <- .preparar_modelo(d, pp, y); df <- pm$df
  mod <- suppressWarnings(glm(.y ~ ., data = df, family = binomial))
  co <- summary(mod)$coefficients; ci <- suppressMessages(confint.default(mod))
  termos <- .rotular(rownames(co), pm$rotulos)
  coefs <- lapply(seq_len(nrow(co))[-1], function(i) list(termo = termos[i], or = exp(co[i, 1]), li = exp(ci[i, 1]), ls = exp(ci[i, 2]), p = co[i, 4]))
  k <- ncol(model.matrix(mod)) - 1
  eventos <- min(sum(df$.y == 1), sum(df$.y == 0))
  epv <- eventos / k
  pres <- list(item("Eventos por variável (EPV)", if (epv >= 10) "ok" else if (epv >= 5) "limite" else "violado",
                    paste0(eventos, " eventos na categoria menos frequente para ", k, " parâmetros: EPV = ", formatC(epv, digits = 1, format = "f", decimal.mark = ","))),
               item("Convergência", if (mod$converged && !any(abs(co[, 1]) > 10)) "ok" else "violado", if (mod$converged) "modelo convergiu" else "modelo não convergiu (separação?)"))
  prev <- mean(df$.y)
  res <- list(teste = "t_regressao_logistica", nome = "Regressão logística", estatistica = mod$null.deviance - mod$deviance, nome_estatistica = "χ² (razão de verossimilhança)",
              gl = mod$df.null - mod$df.residual, p = pchisq(mod$null.deviance - mod$deviance, mod$df.null - mod$df.residual, lower.tail = FALSE),
              efeito = efeito(paste0("Frequência de '", evento, "'"), prev), coeficientes = coefs,
              nota = "OR com IC 95% de Wald.")
  grafico <- .svg(function() {
    ors <- sapply(coefs, `[[`, "or"); lis <- sapply(coefs, `[[`, "li"); lss <- sapply(coefs, `[[`, "ls")
    yy <- rev(seq_along(ors)); rng <- range(c(lis, lss, 1), finite = TRUE)
    par(mar = c(4.5, 12, 2, 1))
    plot(ors, yy, log = "x", xlim = rng, pch = 15, col = .cores[1], yaxt = "n", ylab = "", xlab = "OR (IC 95%, escala log)")
    segments(lis, yy, lss, yy, col = .cores[1], lwd = 2); abline(v = 1, lty = 2)
    axis(2, at = yy, labels = sapply(coefs, `[[`, "termo"), las = 1, cex.axis = 0.8)
  })
  alerta <- if (prev >= 0.1) "Desfecho frequente (≥ 10%): em coorte ou transversal, a OR exagera a associação; considere estimar RP ou RR (regressão de Poisson robusta, com apoio de um bioestatístico)." else NULL
  list(tipo = "logistica", n = nrow(df), pressupostos = pres, resultados = list(res), principal = id, sugerido = "t_regressao_logistica", grafico = grafico, alerta = alerta, nivel_evento = evento)
}

# ---------- Concordância ----------
analise_kappa <- function(d, pp, id) {
  a <- col_cat(d, pp$y); b <- col_cat(d, pp$y2)
  ok <- !is.na(a) & !is.na(b); a <- as.character(a[ok]); b <- as.character(b[ok])
  niv <- sort(unique(c(a, b)))
  tab <- table(factor(a, levels = niv), factor(b, levels = niv)); n <- sum(tab)
  po <- sum(diag(tab)) / n; pe <- sum(rowSums(tab) * colSums(tab)) / n^2
  k <- (po - pe) / (1 - pe)
  se <- sqrt(po * (1 - po) / (n * (1 - pe)^2))
  classe <- if (k < 0) "pobre" else if (k <= 0.2) "leve" else if (k <= 0.4) "razoável" else if (k <= 0.6) "moderada" else if (k <= 0.8) "substancial" else "quase perfeita"
  res <- list(teste = "t_kappa", nome = "Kappa de Cohen", estatistica = k / se, nome_estatistica = "z", gl = NA, p = 2 * pnorm(-abs(k / se)),
              efeito = efeito("Kappa", k, k - 1.96 * se, k + 1.96 * se, paste0("concordância ", classe, " (Landis e Koch); concordância observada ", round(100 * po), "%")))
  tabela <- list(linhas = paste(pp$y, niv), colunas = paste(pp$y2, niv), contagens = lapply(seq_along(niv), function(i) as.list(as.numeric(tab[i, ]))))
  list(tipo = "kappa", n = n, tabela = tabela, pressupostos = list(item("Mesmas categorias", "ok", paste(niv, collapse = ", "))),
       resultados = list(res), principal = id, sugerido = "t_kappa", grafico = NULL)
}
analise_bland_altman <- function(d, pp, id) {
  a <- col_num(d, pp$y); b <- col_num(d, pp$y2)
  ok <- !is.na(a) & !is.na(b); a <- a[ok]; b <- b[ok]
  dif <- a - b; media <- (a + b) / 2; n <- length(dif)
  if (n < 5) stop("São necessários pelo menos 5 pares completos.")
  vies <- mean(dif); s <- sd(dif)
  ic <- vies + c(-1, 1) * qt(0.975, n - 1) * s / sqrt(n)
  prop <- summary(lm(dif ~ media))$coefficients
  pres <- list(normalidade(dif, "diferenças"),
               item("Viés proporcional", if (prop[2, 4] >= 0.05) "ok" else "limite", paste0("inclinação da diferença sobre a média p = ", fmt_p(prop[2, 4]))))
  res <- list(teste = "t_bland_altman", nome = "Bland-Altman", estatistica = NA, nome_estatistica = "", gl = NA, p = NA,
              efeito = efeito(paste0("Viés médio (", pp$y, " − ", pp$y2, ")"), vies, ic[1], ic[2],
                              paste0("limites de concordância de 95%: ", formatC(vies - 1.96 * s, digits = 3, format = "g", decimal.mark = ","), " a ", formatC(vies + 1.96 * s, digits = 3, format = "g", decimal.mark = ","))),
              limites = list(inferior = vies - 1.96 * s, superior = vies + 1.96 * s))
  grafico <- .svg(function() {
    plot(media, dif, pch = 16, col = adjustcolor(.cores[1], 0.6), xlab = "Média dos dois métodos", ylab = paste0("Diferença (", pp$y, " − ", pp$y2, ")"))
    abline(h = vies, col = .cores[3], lwd = 2); abline(h = vies + c(-1.96, 1.96) * s, lty = 2, col = .cores[4])
  })
  list(tipo = "bland_altman", n = n, pressupostos = pres, resultados = list(res), principal = id, sugerido = "t_bland_altman", grafico = grafico)
}
analise_acuracia <- function(d, pp, id) {
  ref <- col_cat(d, pp$y)
  niv <- levels(droplevels(ref[!is.na(ref)]))
  if (length(niv) != 2) stop("O padrão de referência precisa ter 2 categorias.")
  positivo <- if (!is.null(pp$nivel_evento) && pp$nivel_evento %in% niv) pp$nivel_evento else niv[2]
  doente <- as.character(ref) == positivo
  tipo_teste <- pp$tipos[[pp$g]]
  if (!is.null(tipo_teste) && tipo_teste == "quantitativo") {
    x <- col_num(d, pp$g); ok <- !is.na(x) & !is.na(doente); x <- x[ok]; dd <- doente[ok]
    n1 <- sum(dd); n0 <- sum(!dd)
    auc <- (sum(rank(x)[dd]) - n1 * (n1 + 1) / 2) / (n1 * n0)
    q1 <- auc / (2 - auc); q2 <- 2 * auc^2 / (1 + auc)
    se <- sqrt((auc * (1 - auc) + (n1 - 1) * (q1 - auc^2) + (n0 - 1) * (q2 - auc^2)) / (n1 * n0))
    cortes <- sort(unique(x))
    sens <- sapply(cortes, function(k) mean(x[dd] >= k)); esp <- sapply(cortes, function(k) mean(x[!dd] < k))
    j <- which.max(sens + esp - 1)
    res <- list(teste = "t_acuracia_roc", nome = "Curva ROC", estatistica = NA, nome_estatistica = "", gl = NA, p = 2 * pnorm(-abs((auc - 0.5) / se)),
                efeito = efeito("Área sob a curva (AUC)", auc, max(0, auc - 1.96 * se), min(1, auc + 1.96 * se),
                                paste0("IC de Hanley-McNeil; ponto de Youden: ≥ ", formatC(cortes[j], digits = 4, format = "g", decimal.mark = ","), " (sens. ", round(100 * sens[j]), "%, esp. ", round(100 * esp[j]), "%)")))
    grafico <- .svg(function() { plot(1 - esp, sens, type = "s", col = .cores[1], lwd = 2, xlab = "1 − especificidade", ylab = "Sensibilidade", xlim = c(0, 1), ylim = c(0, 1)); abline(0, 1, lty = 2) }, 5, 5)
    ordem <- order(1 - esp, sens)
    return(list(tipo = "acuracia", n = length(x), dados_grafico = list(fpr = as.list(c(0, (1 - esp)[ordem], 1)), tpr = as.list(c(0, sens[ordem], 1))), pressupostos = list(item("Padrão de referência", "ok", paste0(n1, " positivos e ", n0, " negativos"))),
                resultados = list(res), principal = id, sugerido = "t_acuracia_roc", grafico = grafico))
  }
  tc <- col_cat(d, pp$g)
  nt <- levels(droplevels(tc[!is.na(tc)]))
  if (length(nt) != 2) stop("O teste avaliado precisa ser binário ou quantitativo.")
  tpos <- if (!is.null(pp$nivel_teste_positivo) && pp$nivel_teste_positivo %in% nt) pp$nivel_teste_positivo else nt[2]
  ok <- !is.na(tc) & !is.na(ref); t1 <- as.character(tc[ok]) == tpos; dd <- doente[ok]
  vp <- sum(t1 & dd); fn <- sum(!t1 & dd); fp <- sum(t1 & !dd); vn <- sum(!t1 & !dd)
  ic <- function(x, n) if (n > 0) binom.test(x, n)$conf.int else c(NA, NA)
  med <- function(nome, x, n) { i <- ic(x, n); efeito(nome, if (n > 0) x / n else NA, i[1], i[2], "IC exato de Clopper-Pearson") }
  res <- list(teste = "t_acuracia_roc", nome = "Acurácia diagnóstica", estatistica = NA, nome_estatistica = "", gl = NA, p = NA,
              efeito = med("Sensibilidade", vp, vp + fn),
              medidas = list(med("Sensibilidade", vp, vp + fn), med("Especificidade", vn, vn + fp), med("Valor preditivo positivo", vp, vp + fp), med("Valor preditivo negativo", vn, vn + fn)))
  tabela <- list(linhas = c(paste("Teste", tpos), "Teste negativo"), colunas = c(paste("Referência", positivo), "Referência negativa"),
                 contagens = list(list(vp, fp), list(fn, vn)))
  list(tipo = "acuracia", n = vp + fn + fp + vn, tabela = tabela, pressupostos = list(item("Padrão de referência aplicado a todos", "ok", "confira se não houve viés de verificação")),
       resultados = list(res), principal = id, sugerido = "t_acuracia_roc", grafico = NULL)
}

# ---------- Despacho ----------
ANALISES <- list(
  t_t_welch = analise_dois_grupos, t_mann_whitney = analise_dois_grupos,
  t_t_pareado = analise_pareada, t_wilcoxon_pareado = analise_pareada,
  t_anova_um_fator = analise_varios_grupos, t_welch_anova = analise_varios_grupos, t_kruskal_wallis = analise_varios_grupos,
  t_friedman = analise_friedman,
  t_qui_quadrado = analise_categoricas, t_fisher_exato = analise_categoricas,
  t_mcnemar = analise_mcnemar,
  t_pearson = analise_correlacao, t_spearman = analise_correlacao,
  t_regressao_linear = analise_linear, t_regressao_logistica = analise_logistica,
  t_kappa = analise_kappa, t_bland_altman = analise_bland_altman, t_acuracia_roc = analise_acuracia
)
executar_analise <- function(id, dados, papeis) {
  saida <- tryCatch({
    if (!id %in% names(ANALISES)) stop("Análise não disponível no app: ", id)
    d <- as.list(dados)
    r <- ANALISES[[id]](d, papeis, id)
    r$ok <- TRUE
    r$r_versao <- R.version.string
    r
  }, error = function(e) list(ok = FALSE, erro = conditionMessage(e)))
  para_json(saida)
}
