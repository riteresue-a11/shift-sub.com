// API エンドポイント
const API_BASE_URL = 'https://shift-sub-backend.onrender.com/api';

// ========================================
// グローバル変数
// ========================================
let currentUser = null;
let collectingPeriod = null;
let confirmedPeriod = null;

// ========================================
// 日本時間ユーティリティ
// ========================================
function formatDateJST(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function parseJSTDate(dateString) {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
}

function formatDateTime(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}/${month}/${day} ${hours}:${minutes}`;
}

// ========================================
// ローディング表示
// ========================================
function showLoading() {
    document.getElementById('loading-overlay').classList.add('active');
}

function hideLoading() {
    document.getElementById('loading-overlay').classList.remove('active');
}

// ========================================
// メッセージ表示
// ========================================
function showMessage(text, type = 'info') {
    const container = document.getElementById('message-container');
    const message = document.createElement('div');
    message.className = `message ${type}`;
    message.textContent = text;
    container.appendChild(message);

    setTimeout(() => {
        message.remove();
    }, 3000);
}

// ========================================
// ページ初期化
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    initializeAuth();
});

// ========================================
// 認証システム初期化
// ========================================
function initializeAuth() {
    // ログインボタン
    document.getElementById('login-btn').addEventListener('click', handleLogin);
    document.getElementById('login-password').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin();
    });

    // 登録画面表示
    document.getElementById('show-register').addEventListener('click', (e) => {
        e.preventDefault();
        showScreen('register-screen');
    });

    // 登録ボタン
    document.getElementById('register-btn').addEventListener('click', handleRegister);
    
    // ログインに戻る
    document.getElementById('back-to-login').addEventListener('click', () => {
        showScreen('login-screen');
    });

    // ログアウト
    document.getElementById('logout-btn').addEventListener('click', handleLogout);

    // リフレッシュ
    document.getElementById('refresh-btn').addEventListener('click', handleRefresh);

    // 初期画面表示
    showScreen('login-screen');
    
    // ローディングを非表示
    hideLoading();
}

// ========================================
// ログイン処理
// ========================================
async function handleLogin() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;

    if (!username || !password) {
        showMessage('名前と暗証番号を入力してください', 'error');
        return;
    }

    if (password === 'ktwk') {
        showMessage('マスターキーではログインできません', 'error');
        return;
    }

    showLoading();

    try {
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();

        if (!data.success) {
            hideLoading();
            showMessage('ログインに失敗しました', 'error');
            return;
        }

        // ログイン成功
        currentUser = data.user;
        document.getElementById('current-user').textContent = `${currentUser.username}さん`;
        
        if (currentUser.account_type === 'manager') {
            await initializeManagerApp();
        } else {
            await initializeStaffApp();
        }

        showScreen('main-app');
        showMessage(`ようこそ、${currentUser.username}さん`, 'success');
        
        // 入力欄クリア
        document.getElementById('login-username').value = '';
        document.getElementById('login-password').value = '';

    } catch (error) {
        console.error('ログインエラー:', error);
        showMessage('ログインに失敗しました', 'error');
    } finally {
        hideLoading();
    }
}

// ========================================
// 登録処理
// ========================================
async function handleRegister() {
    const username = document.getElementById('register-username').value.trim();
    const password = document.getElementById('register-password').value;
    const passwordConfirm = document.getElementById('register-password-confirm').value;

    if (!username || !password || !passwordConfirm) {
        showMessage('すべての項目を入力してください', 'error');
        return;
    }

    if (password.length !== 4) {
        showMessage('暗証番号は4桁で入力してください', 'error');
        return;
    }

    if (password !== passwordConfirm) {
        showMessage('暗証番号が一致しません', 'error');
        return;
    }

    showLoading();

    try {
        const response = await fetch(`${API_BASE_URL}/accounts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: username,
                password: password,
                account_type: 'staff'
            })
        });

        const data = await response.json();

        if (!data.success) {
            hideLoading();
            showMessage('登録に失敗しました', 'error');
            return;
        }

        showMessage('登録申請を送信しました。社員の承認をお待ちください。', 'success');
        
        // 入力欄クリア
        document.getElementById('register-username').value = '';
        document.getElementById('register-password').value = '';
        document.getElementById('register-password-confirm').value = '';
        
        // ログイン画面に戻る
        setTimeout(() => {
            showScreen('login-screen');
        }, 2000);

    } catch (error) {
        console.error('登録エラー:', error);
        showMessage('登録に失敗しました', 'error');
    } finally {
        hideLoading();
    }
}

// ========================================
// ログアウト
// ========================================
function handleLogout() {
    currentUser = null;
    collectingPeriod = null;
    confirmedPeriod = null;
    showScreen('login-screen');
    showMessage('ログアウトしました', 'info');
}

// ========================================
// リフレッシュ
// ========================================
async function handleRefresh() {
    if (!currentUser) {
        showMessage('ログインしてください', 'error');
        return;
    }

    showLoading();

    try {
        // 期間データを再読み込み
        await loadPeriods();

        // アカウントタイプに応じて再読み込み
        if (currentUser.account_type === 'manager') {
            await loadManagerShifts();
            await loadSubmissionStats();
            await loadAccountManagement();
        } else {
            await loadStaffConfirmedShift();
            await loadStaffSubmitShift();
        }

        showMessage('データを更新しました', 'success');
    } catch (error) {
        console.error('更新エラー:', error);
        showMessage('更新に失敗しました', 'error');
    } finally {
        hideLoading();
    }
}

// ========================================
// 画面切り替え
// ========================================
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

// ========================================
// アルバイトアプリ初期化
// ========================================
async function initializeStaffApp() {
    document.getElementById('staff-app').style.display = 'block';
    document.getElementById('manager-app').style.display = 'none';

    await loadPeriods();
    
    // タブ切り替え
    initializeTabs('staff');

    // 確定シフト閲覧
    document.getElementById('shift-view-mode').addEventListener('change', loadStaffConfirmedShift);
    await loadStaffConfirmedShift();

    // シフト提出
    await loadStaffSubmitShift();
    document.getElementById('staff-submit-shift').addEventListener('click', submitStaffShift);
    document.getElementById('staff-clear-shift').addEventListener('click', clearStaffShift);

    // 設定
    document.getElementById('staff-change-password').addEventListener('click', changeStaffPassword);
}

// ========================================
// 社員アプリ初期化
// ========================================
async function initializeManagerApp() {
    document.getElementById('staff-app').style.display = 'none';
    document.getElementById('manager-app').style.display = 'block';

    await loadPeriods();
    
    // タブ切り替え
    initializeTabs('manager');

    // シフト管理
    await loadManagerShifts();
    await loadSubmissionStats();
    
    document.getElementById('publish-shift').addEventListener('click', publishShift);
    document.getElementById('revert-shift').addEventListener('click', revertShift);
    document.getElementById('download-confirmed-excel').addEventListener('click', () => downloadExcel('confirmed'));
    document.getElementById('download-confirmed-pdf').addEventListener('click', () => downloadPDF('confirmed'));
    document.getElementById('download-collecting-excel').addEventListener('click', () => downloadExcel('collecting'));

    // アカウント管理
    await loadAccountManagement();

    // 設定
    document.getElementById('manager-change-password').addEventListener('click', changeManagerPassword);
}

// ========================================
// タブ初期化
// ========================================
function initializeTabs(type) {
    const buttons = document.querySelectorAll(`#${type}-app .tab-button`);
    buttons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.dataset.tab;
            
            // すべてのタブを非アクティブに
            buttons.forEach(b => b.classList.remove('active'));
            document.querySelectorAll(`#${type}-app .tab-content`).forEach(c => c.classList.remove('active'));
            
            // 選択されたタブをアクティブに
            button.classList.add('active');
            document.getElementById(`${tabId}-tab`).classList.add('active');
        });
    });
}

// ========================================
// 期間データ読み込み
// ========================================
async function loadPeriods() {
    try {
        const response = await fetch(`${API_BASE_URL}/shift_periods`);
        const data = await response.json();
        
        collectingPeriod = data.find(p => p.status === 'collecting');
        confirmedPeriod = data.find(p => p.status === 'confirmed');
    } catch (error) {
        console.error('期間読み込みエラー:', error);
    }
}

// ========================================
// アルバイト:確定シフト閲覧
// ========================================
async function loadStaffConfirmedShift() {
    const container = document.getElementById('staff-confirmed-shift');
    const mode = document.getElementById('shift-view-mode').value;

    if (!confirmedPeriod) {
        container.innerHTML = '<p>確定版のシフトがまだありません</p>';
        return;
    }

    showLoading();

    try {
        const response = await fetch(`${API_BASE_URL}/shifts`);
        const data = await response.json();
        
        let shifts = data.filter(s => s.period_id === confirmedPeriod.id);
        
        if (mode === 'mine') {
            shifts = shifts.filter(s => s.staff_name === currentUser.username);
        }

        renderShiftTable(container, confirmedPeriod, shifts, false, false);
    } catch (error) {
        console.error('シフト読み込みエラー:', error);
    } finally {
        hideLoading();
    }
}

// ========================================
// アルバイト:シフト提出
// ========================================
async function loadStaffSubmitShift() {
    if (!collectingPeriod) {
        document.getElementById('submission-status').innerHTML = '<p>現在シフト希望を受け付けていません</p>';
        return;
    }

    document.getElementById('submit-period-title').textContent = collectingPeriod.display_name;

    // 既存のシフトを確認
    const response = await fetch(`${API_BASE_URL}/shifts`);
    const data = await response.json();
    
    const existingShifts = data.filter(s => 
        s.period_id === collectingPeriod.id && s.staff_name === currentUser.username
    );

    const statusBox = document.getElementById('submission-status');
    if (existingShifts.length > 0) {
        statusBox.className = 'status-box status-submitted';
        statusBox.textContent = `✅ 提出済み`;
    } else {
        statusBox.className = 'status-box status-not-submitted';
        statusBox.textContent = '❌ 未提出';
    }

    // カレンダー描画
    renderStaffShiftCalendar(existingShifts);
}

function renderStaffShiftCalendar(existingShifts) {
    const calendar = document.getElementById('staff-shift-calendar');
    calendar.innerHTML = '';

    const existingShiftsMap = {};
    existingShifts.forEach(shift => {
        existingShiftsMap[shift.date] = shift.shift_type;
    });

    const startDate = parseJSTDate(collectingPeriod.start_date);
    const endDate = parseJSTDate(collectingPeriod.end_date);

    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
        const dateStr = formatDateJST(new Date(date));
        const dayDiv = createDayElement(new Date(date), existingShiftsMap[dateStr] || '');
        calendar.appendChild(dayDiv);
    }
}

function createDayElement(date, existingShiftType = '') {
    const dayDiv = document.createElement('div');
    dayDiv.className = 'calendar-day';
    
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 6) dayDiv.classList.add('saturday');
    if (dayOfWeek === 0) dayDiv.classList.add('sunday');

    const dayNumber = document.createElement('div');
    dayNumber.className = 'day-number';
    dayNumber.textContent = `${date.getMonth() + 1}/${date.getDate()}`;

    const dayName = document.createElement('div');
    dayName.className = 'day-name';
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    dayName.textContent = dayNames[dayOfWeek];

    const select = document.createElement('select');
    select.className = 'shift-select';
    select.dataset.date = formatDateJST(date);
    
    const options = ['', 'B', 'C', 'L', 'N', 'CL', 'BL', 'BN', 'CN'];
    options.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt;
        option.textContent = opt || '休み';
        if (opt === existingShiftType) {
            option.selected = true;
        }
        select.appendChild(option);
    });

    dayDiv.appendChild(dayNumber);
    dayDiv.appendChild(dayName);
    dayDiv.appendChild(select);

    return dayDiv;
}
async function submitStaffShift() {
    const selects = document.querySelectorAll('.shift-select');
    const shifts = [];

    selects.forEach(select => {
        if (select.value) {
            shifts.push({
                period_id: collectingPeriod.id,
                staff_name: currentUser.username,
                date: select.dataset.date,
                shift_type: select.value
            });
        }
    });

    if (shifts.length === 0) {
        showMessage('シフトが選択されていません', 'error');
        return;
    }

    showLoading();

    try {
        // 既存のシフトを削除
        const existingResponse = await fetch(`${API_BASE_URL}/shifts`);
        const existingData = await existingResponse.json();
        
        for (const shift of existingData) {
            if (shift.staff_name === currentUser.username && shift.period_id === collectingPeriod.id) {
                await fetch(`${API_BASE_URL}/shifts/${shift.id}`, { method: 'DELETE' });
            }
        }

        // 新しいシフトを保存
        for (const shift of shifts) {
            await fetch(`${API_BASE_URL}/shifts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(shift)
            });
        }

        showMessage('シフトを提出しました', 'success');
        await loadStaffSubmitShift();

    } catch (error) {
        console.error('提出エラー:', error);
        showMessage('提出に失敗しました', 'error');
    } finally {
        hideLoading();
    }
}

function clearStaffShift() {
    document.querySelectorAll('.shift-select').forEach(select => {
        select.value = '';
    });
    showMessage('入力内容をクリアしました', 'info');
}

// ========================================
// アルバイト:パスワード変更
// ========================================
async function changeStaffPassword() {
    const currentPassword = document.getElementById('staff-current-password').value;
    const newPassword = document.getElementById('staff-new-password').value;

    if (!currentPassword || !newPassword) {
        showMessage('すべての項目を入力してください', 'error');
        return;
    }

    if (newPassword.length !== 4) {
        showMessage('新しい暗証番号は4桁で入力してください', 'error');
        return;
    }

    // マスターキーまたは現在のパスワードでチェック
    if (currentPassword !== 'ktwk' && currentPassword !== currentUser.password) {
        showMessage('現在の暗証番号が正しくありません', 'error');
        return;
    }

    showLoading();

    try {
        await fetch(`${API_BASE_URL}/accounts/${currentUser.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: newPassword })
        });

        currentUser.password = newPassword;
        showMessage('暗証番号を変更しました', 'success');
        
        document.getElementById('staff-current-password').value = '';
        document.getElementById('staff-new-password').value = '';

    } catch (error) {
        console.error('パスワード変更エラー:', error);
        showMessage('パスワード変更に失敗しました', 'error');
    } finally {
        hideLoading();
    }
}

// ========================================
// 社員:シフト管理
// ========================================
async function loadManagerShifts() {
    showLoading();

    try {
        const response = await fetch(`${API_BASE_URL}/shifts`);
        const data = await response.json();

        // 確定版
        if (confirmedPeriod) {
            const confirmedShifts = data.filter(s => s.period_id === confirmedPeriod.id);
            renderShiftTable(
                document.getElementById('manager-confirmed-shift'),
                confirmedPeriod,
                confirmedShifts,
                false,
                false
            );
        }

        // 収集中
        if (collectingPeriod) {
            const collectingShifts = data.filter(s => s.period_id === collectingPeriod.id);
            renderShiftTable(
                document.getElementById('manager-collecting-shift'),
                collectingPeriod,
                collectingShifts,
                false,
                true
            );
        }

    } catch (error) {
        console.error('シフト読み込みエラー:', error);
    } finally {
        hideLoading();
    }
}

// ========================================
// シフト表描画
// ========================================
function renderShiftTable(container, period, shifts, editable, deletable) {
    if (!period) {
        container.innerHTML = '<p>シフトデータがありません</p>';
        return;
    }

    const startDate = parseJSTDate(period.start_date);
    const endDate = parseJSTDate(period.end_date);
    
    const shiftsByStaff = {};
    shifts.forEach(shift => {
        if (!shiftsByStaff[shift.staff_name]) {
            shiftsByStaff[shift.staff_name] = {};
        }
        shiftsByStaff[shift.staff_name][shift.date] = shift.shift_type;
    });

    let html = '<div class="shift-table"><table>';
    html += '<thead><tr><th>スタッフ名</th>';
    
    const dates = [];
    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
        const dayOfWeek = date.getDay();
        const className = dayOfWeek === 6 ? 'saturday' : (dayOfWeek === 0 ? 'sunday' : '');
        const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
        const dateStr = formatDateJST(new Date(date));
        dates.push(dateStr);
        
        html += `<th class="${className}">${date.getMonth() + 1}/${date.getDate()}<br>(${dayNames[dayOfWeek]})`;
        
        if (deletable) {
            html += `<br><button class="btn-delete-date" onclick="deleteShiftsByDate('${dateStr}', '${period.id}')">🗑️</button>`;
        }
        html += '</th>';
    }
    
    if (deletable) {
        html += '<th>操作</th>';
    }
    
    html += '</tr></thead><tbody>';

    const staffNames = Object.keys(shiftsByStaff).sort();
    staffNames.forEach(staffName => {
        html += `<tr><td><strong>${staffName}</strong></td>`;
        
        for (let date of dates) {
            const shiftType = shiftsByStaff[staffName][date] || '';
            const dayOfWeek = new Date(date).getDay();
            const className = dayOfWeek === 6 ? 'saturday' : (dayOfWeek === 0 ? 'sunday' : '');
            
            if (deletable && shiftType) {
                html += `<td class="${className} deletable-cell" onclick="deleteShiftCell('${staffName}', '${date}', '${period.id}')">${shiftType} <span class="cell-delete-icon">🗑️</span></td>`;
            } else {
                html += `<td class="${className}">${shiftType}</td>`;
            }
        }
        
        if (deletable) {
            html += `<td><button class="btn btn-danger btn-small" onclick="deleteShiftsByStaff('${staffName}', '${period.id}')">削除</button></td>`;
        }
        
        html += '</tr>';
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
}

// ========================================
// 社員:提出状況表示
// ========================================
async function loadSubmissionStats() {
    const container = document.getElementById('submission-stats');
    
    if (!collectingPeriod) {
        container.innerHTML = '<p>収集中のシフト期間がありません</p>';
        return;
    }

    showLoading();

    try {
        // 全アカウント取得
        const accountsResponse = await fetch(`${API_BASE_URL}/accounts`);
        const accountsData = await accountsResponse.json();
        const staffAccounts = accountsData.filter(a => 
            a.account_type === 'staff' && a.status === 'approved'
        );

        // 提出済みシフト取得
        const shiftsResponse = await fetch(`${API_BASE_URL}/shifts`);
        const shiftsData = await shiftsResponse.json();
        const submittedShifts = shiftsData.filter(s => s.period_id === collectingPeriod.id);
        
        // 提出済みスタッフ名を取得
        const submittedStaff = [...new Set(submittedShifts.map(s => s.staff_name))];
        
        // 未提出スタッフを計算
        const notSubmittedStaff = staffAccounts.filter(a => 
            !submittedStaff.includes(a.username)
        );

        let html = '<div class="submission-stat">';
        
        // 提出済み
        html += '<div class="stat-card stat-submitted">';
        html += `<div class="stat-number">${submittedStaff.length}</div>`;
        html += '<div class="stat-label">提出済み</div>';
        if (submittedStaff.length > 0) {
            html += '<div class="staff-list">';
            submittedStaff.forEach(name => {
                html += `<div class="staff-list-item">✅ ${name}</div>`;
            });
            html += '</div>';
        }
        html += '</div>';
        
        // 未提出
        html += '<div class="stat-card stat-not-submitted">';
        html += `<div class="stat-number">${notSubmittedStaff.length}</div>`;
        html += '<div class="stat-label">未提出</div>';
        if (notSubmittedStaff.length > 0) {
            html += '<div class="staff-list">';
            notSubmittedStaff.forEach(account => {
                html += `<div class="staff-list-item">❌ ${account.username}</div>`;
            });
            html += '</div>';
        }
        html += '</div>';
        
        html += '</div>';
        container.innerHTML = html;

    } catch (error) {
        console.error('提出状況読み込みエラー:', error);
    } finally {
        hideLoading();
    }
}

// ========================================
// 社員:シフト公開
// ========================================
async function publishShift() {
    if (!confirm('収集中のシフトを確定版として公開しますか？')) {
        return;
    }

    showLoading();

    try {
        // 現在の確定版をアーカイブ
        if (confirmedPeriod) {
            await fetch(`${API_BASE_URL}/shift_periods/${confirmedPeriod.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'archived' })
            });
        }

        // 収集中を確定版に
        await fetch(`${API_BASE_URL}/shift_periods/${collectingPeriod.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'confirmed' })
        });

        // 次の期間を作成
        const nextStart = new Date(collectingPeriod.start_date);
        nextStart.setMonth(nextStart.getMonth() + 1);
        const nextEnd = new Date(nextStart);
        nextEnd.setMonth(nextEnd.getMonth() + 1);
        nextEnd.setDate(15);

        const { v4: uuidv4 } = await import('https://cdn.skypack.dev/uuid');
        
        await fetch(`${API_BASE_URL}/shift_periods`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: uuidv4(),
                start_date: formatDateJST(nextStart),
                end_date: formatDateJST(nextEnd),
                status: 'collecting',
                display_name: `${nextStart.getFullYear()}年${nextStart.getMonth() + 1}月16日〜${nextEnd.getFullYear()}年${nextEnd.getMonth() + 1}月15日`
            })
        });

        showMessage('シフトを公開しました', 'success');
        await loadPeriods();
        await loadManagerShifts();
        await loadSubmissionStats();

    } catch (error) {
        console.error('公開エラー:', error);
        showMessage('公開に失敗しました', 'error');
    } finally {
        hideLoading();
    }
}

// ========================================
// 社員:確定撤回(シフトデータ保持)
// ========================================
async function revertShift() {
    if (!confirm('確定を撤回しますか？1つ前の状態に戻ります。提出済みシフトは保持されます。')) {
        return;
    }

    showLoading();

    try {
        const response = await fetch(`${API_BASE_URL}/shift_periods`);
        const data = await response.json();
        
        const currentConfirmed = data.find(p => p.status === 'confirmed');
        const currentCollecting = data.find(p => p.status === 'collecting');
        const archived = data.filter(p => p.status === 'archived').sort((a, b) => 
            new Date(b.start_date) - new Date(a.start_date)
        )[0];

        if (!currentConfirmed || !currentCollecting) {
            showMessage('撤回できる状態ではありません', 'error');
            hideLoading();
            return;
        }

        // 収集中を削除
        await fetch(`${API_BASE_URL}/shift_periods/${currentCollecting.id}`, { method: 'DELETE' });

        // 確定版を収集中に戻す
        await fetch(`${API_BASE_URL}/shift_periods/${currentConfirmed.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'collecting' })
        });

        // アーカイブを確定版に戻す
        if (archived) {
            await fetch(`${API_BASE_URL}/shift_periods/${archived.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'confirmed' })
            });
        }

        showMessage('確定を撤回しました', 'success');
        await loadPeriods();
        await loadManagerShifts();
        await loadSubmissionStats();

    } catch (error) {
        console.error('撤回エラー:', error);
        showMessage('撤回に失敗しました', 'error');
    } finally {
        hideLoading();
    }
}

// ========================================
// 削除機能
// ========================================
async function deleteShiftsByStaff(staffName, periodId) {
    if (!confirm(`${staffName}さんのシフトを全削除しますか？`)) {
        return;
    }

    showLoading();

    try {
        const response = await fetch(`${API_BASE_URL}/shifts`);
        const data = await response.json();
        
        let deletedCount = 0;
        for (const shift of data) {
            if (shift.staff_name === staffName && shift.period_id === periodId) {
                await fetch(`${API_BASE_URL}/shifts/${shift.id}`, { method: 'DELETE' });
                deletedCount++;
            }
        }

        showMessage(`${staffName}さんのシフトを${deletedCount}件削除しました`, 'success');
        await loadManagerShifts();
        await loadSubmissionStats();
    } catch (error) {
        console.error('削除エラー:', error);
        showMessage('削除に失敗しました', 'error');
    } finally {
        hideLoading();
    }
}

async function deleteShiftsByDate(date, periodId) {
    if (!confirm(`${date}のシフトを全員分削除しますか？`)) {
        return;
    }

    showLoading();

    try {
        const response = await fetch(`${API_BASE_URL}/shifts`);
        const data = await response.json();
        
        let deletedCount = 0;
        for (const shift of data) {
            if (shift.date === date && shift.period_id === periodId) {
                await fetch(`${API_BASE_URL}/shifts/${shift.id}`, { method: 'DELETE' });
                deletedCount++;
            }
        }

        showMessage(`${date}のシフトを${deletedCount}件削除しました`, 'success');
        await loadManagerShifts();
        await loadSubmissionStats();
    } catch (error) {
        console.error('削除エラー:', error);
        showMessage('削除に失敗しました', 'error');
    } finally {
        hideLoading();
    }
}

async function deleteShiftCell(staffName, date, periodId) {
    if (!confirm(`${staffName}さんの${date}のシフトを削除しますか？`)) {
        return;
    }

    showLoading();

    try {
        const response = await fetch(`${API_BASE_URL}/shifts`);
        const data = await response.json();
        
        for (const shift of data) {
            if (shift.staff_name === staffName && shift.date === date && shift.period_id === periodId) {
                await fetch(`${API_BASE_URL}/shifts/${shift.id}`, { method: 'DELETE' });
                showMessage(`${staffName}さんの${date}のシフトを削除しました`, 'success');
                await loadManagerShifts();
                await loadSubmissionStats();
                hideLoading();
                return;
            }
        }

        showMessage('該当するシフトが見つかりませんでした', 'error');
    } catch (error) {
        console.error('削除エラー:', error);
        showMessage('削除に失敗しました', 'error');
    } finally {
        hideLoading();
    }
}

// ========================================
// 社員:アカウント管理
// ========================================
async function loadAccountManagement() {
    showLoading();

    try {
        const response = await fetch(`${API_BASE_URL}/accounts`);
        const data = await response.json();
        
        const pending = data.filter(a => a.status === 'pending');
        const approved = data.filter(a => a.status === 'approved' && a.account_type === 'staff');

        // 承認待ち
        const pendingContainer = document.getElementById('pending-list');
        if (pending.length === 0) {
            pendingContainer.innerHTML = '<p>承認待ちのアカウントはありません</p>';
        } else {
            let html = '';
            pending.forEach(account => {
                html += `
                    <div class="account-item">
                        <div class="account-info">
                            <div class="account-name">${account.username} <span class="badge badge-new">NEW</span></div>
                            <div class="account-date">登録日時: ${formatDateTime(account.created_at)}</div>
                        </div>
                        <div class="account-actions">
                            <button class="btn btn-success btn-small" onclick="approveAccount('${account.id}')">承認</button>
                            <button class="btn btn-danger btn-small" onclick="rejectAccount('${account.id}')">拒否</button>
                        </div>
                    </div>
                `;
            });
            pendingContainer.innerHTML = html;
        }

        // 承認済み
        const approvedContainer = document.getElementById('approved-list');
        if (approved.length === 0) {
            approvedContainer.innerHTML = '<p>承認済みのアカウントはありません</p>';
        } else {
            let html = '';
            approved.forEach(account => {
                html += `
                    <div class="account-item">
                        <div class="account-info">
                            <div class="account-name">${account.username}</div>
                            <div class="account-date">承認日時: ${formatDateTime(account.approved_at)}</div>
                        </div>
                        <div class="account-actions">
                            <button class="btn btn-warning btn-small" onclick="resetPassword('${account.id}', '${account.username}')">暗証番号リセット</button>
                            <button class="btn btn-danger btn-small" onclick="deleteAccount('${account.id}', '${account.username}')">削除</button>
                        </div>
                    </div>
                `;
            });
            approvedContainer.innerHTML = html;
        }

    } catch (error) {
        console.error('アカウント読み込みエラー:', error);
    } finally {
        hideLoading();
    }
}

async function approveAccount(accountId) {
    showLoading();

    try {
        await fetch(`${API_BASE_URL}/accounts/${accountId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: 'approved',
                approved_at: new Date().toISOString()
            })
        });

        showMessage('アカウントを承認しました', 'success');
        await loadAccountManagement();
    } catch (error) {
        console.error('承認エラー:', error);
        showMessage('承認に失敗しました', 'error');
    } finally {
        hideLoading();
    }
}

async function rejectAccount(accountId) {
    if (!confirm('このアカウントを拒否しますか？')) {
        return;
    }

    showLoading();

    try {
        await fetch(`${API_BASE_URL}/accounts/${accountId}`, { method: 'DELETE' });
        showMessage('アカウントを拒否しました', 'info');
        await loadAccountManagement();
    } catch (error) {
        console.error('拒否エラー:', error);
        showMessage('拒否に失敗しました', 'error');
    } finally {
        hideLoading();
    }
}

async function resetPassword(accountId, username) {
    if (!confirm(`${username}さんの暗証番号を1111にリセットしますか？`)) {
        return;
    }

    showLoading();

    try {
        await fetch(`${API_BASE_URL}/accounts/${accountId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: '1111' })
        });

        showMessage(`${username}さんの暗証番号を1111にリセットしました`, 'success');
    } catch (error) {
        console.error('リセットエラー:', error);
        showMessage('リセットに失敗しました', 'error');
    } finally {
        hideLoading();
    }
}

async function deleteAccount(accountId, username) {
    if (!confirm(`${username}さんのアカウントとシフトデータを完全に削除しますか？この操作は取り消せません。`)) {
        return;
    }

    showLoading();

    try {
        // アカウント削除
        await fetch(`${API_BASE_URL}/accounts/${accountId}`, { method: 'DELETE' });

        // シフトデータ削除
        const response = await fetch(`${API_BASE_URL}/shifts`);
        const data = await response.json();
        
        for (const shift of data) {
            if (shift.staff_name === username) {
                await fetch(`${API_BASE_URL}/shifts/${shift.id}`, { method: 'DELETE' });
            }
        }

        showMessage(`${username}さんのアカウントとシフトデータを削除しました`, 'success');
        await loadAccountManagement();
        await loadManagerShifts();
        await loadSubmissionStats();
    } catch (error) {
        console.error('削除エラー:', error);
        showMessage('削除に失敗しました', 'error');
    } finally {
        hideLoading();
    }
}

// ========================================
// 社員:パスワード変更
// ========================================
async function changeManagerPassword() {
    const currentPassword = document.getElementById('manager-current-password').value;
    const newPassword = document.getElementById('manager-new-password').value;

    if (!currentPassword || !newPassword) {
        showMessage('すべての項目を入力してください', 'error');
        return;
    }

    if (newPassword.length !== 4) {
        showMessage('新しい暗証番号は4桁で入力してください', 'error');
        return;
    }

    if (currentPassword !== 'ktwk' && currentPassword !== currentUser.password) {
        showMessage('現在の暗証番号が正しくありません', 'error');
        return;
    }

    showLoading();

    try {
        await fetch(`${API_BASE_URL}/accounts/${currentUser.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: newPassword })
        });

        currentUser.password = newPassword;
        showMessage('暗証番号を変更しました', 'success');
        
        document.getElementById('manager-current-password').value = '';
        document.getElementById('manager-new-password').value = '';

    } catch (error) {
        console.error('パスワード変更エラー:', error);
        showMessage('パスワード変更に失敗しました', 'error');
    } finally {
        hideLoading();
    }
}

// ========================================
// ダウンロード機能
// ========================================
async function downloadExcel(type) {
    const period = type === 'confirmed' ? confirmedPeriod : collectingPeriod;
    
    if (!period) {
        showMessage('ダウンロードするシフトがありません', 'error');
        return;
    }

    showLoading();

    try {
        const response = await fetch(`${API_BASE_URL}/shifts`);
        const data = await response.json();
        const shifts = data.filter(s => s.period_id === period.id);

        const startDate = parseJSTDate(period.start_date);
        const endDate = parseJSTDate(period.end_date);
        
        const shiftsByStaff = {};
        shifts.forEach(shift => {
            if (!shiftsByStaff[shift.staff_name]) {
                shiftsByStaff[shift.staff_name] = {};
            }
            shiftsByStaff[shift.staff_name][shift.date] = shift.shift_type;
        });

        const wsData = [['スタッフ名']];
        
        for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
            wsData[0].push(`${date.getMonth() + 1}/${date.getDate()}`);
        }

        Object.keys(shiftsByStaff).sort().forEach(staffName => {
            const row = [staffName];
            for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
                const dateStr = formatDateJST(date);
                row.push(shiftsByStaff[staffName][dateStr] || '');
            }
            wsData.push(row);
        });

        const ws = XLSX.utils.aoa_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'シフト表');
        XLSX.writeFile(wb, `シフト表_${period.display_name}.xlsx`);

        showMessage('Excelファイルをダウンロードしました', 'success');
    } catch (error) {
        console.error('ダウンロードエラー:', error);
        showMessage('ダウンロードに失敗しました', 'error');
    } finally {
        hideLoading();
    }
}

async function downloadPDF(type) {
    const period = type === 'confirmed' ? confirmedPeriod : collectingPeriod;
    
    if (!period) {
        showMessage('ダウンロードするシフトがありません', 'error');
        return;
    }

    showLoading();

    try {
        const response = await fetch(`${API_BASE_URL}/shifts`);
        const data = await response.json();
        const shifts = data.filter(s => s.period_id === period.id);

        const startDate = parseJSTDate(period.start_date);
        const endDate = parseJSTDate(period.end_date);
        
        const shiftsByStaff = {};
        shifts.forEach(shift => {
            if (!shiftsByStaff[shift.staff_name]) {
                shiftsByStaff[shift.staff_name] = {};
            }
            shiftsByStaff[shift.staff_name][shift.date] = shift.shift_type;
        });

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('landscape');

        doc.setFont('helvetica');
        doc.setFontSize(16);
        doc.text(period.display_name, 15, 15);

        const headers = [['スタッフ名']];
        for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
            headers[0].push(`${date.getMonth() + 1}/${date.getDate()}`);
        }

        const body = [];
        Object.keys(shiftsByStaff).sort().forEach(staffName => {
            const row = [staffName];
            for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
                const dateStr = formatDateJST(date);
                row.push(shiftsByStaff[staffName][dateStr] || '');
            }
            body.push(row);
        });

        doc.autoTable({
            head: headers,
            body: body,
            startY: 25,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [102, 126, 234] }
        });

        doc.save(`シフト表_${period.display_name}.pdf`);
        showMessage('PDFファイルをダウンロードしました', 'success');
    } catch (error) {
        console.error('PDFダウンロードエラー:', error);
        showMessage('PDFダウンロードに失敗しました', 'error');
    } finally {
        hideLoading();
    }
}
