# Valores de referência do PODER dado n (curva de poder interativa), gerados no R.
fmt <- function(x) formatC(x, digits = 15, format = "g")
g1 <- c(); for (cs in list(c(10,1,1,.05), c(64,5,10,.05), c(20,0.5,1,.05), c(100,0.3,1,.05), c(5,2,1,.05), c(30,10,25,.01), c(200,0.2,1,.05), c(15,1.5,2,.1), c(50,0.5,1,.01), c(8,3,2,.05))) {
  g1 <- c(g1, sprintf('{"n":%s,"delta":%s,"dp":%s,"alfa":%s,"poder":%s}', fmt(cs[1]), fmt(cs[2]), fmt(cs[3]), fmt(cs[4]), fmt(power.t.test(n=cs[1], delta=cs[2], sd=cs[3], sig.level=cs[4])$power)))
}
g2 <- c(); for (cs in list(c(50,.3,.15,.05), c(100,.5,.6,.05), c(500,.01,.05,.05), c(30,.9,.95,.05), c(80,.2,.4,.01), c(400,.45,.55,.05), c(1000,.05,.1,.05), c(20,.7,.5,.05), c(150,.12,.08,.1), c(60,.33,.2,.05))) {
  g2 <- c(g2, sprintf('{"n":%s,"p1":%s,"p2":%s,"alfa":%s,"poder":%s}', fmt(cs[1]), fmt(cs[2]), fmt(cs[3]), fmt(cs[4]), fmt(power.prop.test(n=cs[1], p1=cs[2], p2=cs[3], sig.level=cs[4])$power)))
}
g3 <- c(); for (cs in list(c(10,1,1,.05), c(34,5,10,.05), c(50,0.3,1,.05))) {
  g3 <- c(g3, sprintf('{"n":%s,"delta":%s,"dp":%s,"alfa":%s,"poder":%s}', fmt(cs[1]), fmt(cs[2]), fmt(cs[3]), fmt(cs[4]), fmt(power.t.test(n=cs[1], delta=cs[2], sd=cs[3], sig.level=cs[4], type="paired")$power)))
}
cat('{"poder_t":[', paste(g1, collapse=","), '],"poder_prop":[', paste(g2, collapse=","), '],"poder_pareado":[', paste(g3, collapse=","), ']}', sep="")
