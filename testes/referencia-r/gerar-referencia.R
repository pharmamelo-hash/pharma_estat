# Gera os valores de referência dos testes do app, no próprio R (via webR 4.6).
# Saída: JSON em testes/referencia-r/referencia-amostra.json
fmt <- function(x) formatC(x, digits = 15, format = "g")
linhas <- character()
add <- function(...) linhas <<- c(linhas, paste0(...))
grupo <- function(nome, itens) add('"', nome, '": [', paste(itens, collapse = ","), ']')

# Distribuições
g <- c(); for (x in c(-4, -1.96, -0.5, 0, 0.3, 1.2816, 2.5, 6)) g <- c(g, sprintf('{"x":%s,"p":%s}', fmt(x), fmt(pnorm(x)))); grupo("pnorm", g)
g <- c(); for (p in c(1e-6, 0.001, 0.0125, 0.025, 0.2, 0.5, 0.8, 0.975, 0.995, 0.999999)) g <- c(g, sprintf('{"p":%s,"q":%s}', fmt(p), fmt(qnorm(p)))); grupo("qnorm", g)
g <- c(); for (cs in list(c(-3,2), c(-1,5), c(0.5,1), c(2.1,10), c(1.96,30), c(4,3), c(0,7), c(2.5,150))) g <- c(g, sprintf('{"t":%s,"gl":%s,"p":%s}', fmt(cs[1]), fmt(cs[2]), fmt(pt(cs[1], cs[2])))); grupo("pt", g)
g <- c(); for (cs in list(c(0.975,1), c(0.975,4), c(0.995,10), c(0.9,30), c(0.025,58), c(0.975,1000), c(0.6,2.5))) g <- c(g, sprintf('{"p":%s,"gl":%s,"q":%s}', fmt(cs[1]), fmt(cs[2]), fmt(qt(cs[1], cs[2])))); grupo("qt", g)
g <- c(); for (cs in list(c(2,10,1), c(2.0484,20,2.5), c(1.98,198,2.8), c(-1,5,0.5), c(0.5,3,3), c(3,8,-1), c(2.6,40,4), c(1.7,12,0.1), c(-2,15,-2.5), c(2.01,48,5.9))) g <- c(g, sprintf('{"t":%s,"gl":%s,"ncp":%s,"p":%s}', fmt(cs[1]), fmt(cs[2]), fmt(cs[3]), fmt(pt(cs[1], cs[2], ncp = cs[3])))); grupo("pt_ncp", g)

# Duas proporções: n contínuo com tolerância fina + n do power.prop.test padrão
g <- c()
for (cs in list(c(.3,.15,.05,.8), c(.5,.6,.05,.8), c(.01,.05,.05,.8), c(.9,.95,.05,.9), c(.2,.4,.01,.9), c(.45,.55,.05,.95), c(.05,.1,.05,.8), c(.7,.5,.05,.8), c(.12,.08,.1,.8), c(.33,.2,.05,.85), c(.6,.9,.05,.8))) {
  f <- function(n) power.prop.test(n = n, p1 = cs[1], p2 = cs[2], sig.level = cs[3])$power - cs[4]
  nfino <- uniroot(f, c(2, 1e7), tol = 1e-12)$root
  g <- c(g, sprintf('{"p1":%s,"p2":%s,"alfa":%s,"poder":%s,"n":%s,"n_r":%s}', fmt(cs[1]), fmt(cs[2]), fmt(cs[3]), fmt(cs[4]), fmt(nfino), fmt(power.prop.test(p1=cs[1], p2=cs[2], sig.level=cs[3], power=cs[4])$n)))
}
grupo("duas_proporcoes", g)

# Médias (duas amostras e pareado)
for (tipo in c("two.sample", "paired")) {
  g <- c()
  for (cs in list(c(5,10,.05,.8), c(1,1,.05,.8), c(0.1,1,.05,.8), c(2,1,.05,.8), c(3,1,.05,.9), c(10,25,.01,.9), c(0.5,1,.05,.95), c(15,40,.05,.8), c(0.8,1,.1,.8), c(1.5,2,.05,.85), c(4,1,.05,.99))) {
    f <- function(n) power.t.test(n = n, delta = cs[1], sd = cs[2], sig.level = cs[3], type = tipo)$power - cs[4]
    nfino <- uniroot(f, c(2, 1e7), tol = 1e-12)$root
    g <- c(g, sprintf('{"delta":%s,"dp":%s,"alfa":%s,"poder":%s,"n":%s,"n_r":%s}', fmt(cs[1]), fmt(cs[2]), fmt(cs[3]), fmt(cs[4]), fmt(nfino), fmt(power.t.test(delta=cs[1], sd=cs[2], sig.level=cs[3], power=cs[4], type=tipo)$n)))
  }
  grupo(ifelse(tipo == "paired", "media_pareada", "duas_medias"), g)
}

# Proporção única (fórmula), correlação (Fisher z) e Schoenfeld calculados no R
g <- c(); for (cs in list(c(.5,.05,.95,NA), c(.2,.03,.95,NA), c(.1,.05,.99,NA), c(.5,.05,.95,800), c(.3,.1,.9,NA), c(.02,.01,.95,NA), c(.65,.04,.95,5000), c(.5,.02,.95,300), c(.15,.05,.95,NA), c(.8,.06,.99,1200))) {
  z <- qnorm(1 - (1 - cs[3]) / 2); n0 <- z^2 * cs[1] * (1 - cs[1]) / cs[2]^2
  n <- if (is.na(cs[4])) n0 else n0 / (1 + (n0 - 1) / cs[4])
  g <- c(g, sprintf('{"p":%s,"e":%s,"confianca":%s,"N":%s,"n":%s}', fmt(cs[1]), fmt(cs[2]), fmt(cs[3]), ifelse(is.na(cs[4]), "null", fmt(cs[4])), fmt(n)))
}
grupo("proporcao", g)
g <- c(); for (cs in list(c(.3,.05,.8), c(.1,.05,.8), c(.5,.05,.9), c(.2,.01,.9), c(.7,.05,.8), c(.05,.05,.8), c(.4,.1,.8), c(.25,.05,.95), c(.9,.05,.8), c(.35,.01,.99))) {
  C <- 0.5 * log((1 + cs[1]) / (1 - cs[1])); n <- ((qnorm(1 - cs[2]/2) + qnorm(cs[3])) / C)^2 + 3
  g <- c(g, sprintf('{"r":%s,"alfa":%s,"poder":%s,"n":%s}', fmt(cs[1]), fmt(cs[2]), fmt(cs[3]), fmt(n)))
}
grupo("correlacao", g)
g <- c(); for (cs in list(c(.6,.4,.05,.8), c(.75,.5,.05,.8), c(.5,.3,.05,.9), c(1.5,.6,.05,.8), c(2,.2,.01,.9), c(.8,.7,.05,.8), c(.9,.5,.05,.8), c(.4,.25,.05,.95), c(1.3,1,.05,.8), c(.67,.35,.1,.8))) {
  d <- (qnorm(1 - cs[3]/2) + qnorm(cs[4]))^2 / (0.25 * log(cs[1])^2)
  g <- c(g, sprintf('{"hr":%s,"p_evento":%s,"alfa":%s,"poder":%s,"eventos":%s}', fmt(cs[1]), fmt(cs[2]), fmt(cs[3]), fmt(cs[4]), fmt(d)))
}
grupo("sobrevivencia", g)
cat("{", R.version.string |> (\(v) paste0('"r_versao": "', v, '",'))(), paste(linhas, collapse = ",\n"), "}", sep = "\n")
