// ========================================
// CALCULADORA NBA - MODELO PROBABILIDADE
// ========================================

// ===============================
// PEGAR VALORES
// ===============================
function pegarValores(classe) {

    let elementos = document.querySelectorAll("." + classe)
    let valores = []

    elementos.forEach(e => {

        let v = Number(e.value)

        if (!isNaN(v) && v > 0) {
            valores.push(v)
        }

    })

    return valores
}

// ===============================
// MEDIA
// ===============================
function media(arr) {

    if (arr.length === 0) return 0

    return arr.reduce((a, b) => a + b, 0) / arr.length
}

// ===============================
// ERF
// ===============================
function erf(x) {

    let sign = (x >= 0) ? 1 : -1

    x = Math.abs(x)

    let a1 = 0.254829592
    let a2 = -0.284496736
    let a3 = 1.421413741
    let a4 = -1.453152027
    let a5 = 1.061405429
    let p = 0.3275911

    let t = 1 / (1 + p * x)

    let y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)

    return sign * y
}

// ===============================
// NORMAL CDF
// ===============================
function normalCDF(x, media, desvio) {

    return (1 - erf((media - x) / (Math.sqrt(2) * desvio))) / 2

}

// ===============================
// CALCULO PRINCIPAL
// ===============================
function calcular() {

    // ===============================
    // DADOS
    // ===============================

    const pontosA = pegarValores("pontosA")
    const sofridosA = pegarValores("sofridosA")

    const pontosB = pegarValores("pontosB")
    const sofridosB = pegarValores("sofridosB")

    const h2hA = pegarValores("h2hA")
    const h2hB = pegarValores("h2hB")

    // ===============================
    // MÉDIAS
    // ===============================

    const ataqueA = media(pontosA)
    const defesaA = media(sofridosA)

    const ataqueB = media(pontosB)
    const defesaB = media(sofridosB)

    const h2hMediaA = media(h2hA)
    const h2hMediaB = media(h2hB)

    // ===============================
    // PROJEÇÃO DE PONTOS
    // ===============================

    let esperadoA = (ataqueA * 0.6) + (defesaB * 0.4)
    let esperadoB = (ataqueB * 0.6) + (defesaA * 0.4)

    if (h2hMediaA > 0 && h2hMediaB > 0) {

        esperadoA = (esperadoA * 0.75) + (h2hMediaA * 0.25)
        esperadoB = (esperadoB * 0.75) + (h2hMediaB * 0.25)

    }

    // ===============================
    // TOTAL E SPREAD
    // ===============================

    let totalEsperado = esperadoA + esperadoB
    let spreadEsperado = esperadoA - esperadoB

    // ===============================
    // LINHA JUSTA DO SPREAD
    // ===============================

    let linhaJustaSpread = Math.round(spreadEsperado * 2) / 2

    let textoLinhaJusta = ""

    if (linhaJustaSpread > 0) {

        textoLinhaJusta = "Time A -" + linhaJustaSpread.toFixed(1)

    } else {

        textoLinhaJusta = "Time B -" + Math.abs(linhaJustaSpread).toFixed(1)

    }

    // ===============================
    // LINHAS DO MERCADO
    // ===============================

    let linhaTotal = Number(document.getElementById("linhaTotal").value)

    let handicapA = Number(document.getElementById("handicapA").value)

    let oddOver = Number(document.getElementById("oddOver").value)
    let oddUnder = Number(document.getElementById("oddUnder").value)

    let oddSpreadA = Number(document.getElementById("oddSpreadA").value)
    let oddSpreadB = Number(document.getElementById("oddSpreadB").value)

    let valorAposta = Number(document.getElementById("valorAposta").value)


    // ===============================
    // DESVIO DINÂMICO
    // ===============================

    // total mais alto = jogo mais caótico
    let desvioTotal = 14 + (totalEsperado * 0.02)

    // spreads grandes aumentam variância
    let desvioSpread = 12 + (Math.abs(spreadEsperado) * 0.18)

    // ===============================
    // PROBABILIDADES
    // ===============================

    let probOver = 1 - normalCDF(linhaTotal, totalEsperado, desvioTotal)
    let probUnder = 1 - probOver

    let diffSpread = spreadEsperado - handicapA

    let probSpreadA = normalCDF(0, diffSpread, desvioSpread)
    let probSpreadB = 1 - probSpreadA

    let probVitoriaA = 1 - normalCDF(0, spreadEsperado, desvioSpread)
    let probVitoriaB = 1 - probVitoriaA

    // ===============================
    // EVENTOS
    // ===============================

    let eventos = [

        { nome: "OVER", prob: probOver, odd: oddOver },
        { nome: "UNDER", prob: probUnder, odd: oddUnder },

        { nome: "SPREAD A", prob: probSpreadA, odd: oddSpreadA },
        { nome: "SPREAD B", prob: probSpreadB, odd: oddSpreadB },

        { nome: "VITORIA A", prob: probVitoriaA, odd: 0 },
        { nome: "VITORIA B", prob: probVitoriaB, odd: 0 }

    ]

    // ===============================
    // ORDENAR
    // ===============================

    eventos.sort((a, b) => b.prob - a.prob)

    let principal = eventos[0]
    let protecao = eventos[1]

    // ===============================
    // CONFIANÇA
    // ===============================

    let confianca = "Baixa"

    if (principal.prob > 0.70) confianca = "Muito Alta"
    else if (principal.prob > 0.60) confianca = "Alta"
    else if (principal.prob > 0.55) confianca = "Média"

    // ===============================
    // HEDGE
    // ===============================

    let stakePrincipal = valorAposta * 0.7
    let stakeProtecao = valorAposta * 0.3

    let lucro = 0

    if (principal.odd > 0) {

        lucro = (stakePrincipal * principal.odd) - valorAposta

    }

    // ===============================
    // RESULTADOS
    // ===============================

    document.getElementById("pontosA").innerText = esperadoA.toFixed(1)
    document.getElementById("pontosB").innerText = esperadoB.toFixed(1)

    document.getElementById("total").innerText = totalEsperado.toFixed(1)
    document.getElementById("spread").innerText = spreadEsperado.toFixed(1)

    document.getElementById("probOver").innerText = (probOver * 100).toFixed(1) + "%"
    document.getElementById("probUnder").innerText = (probUnder * 100).toFixed(1) + "%"

    document.getElementById("probSpreadA").innerText = (probSpreadA * 100).toFixed(1) + "%"
    document.getElementById("probSpreadB").innerText = (probSpreadB * 100).toFixed(1) + "%"

    document.getElementById("probVitoriaA").innerText = (probVitoriaA * 100).toFixed(1) + "%"
    document.getElementById("probVitoriaB").innerText = (probVitoriaB * 100).toFixed(1) + "%"

    // ===============================
    // APOSTAS
    // ===============================

    document.getElementById("apostaPrincipal").innerText = principal.nome
    document.getElementById("cobertura").innerText = protecao.nome
    document.getElementById("confianca").innerText = confianca

    document.getElementById("principalStake").innerText = "R$ " + stakePrincipal.toFixed(2)
    document.getElementById("protecaoStake").innerText = "R$ " + stakeProtecao.toFixed(2)

    document.getElementById("lucroEstimado").innerText = "R$ " + lucro.toFixed(2)
    document.getElementById("linhaJustaSpread").innerText = textoLinhaJusta

}

// ===============================
// PREENCHER AUTOMÁTICO
// ===============================
function preencher() {

    let exemploA = [128, 120, 111, 122, 126]
    let exemploAS = [149, 103, 136, 123, 134]

    let exemploB = [113, 130, 128, 119, 119]
    let exemploBS = [114, 137, 126, 134, 127]

    let exemploH2HA = [99, 142, 125, 115, 110]
    let exemploH2HB = [123, 116, 120, 128, 119]

    document.querySelectorAll(".pontosA").forEach((e, i) => e.value = exemploA[i])
    document.querySelectorAll(".sofridosA").forEach((e, i) => e.value = exemploAS[i])

    document.querySelectorAll(".pontosB").forEach((e, i) => e.value = exemploB[i])
    document.querySelectorAll(".sofridosB").forEach((e, i) => e.value = exemploBS[i])

    document.querySelectorAll(".h2hA").forEach((e, i) => e.value = exemploH2HA[i])
    document.querySelectorAll(".h2hB").forEach((e, i) => e.value = exemploH2HB[i])

    document.getElementById("linhaTotal").value = 237.5
    document.getElementById("handicapA").value = -16.5
    document.getElementById("handicapB").value = 16.5

    document.getElementById("oddOver").value = 1.9
    document.getElementById("oddUnder").value = 1.9

    document.getElementById("oddSpreadA").value = 1.87
    document.getElementById("oddSpreadB").value = 1.95

}

// ===============================
// LIMPAR
// ===============================
function limparCampos() {

    document.querySelectorAll("input").forEach(e => e.value = "")

    document.querySelectorAll("span").forEach(e => e.innerText = "")

}