// ==========================================
// 💡 已自動代換為您最新的 GAS 正式發布網址
// ==========================================
const GAS_URL = "https://script.google.com/macros/s/AKfycbyJP_KzE-qsHJOUoZiUAhoweAjphbkPe0hMQrL9IkDD5GXGfWKEc497Q6mhP-24mVba/exec";

let currentQuestions = [];
let userInfo = {};
let lastScoreData = null; // 用於暫存評分結果，待手動送出

// 頁面切換控制
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    window.scrollTo(0, 0);
}

// 啟動測驗：【極速優化版】先切換頁面，再非同步撈取題目
document.getElementById('startExamBtn').addEventListener('click', function() {
    const vendorName = document.getElementById('vendorName').value.trim();
    const employeeId = document.getElementById('employeeId').value.trim();
    const userName = document.getElementById('userName').value.trim();
    const examType = document.getElementById('examType').value;

    if (!vendorName || !employeeId || !userName || !examType) {
        alert("請完整填寫所有欄位！");
        return;
    }

    // 1. 瞬間鎖定本頁基本資料
    userInfo = { vendorName, employeeId, userName, examType };

    // 2. 🔥 【關鍵優化點】不等網路連線，0秒直接切換到第二頁！
    // 清空舊題目容器，並把「正在隨機抽取題型...」的載入動畫秀出來
    document.getElementById('questionsContainer').innerHTML = '';
    document.getElementById('loadingText').style.display = 'block';
    document.getElementById('submitBtn').style.display = 'none'; // 題目還沒好之前，先隱藏交卷按鈕
    showPage('quizPage');

    // 3. 讓瀏覽器在後台默默跟 Google 伺服器通訊，不卡死前端畫面
    fetch(`${GAS_URL}?type=${encodeURIComponent(examType)}`)
        .then(response => response.json())
        .then(data => {
            // 4. 題目撈取完成，隱藏載入文字，顯示交卷按鈕
            document.getElementById('loadingText').style.display = 'none';
            document.getElementById('submitBtn').style.display = 'block';

            if (data.error) {
                alert(`系統錯誤: ${data.error}`);
                showPage('page1'); // 發生錯誤時退回第一頁
                return;
            }

            currentQuestions = data;
            // 5. 渲染題目到畫面上
            renderQuestions();
        })
        .catch(error => {
            console.error("撈取題目失敗:", error);
            alert("連線後端失敗，請檢查網路連線或權限設定！");
            showPage('page1'); // 失敗時退回第一頁
        });
});

// 渲染題目
function renderQuestions() {
    const container = document.getElementById('questionsContainer');
    container.innerHTML = '';
    
    currentQuestions.forEach((q, index) => {
        const qBox = document.createElement('div');
        qBox.className = 'question-box';
        
        // 判定題型標籤
        const typeBadge = q.type === "TF" ? "[是非題]" : "[單選題]";
        qBox.innerHTML = `<p class='question-title'><b>第 ${index + 1} 題 ${typeBadge}</b>：${q.question}</p>`;
        
        const optionsDiv = document.createElement('div');
        optionsDiv.className = 'options-container';
        
        if (q.type === "TF") {
            optionsDiv.appendChild(createRadioOption(q.id, "true", "是 (O)"));
            optionsDiv.appendChild(createRadioOption(q.id, "false", "非 (X)"));
        } else {
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

function createRadioOption(qId, value, labelText) {
    const label = document.createElement('label');
    label.className = 'option-label';
    label.innerHTML = `<input type="radio" name="question_${qId}" value="${value}" required> ${labelText}`;
    return label;
}

// 點擊交卷評分：一樣做非同步優化，交卷瞬間先進入第三頁
document.getElementById('quizForm').addEventListener('submit', function(e) {
    e.preventDefault();
    if (!confirm("確定交卷評分？")) return;

    const answers = {};
    currentQuestions.forEach(q => {
        const selected = document.querySelector(`input[name="question_${q.id}"]:checked`);
        answers[q.id] = selected ? selected.value : "";
    });

    // 🔥 【關鍵優化點】交卷時「0秒直接切換到第三頁」！
    // 先把分數格子清空，顯示「評定中」的等待狀態，避免考生在第二頁狂按重複送出
    document.getElementById('resExamType').textContent = userInfo.examType;
    document.getElementById('resVendor').textContent = userInfo.vendorName;
    document.getElementById('resId').textContent = userInfo.employeeId;
    document.getElementById('resName').textContent = userInfo.userName;
    document.getElementById('displayScore').textContent = "閱卷中...";
    document.getElementById('displayStatus').textContent = "計算分數中...";
    document.getElementById('displayStatus').className = "status-box";
    document.getElementById('reviewContainer').innerHTML = "<p style='color:gray;text-align:center;'>正在核對答案...</p>";
    
    showPage('resultPage');

    // 讓瀏覽器在背景默默閱卷
    fetch(GAS_URL, {
        method: "POST",
        body: JSON.stringify({ action: "score", examType: userInfo.examType, answers: answers })
    })
    .then(response => response.json())
    .then(data => {
        lastScoreData = data; // 存入暫存
        // 閱卷完成，動態更新第三頁的分數、顏色與對錯明細
        renderResultPage(data);
    })
    .catch(error => {
        console.error("閱卷通訊失敗:", error);
        alert("閱卷伺服器連線超時，請重新提交！");
        showPage('quizPage'); // 失敗時回彈
    });
});

// 手動送出成績至環安衛後台
document.getElementById('uploadBtn').addEventListener('click', function() {
    if (!lastScoreData) return;
    
    this.disabled = true;
    this.textContent = "成績上傳中，請勿關閉網頁...";

    fetch(GAS_URL, {
        method: "POST",
        body: JSON.stringify({
            action: "save",
            userInfo: userInfo,
            score: lastScoreData.score,
            details: lastScoreData.details
        })
    })
    .then(() => {
        alert("成績已成功上傳至環安衛後台資料庫，並已自動生成 PDF 稽核紀錄表！");
        location.reload(); // 完成後重整回首頁
    })
    .catch(error => {
        console.error("上傳失敗:", error);
        alert("送出失敗，請確認網路連線是否正常！");
        this.disabled = false;
        this.textContent = "確認並送出成績至環安衛後台";
    });
});

// 渲染結果頁面的詳細對錯資訊
function renderResultPage(data) {
    document.getElementById('displayScore').textContent = `${data.score} 分`;

    const passingThreshold = data.passingScore || 80;
    const isPass = data.score >= passingThreshold;
    
    const statusBox = document.getElementById('displayStatus');
    statusBox.textContent = isPass ? `評定：及格 (門檻: ${passingThreshold}分)` : `評定：不及格 (門檻: ${passingThreshold}分)`;
    statusBox.className = `status-box ${isPass ? 'pass' : 'fail'}`;

    // 渲染詳細檢討列表
    const reviewContainer = document.getElementById('reviewContainer');
    reviewContainer.innerHTML = '';

    data.details.forEach((w, index) => {
        const item = document.createElement('div');
        item.className = `review-item ${w.isCorrect ? 'correct-item' : 'wrong-item'}`;

        let userText = w.userAns === "true" ? "是" : (w.userAns === "false" ? "非" : w.userAns);
        let correctText = w.correctAns === "true" ? "是" : (w.correctAns === "false" ? "非" : w.correctAns);
        let statusBadge = w.isCorrect ? `<span style="color:#2e7d32;font-weight:bold;">[答對 O]</span>` : `<span style="color:#c62828;font-weight:bold;">[答錯 X]</span>`;

        item.innerHTML = `
            <p style="margin: 5px 0;"><b>第 ${index + 1} 題：${w.question}</b> ${statusBadge}</p>
            <p style="margin: 3px 0; font-size:0.9em; color: ${w.isCorrect ? '#2e7d32' : '#c62828'};">您的作答：${userText}</p>
            <p style="margin: 3px 0; font-size:0.9em; color: #2e7d32;">正確答案：${correctText} <span style="color:#757575; font-size:0.85em; margin-left:15px;">(出處: ${w.source || '本廠規範'})</span></p>
        `;
        reviewContainer.appendChild(item);
    });
}
