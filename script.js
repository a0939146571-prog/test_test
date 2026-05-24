const GAS_URL = "https://script.google.com/macros/s/AKfycbxxReCxqhxQwwlkoVOX4HPPWxnzVNPPvCTOrO25SB0R128rCoNP52ia20f32BcHhcgu/exec"; 
let examResultData = null; 

// 進入第二頁並依據下拉選單抓取考題
async function goToPage2() {
    const vName = document.getElementById('vendorName').value.trim();
    const eId = document.getElementById('employeeId').value.trim();
    const uName = document.getElementById('userName').value.trim();
    const eType = document.getElementById('examType').value;

    if (!vName || !eId || !uName || !eType) {
        return alert('請完整填寫廠商、工號、姓名並選擇考卷項目！');
    }
    
    // 基本工號長度防呆
    if (eId.length !== 8) {
        return alert('工號格式不正確，須為 8 碼英數字組合！');
    }
    
    localStorage.setItem('userInfo', JSON.stringify({ 
        vendorName: vName, 
        employeeId: eId, 
        userName: uName,
        examType: eType 
    }));
    
    showPage('page2');

    try {
        const response = await fetch(`${GAS_URL}?type=${encodeURIComponent(eType)}`);
        const questions = await response.json();
        renderQuestions(questions);
    } catch (e) {
        alert("題目載入失敗！請確認後台試算表 Questions 中的 ExamType 欄位名稱是否與選項完全一致。");
    }
}

// 動態渲染隨機抽出的考題
function renderQuestions(questions) {
    const form = document.getElementById('examForm');
    form.innerHTML = '';
    
    if(!questions || questions.length === 0) {
        document.getElementById('loadingText').textContent = "此考卷類別目前在題庫中無對應題目，請洽廠區環安衛管理人員。";
        return;
    }

    questions.forEach((q, i) => {
        const div = document.createElement('div');
        div.className = 'question-block';
        div.innerHTML = `<p class="question-title"><b>Q${i + 1}.</b> ${q.question} <span class="q-source">(${q.source})</span></p>`;
        
        const opts = document.createElement('div');
        opts.className = 'options-group';
        
        if (q.type === "TF") {
            opts.innerHTML = `
                <label class="option-label"><input type="radio" name="${q.id}" value="true" required> <span>是 (O)</span></label>
                <label class="option-label"><input type="radio" name="${q.id}" value="false"> <span>非 (X)</span></label>
            `;
        } else {
            q.options.forEach(opt => {
                let cleanOpt = opt.trim();
                opts.innerHTML += `
                    <label class="option-label"><input type="radio" name="${q.id}" value="${cleanOpt}" required> <span>${cleanOpt}</span></label>
                `;
            });
        }
        div.appendChild(opts);
        form.appendChild(div);
    });
    
    const btn = document.createElement('button');
    btn.textContent = "完成交卷並進行線上評分";
    btn.className = "btn-submit";
    btn.type = "submit";
    form.appendChild(btn);
    
    form.onsubmit = submitExam;
    document.getElementById('loadingText').style.display = 'none';
}

// 提交至後端進行評分 (標準：80 分及格)
async function submitExam(e) {
    e.preventDefault();
    const form = document.getElementById('examForm');
    if (!form.checkValidity()) return alert("還有題目尚未作答喔！");

    const formData = new FormData(form);
    const answers = {};
    formData.forEach((v, k) => answers[k] = v);

    const btn = document.querySelector("#page2 button");
    btn.disabled = true;
    btn.textContent = "安全線上評分中...";

    try {
        const response = await fetch(GAS_URL, { method: "POST", body: JSON.stringify({ answers: answers }) });
        examResultData = await response.json();
        renderResultPage(examResultData);
        showPage('page3');
    } catch (e) { 
        alert("評分系統連線逾時，請檢查網路連線狀態。"); 
        btn.disabled = false;
        btn.textContent = "完成交卷並進行線上評分";
    }
}

// 顯示第三頁結果與錯題解析
function renderResultPage(data) {
    const info = JSON.parse(localStorage.getItem('userInfo'));
    document.getElementById('displayExamType').textContent = info.examType;
    document.getElementById('displayVendorName').textContent = info.vendorName;
    document.getElementById('displayEmployeeId').textContent = info.employeeId;
    document.getElementById('displayName').textContent = info.userName;
    document.getElementById('displayScore').textContent = Math.round(data.score);
    
    const status = document.getElementById('displayStatus');
    const isPass = data.score >= 80; // 80分及格門檻
    status.textContent = isPass ? "評定：及格" : "評定：不及格";
    status.className = `status-box ${isPass ? 'pass' : 'fail'}`;

    const errorList = document.getElementById('errorList');
    errorList.innerHTML = `<h3 class="error-zone-title">錯題解析與精進學習</h3>`;
    const wrongs = data.details.filter(d => !d.isCorrect);
    
    if (wrongs.length === 0) {
        errorList.innerHTML += `<p class="perfect-text">恭喜！本次測驗全對，完美通過環安衛考核！</p>`;
    } else {
        wrongs.forEach(w => {
            let uAnsText = w.userAns === "true" ? "是 (O)" : (w.userAns === "false" ? "非 (X)" : w.userAns);
            let cAnsText = w.correctAns === "true" ? "是 (O)" : (w.correctAns === "false" ? "非" : w.correctAns);
            errorList.innerHTML += `
                <div class="wrong-item">
                    <p class="wrong-q"><b>題目：</b>${w.question}</p>
                    <p class="wrong-user">您的答案：${uAnsText}</p>
                    <p class="wrong-correct">正確答案：${cAnsText} <small class="source-tag">(${w.source})</small></p>
                </div>`;
        });
    }
    const today = new Date();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
    document.getElementById('currentDate').textContent = `${today.getFullYear()}/${month}/${day}`;
}

// 確認存檔上傳，觸發後端登錄 Excel 並自動產生 PDF 存入您的指定 Folder
async function uploadData() {
    const btn = document.getElementById('submitToDatabase');
    btn.disabled = true; 
    btn.textContent = "系統建檔與雲端 PDF 產出中...";
    
    const info = JSON.parse(localStorage.getItem('userInfo'));
    const payload = { 
        action: "save", 
        userInfo: info, 
        score: examResultData.score,
        details: examResultData.details 
    };
    
    try {
        await fetch(GAS_URL, { method: "POST", mode: "no-cors", body: JSON.stringify(payload) });
        alert("【環安衛後台系統提示】\n成績登錄成功！電子考卷 PDF 紀錄已自動建檔至您的指定雲端資料夾中。");
        btn.textContent = "雲端建檔完成";
    } catch (e) { 
        alert("上傳失敗，請再試一次。"); 
        btn.disabled = false; 
        btn.textContent = "確認並送出成績至環安衛後台"; 
    }
}

function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    // 切換頁面時自動滾動回頂端
    window.scrollTo({ top: 0, behavior: 'smooth' });
}