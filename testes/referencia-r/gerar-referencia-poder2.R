fmt <- function(x) formatC(x, digits = 15, format = "g")
pw_t <- function(n, d, a, caudas, k, pareado) {
  if (pareado) { gl <- n - 1; ncp <- sqrt(n) * d } else { n2 <- k * n; gl <- n + n2 - 2; ncp <- d * sqrt(n * n2 / (n + n2)) }
  pt(qt(1 - a / caudas, gl), gl, ncp = ncp, lower.tail = FALSE)
}
t1 <- c()
for (cs in list(c(30,.5,.05,2,1,0), c(30,.5,.05,1,1,0), c(20,.8,.05,2,2,0), c(50,.3,.01,2,.5,0), c(15,1,.05,1,3,0), c(40,.4,.05,2,1.1,0), c(12,.9,.05,2,1,1), c(25,.5,.05,1,1,1), c(100,.25,.05,2,1,0), c(8,1.4,.1,2,1.5,0))) {
  t1 <- c(t1, sprintf('{"n":%s,"d":%s,"alfa":%s,"caudas":%s,"k":%s,"pareado":%s,"poder":%s}', fmt(cs[1]), fmt(cs[2]), fmt(cs[3]), fmt(cs[4]), fmt(cs[5]), ifelse(cs[6]==1,"true","false"), fmt(pw_t(cs[1],cs[2],cs[3],cs[4],cs[5],cs[6]==1))))
}
# conferência cruzada com power.t.test (k = 1)
t2 <- c()
for (cs in list(c(30,.5,.05,"two.sided","two.sample"), c(30,.5,.05,"one.sided","two.sample"), c(12,.9,.05,"two.sided","paired"), c(25,.5,.05,"one.sided","paired"))) {
  t2 <- c(t2, sprintf('{"n":%s,"d":%s,"alfa":%s,"alt":"%s","tipo":"%s","poder":%s}', cs[1], cs[2], cs[3], cs[4], cs[5], fmt(power.t.test(n=as.numeric(cs[1]), delta=as.numeric(cs[2]), sd=1, sig.level=as.numeric(cs[3]), alternative=cs[4], type=cs[5])$power)))
}
pr <- c()
for (cs in list(c(100,.3,.15,.05,"two.sided"), c(100,.3,.15,.05,"one.sided"), c(60,.5,.7,.01,"two.sided"), c(250,.1,.05,.05,"one.sided"))) {
  pr <- c(pr, sprintf('{"n":%s,"p1":%s,"p2":%s,"alfa":%s,"alt":"%s","poder":%s}', cs[1], cs[2], cs[3], cs[4], cs[5], fmt(power.prop.test(n=as.numeric(cs[1]), p1=as.numeric(cs[2]), p2=as.numeric(cs[3]), sig.level=as.numeric(cs[4]), alternative=cs[5])$power)))
}
# n com razão k (resolvido no R por uniroot)
nk <- c()
for (cs in list(c(.4,.05,.8,2,1.1), c(.5,.05,.9,2,2), c(.3,.05,.8,1,.5), c(.8,.01,.8,2,3))) {
  f <- function(n) pw_t(n, cs[1], cs[2], cs[4], cs[5], FALSE) - cs[3]
  nk <- c(nk, sprintf('{"d":%s,"alfa":%s,"poder":%s,"caudas":%s,"k":%s,"n1":%s}', fmt(cs[1]), fmt(cs[2]), fmt(cs[3]), fmt(cs[4]), fmt(cs[5]), fmt(uniroot(f, c(2, 1e6), tol = 1e-12)$root)))
}
cat('{"t":[', paste(t1, collapse=","), '],"t_r":[', paste(t2, collapse=","), '],"prop_r":[', paste(pr, collapse=","), '],"n_razao":[', paste(nk, collapse=","), ']}', sep="")
