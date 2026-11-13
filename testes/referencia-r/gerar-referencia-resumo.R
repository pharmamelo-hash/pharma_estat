fmt <- function(x) formatC(x, digits = 15, format = "g")
g <- c()
for (cs in list(c(12,5,20,31), c(3,9,8,4), c(40,60,25,75), c(1,19,6,14), c(150,850,100,900), c(7,3,2,8), c(22,18,19,21), c(5,45,15,35), c(30,10,12,28), c(2,2,9,1))) {
  tab <- matrix(cs, 2, byrow = TRUE)
  q <- suppressWarnings(chisq.test(tab, correct = FALSE)); f <- fisher.test(tab)
  g <- c(g, sprintf('{"a":%s,"b":%s,"c":%s,"d":%s,"qui":%s,"pQui":%s,"pFisher":%s}', fmt(cs[1]), fmt(cs[2]), fmt(cs[3]), fmt(cs[4]), fmt(unname(q$statistic)), fmt(q$p.value), fmt(f$p.value)))
}
w <- c(); set.seed(1)
for (cs in list(c(10,5.2,1.1,12,4.1,2.3), c(30,120,15,30,112,14), c(8,1.4,0.5,25,1.1,0.2), c(100,36.6,0.4,90,36.7,0.5), c(5,9,3,5,4,1), c(40,7.2,2.2,38,7.2,2.0), c(15,88,20,60,80,9), c(3,2,1,4,5,2), c(200,5.1,1.9,210,4.8,2.1), c(12,0.9,0.3,12,1.3,0.6))) {
  # reconstrói amostras com exatamente esses n, média e DP e roda t.test
  mk <- function(n, m, s) { x <- rnorm(n); x <- (x - mean(x)) / sd(x); x * s + m }
  t <- t.test(mk(cs[1], cs[2], cs[3]), mk(cs[4], cs[5], cs[6]))
  w <- c(w, sprintf('{"n1":%s,"m1":%s,"dp1":%s,"n2":%s,"m2":%s,"dp2":%s,"t":%s,"gl":%s,"p":%s,"li":%s,"ls":%s}', fmt(cs[1]), fmt(cs[2]), fmt(cs[3]), fmt(cs[4]), fmt(cs[5]), fmt(cs[6]), fmt(unname(t$statistic)), fmt(unname(t$parameter)), fmt(t$p.value), fmt(t$conf.int[1]), fmt(t$conf.int[2])))
}
cat('{"tabelas":[', paste(g, collapse=","), '],"welch":[', paste(w, collapse=","), ']}', sep="")
