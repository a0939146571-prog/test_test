const GAS_URL = "https://script.google.com/macros/s/AKfycbxxReCxqhxQwwlkoVOX4HPPWxnzVNPPvCTOrO25SB0R128rCoNP52ia20f32BcHhcgu/exec"; 
let examResultData = null; 

// 進入第二頁並依據下拉選單抓取考題
async function goToPage2() {
    const vName = document.getElementById('vendorName').value;
    const eId = document.getElementById('employeeId').value;
    const uName = document.getElementById('userName').value;
    const eType = document.getElementById('examType').value;

    if (!vName || !eId || !uName || !eType) return alert('請填寫完整資訊並選擇考卷');
    
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
        alert("題目載入失敗，請確認後台試算表 Questions 中 ExamType 欄位是否有對應的題目！");
    }
}

// 動態渲染考題
function renderQuestions(questions) {
    const form = document.getElementById('examForm');
    form.innerHTML = '';
    
    if(questions.length === 0) {
        document.getElementById('loadingText').textContent = "此考卷類別目前無題目，請洽管理員。";
        return;
    }

    questions.forEach((q, i) => {
        const div = document.createElement('div');
        div.className = 'question';
        div.innerHTML = `<p>${i + 1}. ${q.question} <small style="color:gray;">(${q.source})</small></p>`;
        const opts = document.createElement('div');
        if (q.type === "TF") {
            opts.innerHTML = `<label><input type="radio" name="${q.id}" value="true" required> 是</label>
                              <label><input type="radio" name="${q.id}" value="false"> 非</label>`;
        } else {
            q.options.forEach(opt => {
                opts.innerHTML += `<label><input type="radio" name="${q.id}" value="${opt}" required> ${opt}</label>`;
            });
        }
        div.appendChild(opts);
        form.appendChild(div);
    });
    
    const btn = document.createElement('button');
    btn.textContent = "送出";
    btn.type = "submit";
    form.appendChild(btn);
    
    form.onsubmit = submitExam;
    document.getElementById('loadingText').style.display = 'none';
}

// 提交至後端進行 80 分及格制的評分
async function submitExam(e) {
    e.preventDefault();
    const form = document.getElementById('examForm');
    if (!form.checkValidity()) return alert("還有題目沒填喔！");

    const formData = new FormData(form);
    const answers = {};
    formData.forEach((v, k) => answers[k] = v);

    const btn = document.querySelector("#page2 button");
    btn.disabled = true;
    btn.textContent = "評分中...";

    try {
        const response = await fetch(GAS_URL, { method: "POST", body: JSON.stringify({ answers: answers }) });
        examResultData = await response.json();
        renderResultPage(examResultData);
        showPage('page3');
    } catch (e) { 
        alert("評分系統連線失敗"); 
        btn.disabled = false;
        btn.textContent = "送出";
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
    const isPass = data.score >= 80; // 80分及格制
    status.textContent = isPass ? "及格" : "不及格";
    status.className = `status-box ${isPass ? 'pass' : 'fail'}`;

    const errorList = document.getElementById('errorList');
    errorList.innerHTML = `<h3 style="color:#d9534f; margin-top:20px; text-align:left;">錯誤題目解析</h3>`;
    const wrongs = data.details.filter(d => !d.isCorrect);
    
    if (wrongs.length === 0) {
        errorList.innerHTML += `<p style="color:green; text-align:left;">全對！太棒了！</p>`;
    } else {
        wrongs.forEach(w => {
            errorList.innerHTML += `
                <div style="text-align:left; border-bottom:1px solid #eee; padding:10px 0; font-size: 0.95em;">
                    <p><b>題目：</b>${w.question}</p>
                    <p style="color:red; margin: 4px 0;">您的答案：${w.userAns === "true" ? "是" : (w.userAns === "false" ? "非" : w.userAns)}</p>
                    <p style="color:green; margin: 4px 0;">正確答案：${w.correctAns === "true" ? "是" : (w.correctAns === "false" ? "非" : w.correctAns)} <small style="color:gray;">(${w.source})</small></p>
                </div>`;
        });
    }
    const today = new Date();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
    document.getElementById('currentDate').textContent = `${today.getFullYear()}/${month}/${day}`;
}

// 確認存檔上傳，傳送給後端做 Excel 登錄並自動生成雲端 PDF
async function uploadData() {
    const btn = document.getElementById('submitToDatabase');
    btn.disabled = true; 
    btn.textContent = "系統建檔中...";
    
    const info = JSON.parse(localStorage.getItem('userInfo'));
    const payload = { 
        action: "save", 
        userInfo: info, 
        score: examResultData.score,
        details: examResultData.details 
    };
    
    try {
        await fetch(GAS_URL, { method: "POST", mode: "no-cors", body: JSON.stringify(payload) });
        alert("考試成績已寫入資料庫，電子考卷 PDF 已成功上傳存檔！");
        btn.textContent = "上傳完成";
    } catch (e) { 
        alert("上傳失敗"); 
        btn.disabled = false; 
        btn.textContent = "確認並送出成績"; 
    }
}

function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}