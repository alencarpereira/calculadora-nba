function executarAnalise() {
    const getVal = (id) => parseFloat(document.getElementById(id).value) || 0;
    const mediaLiga = getVal('mediaLiga') || 2.5;

    const mercado = {
        casa: getVal('oddCasa') || 0,
        empate: getVal('oddEmpate') || 0,
        fora: getVal('oddFora') || 0,
        over: getVal('oddOver') || 0,
        under: getVal('oddUnder') || 0,
        btts: getVal('oddBTTS') || 0
    };

    const calcularMediaAjustada = (id) => {
        const input = document.getElementById(id).value;
        if (!input) return 0;
        const v = input.split(/[.,]/).map(x => Number(x.trim()));
        while (v.length < 5) v.push(0);
        return (v[0] + v[1] + v[2] + (v[3] * 1.5) + (v[4] * 1.5)) / 6;
    };

    const ataqueCasa = calcularMediaAjustada('golsMCasa');
    const defesaCasa = calcularMediaAjustada('golsSCasa');
    const ataqueFora = calcularMediaAjustada('golsMFora');
    const defesaFora = calcularMediaAjustada('golsSFora');

    const expGolsCasa = (ataqueCasa + defesaFora + getVal('ataqueCasa') + (2 - getVal('defesaFora'))) / 4;
    const expGolsFora = (ataqueFora + defesaCasa + getVal('ataqueFora') + (2 - getVal('defesaCasa'))) / 4;

    const fatorMotivacao = parseFloat(document.getElementById('motivacao').value) || 1;
    // O fator 0.7 "puxa" os extremos para a média, evitando projeções de 4 ou 5 gols
    const compressao = 0.7;
    const lambdaCasa = Math.max(0.1, (((expGolsCasa + getVal('ataqueCasa')) / 2) * compressao + (mediaLiga / 2) * (1 - compressao)) * fatorMotivacao);
    const lambdaFora = Math.max(0.1, (((expGolsFora + getVal('ataqueFora')) / 2) * compressao + (mediaLiga / 2) * (1 - compressao)) * fatorMotivacao);

    const fatorial = (n) => {
        if (n === 0) return 1;
        let r = 1;
        for (let i = 1; i <= n; i++) r *= i;
        return r;
    };

    const poisson = (lambda, k) => (Math.exp(-lambda) * Math.pow(lambda, k)) / fatorial(k);

    let pCasa = 0, pFora = 0, pEmpate = 0, pOver = 0, pBTTS = 0;
    const rho = -0.05;
    let somaTotalProb = 0;

    for (let i = 0; i < 10; i++) {
        for (let j = 0; j < 10; j++) {
            let probPlacar = poisson(lambdaCasa, i) * poisson(lambdaFora, j);
            if (i === 0 && j === 0) probPlacar *= (1 - (lambdaCasa * lambdaFora * rho));
            else if (i === 0 && j === 1) probPlacar *= (1 + (lambdaCasa * rho));
            else if (i === 1 && j === 0) probPlacar *= (1 + (lambdaFora * rho));
            else if (i === 1 && j === 1) probPlacar *= (1 - rho);

            somaTotalProb += probPlacar;
            if (i > j) pCasa += probPlacar;
            else if (i < j) pFora += probPlacar;
            else pEmpate += probPlacar;
            // Dentro do loop de i e j, aplique um redutor leve no BTTS
            if (i > 0 && j > 0) pBTTS += (probPlacar * 0.9); // Redução de 10% na confiança do BTTS
            if ((i + j) > 2) pOver += (probPlacar * 0.95); // Redução de 5% na confiança do Over 2.5

        }
    }

    pCasa /= somaTotalProb; pFora /= somaTotalProb; pEmpate /= somaTotalProb;
    pOver /= somaTotalProb; pBTTS /= somaTotalProb;

    const calcularKelly = (prob, odd) => {
        if (!odd || odd <= 1) return 0;
        const b = odd - 1;
        const kellyBruto = ((b * prob) - (1 - prob)) / b;
        let stakeSugerida = kellyBruto * 0.25 * 100;
        return kellyBruto > 0 ? parseFloat(Math.min(stakeSugerida, 5.0).toFixed(1)) : 0;
    };

    // --- CÁLCULO DE EV ---
    let evCasa = mercado.casa > 0 ? (pCasa * mercado.casa) - 1 : -1;
    let evBTTS = mercado.btts > 0 ? (pBTTS * mercado.btts) - 1 : -1;
    let evOver = mercado.over > 0 ? (pOver * mercado.over) - 1 : -1;
    let evFora = mercado.fora > 0 ? (pFora * mercado.fora) - 1 : -1;
    let evEmpate = mercado.empate > 0 ? (pEmpate * mercado.empate) - 1 : -1;
    let evUnder = mercado.under > 0 ? ((1 - pOver) * mercado.under) - 1 : -1;

    const kCasa = calcularKelly(pCasa, mercado.casa);
    const kBTTS = calcularKelly(pBTTS, mercado.btts);
    const kOver = calcularKelly(pOver, mercado.over);
    const kFora = calcularKelly(pFora, mercado.fora);
    const kEmpate = calcularKelly(pEmpate, mercado.empate);
    const kUnder = calcularKelly((1 - pOver), mercado.under);

    exibirResultados(
        pCasa * 100, pEmpate * 100, pFora * 100, pBTTS * 100, pOver * 100,
        evCasa, evBTTS, evOver, evFora, // Adicionado evFora aqui
        kCasa, kBTTS, kOver, kFora,     // Adicionado kFora aqui
        lambdaCasa + lambdaFora
    );

    // --- LÓGICA DE SELEÇÃO DA MELHOR APOSTA (SINCRONIZADA) ---
    let maiorScore = -Infinity;
    let principalNome = "Sem Valor";
    let oddFinal = 0;
    let stakeFinal = 0;
    let maiorEVFinal = 0;

    const atualizarMelhor = (nome, ev, prob, odd, stake) => {
        // Mesmas regras: prob > 50% e ev > 0
        if (prob < 0.50 || ev <= 0) return;

        // Aplica o teto de 0.20
        const evFinal = Math.min(ev, 0.20);

        // O Score ajuda a escolher a aposta que equilibra melhor Valor e Chance de Green
        const score = (evFinal * 0.6) + (prob * 0.4);

        if (score > maiorScore) {
            maiorScore = score;
            maiorEVFinal = evFinal;
            principalNome = nome;
            oddFinal = odd;
            stakeFinal = stake;
        }
    };


    // Agora incluímos o Fora e o Under na busca
    const pUnder = 1 - pOver;
    atualizarMelhor("Casa", evCasa, pCasa, mercado.casa, kCasa);
    atualizarMelhor("Fora", evFora, pFora, mercado.fora, kFora);
    atualizarMelhor("BTTS", evBTTS, pBTTS, mercado.btts, kBTTS);
    atualizarMelhor("Over 2.5", evOver, pOver, mercado.over, kOver);
    atualizarMelhor("Under 2.5", evUnder, pUnder, mercado.under, kUnder);

    // DADOS PARA O RELATÓRIO
    const dadosParaSalvar = {
        time: document.getElementById('nomeJogo').value || "Jogo",
        ev: maiorEVFinal,
        odd: oddFinal,
        stake: stakeFinal,
        pC: pCasa * 100, pE: pEmpate * 100, pF: pFora * 100, pB: pBTTS * 100, pO: pOver * 100,
        expGols: lambdaCasa + lambdaFora,
        principal: principalNome // Aqui ele pegará exatamente o que aparecer no card
    };

    // Localize a linha da chamada e substitua por esta:
    exibirResultados(
        pCasa * 100, pEmpate * 100, pFora * 100, pBTTS * 100, pOver * 100, // 1-5
        evCasa, evBTTS, evOver, evFora, evUnder,                         // 6-10
        kCasa, kBTTS, kOver, kFora, kUnder,                             // 11-15
        (lambdaCasa + lambdaFora)                                        // 16 (totalGols)
    );



    // CRIA O BOTÃO (Sincronizado com os dados acima)
    const btn = document.createElement('button');
    btn.innerHTML = "💾 SALVAR NA TABELA DE RELATÓRIO";
    btn.style = "width:100%; margin-top:15px; padding:12px; background:#1a237e; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer;";
    btn.onclick = () => salvarResultado(dadosParaSalvar);
    document.getElementById('painelResultado').appendChild(btn);

}
// --- FUNÇÃO DE TRAVA RIGOROSA ---
const filtrarEVDentroDasRegras = (prob, ev) => {
    // Se a chance for menor que 50%, descarta (Retorna null)
    if (prob < 50) return null;
    // Se o EV for negativo ou margem de erro, descarta
    if (ev <= 0) return null;
    // Se o EV for absurdo, trava em 20%
    return Math.min(ev, 0.20);
};

const vC = filtrarEVDentroDasRegras(pC, evC);
const vF = filtrarEVDentroDasRegras(pF, evF);
const vB = filtrarEVDentroDasRegras(pBTTS, evB);
const vO = filtrarEVDentroDasRegras(pOver, evO);

// Agora o HTML só recebe o que passou no filtro acima
if (vC) html += criarCard("Valor em Casa", vC, fairC, kellyC, "#2e7d32");
if (vF) html += criarCard("Valor em Fora", vF, fairF, kellyF, "#c62828");
if (vB) html += criarCard("Valor em BTTS", vB, fairB, kellyB, "#1565c0");
if (vO) html += criarCard("Valor em Over 2.5", vO, fairO, kellyO, "#ef6c00");


function salvarResultado(dados) {
    let hist = JSON.parse(localStorage.getItem('meuHistoricoApostas')) || [];
    dados.resultado = "Pendente";
    dados.lucro = 0;
    hist.unshift(dados);
    localStorage.setItem('meuHistoricoApostas', JSON.stringify(hist));
    renderizarTabela();
    alert("Salvo!");
}

function marcarResultado(index, tipo) {
    let hist = JSON.parse(localStorage.getItem('meuHistoricoApostas')) || [];
    let jogo = hist[index];
    let valorApostado = 100 * (Number(jogo.stake) / 100);
    if (tipo === 'Green') {
        jogo.lucro = (Number(jogo.odd) - 1) * valorApostado;
        jogo.resultado = "Green";
    } else {
        jogo.lucro = -valorApostado;
        jogo.resultado = "Red";
    }
    localStorage.setItem('meuHistoricoApostas', JSON.stringify(hist));
    renderizarTabela();
}

function validarPlacar(index) {
    const gC = parseInt(document.getElementById(`resC-${index}`).value);
    const gF = parseInt(document.getElementById(`resF-${index}`).value);
    if (isNaN(gC) || isNaN(gF)) return alert("Placar!");
    let hist = JSON.parse(localStorage.getItem('meuHistoricoApostas')) || [];
    let jogo = hist[index];
    let deuGreen = false;
    const total = gC + gF;
    const aposta = jogo.principal;

    if (aposta === "Over 2.5" && total > 2.5) deuGreen = true;
    else if (aposta === "Under 2.5" && total < 2.5) deuGreen = true;
    else if (aposta === "BTTS" && gC > 0 && gF > 0) deuGreen = true;
    else if (aposta === "Casa" && gC > gF) deuGreen = true;
    else if (aposta === "Empate" && gC === gF) deuGreen = true;
    else if (aposta === "Fora" && gF > gC) deuGreen = true;

    jogo.golsC = gC; jogo.golsF = gF;
    marcarResultado(index, deuGreen ? 'Green' : 'Red');
}

function renderizarTabela() {
    const hist = JSON.parse(localStorage.getItem('meuHistoricoApostas')) || [];
    const corpo = document.getElementById('corpoTabela');
    if (!corpo) return;
    let soma = 0;
    corpo.innerHTML = hist.map((j, i) => {
        soma += Number(j.lucro || 0);
        let bg = j.resultado === "Green" ? "#e8f5e9" : (j.resultado === "Red" ? "#ffebee" : "#fff9c4");
        return `<tr style="background:${bg}; border-bottom:1px solid #ddd; text-align:center;">
            <td style="padding:8px;">${j.time}</td>
            <td>${Number(j.ev).toFixed(2)}</td>
            <td>${Number(j.odd).toFixed(2)}</td>
            <td>${Number(j.stake).toFixed(1)}%</td>
            <td>${Number(j.pC).toFixed(1)}%</td>
            <td>${Number(j.pE).toFixed(1)}%</td>
            <td>${Number(j.pF).toFixed(1)}%</td>
            <td>${Number(j.pB).toFixed(1)}%</td>
            <td>${Number(j.pO).toFixed(1)}%</td>
            <td>${Number(j.expGols).toFixed(2)}</td>
            <td><b>${j.principal}</b></td>
            <td>
                <input type="number" id="resC-${i}" style="width:35px;" value="${j.golsC ?? ''}"> x 
                <input type="number" id="resF-${i}" style="width:35px;" value="${j.golsF ?? ''}">
                <button onclick="validarPlacar(${i})">OK</button>
            </td>
            <td style="color:${j.lucro >= 0 ? 'green' : 'red'}">R$ ${Number(j.lucro).toFixed(2)}</td>
            <td><button onclick="excluirLinha(${i})">🗑️</button></td>
        </tr>`;
    }).join('');
    document.getElementById('lucroTotal').innerHTML = `Lucro Total: R$ ${soma.toFixed(2)}`;
    document.getElementById('saldoAtual').innerHTML = `Saldo Atual: R$ ${(100 + soma).toFixed(2)}`;
}

function excluirLinha(i) {
    let hist = JSON.parse(localStorage.getItem('meuHistoricoApostas')) || [];
    hist.splice(i, 1);
    localStorage.setItem('meuHistoricoApostas', JSON.stringify(hist));
    renderizarTabela();
}

function ajustarMediaLiga() {
    const s = document.getElementById('selectLiga');
    const i = document.getElementById('mediaLiga');
    if (s.value === "custom") { i.value = ""; i.focus(); }
    else if (s.value) { i.value = s.value; }
}

function preencherExemplo() {
    document.getElementById('oddCasa').value = "2.05";
    document.getElementById('oddEmpate').value = "3.40";
    document.getElementById('oddFora').value = "3.80";
    document.getElementById('oddOver').value = "1.90";
    document.getElementById('oddUnder').value = "1.90";
    document.getElementById('oddBTTS').value = "1.72";
    document.getElementById('golsMCasa').value = "2,1,1,0,3";
    document.getElementById('golsSCasa').value = "0,1,1,2,0";
    document.getElementById('ataqueCasa').value = "1.8";
    document.getElementById('defesaCasa').value = "1.2";
    document.getElementById('golsMFora').value = "1,1,2,0,1";
    document.getElementById('golsSFora').value = "1,2,1,1,3";
    document.getElementById('ataqueFora').value = "1.4";
    document.getElementById('defesaFora').value = "1.6";
    document.getElementById('nomeJogo').value = "Flamengo x Vasco";
}

function limparCampos() {
    document.querySelectorAll('input').forEach(i => i.value = "");
    document.getElementById('resultado').style.display = 'none';
}

window.onload = renderizarTabela;
function exibirResultados(pC, pE, pF, pBTTS, pOver, evC, evB, evO, evF, evU, kellyC, kellyB, kellyO, kellyF, kellyU, totalGols) {
    const painel = document.getElementById('painelResultado');
    const resultadoDiv = document.getElementById('resultado');

    if (resultadoDiv) resultadoDiv.style.display = 'block';

    const calcularFairOdd = (p) => (p > 0) ? (100 / p).toFixed(2) : "-";

    const fairC = calcularFairOdd(pC);
    const fairE = calcularFairOdd(pE);
    const fairF = calcularFairOdd(pF);
    const fairB = calcularFairOdd(pBTTS);
    const fairO = calcularFairOdd(pOver);
    const fairU = calcularFairOdd(100 - pOver);

    // 1. Definições auxiliares
    const criarCard = (titulo, ev, fair, stake, cor) => {
        return `<div style="background:${cor}15; padding:10px; border-radius:8px; border:2px solid ${cor}; margin-bottom: 8px;">
        <b style="color:${cor}; text-transform:uppercase;">🔥 ${titulo} (EV: ${(ev * 100).toFixed(1)}%)</b><br>
        Odd Justa: ${fair} | Stake: <b>${stake}%</b></div>`;
    };

    const filtrarEVDentroDasRegras = (prob, ev) => {
        if (prob < 50) return null;
        if (!ev || ev <= 0.02) return null;
        return Math.min(ev, 0.20);
    };

    // 2. Montagem do HTML inicial
    let html = `
        <div style="display: flex; justify-content: space-between; margin-bottom: 15px; font-weight: bold; font-size: 0.9em;">
            <span>🏠 Casa: ${Number(pC).toFixed(1)}% <small style="color:#666">(${fairC})</small></span>
            <span>🤝 Empate: ${Number(pE).toFixed(1)}% <small style="color:#666">(${fairE})</small></span>
            <span>🚀 Fora: ${Number(pF).toFixed(1)}% <small style="color:#666">(${fairF})</small></span>
        </div>
        <div style="display: flex; justify-content: space-around; margin-bottom: 15px; font-size: 0.85em;">
            <span style="color: #1565c0;">⚽ BTTS: <b>${Number(pBTTS).toFixed(1)}%</b> <small style="color:#666">(${fairB})</small></span>
            <span style="color: #e65100;">📈 Over 2.5: <b>${Number(pOver).toFixed(1)}%</b> <small style="color:#666">(${fairO})</small></span>
        </div>
    `;

    // 3. Filtros
    const vC = filtrarEVDentroDasRegras(pC, evC);
    const vF = filtrarEVDentroDasRegras(pF, evF);
    const vB = filtrarEVDentroDasRegras(pBTTS, evB);
    const vO = filtrarEVDentroDasRegras(pOver, evO);
    const vU = filtrarEVDentroDasRegras(100 - pOver, evU);

    // 4. Cards
    if (vC) html += criarCard("Casa", vC, fairC, kellyC, "#2e7d32");
    if (vF) html += criarCard("Fora", vF, fairF, kellyF, "#c62828");
    if (vB) html += criarCard("BTTS", vB, fairB, kellyB, "#1565c0");
    if (vO) html += criarCard("Over 2.5", vO, fairO, kellyO, "#ef6c00");
    if (vU) html += criarCard("Under 2.5", vU, fairU, kellyU, "#546e7a");

    // 5. Verificação de vazio
    if (!vC && !vF && !vB && !vO && !vU) {
        html += `<div style="background:#fff3e0; color:#e65100; padding:12px; border-radius:8px; text-align:center; border:1px solid #ffb74d;">
            ⚠️ Sem entradas de alta confiança (>50% prob e valor real).
        </div>`;
    }

    // 6. Rodapé (Expectativa de Gols)
    const golsFormatado = (typeof totalGols === 'number') ? totalGols.toFixed(2) : "0.00";
    html += `<p style="font-size: 0.8em; margin-top: 10px; color: #666; text-align:center;">Expectativa Total: <b>${golsFormatado} gols</b></p>`;

    if (painel) painel.innerHTML = html;
}


// 1. FUNÇÃO PARA SALVAR (Garante que os números entrem limpos)
function salvarResultado(dados) {
    let historico = JSON.parse(localStorage.getItem('meuHistoricoApostas')) || [];
    // Adiciona campos iniciais de controle
    dados.resultado = "Pendente";
    dados.lucro = 0;

    historico.unshift(dados);
    localStorage.setItem('meuHistoricoApostas', JSON.stringify(historico));
    renderizarTabela();
    alert("Análise salva com sucesso!");
}

// 2. FUNÇÃO PARA CALCULAR GREEN/RED (Arruma a última coluna)
function marcarResultado(index, tipo) {
    let historico = JSON.parse(localStorage.getItem('meuHistoricoApostas')) || [];
    let jogo = historico[index];
    const bancaBase = 100; // Valor da sua banca para o cálculo

    // Converte a stake para valor financeiro (ex: 1.8% de 1000 = 18.00)
    let valorApostado = bancaBase * (Number(jogo.stake) / 100);

    if (tipo === 'Green') {
        // Lucro Líquido: (Odd - 1) * Valor Apostado
        jogo.lucro = (Number(jogo.odd) - 1) * valorApostado;
        jogo.resultado = "Green";
    } else {
        // Prejuízo: Valor Apostado negativo
        jogo.lucro = -valorApostado;
        jogo.resultado = "Red";
    }

    localStorage.setItem('meuHistoricoApostas', JSON.stringify(historico));
    renderizarTabela(); // Atualiza o R$ na tela na hora
}

// 3. FUNÇÃO PARA RENDERIZAR (O visual da tabela)
function renderizarTabela() {
    const historico = JSON.parse(localStorage.getItem('meuHistoricoApostas')) || [];
    const corpo = document.getElementById('corpoTabela');
    if (!corpo) return;

    let somaLucro = 0;

    corpo.innerHTML = historico.map((jogo, index) => {
        const ev = Number(jogo.ev) || 0;
        const odd = Number(jogo.odd) || 0;
        const stake = Number(jogo.stake) || 0;
        const lucro = Number(jogo.lucro) || 0;
        somaLucro += lucro;

        let bgLinha = "#fff9c4"; // Pendente (Amarelo)
        if (jogo.resultado === "Green") bgLinha = "#e8f5e9";
        if (jogo.resultado === "Red") bgLinha = "#ffebee";

        return `
            <tr style="background: ${bgLinha}; border-bottom: 1px solid #ddd; text-align: center;">
                <td style="padding:8px; font-weight:bold; border: 1px solid #ddd;">${jogo.time}</td>
                <td style="border: 1px solid #ddd;">${ev.toFixed(2)}</td>
                <td style="border: 1px solid #ddd;">${odd.toFixed(2)}</td>
                <td style="border: 1px solid #ddd; color: #1565c0; font-weight:bold;">${stake.toFixed(1)}%</td>
                <td style="border: 1px solid #ddd;">${Number(jogo.pC).toFixed(1)}%</td>
                <td style="border: 1px solid #ddd;">${Number(jogo.pE).toFixed(1)}%</td>
                <td style="border: 1px solid #ddd;">${Number(jogo.pF).toFixed(1)}%</td>
                <td style="border: 1px solid #ddd;">${Number(jogo.pB).toFixed(1)}%</td>
                <td style="border: 1px solid #ddd;">${Number(jogo.pO).toFixed(1)}%</td>
                <td style="border: 1px solid #ddd;">${Number(jogo.expGols).toFixed(2)}</td>
                <td style="border: 1px solid #ddd; background: #fffde7;"><b>${jogo.principal}</b></td>
            
<td style="border: 1px solid #ddd; min-width: 140px; padding: 5px;">
    <div style="display: flex; align-items: center; justify-content: center; gap: 5px;">
        <input type="number" id="resC-${index}" 
               style="width: 45px; height: 25px; text-align: center; border: 1px solid #999; border-radius: 4px; font-weight: bold; font-size: 1.1em; appearance: textfield;" 
               value="${jogo.golsC !== undefined ? jogo.golsC : ''}">
        
        <span style="font-weight: bold; font-size: 1.1em;">×</span>
        
        <input type="number" id="resF-${index}" 
               style="width: 45px; height: 25px; text-align: center; border: 1px solid #999; border-radius: 4px; font-weight: bold; font-size: 1.1em; appearance: textfield;" 
               value="${jogo.golsF !== undefined ? jogo.golsF : ''}">
        
        <button onclick="validarPlacar(${index})" 
                style="background: #1a237e; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-weight: bold; transition: 0.2s;">
            OK
        </button>
    </div>
</td>


                <td style="border: 1px solid #ddd; font-weight:bold; color: ${lucro >= 0 ? '#2e7d32' : '#c62828'}">
                    R$ ${lucro.toFixed(2)}
                </td>
                <td style="border: 1px solid #ddd;">
                    <button onclick="excluirLinha(${index})" style="background:none; border:none; cursor:pointer; font-size:1.2em;">🗑️</button>
                </td>
            </tr>
        `;
    }).join('');

    // Atualiza Painel de Saldo
    const bancaInicial = 100;
    const lucroTotalElem = document.getElementById('lucroTotal');
    const saldoAtualElem = document.getElementById('saldoAtual');

    if (lucroTotalElem) lucroTotalElem.innerHTML = `Lucro Total: ${somaLucro >= 0 ? '+' : ''} R$ ${somaLucro.toFixed(2)}`;
    if (saldoAtualElem) saldoAtualElem.innerHTML = `Saldo Atual: R$ ${(bancaInicial + somaLucro).toFixed(2)}`;
}

// 3. LIMPAR TUDO
function limparHistorico() {
    if (confirm("Deseja apagar todas as análises salvas?")) {
        localStorage.removeItem('meuHistoricoApostas');
        renderizarTabela();
    }
}

// Chamar ao carregar a página
window.onload = renderizarTabela;

function excluirLinha(index) {
    if (confirm("Deseja excluir esta análise permanentemente?")) {
        let historico = JSON.parse(localStorage.getItem('meuHistoricoApostas')) || [];
        historico.splice(index, 1); // Remove 1 item na posição index
        localStorage.setItem('meuHistoricoApostas', JSON.stringify(historico));
        renderizarTabela(); // Atualiza a tela
    }
}

function validarPlacar(index) {
    let historico = JSON.parse(localStorage.getItem('meuHistoricoApostas')) || [];
    let jogo = historico[index];

    if (!jogo) return alert("Erro: Jogo não encontrado!");
    const bancaBase = 100;

    const gC = parseInt(document.getElementById(`resC-${index}`).value);
    const gF = parseInt(document.getElementById(`resF-${index}`).value);

    if (isNaN(gC) || isNaN(gF)) return alert("Preencha o placar!");

    // ATUALIZAÇÃO DO NOME COM O PLACAR
    // Remove placares antigos se houver e coloca o novo
    let nomeLimpo = jogo.time.split(" (")[0];
    jogo.time = `${nomeLimpo} (${gC} x ${gF})`;

    jogo.golsC = gC;
    jogo.golsF = gF;

    let deuGreen = false;
    const totalGols = gC + gF;
    const aposta = jogo.principal;

    // Substitua o bloco de IFs por este:
    if (aposta === "Over 2.5" && totalGols > 2.5) deuGreen = true;
    else if (aposta === "Under 2.5" && totalGols < 2.5) deuGreen = true; // ADICIONE ESTA LINHA
    else if (aposta === "BTTS" && gC > 0 && gF > 0) deuGreen = true;
    else if (aposta === "Casa" && gC > gF) deuGreen = true;
    else if (aposta === "Empate" && gC === gF) deuGreen = true;
    else if (aposta === "Fora" && gF > gC) deuGreen = true;


    let valorApostado = bancaBase * (Number(jogo.stake) / 100);

    if (deuGreen) {
        jogo.lucro = (Number(jogo.odd) - 1) * valorApostado;
        jogo.resultado = "Green";
    } else {
        jogo.lucro = -valorApostado;
        jogo.resultado = "Red";
    }

    localStorage.setItem('meuHistoricoApostas', JSON.stringify(historico));
    renderizarTabela();
}

function exportarCSV() {
    const historico = JSON.parse(localStorage.getItem('meuHistoricoApostas')) || [];
    if (historico.length === 0) return alert("Não há dados para exportar!");

    // Cabeçalho da planilha
    let csv = "Analise do Time;Valor EV;Odd;Stake;Casa;Empate;Fora;BTTS;Over 2.5;Exp Gols;Aposta Principal;Resultado;Lucro (R$)\n";

    historico.forEach(j => {
        // Organiza as colunas separadas por ponto e vírgula (padrão Excel Brasil)
        csv += `${j.time};`;
        csv += `${Number(j.ev).toFixed(2)};`;
        csv += `${Number(j.odd).toFixed(2)};`;
        csv += `${Number(j.stake).toFixed(1)}%;`;
        csv += `${Number(j.pC).toFixed(1)}%;`;
        csv += `${Number(j.pE).toFixed(1)}%;`;
        csv += `${Number(j.pF).toFixed(1)}%;`;
        csv += `${Number(j.pB).toFixed(1)}%;`;
        csv += `${Number(j.pO).toFixed(1)}%;`;
        csv += `${Number(j.expGols).toFixed(2)};`;
        csv += `${j.principal};`;
        csv += `${j.resultado};`;
        csv += `${Number(j.lucro).toFixed(2)}\n`;
    });

    // Cria o arquivo para download
    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `relatorio_apostas_${new Date().toLocaleDateString().replace(/\//g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
function ajustarMediaLiga() {

    const select = document.getElementById('selectLiga');
    const inputMedia = document.getElementById('mediaLiga');

    if (select.value === "custom") {

        inputMedia.value = "";
        inputMedia.focus();
        inputMedia.style.backgroundColor = "#ffffff";

        return;
    }

    if (select.value) {

        inputMedia.value = select.value;

        inputMedia.style.backgroundColor = "#fff9c4";
        inputMedia.style.border = "2px solid #1a237e";

        setTimeout(() => {
            inputMedia.style.backgroundColor = "#f9f9f9";
            inputMedia.style.border = "1px solid #ccc";
        }, 600);

    }
}

// Função para preencher com um cenário de exemplo (ex: Flamengo vs Palmeiras)
function preencherExemplo() {
    // 1. ODDS DO MERCADO
    document.getElementById('oddCasa').value = "2.05";
    document.getElementById('oddEmpate').value = "3.40";
    document.getElementById('oddFora').value = "3.80";
    document.getElementById('oddOver').value = "1.90";
    document.getElementById('oddUnder').value = "1.90";
    document.getElementById('oddBTTS').value = "1.72";

    // 2. DADOS TIME CASA (IDs corrigidos conforme seu HTML)
    document.getElementById('golsMCasa').value = "2,1,1,0,3";
    document.getElementById('golsSCasa').value = "0,1,1,2,0";
    document.getElementById('ataqueCasa').value = "1.8";
    document.getElementById('defesaCasa').value = "1.2";

    // 3. DADOS TIME FORA (IDs corrigidos conforme seu HTML)
    document.getElementById('golsMFora').value = "1,1,2,0,1";
    document.getElementById('golsSFora').value = "1,2,1,1,3";
    document.getElementById('ataqueFora').value = "1.4";
    document.getElementById('defesaFora').value = "1.6";

    // 4. NOME DO JOGO
    document.getElementById('nomeJogo').value = "Flamengo x Vasco";

    console.log("Exemplo carregado com sucesso!");
}


// Função para limpar todos os campos
function limparCampos() {
    const inputs = document.querySelectorAll('input');
    inputs.forEach(input => input.value = "");

    const selects = document.querySelectorAll('select');
    selects.forEach(select => select.selectedIndex = 0);

    document.getElementById('resultado').style.display = 'none';
    document.getElementById('painelResultado').innerHTML = "";

    console.log("Formulário limpo!");
}
