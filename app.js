/**
 * 新北市立頭前國民中學 - 定期評量成績查詢與管理系統
 * app.js
 */

// Global State
let currExamData = [];
let prevExamData = [];
let studentRoster = [];
let isIdMasked = true;
let currentTab = 'query';
let isTeacherLoggedIn = false;

// Chart Instances
let radarChartInstance = null;
let barChartInstance = null;
let classSubjectChartInstance = null;
let gradeDistChartInstance = null;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  isTeacherLoggedIn = sessionStorage.getItem('tq_teacher_auth') === 'true';
  initData();
  checkTeacherAuth();
  updateClassStats();
});

/**
 * 檢查成績是否已輸入有效數值
 */
function isScoreEntered(val) {
  if (val === undefined || val === null || val === '') return false;
  const num = Number(val);
  return !isNaN(num) && num >= 0;
}

/**
 * 取得成績數值或 null
 */
function getScoreVal(val) {
  return isScoreEntered(val) ? parseFloat(val) : null;
}

/**
 * 載入預設或儲存的成績資料
 */
function initData() {
  const defaultData = window.DEFAULT_DATA || {};
  studentRoster = defaultData.students || [];
  
  // Previous Exam (807-11423)
  const savedPrev = localStorage.getItem('tq_grades_prev_exam');
  if (savedPrev) {
    try {
      prevExamData = JSON.parse(savedPrev);
    } catch (e) {
      prevExamData = defaultData.prev_exam || [];
    }
  } else {
    prevExamData = defaultData.prev_exam || [];
  }

  // Current Exam (907-11511)
  const savedCurr = localStorage.getItem('tq_grades_curr_exam');
  if (savedCurr) {
    try {
      currExamData = JSON.parse(savedCurr);
    } catch (e) {
      currExamData = defaultData.curr_exam || [];
    }
  } else {
    currExamData = defaultData.curr_exam || [];
  }

  // Ensure rankings and progress are up-to-date
  computeRanksAndProgress();
}

/**
 * 計算全班排名與進退步（支援科目延遲輸入、部分登錄與年名次尚未公布情境）
 */
function computeRanksAndProgress() {
  const prevMap = {};
  prevExamData.forEach(p => {
    prevMap[p.seat] = p;
  });

  currExamData.forEach(c => {
    const subjects = [c.chinese, c.english, c.math, c.social, c.science];
    const entered = subjects.filter(s => isScoreEntered(s)).map(s => parseFloat(s));
    c.entered_count = entered.length;

    if (c.entered_count === 5) {
      c.total = Math.round(entered.reduce((a, b) => a + b, 0) * 10) / 10;
      c.average = Math.round((c.total / 5) * 10) / 10;
      const p = prevMap[c.seat];
      c.progress = p && p.total !== undefined ? Math.round((c.total - p.total) * 10) / 10 : 0;
    } else if (c.entered_count > 0) {
      c.total = Math.round(entered.reduce((a, b) => a + b, 0) * 10) / 10;
      c.average = Math.round((c.total / c.entered_count) * 10) / 10;
      c.progress = null; // 待全科登錄完成後結算
    } else {
      c.total = null;
      c.average = null;
      c.progress = null;
    }

    // 若年名次尚未由學校輸入 (0 或空)，保持為 null (學校尚未公布)
    if (!c.grade_rank || c.grade_rank <= 0) {
      c.grade_rank = null;
    }
  });

  // 計算班排名：僅對五科皆已輸入完成的學生計算完整名次
  const allCompleteStudents = currExamData.filter(c => c.entered_count === 5);
  if (allCompleteStudents.length > 0) {
    const sorted = [...allCompleteStudents].sort((a, b) => b.total - a.total);
    sorted.forEach((item, idx) => {
      const original = currExamData.find(c => c.seat === item.seat);
      if (original) {
        original.class_rank = idx + 1;
      }
    });
  }

  // 科目未填齊的學生班名次設為 null (結算中)
  currExamData.forEach(c => {
    if (c.entered_count < 5) {
      c.class_rank = null;
    }
  });
}

/**
 * 切換頁籤 (Tab Switcher)
 */
function switchTab(tabId) {
  currentTab = tabId;
  const tabs = ['query', 'teacher', 'stats'];
  tabs.forEach(t => {
    const btn = document.getElementById(`tab-btn-${t}`);
    const view = document.getElementById(`view-${t}`);
    if (btn) btn.classList.toggle('active', t === tabId);
    if (view) view.style.display = (t === tabId) ? 'block' : 'none';
  });

  if (tabId === 'teacher') {
    checkTeacherAuth();
  } else if (tabId === 'stats') {
    updateClassStats();
  }
}

/**
 * 檢查導師登入狀態並更新畫面
 */
function checkTeacherAuth() {
  const loginView = document.getElementById('teacher-login-view');
  const contentView = document.getElementById('teacher-content-view');

  if (isTeacherLoggedIn) {
    if (loginView) loginView.style.display = 'none';
    if (contentView) contentView.style.display = 'block';
    renderTeacherTable();
  } else {
    if (loginView) loginView.style.display = 'block';
    if (contentView) contentView.style.display = 'none';
  }
}

/**
 * 導師身分驗證登入
 */
function handleTeacherLogin(event) {
  if (event && event.preventDefault) event.preventDefault();

  const accInput = document.getElementById('teacher-acc');
  const pwdInput = document.getElementById('teacher-pwd');
  const alertBox = document.getElementById('teacher-login-alert');

  const account = accInput ? accInput.value.trim() : '';
  const password = pwdInput ? pwdInput.value.trim() : '';

  // 驗證帳號: 907導師，密碼: 123456789
  if (account === '907導師' && password === '123456789') {
    isTeacherLoggedIn = true;
    sessionStorage.setItem('tq_teacher_auth', 'true');
    if (alertBox) alertBox.style.display = 'none';
    checkTeacherAuth();
    // 自動聚焦於第 01 號國文欄位
    setTimeout(() => {
      const firstInput = document.getElementById('score-01-chinese');
      if (firstInput) firstInput.focus();
    }, 150);
  } else {
    if (alertBox) {
      alertBox.textContent = '帳號或密碼不正確！請確認帳號為「907導師」，密碼為 123456789。';
      alertBox.style.display = 'block';
    }
  }
}

/**
 * 導師登出
 */
function logoutTeacher() {
  isTeacherLoggedIn = false;
  sessionStorage.removeItem('tq_teacher_auth');
  const pwdInput = document.getElementById('teacher-pwd');
  if (pwdInput) pwdInput.value = '';
  const alertBox = document.getElementById('teacher-login-alert');
  if (alertBox) alertBox.style.display = 'none';
  checkTeacherAuth();
}

/**
 * 快捷代入導師帳密 (測試用)
 */
function quickFillTeacherLogin() {
  const accInput = document.getElementById('teacher-acc');
  const pwdInput = document.getElementById('teacher-pwd');
  if (accInput) accInput.value = '907導師';
  if (pwdInput) pwdInput.value = '123456789';
  handleTeacherLogin(new Event('submit'));
}

/**
 * 密碼顯示/隱藏切換
 */
function togglePasswordVisibility(fieldId) {
  const field = document.getElementById(fieldId);
  if (field) {
    field.type = field.type === 'password' ? 'text' : 'password';
  }
}

/**
 * 快速填入測試資料
 */
function quickFill(seat, name, id3) {
  document.getElementById('query-class').value = '907';
  document.getElementById('query-seat').value = seat;
  document.getElementById('query-name').value = name;
  document.getElementById('query-id3').value = id3;
  document.getElementById('query-id3').type = 'text';

  // 觸發查詢
  handleStudentQuery(new Event('submit'));
}

/**
 * 清除查詢表單
 */
function resetQueryForm() {
  document.getElementById('student-query-form').reset();
  document.getElementById('query-alert').style.display = 'none';
  document.getElementById('query-result-card').style.display = 'none';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * 處理家長/學生查詢
 */
function handleStudentQuery(event) {
  if (event && event.preventDefault) event.preventDefault();

  const examType = document.getElementById('query-exam').value;
  const classVal = document.getElementById('query-class').value;
  const seatInput = document.getElementById('query-seat').value.trim();
  const nameInput = document.getElementById('query-name').value.trim();
  const id3Input = document.getElementById('query-id3').value.trim().toUpperCase();

  const alertBox = document.getElementById('query-alert');
  const resultCard = document.getElementById('query-result-card');

  if (!seatInput || !nameInput || !id3Input) {
    showAlert('請完整填寫座號、姓名與身分證末三碼！', 'danger');
    return;
  }

  // Normalize seat to two digits (e.g. "1" -> "01")
  const seatNum = parseInt(seatInput, 10);
  if (isNaN(seatNum) || seatNum < 1 || seatNum > 99) {
    showAlert('座號格式不正確，請輸入 1 至 31 之間的數字。', 'danger');
    return;
  }
  const seatFormatted = seatNum < 10 ? '0' + seatNum : '' + seatNum;

  // Find student in roster
  const student = studentRoster.find(s => {
    const sSeat = s[0].trim();
    const sName = s[1].trim();
    const sId = s[2].trim().toUpperCase();
    const sLast3 = sId.slice(-3);

    const seatMatch = (sSeat === seatFormatted || parseInt(sSeat, 10) === seatNum);
    const nameMatch = (sName === nameInput);
    const idMatch = (sLast3 === id3Input);

    return seatMatch && nameMatch && idMatch;
  });

  if (!student) {
    showAlert(
      `查無相符資料！請確認輸入是否正確：<br>
       1. 座號與姓名是否完全相符。<br>
       2. 身分證號末 3 碼是否正確。<br>
       （提示：您可以點擊下方「快速體驗測試」標籤嘗試）`,
      'danger'
    );
    resultCard.style.display = 'none';
    return;
  }

  // Matched student found!
  alertBox.style.display = 'none';

  const seat = student[0].padStart(2, '0');
  const name = student[1];
  const fullId = student[2];
  const idMasked = fullId.slice(0, 3) + '****' + fullId.slice(-3);

  // Retrieve current and previous exam data
  const currRecord = currExamData.find(c => c.seat === seat) || {};
  const prevRecord = prevExamData.find(p => p.seat === seat) || {};

  renderStudentResultCard({
    student,
    seat,
    name,
    fullId,
    idMasked,
    currRecord,
    prevRecord,
    examType
  });

  resultCard.style.display = 'block';
  setTimeout(() => {
    resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

/**
 * 顯示警示通知
 */
function showAlert(message, type = 'danger') {
  const alertBox = document.getElementById('query-alert');
  alertBox.className = `alert-box alert-${type}`;
  alertBox.innerHTML = message;
  alertBox.style.display = 'block';
}

/**
 * 渲染個別學生成績通知卡與對比表（完整支援延遲登錄與未公布狀況）
 */
function renderStudentResultCard({ student, seat, name, currRecord, prevRecord }) {
  // Compute class averages
  const classStats = computeClassSubjectAverages();

  // Populate Hero Header
  document.getElementById('res-name').textContent = name;
  document.getElementById('res-class-badge').textContent = `九年七班 ${seat}號`;
  document.getElementById('res-student-id').textContent = currRecord.student_id || prevRecord.student_id || ('355' + seat);

  // 計算已登錄科目數
  const subjects = [
    { key: 'chinese', name: '國文' },
    { key: 'english', name: '英語' },
    { key: 'math',    name: '數學' },
    { key: 'social',  name: '社會' },
    { key: 'science', name: '自然' }
  ];

  const enteredCount = subjects.filter(s => isScoreEntered(currRecord[s.key])).length;
  const isPendingGradeRank = !currRecord.grade_rank || currRecord.grade_rank <= 0;
  const hasPendingItems = (enteredCount < 5) || isPendingGradeRank;

  // 頂部提示條：若有科目或排名未出，友善通知家長
  const pendingBanner = document.getElementById('query-pending-banner');
  if (pendingBanner) {
    if (hasPendingItems) {
      let pendingNotes = [];
      if (enteredCount < 5) pendingNotes.push(`部分學科（目前已登錄 ${enteredCount}/5 科）`);
      if (isPendingGradeRank) pendingNotes.push('學校年級排名');
      pendingBanner.innerHTML = `
        <span>ℹ️</span>
        <div>
          <strong>貼心提醒：</strong>目前本次段考 ${pendingNotes.join('與')} 正由任課教師及教務處陸續登錄結算中。<br>
          已登錄之科目成績家長可正常查閱，後續各科成績與全校排名送審後，系統將即時同步更新！
        </div>
      `;
      pendingBanner.style.display = 'flex';
    } else {
      pendingBanner.style.display = 'none';
    }
  }

  // KPI 1: 總分
  const totalElem = document.getElementById('res-total');
  const diffElem = document.getElementById('res-diff-val');
  if (enteredCount === 5 && currRecord.total !== null && currRecord.total !== undefined) {
    totalElem.textContent = currRecord.total.toFixed(1);
    const progressVal = currRecord.progress !== null && currRecord.progress !== undefined ? currRecord.progress : 0;
    if (progressVal > 0) {
      diffElem.innerHTML = `<span>較上次</span> <strong class="diff-up">+${progressVal.toFixed(1)} 分 (顯著進步)</strong>`;
    } else if (progressVal < 0) {
      diffElem.innerHTML = `<span>較上次</span> <strong class="diff-down">${progressVal.toFixed(1)} 分 (需加油)</strong>`;
    } else {
      diffElem.innerHTML = `<span>較上次</span> <strong class="diff-same">0.0 (持平)</strong>`;
    }
  } else if (enteredCount > 0 && currRecord.total !== null) {
    totalElem.innerHTML = `${currRecord.total.toFixed(1)} <span style="font-size:0.85rem; font-weight:normal; color:#bfdbfe;">(已公布 ${enteredCount}/5 科)</span>`;
    diffElem.innerHTML = `<span style="color:#e0f2fe; font-size:0.85rem;">待全科登錄完成後結算進退步</span>`;
  } else {
    totalElem.innerHTML = `<span style="font-size:1.25rem; color:#bfdbfe;">成績登錄中</span>`;
    diffElem.innerHTML = `<span style="color:#e0f2fe; font-size:0.85rem;">任課教師陸續輸入中</span>`;
  }

  // KPI 2: 平均
  const avgElem = document.getElementById('res-avg');
  const avgDiffElem = document.getElementById('res-avg-diff');
  if (enteredCount === 5 && currRecord.average !== null && currRecord.average !== undefined) {
    avgElem.textContent = currRecord.average.toFixed(1);
    avgDiffElem.innerHTML = `<span>班級平均: </span> <strong>${classStats.totalAvg.toFixed(1)} 分</strong>`;
  } else if (enteredCount > 0 && currRecord.average !== null) {
    avgElem.innerHTML = `${currRecord.average.toFixed(1)} <span style="font-size:0.85rem; font-weight:normal; color:#bfdbfe;">(${enteredCount}科平均)</span>`;
    avgDiffElem.innerHTML = `<span style="color:#e0f2fe; font-size:0.85rem;">全科平均待全科登錄後結算</span>`;
  } else {
    avgElem.innerHTML = `<span style="font-size:1.25rem; color:#bfdbfe;">尚未結算</span>`;
    avgDiffElem.innerHTML = `<span style="color:#e0f2fe; font-size:0.85rem;">待各科成績送件</span>`;
  }

  // KPI 3: 班名次
  const rankElem = document.getElementById('res-rank');
  const rankDiffSpan = document.getElementById('res-prev-rank');
  if (currRecord.class_rank && currRecord.class_rank > 0 && enteredCount === 5) {
    const rank = currRecord.class_rank;
    const prevRank = prevRecord.class_rank || '--';
    rankElem.textContent = `第 ${rank} 名`;
    if (prevRank !== '--') {
      const rankDiff = prevRank - rank; // positive means improved rank
      if (rankDiff > 0) {
        rankDiffSpan.innerHTML = `上次名次: 第 ${prevRank} 名 <span class="diff-up">(前進 ${rankDiff} 名 🚀)</span>`;
      } else if (rankDiff < 0) {
        rankDiffSpan.innerHTML = `上次名次: 第 ${prevRank} 名 <span class="diff-down">(後退 ${Math.abs(rankDiff)} 名)</span>`;
      } else {
        rankDiffSpan.textContent = `上次名次: 第 ${prevRank} 名 (持平)`;
      }
    } else {
      rankDiffSpan.textContent = `上次名次: 第 ${prevRank} 名`;
    }
  } else {
    rankElem.innerHTML = `<span style="font-size:1.25rem; color:#f1f5f9;">成績結算中</span>`;
    rankDiffSpan.innerHTML = `<span style="color:#bfdbfe;">待全科登錄完成後排序</span>`;
  }

  // KPI 4: 年名次 (學校排名)
  const gradeRankElem = document.getElementById('res-grade-rank');
  const gradeRankDiffElem = document.getElementById('res-grade-rank-diff');
  if (currRecord.grade_rank && currRecord.grade_rank > 0) {
    gradeRankElem.textContent = `第 ${currRecord.grade_rank} 名`;
    gradeRankDiffElem.textContent = `上次年名次: 第 ${prevRecord.grade_rank || '--'} 名`;
  } else {
    gradeRankElem.innerHTML = `<span style="font-size:1.2rem; color:#f1f5f9;">學校尚未公布</span>`;
    gradeRankDiffElem.innerHTML = `<span style="color:#bfdbfe;">教務處統整中 (開放查詢)</span>`;
  }

  // Comparison Table Body
  const tbody = document.getElementById('comparison-table-body');
  tbody.innerHTML = '';

  subjects.forEach(subj => {
    const pScore = prevRecord[subj.key] !== undefined && prevRecord[subj.key] !== null ? prevRecord[subj.key] : '--';
    const cEntered = isScoreEntered(currRecord[subj.key]);
    const cScore = cEntered ? parseFloat(currRecord[subj.key]) : null;
    const classAvg = classStats[subj.key];

    let cScoreHtml = '';
    let diffHtml = '';
    let classAvgHtml = classAvg !== null ? classAvg.toFixed(1) : '<span style="color:var(--gray-400);">統計中</span>';
    let vsClassHtml = '<span style="color:var(--gray-400);">--</span>';

    if (cEntered) {
      cScoreHtml = `<strong style="color: var(--primary); font-size:1.05rem;">${cScore.toFixed(1)}</strong>`;
      if (pScore !== '--') {
        const diff = Math.round((cScore - parseFloat(pScore)) * 10) / 10;
        if (diff > 0) {
          diffHtml = `<span class="badge-change up">+${diff.toFixed(1)} 🔺</span>`;
        } else if (diff < 0) {
          diffHtml = `<span class="badge-change down">${diff.toFixed(1)} 🔻</span>`;
        } else {
          diffHtml = `<span class="badge-change same">0.0 ➖</span>`;
        }
      } else {
        diffHtml = `<span class="badge-change same">--</span>`;
      }

      if (classAvg !== null) {
        const vsDiff = Math.round((cScore - classAvg) * 10) / 10;
        if (vsDiff > 0) {
          vsClassHtml = `<span style="color: var(--success); font-weight:600;">+${vsDiff.toFixed(1)} (高於班平均)</span>`;
        } else if (vsDiff < 0) {
          vsClassHtml = `<span style="color: var(--danger); font-weight:600;">${vsDiff.toFixed(1)} (低於班平均)</span>`;
        } else {
          vsClassHtml = `<span style="color: var(--gray-600);">符合班平均</span>`;
        }
      }
    } else {
      // 科目尚未輸入
      cScoreHtml = `<span class="badge-pending pulse">待任課教師登錄</span>`;
      diffHtml = `<span class="badge-pending">待公布</span>`;
      vsClassHtml = `<span style="color:var(--gray-400);">--</span>`;
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${subj.name}</strong></td>
      <td>${pScore !== '--' ? Number(pScore).toFixed(1) : '--'}</td>
      <td>${cScoreHtml}</td>
      <td>${diffHtml}</td>
      <td>${classAvgHtml}</td>
      <td>${vsClassHtml}</td>
    `;
    tbody.appendChild(tr);
  });

  // Summary row for Total & Average
  const trTotal = document.createElement('tr');
  trTotal.className = 'highlight-total';
  if (enteredCount === 5 && currRecord.total !== null) {
    const totalDiff = currRecord.progress || 0;
    const totalDiffBadge = totalDiff > 0 ? 'up' : (totalDiff < 0 ? 'down' : 'same');
    const totalDiffText = totalDiff > 0 ? `+${totalDiff.toFixed(1)} 🔺` : (totalDiff < 0 ? `${totalDiff.toFixed(1)} 🔻` : '0.0 ➖');
    trTotal.innerHTML = `
      <td><strong>五科總分</strong></td>
      <td>${prevRecord.total ? prevRecord.total.toFixed(1) : '--'}</td>
      <td><strong style="color: var(--primary); font-size:1.15rem;">${currRecord.total.toFixed(1)}</strong></td>
      <td><span class="badge-change ${totalDiffBadge}">${totalDiffText}</span></td>
      <td>${classStats.sumOfAverages.toFixed(1)}</td>
      <td>${currRecord.total >= classStats.sumOfAverages ? '<span style="color:var(--success); font-weight:600;">高於班平均總分</span>' : '<span style="color:var(--danger); font-weight:600;">低於班平均總分</span>'}</td>
    `;
  } else if (enteredCount > 0 && currRecord.total !== null) {
    trTotal.innerHTML = `
      <td><strong>五科總分</strong></td>
      <td>${prevRecord.total ? prevRecord.total.toFixed(1) : '--'}</td>
      <td><strong style="color: var(--primary); font-size:1.05rem;">${currRecord.total.toFixed(1)}</strong> <span style="font-size:0.8rem; color:var(--gray-500);">(已出 ${enteredCount}/5 科)</span></td>
      <td><span class="badge-pending">待全科結算</span></td>
      <td>--</td>
      <td><span style="color:var(--gray-500);">待全科結算</span></td>
    `;
  } else {
    trTotal.innerHTML = `
      <td><strong>五科總分</strong></td>
      <td>${prevRecord.total ? prevRecord.total.toFixed(1) : '--'}</td>
      <td><span class="badge-pending pulse">待任課教師登錄</span></td>
      <td><span class="badge-pending">待公布</span></td>
      <td>--</td>
      <td>--</td>
    `;
  }
  tbody.appendChild(trTotal);

  const trAvg = document.createElement('tr');
  trAvg.className = 'highlight-total';
  if (enteredCount === 5 && currRecord.average !== null) {
    const avgDiff = Math.round(((currRecord.average || 0) - (prevRecord.average || 0)) * 10) / 10;
    const avgDiffBadge = avgDiff > 0 ? 'up' : (avgDiff < 0 ? 'down' : 'same');
    trAvg.innerHTML = `
      <td><strong>學科總平均</strong></td>
      <td>${prevRecord.average ? prevRecord.average.toFixed(1) : '--'}</td>
      <td><strong style="color: var(--primary); font-size:1.15rem;">${currRecord.average.toFixed(1)}</strong></td>
      <td><span class="badge-change ${avgDiffBadge}">${avgDiff > 0 ? '+' + avgDiff.toFixed(1) : avgDiff.toFixed(1)}</span></td>
      <td>${classStats.totalAvg.toFixed(1)}</td>
      <td>${currRecord.average >= classStats.totalAvg ? '<span style="color:var(--success); font-weight:600;">高於班級平均</span>' : '<span style="color:var(--danger); font-weight:600;">低於班級平均</span>'}</td>
    `;
  } else if (enteredCount > 0 && currRecord.average !== null) {
    trAvg.innerHTML = `
      <td><strong>學科總平均</strong></td>
      <td>${prevRecord.average ? prevRecord.average.toFixed(1) : '--'}</td>
      <td><strong style="color: var(--primary); font-size:1.05rem;">${currRecord.average.toFixed(1)}</strong> <span style="font-size:0.8rem; color:var(--gray-500);">(${enteredCount}科平均)</span></td>
      <td><span class="badge-pending">待全科結算</span></td>
      <td>--</td>
      <td><span style="color:var(--gray-500);">待全科結算</span></td>
    `;
  } else {
    trAvg.innerHTML = `
      <td><strong>學科總平均</strong></td>
      <td>${prevRecord.average ? prevRecord.average.toFixed(1) : '--'}</td>
      <td><span class="badge-pending pulse">待任課教師登錄</span></td>
      <td><span class="badge-pending">待公布</span></td>
      <td>--</td>
      <td>--</td>
    `;
  }
  tbody.appendChild(trAvg);

  // 班級名次 Row
  const trClassRank = document.createElement('tr');
  const currCR = (currRecord.class_rank && currRecord.class_rank > 0 && enteredCount === 5) ? currRecord.class_rank : null;
  const prevCR = (prevRecord.class_rank && prevRecord.class_rank > 0) ? prevRecord.class_rank : null;
  let crDiffText = '--';
  let crBadge = 'same';
  if (currCR && prevCR) {
    const crDiff = prevCR - currCR;
    if (crDiff > 0) {
      crDiffText = `前進 ${crDiff} 名 🔺`;
      crBadge = 'up';
    } else if (crDiff < 0) {
      crDiffText = `後退 ${Math.abs(crDiff)} 名 🔻`;
      crBadge = 'down';
    } else {
      crDiffText = `持平 ➖`;
    }
  }

  trClassRank.innerHTML = `
    <td><strong>班級名次</strong></td>
    <td>${prevCR ? '第 ' + prevCR + ' 名' : '--'}</td>
    <td>${currCR ? '<strong style="color:var(--primary); font-size:1.05rem;">第 ' + currCR + ' 名</strong>' : '<span class="badge-pending pulse">成績結算中</span>'}</td>
    <td>${currCR && prevCR ? '<span class="badge-change ' + crBadge + '">' + crDiffText + '</span>' : '<span class="badge-pending">待公布</span>'}</td>
    <td>--</td>
    <td>--</td>
  `;
  tbody.appendChild(trClassRank);

  // 年級名次 (學校排名) Row
  const trGradeRank = document.createElement('tr');
  const currGR = (currRecord.grade_rank && currRecord.grade_rank > 0) ? currRecord.grade_rank : null;
  const prevGR = (prevRecord.grade_rank && prevRecord.grade_rank > 0) ? prevRecord.grade_rank : null;
  let grDiffText = '--';
  let grBadge = 'same';
  if (currGR && prevGR) {
    const grDiff = prevGR - currGR;
    if (grDiff > 0) {
      grDiffText = `前進 ${grDiff} 名 🔺`;
      grBadge = 'up';
    } else if (grDiff < 0) {
      grDiffText = `後退 ${Math.abs(grDiff)} 名 🔻`;
      grBadge = 'down';
    } else {
      grDiffText = `持平 ➖`;
    }
  }

  trGradeRank.innerHTML = `
    <td><strong>年級名次</strong></td>
    <td>${prevGR ? '第 ' + prevGR + ' 名' : '--'}</td>
    <td>${currGR ? '<strong style="color:var(--primary); font-size:1.05rem;">第 ' + currGR + ' 名</strong>' : '<span class="badge-pending pulse">學校尚未公布</span>'}</td>
    <td>${currGR && prevGR ? '<span class="badge-change ' + grBadge + '">' + grDiffText + '</span>' : '<span class="badge-pending">待公布</span>'}</td>
    <td>--</td>
    <td>--</td>
  `;
  tbody.appendChild(trGradeRank);

  // Motivational Teacher's Note
  renderTeacherEncouragement(name, currRecord, prevRecord, enteredCount);

  // Render Charts
  renderStudentCharts(currRecord, prevRecord, classStats, enteredCount);
}

/**
 * 智能生成導師勉勵專區評語（支援部分成績登錄中情境）
 */
function renderTeacherEncouragement(name, curr, prev, enteredCount) {
  const commentElem = document.getElementById('res-teacher-comment');
  if (!commentElem) return;

  if (enteredCount < 5) {
    if (enteredCount > 0) {
      commentElem.innerHTML = `親愛的 ${name} 與家長您好：目前本次段考成績由各科任課教師陸續登錄中（目前已公布 ${enteredCount}/5 科）。在已公布的學科中表現良好，請孩子保持正面學習心情。待各科成績全部登錄完畢後，系統將自動進行全科總結算與分析！`;
    } else {
      commentElem.innerHTML = `親愛的 ${name} 與家長您好：本次段考各學科成績正由任課教師與教務處逐科登錄中，目前尚未有成績送審。請同學先行妥善訂正考卷與檢視錯題，預祝本次段考收穫滿滿！`;
    }
    return;
  }

  const prog = curr.progress || 0;
  const avg = curr.average || 0;

  let comment = '';
  if (prog >= 20) {
    comment = `親愛的 ${name} 與家長您好：${name} 在本次段考展現出令人驚艷的爆發力與學習毅力，總分大幅躍進 +${prog.toFixed(1)} 分！這代表過去一段時間的紮實複習與用功獲得了豐碩的成果。進入國三衝刺期，請繼續維持良好的作息與專注度，老師對你充滿信心！`;
  } else if (prog > 0) {
    comment = `親愛的 ${name} 與家長您好：恭喜 ${name} 在本次段考穩健進步 +${prog.toFixed(1)} 分！各科理解度均有正面成長。國三課程節奏較快，面對即將到來的模擬考與會考，只要每天按部就班複習各科錯題、補強觀念弱點，必定能再創佳績！`;
  } else if (prog === 0) {
    comment = `親愛的 ${name} 與家長您好：${name} 在本次評量表現維持穩定。目前平均為 ${avg.toFixed(1)} 分。國三階段需特別針對各科重點章節進行深層演練，鼓勵主動向師長提問，針對稍弱的科目多花 20 分鐘深化複習，突破學習瓶頸！`;
  } else {
    comment = `親愛的 ${name} 與家長您好：本次段考可能題目難度提高或答題稍有粗心，總分稍有起伏。請孩子不要氣餒，段考的目的在於及時發現知識漏洞！建議利用這兩天好好訂正試卷、重新歸納題型，導師隨時樂意提供個別學習指導，我們一起加油！`;
  }

  commentElem.innerHTML = comment;
}

/**
 * 繪製學生雷達圖與柱狀圖 (Chart.js，避免未輸入科目誤顯示為 0 分)
 */
function renderStudentCharts(curr, prev, classStats, enteredCount) {
  if (typeof Chart === 'undefined') {
    console.warn('Chart.js not loaded');
    return;
  }

  const subjKeys = ['chinese', 'english', 'math', 'social', 'science'];
  const subjNames = ['國文', '英語', '數學', '社會', '自然'];

  const labels = subjKeys.map((k, i) => isScoreEntered(curr[k]) ? subjNames[i] : `${subjNames[i]} (登錄中)`);
  const currScores = subjKeys.map(k => isScoreEntered(curr[k]) ? parseFloat(curr[k]) : null);
  const prevScores = subjKeys.map(k => isScoreEntered(prev[k]) ? parseFloat(prev[k]) : null);
  const avgScores = subjKeys.map(k => classStats[k] !== null ? classStats[k] : null);

  // 1. Radar Chart
  const radarCtx = document.getElementById('studentRadarChart');
  if (radarCtx) {
    if (radarChartInstance) radarChartInstance.destroy();

    // 若登錄科目數少於 3 科，雷達圖展示溫馨提示，避免空角變形
    radarChartInstance = new Chart(radarCtx, {
      type: 'radar',
      data: {
        labels: labels,
        datasets: [
          {
            label: '本次段考 (907)',
            data: currScores,
            fill: true,
            backgroundColor: 'rgba(37, 99, 235, 0.25)',
            borderColor: '#2563eb',
            pointBackgroundColor: '#2563eb',
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: '#2563eb',
            borderWidth: 2.5
          },
          {
            label: '上次段考 (807)',
            data: prevScores,
            fill: true,
            backgroundColor: 'rgba(249, 115, 22, 0.15)',
            borderColor: '#f97316',
            pointBackgroundColor: '#f97316',
            pointBorderColor: '#fff',
            borderDash: [4, 4],
            borderWidth: 2
          },
          {
            label: '本次班級平均',
            data: avgScores,
            fill: false,
            borderColor: '#94a3b8',
            pointBackgroundColor: '#94a3b8',
            borderDash: [2, 2],
            borderWidth: 1.5
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            angleLines: { color: '#e2e8f0' },
            grid: { color: '#f1f5f9' },
            suggestedMin: 0,
            suggestedMax: 100,
            ticks: { stepSize: 20, font: { size: 10 } }
          }
        },
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } }
        }
      }
    });
  }

  // 2. Bar Chart
  const barCtx = document.getElementById('studentBarChart');
  if (barCtx) {
    if (barChartInstance) barChartInstance.destroy();

    barChartInstance = new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: '本次成績 (907)',
            data: currScores,
            backgroundColor: '#3b82f6',
            borderRadius: 4
          },
          {
            label: '上次成績 (807)',
            data: prevScores,
            backgroundColor: '#fdba74',
            borderRadius: 4
          },
          {
            label: '全班平均',
            data: avgScores,
            backgroundColor: '#cbd5e1',
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: { font: { size: 10 } }
          },
          x: {
            ticks: { font: { size: 11 } }
          }
        },
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } }
        }
      }
    });
  }
}

/**
 * 計算全班各科平均（僅統計已輸入該科成績之學生）
 */
function computeClassSubjectAverages() {
  const subjects = ['chinese', 'english', 'math', 'social', 'science'];
  const res = {
    sumOfAverages: 0,
    totalAvg: 0,
    count: currExamData.length
  };

  let validSubjCount = 0;
  let sumOfAvgs = 0;

  subjects.forEach(s => {
    let sum = 0;
    let count = 0;
    currExamData.forEach(c => {
      if (isScoreEntered(c[s])) {
        sum += parseFloat(c[s]);
        count++;
      }
    });
    if (count > 0) {
      const avg = Math.round((sum / count) * 10) / 10;
      res[s] = avg;
      res[s + '_count'] = count;
      sumOfAvgs += avg;
      validSubjCount++;
    } else {
      res[s] = null;
      res[s + '_count'] = 0;
    }
  });

  res.sumOfAverages = Math.round(sumOfAvgs * 10) / 10;
  res.totalAvg = validSubjCount > 0 ? Math.round((sumOfAvgs / validSubjCount) * 10) / 10 : 0;
  return res;
}

/**
 * =========================================================================
 * 導師成績管理專區 (Teacher Portal)
 * =========================================================================
 */

/**
 * 切換身分證字號遮罩
 */
function toggleIdMasking() {
  isIdMasked = !isIdMasked;
  const btnText = document.getElementById('mask-btn-text');
  if (btnText) {
    btnText.textContent = isIdMasked ? '顯示身分證字號' : '隱藏身分證字號';
  }
  renderTeacherTable();
}

/**
 * 渲染導師成績輸入表格 (座號 01 ~ 31，支援科目部分留白與年名次留白)
 */
function renderTeacherTable() {
  const tbody = document.getElementById('teacher-entry-tbody');
  if (!tbody) return;

  const prevMap = {};
  prevExamData.forEach(p => {
    prevMap[p.seat] = p;
  });

  tbody.innerHTML = '';

  currExamData.forEach((row, idx) => {
    const seat = row.seat;
    const name = row.name;
    const prev = prevMap[seat] || {};
    const prevTotal = prev.total !== undefined ? prev.total.toFixed(1) : '--';

    // Mask ID
    const fullId = row.id_no || '';
    let displayId = fullId;
    if (isIdMasked && fullId.length >= 7) {
      displayId = fullId.slice(0, 3) + '****' + fullId.slice(-3);
    }

    const tr = document.createElement('tr');
    tr.id = `teacher-row-${seat}`;

    // Values (空值時直接顯示空字串，不強制為 0)
    const cVal = isScoreEntered(row.chinese) ? row.chinese : '';
    const eVal = isScoreEntered(row.english) ? row.english : '';
    const mVal = isScoreEntered(row.math) ? row.math : '';
    const sVal = isScoreEntered(row.social) ? row.social : '';
    const sciVal = isScoreEntered(row.science) ? row.science : '';

    const totVal = row.total !== null && row.total !== undefined ? row.total.toFixed(1) : '--';
    const avgVal = row.average !== null && row.average !== undefined ? row.average.toFixed(1) : '--';
    const rankVal = row.class_rank ? row.class_rank : '--';
    const gradeRankVal = row.grade_rank && row.grade_rank > 0 ? row.grade_rank : '';

    let progText = '--';
    let progClass = 'diff-same';
    if (row.progress !== null && row.progress !== undefined) {
      progText = row.progress > 0 ? `+${row.progress.toFixed(1)} 🔺` : (row.progress < 0 ? `${row.progress.toFixed(1)} 🔻` : '0.0');
      progClass = row.progress > 0 ? 'diff-up' : (row.progress < 0 ? 'diff-down' : 'diff-same');
    }

    tr.innerHTML = `
      <td><strong>${seat}</strong></td>
      <td><strong>${name}</strong></td>
      <td style="font-family: monospace; font-size: 0.85rem; color: var(--gray-600);">${displayId}</td>
      <td>
        <input type="number" step="0.5" min="0" max="100" class="score-input"
          id="score-${seat}-chinese" data-seat="${seat}" data-subject="chinese"
          value="${cVal}" placeholder="--" onfocus="handleInputFocus(this)" onblur="handleInputBlur(this)" oninput="handleScoreChange('${seat}')">
      </td>
      <td>
        <input type="number" step="0.5" min="0" max="100" class="score-input"
          id="score-${seat}-english" data-seat="${seat}" data-subject="english"
          value="${eVal}" placeholder="--" onfocus="handleInputFocus(this)" onblur="handleInputBlur(this)" oninput="handleScoreChange('${seat}')">
      </td>
      <td>
        <input type="number" step="0.5" min="0" max="100" class="score-input"
          id="score-${seat}-math" data-seat="${seat}" data-subject="math"
          value="${mVal}" placeholder="--" onfocus="handleInputFocus(this)" onblur="handleInputBlur(this)" oninput="handleScoreChange('${seat}')">
      </td>
      <td>
        <input type="number" step="0.5" min="0" max="100" class="score-input"
          id="score-${seat}-social" data-seat="${seat}" data-subject="social"
          value="${sVal}" placeholder="--" onfocus="handleInputFocus(this)" onblur="handleInputBlur(this)" oninput="handleScoreChange('${seat}')">
      </td>
      <td>
        <input type="number" step="0.5" min="0" max="100" class="score-input"
          id="score-${seat}-science" data-seat="${seat}" data-subject="science"
          value="${sciVal}" placeholder="--" onfocus="handleInputFocus(this)" onblur="handleInputBlur(this)" oninput="handleScoreChange('${seat}')">
      </td>
      <td><strong id="cell-total-${seat}" style="color: var(--primary); font-size: 1rem;">${totVal}</strong></td>
      <td><span id="cell-avg-${seat}">${avgVal}</span></td>
      <td><span id="cell-rank-${seat}" style="font-weight: 700;">${rankVal}</span></td>
      <td>
        <input type="number" min="1" max="999" class="score-input" style="width: 55px;"
          id="score-${seat}-graderank" data-seat="${seat}" data-subject="graderank"
          value="${gradeRankVal}" placeholder="未出" onchange="handleGradeRankChange('${seat}', this.value)">
      </td>
      <td style="color: var(--gray-600);">${prevTotal}</td>
      <td><span id="cell-prog-${seat}" class="${progClass}" style="font-weight:700;">${progText}</span></td>
    `;

    tbody.appendChild(tr);
  });

  renderTeacherFooter();
  setupKeyboardNavigation();
}

/**
 * 鍵盤快速連打支援 (Enter / Tab / 方向鍵)
 */
function setupKeyboardNavigation() {
  const subjects = ['chinese', 'english', 'math', 'social', 'science'];
  const inputs = document.querySelectorAll('#teacher-entry-tbody input.score-input');

  inputs.forEach(input => {
    input.addEventListener('keydown', (e) => {
      const seat = input.dataset.seat;
      const subject = input.dataset.subject;
      if (!subject || subject === 'graderank') return;

      const seatIndex = currExamData.findIndex(c => c.seat === seat);
      const subjIndex = subjects.indexOf(subject);

      if (e.key === 'Enter') {
        e.preventDefault();
        // Jump to next subject, or next row's chinese
        if (subjIndex < subjects.length - 1) {
          const nextSubj = subjects[subjIndex + 1];
          const nextInput = document.getElementById(`score-${seat}-${nextSubj}`);
          if (nextInput) {
            nextInput.focus();
            nextInput.select();
          }
        } else {
          // Jump to next student's first subject
          if (seatIndex < currExamData.length - 1) {
            const nextSeat = currExamData[seatIndex + 1].seat;
            const nextInput = document.getElementById(`score-${nextSeat}-chinese`);
            if (nextInput) {
              nextInput.focus();
              nextInput.select();
            }
          }
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (seatIndex < currExamData.length - 1) {
          const nextSeat = currExamData[seatIndex + 1].seat;
          const target = document.getElementById(`score-${nextSeat}-${subject}`);
          if (target) { target.focus(); target.select(); }
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (seatIndex > 0) {
          const prevSeat = currExamData[seatIndex - 1].seat;
          const target = document.getElementById(`score-${prevSeat}-${subject}`);
          if (target) { target.focus(); target.select(); }
        }
      }
    });
  });
}

function handleInputFocus(input) {
  const seat = input.dataset.seat;
  const row = document.getElementById(`teacher-row-${seat}`);
  if (row) row.classList.add('current-row-focus');
  input.select();
}

function handleInputBlur(input) {
  const seat = input.dataset.seat;
  const row = document.getElementById(`teacher-row-${seat}`);
  if (row) row.classList.remove('current-row-focus');
}

/**
 * 當導師輸入某科分數時，即時更新該生之總分、平均與進退步
 */
function handleScoreChange(seat) {
  const cInp = document.getElementById(`score-${seat}-chinese`);
  const eInp = document.getElementById(`score-${seat}-english`);
  const mInp = document.getElementById(`score-${seat}-math`);
  const sInp = document.getElementById(`score-${seat}-social`);
  const sciInp = document.getElementById(`score-${seat}-science`);

  const student = currExamData.find(c => c.seat === seat);
  if (!student) return;

  student.chinese = cInp && cInp.value !== '' ? parseFloat(cInp.value) : '';
  student.english = eInp && eInp.value !== '' ? parseFloat(eInp.value) : '';
  student.math    = mInp && mInp.value !== '' ? parseFloat(mInp.value) : '';
  student.social  = sInp && sInp.value !== '' ? parseFloat(sInp.value) : '';
  student.science = sciInp && sciInp.value !== '' ? parseFloat(sciInp.value) : '';

  const subjects = [student.chinese, student.english, student.math, student.social, student.science];
  const entered = subjects.filter(s => isScoreEntered(s)).map(s => parseFloat(s));
  student.entered_count = entered.length;

  const cellTotal = document.getElementById(`cell-total-${seat}`);
  const cellAvg = document.getElementById(`cell-avg-${seat}`);
  const cellProg = document.getElementById(`cell-prog-${seat}`);

  if (student.entered_count === 5) {
    student.total = Math.round(entered.reduce((a, b) => a + b, 0) * 10) / 10;
    student.average = Math.round((student.total / 5) * 10) / 10;
    const prev = prevExamData.find(p => p.seat === seat);
    const prevTotal = prev && prev.total !== undefined ? prev.total : 0;
    student.progress = Math.round((student.total - prevTotal) * 10) / 10;

    if (cellTotal) cellTotal.textContent = student.total.toFixed(1);
    if (cellAvg) cellAvg.textContent = student.average.toFixed(1);
    if (cellProg) {
      const progVal = student.progress;
      cellProg.textContent = progVal > 0 ? `+${progVal.toFixed(1)} 🔺` : (progVal < 0 ? `${progVal.toFixed(1)} 🔻` : '0.0');
      cellProg.className = progVal > 0 ? 'diff-up' : (progVal < 0 ? 'diff-down' : 'diff-same');
    }
  } else if (student.entered_count > 0) {
    student.total = Math.round(entered.reduce((a, b) => a + b, 0) * 10) / 10;
    student.average = Math.round((student.total / student.entered_count) * 10) / 10;
    student.progress = null;

    if (cellTotal) cellTotal.textContent = `${student.total.toFixed(1)} (${student.entered_count}科)`;
    if (cellAvg) cellAvg.textContent = student.average.toFixed(1);
    if (cellProg) {
      cellProg.textContent = '待全科';
      cellProg.className = 'diff-same';
    }
  } else {
    student.total = null;
    student.average = null;
    student.progress = null;
    if (cellTotal) cellTotal.textContent = '--';
    if (cellAvg) cellAvg.textContent = '--';
    if (cellProg) {
      cellProg.textContent = '--';
      cellProg.className = 'diff-same';
    }
  }

  // Update Footer & Save status
  renderTeacherFooter();
  setSaveStatusIndicator('⚠️ 內容已更動，請記得點擊「儲存成績」', '#d97706');
}

function handleGradeRankChange(seat, val) {
  const student = currExamData.find(c => c.seat === seat);
  if (student) {
    student.grade_rank = val !== '' && !isNaN(parseInt(val, 10)) ? parseInt(val, 10) : null;
    setSaveStatusIndicator('⚠️ 內容已更動，請記得點擊「儲存成績」', '#d97706');
  }
}

/**
 * 重新計算全班名次
 */
function recalculateAllRanks() {
  computeRanksAndProgress();
  renderTeacherTable();
  setSaveStatusIndicator('✅ 名次已重新計算完成！請點擊「儲存成績」', '#16a34a');
}

/**
 * 渲染導師表格底部全班平均行
 */
function renderTeacherFooter() {
  const tfoot = document.getElementById('teacher-entry-tfoot');
  if (!tfoot) return;

  const stats = computeClassSubjectAverages();

  tfoot.innerHTML = `
    <tr>
      <td colspan="3" style="text-align: right; padding-right: 1rem;"><strong>全班各科平均：</strong></td>
      <td><strong>${stats.chinese !== null ? stats.chinese.toFixed(1) : '--'}</strong></td>
      <td><strong>${stats.english !== null ? stats.english.toFixed(1) : '--'}</strong></td>
      <td><strong>${stats.math !== null ? stats.math.toFixed(1) : '--'}</strong></td>
      <td><strong>${stats.social !== null ? stats.social.toFixed(1) : '--'}</strong></td>
      <td><strong>${stats.science !== null ? stats.science.toFixed(1) : '--'}</strong></td>
      <td style="color: var(--primary);"><strong>${stats.sumOfAverages > 0 ? stats.sumOfAverages.toFixed(1) : '--'}</strong></td>
      <td><strong>${stats.totalAvg > 0 ? stats.totalAvg.toFixed(1) : '--'}</strong></td>
      <td>--</td>
      <td>--</td>
      <td>--</td>
      <td>--</td>
    </tr>
  `;
}

function setSaveStatusIndicator(text, color) {
  const indicator = document.getElementById('save-status-indicator');
  if (indicator) {
    indicator.textContent = text;
    indicator.style.color = color;
  }
}

/**
 * 儲存成績至 LocalStorage
 */
function saveGradesToStorage() {
  computeRanksAndProgress();
  try {
    localStorage.setItem('tq_grades_curr_exam', JSON.stringify(currExamData));
    localStorage.setItem('tq_grades_prev_exam', JSON.stringify(prevExamData));
    setSaveStatusIndicator('✅ 資料已於 ' + new Date().toLocaleTimeString() + ' 成功儲存！', '#16a34a');
    alert('成績已成功儲存至本機！下次開啟將自動保留最新成績。');
  } catch (e) {
    alert('儲存失敗：' + e.message);
  }
}

/**
 * 清空成績讓導師從頭依序輸入
 */
function clearGradesForEntry() {
  const confirmClean = confirm('確定要清空全班五科成績以重新依序輸入嗎？\n（學生名冊與身分證字號將保留，五科分數將歸零清空）');
  if (!confirmClean) return;

  currExamData.forEach(c => {
    c.chinese = '';
    c.english = '';
    c.math = '';
    c.social = '';
    c.science = '';
    c.total = null;
    c.average = null;
    c.class_rank = null;
    c.grade_rank = null;
    c.progress = null;
    c.entered_count = 0;
  });

  renderTeacherTable();
  setSaveStatusIndicator('⚠️ 成績已清空，請依序打分後點擊儲存', '#dc2626');

  // Focus on seat 01 chinese
  setTimeout(() => {
    const firstInput = document.getElementById('score-01-chinese');
    if (firstInput) firstInput.focus();
  }, 100);
}

/**
 * 載入預設示範成績
 */
function resetToSampleGrades() {
  const confirmReset = confirm('確定要載入系統預設示範成績嗎？這會覆蓋目前的成績。');
  if (!confirmReset) return;

  const defaultData = window.DEFAULT_DATA || {};
  currExamData = JSON.parse(JSON.stringify(defaultData.curr_exam || []));
  computeRanksAndProgress();
  renderTeacherTable();
  setSaveStatusIndicator('✅ 已載入預設示範成績', '#16a34a');
}

/**
 * 匯出 907 班本次成績總表 (Excel .xlsx)
 */
function exportCurrentToExcel() {
  if (typeof XLSX === 'undefined') {
    alert('未載入 Excel 函式庫，無法匯出。');
    return;
  }

  computeRanksAndProgress();
  const stats = computeClassSubjectAverages();

  const headers = [
    '班級', '學號', '座號', '姓名',
    '國文', '英語', '數學', '社會', '自然',
    '總分', '平均', '班名次', '年名次', '進退步'
  ];

  const dataRows = [headers];

  currExamData.forEach(c => {
    dataRows.push([
      c.class_name || '九年七班',
      c.student_id || ('355' + c.seat),
      c.seat,
      c.name,
      isScoreEntered(c.chinese) ? c.chinese : '',
      isScoreEntered(c.english) ? c.english : '',
      isScoreEntered(c.math)    ? c.math : '',
      isScoreEntered(c.social)  ? c.social : '',
      isScoreEntered(c.science) ? c.science : '',
      c.total !== null && c.total !== undefined ? c.total : '',
      c.average !== null && c.average !== undefined ? c.average : '',
      c.class_rank ? c.class_rank : '',
      c.grade_rank ? c.grade_rank : '',
      c.progress !== null && c.progress !== undefined ? c.progress : ''
    ]);
  });

  // Footer Average Row
  dataRows.push([
    '平均', '', '', '',
    stats.chinese !== null ? stats.chinese : '',
    stats.english !== null ? stats.english : '',
    stats.math !== null ? stats.math : '',
    stats.social !== null ? stats.social : '',
    stats.science !== null ? stats.science : '',
    stats.sumOfAverages > 0 ? stats.sumOfAverages : '',
    stats.totalAvg > 0 ? stats.totalAvg : '',
    '', '', ''
  ]);

  const ws = XLSX.utils.aoa_to_sheet(dataRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '907班段考成績');

  XLSX.writeFile(wb, '907班11511段考成績總表.xlsx');
}

/**
 * 匯出 807 班前次成績表 (Excel .xlsx)
 */
function exportPrevToExcel() {
  if (typeof XLSX === 'undefined') {
    alert('未載入 Excel 函式庫，無法匯出。');
    return;
  }

  const headers = [
    '班級', '學號', '座號', '姓名',
    '國文', '英語', '數學', '社會', '自然',
    '總分', '平均', '班名次', '年名次', '進退步'
  ];

  const dataRows = [headers];
  prevExamData.forEach(p => {
    dataRows.push([
      p.class_name || '八年七班',
      p.student_id,
      p.seat,
      p.name,
      p.chinese,
      p.english,
      p.math,
      p.social,
      p.science,
      p.total,
      p.average,
      p.class_rank,
      p.grade_rank,
      p.progress
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(dataRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '807班11423段考成績');

  XLSX.writeFile(wb, '807班11423段考成績總表_備份.xlsx');
}

/**
 * 觸發 Excel 匯入
 */
function triggerExcelImport() {
  const fileInput = document.getElementById('excel-import-file');
  if (fileInput) fileInput.click();
}

/**
 * 處理 Excel / CSV 匯入
 */
function handleExcelImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonRows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

      if (jsonRows.length < 2) {
        alert('匯入的檔案內容為空或格式不正確！');
        return;
      }

      const headerRow = jsonRows[0].map(h => String(h || '').trim());
      // Identify column indices
      const seatCol = headerRow.findIndex(h => h.includes('座號'));
      const nameCol = headerRow.findIndex(h => h.includes('姓名'));
      const cCol = headerRow.findIndex(h => h.includes('國文'));
      const eCol = headerRow.findIndex(h => h.includes('英'));
      const mCol = headerRow.findIndex(h => h.includes('數'));
      const sCol = headerRow.findIndex(h => h.includes('社'));
      const sciCol = headerRow.findIndex(h => h.includes('自'));
      const gradeRankCol = headerRow.findIndex(h => h.includes('年名次'));

      let updatedCount = 0;
      for (let r = 1; r < jsonRows.length; r++) {
        const row = jsonRows[r];
        if (!row || row.length === 0) continue;

        const seatRaw = seatCol >= 0 ? String(row[seatCol] || '').trim() : '';
        const nameRaw = nameCol >= 0 ? String(row[nameCol] || '').trim() : '';

        const target = currExamData.find(c => {
          if (seatRaw) {
            const seatNum = parseInt(seatRaw, 10);
            return parseInt(c.seat, 10) === seatNum;
          }
          if (nameRaw) {
            return c.name === nameRaw;
          }
          return false;
        });

        if (target) {
          if (cCol >= 0 && row[cCol] !== undefined && row[cCol] !== '') target.chinese = parseFloat(row[cCol]);
          if (eCol >= 0 && row[eCol] !== undefined && row[eCol] !== '') target.english = parseFloat(row[eCol]);
          if (mCol >= 0 && row[mCol] !== undefined && row[mCol] !== '') target.math = parseFloat(row[mCol]);
          if (sCol >= 0 && row[sCol] !== undefined && row[sCol] !== '') target.social = parseFloat(row[sCol]);
          if (sciCol >= 0 && row[sciCol] !== undefined && row[sciCol] !== '') target.science = parseFloat(row[sciCol]);
          if (gradeRankCol >= 0 && row[gradeRankCol] !== undefined && row[gradeRankCol] !== '') target.grade_rank = parseInt(row[gradeRankCol], 10);
          updatedCount++;
        }
      }

      computeRanksAndProgress();
      renderTeacherTable();
      alert(`成功從 Excel 匯入並更新 ${updatedCount} 位同學的成績！請點擊「儲存成績」保存。`);
    } catch (err) {
      alert('解析檔案失敗：' + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
  event.target.value = ''; // Reset file input
}

/**
 * =========================================================================
 * 全班成績統計分析專區 (Class Statistics View)
 * =========================================================================
 */
function updateClassStats() {
  const stats = computeClassSubjectAverages();
  const prevStats = computePrevClassSubjectAverages();

  // Overview KPIs
  document.getElementById('stat-count').textContent = stats.count;
  document.getElementById('stat-avg-total').textContent = stats.sumOfAverages > 0 ? stats.sumOfAverages.toFixed(1) : '--';

  const prevTotAvg = prevStats.sumOfAverages;
  if (stats.sumOfAverages > 0) {
    const totDiff = Math.round((stats.sumOfAverages - prevTotAvg) * 10) / 10;
    const totDiffText = totDiff >= 0 ? `較上次 +${totDiff.toFixed(1)} 分 🔺` : `較上次 ${totDiff.toFixed(1)} 分 🔻`;
    document.getElementById('stat-diff-total').textContent = totDiffText;
  } else {
    document.getElementById('stat-diff-total').textContent = '待成績完整登錄';
  }
  document.getElementById('stat-avg-score').textContent = stats.totalAvg > 0 ? stats.totalAvg.toFixed(1) : '--';

  // Highest scorer
  let maxScore = -1;
  let topStudent = null;
  currExamData.forEach(c => {
    if (c.total !== null && c.total > maxScore) {
      maxScore = c.total;
      topStudent = c;
    }
  });

  if (topStudent) {
    document.getElementById('stat-max-score').textContent = maxScore.toFixed(1);
    document.getElementById('stat-max-student').textContent = `座號 ${topStudent.seat} ${topStudent.name}`;
  } else {
    document.getElementById('stat-max-score').textContent = '--';
    document.getElementById('stat-max-student').textContent = '統計中';
  }

  // Subject Stats Table
  const subjects = [
    { key: 'chinese', name: '國文' },
    { key: 'english', name: '英語' },
    { key: 'math',    name: '數學' },
    { key: 'social',  name: '社會' },
    { key: 'science', name: '自然' }
  ];

  const tbody = document.getElementById('subject-stats-tbody');
  if (tbody) {
    tbody.innerHTML = '';
    subjects.forEach(s => {
      const cAvg = stats[s.key];
      const pAvg = prevStats[s.key] || 0;

      let cAvgText = '--';
      let diffText = '待登錄';
      let diffBadge = 'same';

      const enteredSubjStudents = currExamData.filter(c => isScoreEntered(c[s.key]));
      const passCount = enteredSubjStudents.filter(c => parseFloat(c[s.key]) >= 60).length;
      const failCount = enteredSubjStudents.length - passCount;
      const passRate = enteredSubjStudents.length > 0 ? Math.round((passCount / enteredSubjStudents.length) * 1000) / 10 : 0;

      if (cAvg !== null) {
        cAvgText = cAvg.toFixed(1);
        const diff = Math.round((cAvg - pAvg) * 10) / 10;
        diffBadge = diff > 0 ? 'up' : (diff < 0 ? 'down' : 'same');
        diffText = diff > 0 ? `+${diff.toFixed(1)} 🔺` : (diff < 0 ? `${diff.toFixed(1)} 🔻` : '0.0 ➖');
      }

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${s.name}</strong></td>
        <td><strong style="color: var(--primary); font-size:1.05rem;">${cAvgText}</strong></td>
        <td>${pAvg.toFixed(1)}</td>
        <td><span class="badge-change ${diffBadge}">${diffText}</span></td>
        <td style="color: var(--success); font-weight:700;">${enteredSubjStudents.length > 0 ? passCount + ' 人' : '--'}</td>
        <td style="color: var(--danger); font-weight:700;">${enteredSubjStudents.length > 0 ? failCount + ' 人' : '--'}</td>
        <td>
          <div style="display:flex; align-items:center; gap:0.5rem; justify-content:center;">
            <span>${enteredSubjStudents.length > 0 ? passRate.toFixed(1) + '%' : '待登錄'}</span>
            <div style="width:60px; height:8px; background:#e2e8f0; border-radius:4px; overflow:hidden;">
              <div style="width:${passRate}%; height:100%; background:var(--primary-light);"></div>
            </div>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Top 5 Progress Stars
  renderProgressStars();

  // Render Class Charts
  renderClassCharts(stats, prevStats);
}

function computePrevClassSubjectAverages() {
  const count = prevExamData.length || 1;
  let sumC = 0, sumE = 0, sumM = 0, sumS = 0, sumSci = 0;
  prevExamData.forEach(p => {
    sumC += parseFloat(p.chinese) || 0;
    sumE += parseFloat(p.english) || 0;
    sumM += parseFloat(p.math) || 0;
    sumS += parseFloat(p.social) || 0;
    sumSci += parseFloat(p.science) || 0;
  });

  const avgC = Math.round((sumC / count) * 10) / 10;
  const avgE = Math.round((sumE / count) * 10) / 10;
  const avgM = Math.round((sumM / count) * 10) / 10;
  const avgS = Math.round((sumS / count) * 10) / 10;
  const avgSci = Math.round((sumSci / count) * 10) / 10;
  const sumOfAverages = Math.round((avgC + avgE + avgM + avgS + avgSci) * 10) / 10;

  return {
    chinese: avgC,
    english: avgE,
    math: avgM,
    social: avgS,
    science: avgSci,
    sumOfAverages: sumOfAverages,
    count: count
  };
}

/**
 * 渲染進步之星榮譽榜
 */
function renderProgressStars() {
  const container = document.getElementById('progress-star-container');
  if (!container) return;

  const sortedByProg = [...currExamData]
    .filter(c => c.progress !== null && c.progress > 0)
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 5);

  container.innerHTML = '';

  if (sortedByProg.length === 0) {
    container.innerHTML = '<p style="color:var(--gray-500); padding: 1rem;">成績全科登錄結算後將即時公布進步之星</p>';
    return;
  }

  sortedByProg.forEach((s, idx) => {
    const card = document.createElement('div');
    card.className = 'star-card';
    card.innerHTML = `
      <div class="star-rank-badge">${idx + 1}</div>
      <div class="star-info">
        <h5>${s.name} (${s.seat}號)</h5>
        <p>總分躍進 <strong style="color: #b45309; font-size:1.1rem;">+${s.progress.toFixed(1)}</strong> 分</p>
        <span style="font-size: 0.8rem; color: var(--gray-600);">班名次前進至第 ${s.class_rank || '--'} 名</span>
      </div>
    `;
    container.appendChild(card);
  });
}

/**
 * 繪製全班分析圖表
 */
function renderClassCharts(currStats, prevStats) {
  if (typeof Chart === 'undefined') return;

  const labels = ['國文', '英語', '數學', '社會', '自然'];
  const currAvgs = [currStats.chinese, currStats.english, currStats.math, currStats.social, currStats.science];
  const prevAvgs = [prevStats.chinese, prevStats.english, prevStats.math, prevStats.social, prevStats.science];

  // 1. Class Subject Comparison Bar Chart
  const subjCtx = document.getElementById('classSubjectChart');
  if (subjCtx) {
    if (classSubjectChartInstance) classSubjectChartInstance.destroy();

    classSubjectChartInstance = new Chart(subjCtx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: '本次 907 班平均',
            data: currAvgs,
            backgroundColor: '#1d4ed8',
            borderRadius: 6
          },
          {
            label: '上次 807 班平均',
            data: prevAvgs,
            backgroundColor: '#f59e0b',
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, max: 100 }
        },
        plugins: {
          legend: { position: 'bottom' }
        }
      }
    });
  }

  // 2. Score Band Distribution Chart
  const distCtx = document.getElementById('gradeDistributionChart');
  if (distCtx) {
    if (gradeDistChartInstance) gradeDistChartInstance.destroy();

    const bands = [0, 0, 0, 0, 0];
    let hasStudents = false;
    currExamData.forEach(c => {
      if (c.average !== null && c.average !== undefined) {
        hasStudents = true;
        const avg = c.average;
        if (avg >= 90) bands[0]++;
        else if (avg >= 80) bands[1]++;
        else if (avg >= 70) bands[2]++;
        else if (avg >= 60) bands[3]++;
        else bands[4]++;
      }
    });

    gradeDistChartInstance = new Chart(distCtx, {
      type: 'doughnut',
      data: {
        labels: ['90分以上 (拔尖)', '80~89分 (優異)', '70~79分 (良好)', '60~69分 (及格)', '60分以下 (待加強)'],
        datasets: [
          {
            data: bands,
            backgroundColor: [
              '#10b981', // green
              '#3b82f6', // blue
              '#8b5cf6', // purple
              '#f59e0b', // orange
              '#ef4444'  // red
            ]
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { boxWidth: 14, font: { size: 11 } } }
        }
      }
    });
  }
}
