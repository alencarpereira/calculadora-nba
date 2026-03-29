// ========================================
// CALCULADORA NBA - ANALISE TIME A
// ========================================

// ===============================
// PEGAR VALORES
// ===============================
function pegarValores(classe) {
    let elementos = document.querySelectorAll("." + classe);
    let valores = [];
    elementos.forEach(e => {
        let v = Number(e.value);
        if (!isNaN(v) && v > 0) {
            valores.push(v);
        }
    });
    return valores;
}

// ===============================
// MEDIA
// ===============================
function media(arr) {
    if (arr.length === 0) return 0;
    let soma = arr.reduce((a, b) => a + b, 0);
    return soma / arr.length;
}

// ===============================
// CALCULO PRINCIPAL
// ===============================
function calcular() {
    // ===============================
    // DADOS
    // ===============================
    const pontosA = pegarValores("pontosA");
    const sofridosA = pegarValores("sofridosA");
    const pontosB = pegarValores("pontosB");
    const sofridosB = pegarValores("sofridosB");
    const h2hA = pegarValores("h2hA");
    const h2hB = pegarValores("h2hB");

    // ===============================
    // MÉDIAS
    // ===============================
    const ataqueA = media(pontosA);
    const defesaA = media(sofridosA);
    const ataqueB = media(pontosB);
    const defesaB = media(sofridosB);
    const h2hMediaA = media(h2hA);
    const h2hMediaB = media(h2hB);

    // ===============================
    // PROJEÇÃO BASE
    // ===============================
    let esperadoA = (ataqueA + defesaB) / 2;
    let esperadoB = (ataqueB + defesaA) / 2;

    // ===============================
    // AJUSTE H2H
    // ===============================
    if (h2hMediaA > 0 && h2hMediaB > 0) {
        esperadoA = (esperadoA * 0.75) + (h2hMediaA * 0.25);
        esperadoB = (esperadoB * 0.75) + (h2hMediaB * 0.25);
    }

    // ===============================
    // TOTAL
    // ===============================
    let totalEsperado = esperadoA + esperadoB;

    // ===============================
    // SPREAD
    // ===============================
    let spreadEsperado = esperadoA - esperadoB;

    // ===============================
    // LINHAS MERCADO
    // ===============================
    let linhaTotal = Number(document.getElementById("linhaTotal").value);
    let handicapA = Number(document.getElementById("handicapA").value);
    let handicapB = Number(document.getElementById("handicapB").value);

    // ===============================
    // ANALISE TOTAL
    // ===============================
    let analiseTotal = "";
    if (!isNaN(linhaTotal)) {
        analiseTotal = (totalEsperado > linhaTotal) ? "➡ Tendência OVER" : "➡ Tendência UNDER";
    }

    // ===============================
    // ANALISE SPREAD
    // ===============================
    let analiseSpread = "";
    if (!isNaN(handicapA) && !isNaN(handicapB)) {
        // Comparar spread do modelo com os handicaps da casa
        if (spreadEsperado > handicapA) {
            analiseSpread = "➡ Valor no Time A";
        } else if (spreadEsperado < handicapB) {
            analiseSpread = "➡ Valor no Time B";
        } else {
            analiseSpread = "➡ Handicap equilibrado / cuidado";
        }
    }

    // ===============================
    // MOSTRAR RESULTADOS
    // ===============================
    document.getElementById("pontosA").innerText = esperadoA.toFixed(1);
    document.getElementById("pontosB").innerText = esperadoB.toFixed(1);
    document.getElementById("total").innerText = totalEsperado.toFixed(1) + " | " + analiseTotal;
    document.getElementById("spread").innerText = spreadEsperado.toFixed(1) + " | " + analiseSpread;

    // ===============================
    // RECOMENDAÇÃO DE APOSTA
    // ===============================
    document.getElementById("recomendacaoTotal").innerText = "Total: " + analiseTotal;
    document.getElementById("recomendacaoSpread").innerText = "Handicap: " + analiseSpread;
}

// ===============================
// PREENCHER AUTOMÁTICO
// ===============================
function preencher() {
    let exemploA = [128, 120, 111, 122, 126];
    let exemploAS = [149, 103, 136, 123, 134];
    let exemploB = [113, 130, 128, 119, 119];
    let exemploBS = [114, 137, 126, 134, 127];
    let exemploH2HA = [99, 142, 125, 115, 110];
    let exemploH2HB = [123, 116, 120, 128, 119];

    document.querySelectorAll(".pontosA").forEach((e, i) => e.value = exemploA[i]);
    document.querySelectorAll(".sofridosA").forEach((e, i) => e.value = exemploAS[i]);
    document.querySelectorAll(".pontosB").forEach((e, i) => e.value = exemploB[i]);
    document.querySelectorAll(".sofridosB").forEach((e, i) => e.value = exemploBS[i]);
    document.querySelectorAll(".h2hA").forEach((e, i) => e.value = exemploH2HA[i]);
    document.querySelectorAll(".h2hB").forEach((e, i) => e.value = exemploH2HB[i]);

    document.getElementById("linhaTotal").value = 237.5;
    document.getElementById("handicapA").value = -16.5;
    document.getElementById("handicapB").value = 16.5;
}

// ===============================
// LIMPAR CAMPOS
// ===============================
function limparCampos() {
    document.querySelectorAll("input").forEach(input => input.value = "");

    document.getElementById("pontosA").innerText = "";
    document.getElementById("pontosB").innerText = "";
    document.getElementById("total").innerText = "";
    document.getElementById("spread").innerText = "";
    document.getElementById("recomendacaoTotal").innerText = "Total: -";
    document.getElementById("recomendacaoSpread").innerText = "Handicap: -";
}