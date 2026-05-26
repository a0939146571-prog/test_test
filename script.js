// ==========================================
// 💡 已自動代換為您最新的 GAS 正式發布網址
// ==========================================
const GAS_URL = "https://script.google.com/macros/s/AKfycbyJP_KzE-qsHJOUoZiUAhoweAjphbkPe0hMQrL9IkDD5GXGfWKEc497Q6mhP-24mVba/exec";

let currentQuestions = [];
let userInfo = {};

// 頁面切換控制
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    window.scrollTo(0, 0);
}

// 啟動測驗：驗證前端表單並向後端撈取隨機題目
document.getElementById('startExamBtn').addEventListener('click', function() {
    const vendorName = document.getElementById('vendorName').value.trim();
    const employeeId = document.getElementById('employeeId').value.trim();
    const userName = document.getElementById('userName').value.trim();
    const examType = document.getElementById('examType').value;

    if (!vendorName || !employeeId || !userName || !examType) {
        alert("請完整填寫所有欄位！");
        return;
    }

    // 保存考生基本資料
    userInfo = { vendorName, employeeId, userName, examType };

    // 顯示載入中動畫或文字
    document.getElementById('loadingText').style.display = 'block';
    document.getElementById('startExamBtn').disabled = true;

    // 向後端 GAS 請求對應類別的題目
    fetch(`${GAS_URL}?type=${encodeURIComponent(examType)}`)
        .then(response => response.json())
        .then(data => {
            document.getElementById('loadingText').style.display = 'none';
            document.getElementById('startExamBtn').disabled = false;

            if (data.error) {
                alert(`系統錯誤: ${data.error}`);
                return;
            }

            currentQuestions = data;
            if (currentQuestions.length === 0) {
                alert("該考試類別目前沒有題目，請聯絡環安衛管理人員！");
                return;
            }

            // 渲染題目到測驗頁面
            renderQuestions();
            showPage('quizPage');
        })
        .catch(error => {
            document.getElementById('loadingText').style.display = 'none';
            document.getElementById('startExamBtn').disabled = false;
            console.error("撈取題目失敗:", error);
            alert("連線後端失敗，請確認您的 GAS 網址與權限部署是否正確設定為『所有人(Anyone)』！");
        });
});

// 渲染考卷內容到網頁上
function renderQuestions() {
    const container = document.getElementById('questionsContainer');
    container.innerHTML = '';

    currentQuestions.forEach((q, index) => {
        const qBox = document.createElement('div');
        qBox.className = 'question-box';

        // 題目標題
        const qTitle = document.createElement('p');
        qTitle.className = 'question-title';
        const typeBadge = q.type === "TF" ? "[是非題]" : "[單選題]";
        qTitle.innerHTML = `<b>第 ${index + 1} 題 ${typeBadge}</b>：${q.question}`;
        qBox.appendChild(qTitle);

        // 選項區
        const optionsDiv = document.createElement('div');
        optionsDiv.className = 'options-container';

        if (q.type === "TF") {
            // 是非題固定選項：是/非
            optionsDiv.appendChild(createRadioOption(q.id, "true", "是 (O)"));
            optionsDiv.appendChild(createRadioOption(q.id, "false", "非 (X)"));
        } else {
            // 單選題動態選項
            q.options.forEach(opt => {
                const cleanOpt = opt.trim();
                if(cleanOpt) {
                    optionsDiv.appendChild(createRadioOption(q.id, cleanOpt, cleanOpt));
                }
            });
        }

        qBox.appendChild(optionsDiv);
        container.appendChild(qBox);
    });
}

// 建立單選/是非按鈕元件
function createRadioOption(qId, value, labelText) {
    const label = document.createElement('label');
    label.className = 'option-label';

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = `question_${qId}`;
    radio.value = value;
    radio.required = true;

    label.appendChild(radio);
    label.appendChild(document.createTextNode(` ${labelText}`));
    return label;
}

// 考生點擊「確認交卷」
document.getElementById('quizForm').addEventListener('submit', function(e) {
    e.preventDefault();

    if (!confirm("確定要交卷評分了嗎？")) return;

    // 收集作答答案
    const answers = {};
    currentQuestions.forEach(q => {
        const selected = document.querySelector(`input[name="question_${q.id}"]:checked`);
        answers[q.id] = selected ? selected.value : "";
    });

    // 顯示送出中狀態
    document.getElementById('submitBtn').disabled = true;
    document.getElementById('submitBtn').value = "閱卷中，請稍候...";

    // 發送作答結果到後端 GAS 線上閱卷
    fetch(GAS_URL, {
        method: "POST",
        body: JSON.stringify({
            action: "score",
            examType: userInfo.examType, // 帶入考卷名稱供後台識別及格線
            answers: answers
        })
    })
    .then(response => response.json())
    .then(scoreData => {
        // 線上評分完成後，立刻將成績與詳細作答明細打包，連同使用者資訊再次發送給後台做「背景存檔與PDF產出」
        fetch(GAS_URL, {
            method: "POST",
            body: JSON.stringify({
                action: "save",
                userInfo: userInfo,
                score: scoreData.score,
                details: scoreData.details
            })
        });

        // 渲染最終結果頁面
        renderResultPage(scoreData);
        showPage('resultPage');
    })
    .catch(error => {
        document.getElementById('submitBtn').disabled = false;
        document.getElementById('submitBtn').value = "確認交卷";
        console.error("閱卷通訊失敗:", error);
        alert("閱卷伺服器通訊失敗，請重新嘗試交卷！");
    });
});

// 渲染結果頁面（完全動態判定及格分數）
function renderResultPage(data) {
    // 顯示考生基本資料
    document.getElementById('resExamType').textContent = userInfo.examType;
    document.getElementById('resVendor').textContent = userInfo.vendorName;
    document.getElementById('resId').textContent = userInfo.employeeId;
    document.getElementById('resName').textContent = userInfo.userName;

    // 顯示分數
    document.getElementById('displayScore').textContent = `${data.score} 分`;

    // 💡 動態及格判定：優先讀取後端回傳的及格線 data.passingScore，若無則採用 80 分防呆
    const passingThreshold = data.passingScore || 80;
    const isPass = data.score >= passingThreshold;

    const statusBox = document.getElementById('displayStatus');
    statusBox.textContent = isPass ? `評定：及格 (門檻: ${passingThreshold}分)` : `評定：不及格 (門檻: ${passingThreshold}分)`;
    statusBox.className = `status-box ${isPass ? 'pass' : 'fail'}`;

    // 渲染網頁底部的錯題/對題檢視列表
    const reviewContainer = document.getElementById('reviewContainer');
    reviewContainer.innerHTML = '';

    data.details.forEach((w, index) => {
        const item = document.createElement('div');
        item.className = `review-item ${w.isCorrect ? 'correct-item' : 'wrong-item'}`;

        let userText = w.userAns === "true" ? "是" : (w.userAns === "false" ? "非" : w.userAns);
        let correctText = w.correctAns === "true" ? "是" : (w.correctAns === "false" ? "非" : w.correctAns);
        let statusBadge = w.isCorrect ? `<span class="badge-ok">[答對]</span>` : `<span class="badge-no">[答錯]</span>`;

        item.innerHTML = `
            <p><b>第 ${index + 1} 題：${w.question}</b> ${statusBadge}</p>
            <p style="margin: 4px 0; color: ${w.isCorrect ? '#2e7d32' : '#c62828'};">您的答案：${userText}</p>
            <p style="margin: 4px 0; color: #2e7d32;">正確答案：${correctText} <span style="color:#757575; font-size:0.85em; margin-left:10px;">(出處: ${w.source || '本廠規範'})</span></p>
        `;
        reviewContainer.appendChild(item);
    });
}
