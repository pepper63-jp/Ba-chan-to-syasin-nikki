// 1. Firebase初期化（compat版）
const firebaseConfig = {
    apiKey: "AIzaSyAOFOrXB5jFAy87Zuh_JgR1Lmq2N7gxc6Y",
    authDomain: "ba-tyan-to-hananikki.firebaseapp.com",
    databaseURL: "https://ba-tyan-to-hananikki-default-rtdb.firebaseio.com",
    projectId: "ba-tyan-to-hananikki",
    storageBucket: "ba-tyan-to-hananikki.firebasestorage.app",
    messagingSenderId: "245592923418",
    appId: "1:245592923418:web:be6ef7025fb667b965e0a3"
};
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const photosRef = database.ref('photos');

// 2. 変数管理（ここを確実に初期化します）
let currentDisplayDate = new Date();
const realToday = new Date();
let selectedDateKey = null;
let photoData = {};
let currentPhotoList = [];
let currentPhotoIndex = 0;
// 以前のユーザー情報を取得
let notificationEnabled = localStorage.getItem('notificationEnabled') !== 'false';
let currentUser = JSON.parse(localStorage.getItem('flowerUser')) || null;
let selEmoji = currentUser ? currentUser.icon : '';

// 祝日データの一時保存用（例："2026-3" → ["2026-3-20", "2026-3-21"] のような形式）
let holidayCache = {};

// 前回のデータをキャッシュから読み込んで即座に表示する
const cachedData = localStorage.getItem('photoDataCache');
if (cachedData) {
    try {
        photoData = JSON.parse(cachedData);
        renderCalendarWithHolidays();
    } catch(e) {
        // キャッシュが壊れていた場合は無視する
    }
}

// 画面上部の「あなたは【〇〇】さんです」表示を更新
function updateUserStatus() {
    const el = document.getElementById('user-status');
    if (!el) return;
    if (currentUser && currentUser.name) {
        el.textContent = `あなたは【${currentUser.name}】さんです`;
    } else {
        el.textContent = 'おなまえを設定してください';
    }
}

// 3. メール／パスワード認証（ログイン UI は JS で生成）
const AUTH_LOGIN_ERR = 'メールアドレスかパスワードが違います';

function injectAuthLoginStyles() {
    if (document.getElementById('auth-login-styles')) return;
    const style = document.createElement('style');
    style.id = 'auth-login-styles';
    style.textContent = `
        .auth-login-overlay {
            position: fixed; inset: 0; z-index: 30000;
            display: none; align-items: center; justify-content: center;
            background: rgba(253, 252, 240, 0.92);
            padding: 20px; box-sizing: border-box;
        }
        .auth-login-overlay.visible { display: flex; }
        .auth-login-card {
            width: 100%; max-width: 340px;
            background: #fff; border-radius: 20px;
            border: 3px solid #ffb7c5;
            box-shadow: 0 8px 24px rgba(216, 112, 147, 0.2);
            padding: 28px 22px; box-sizing: border-box;
        }
        .auth-login-card h2 {
            margin: 0 0 18px 0; text-align: center;
            font-size: 1.15rem; color: #d87093;
        }
        .auth-login-card label {
            display: block; font-size: 0.8rem; color: #8b5e3c;
            margin-bottom: 4px; text-align: left;
        }
        .auth-login-card input[type="email"],
        .auth-login-card input[type="password"] {
            width: 100%; box-sizing: border-box;
            padding: 12px 14px; margin-bottom: 14px;
            border: 2px solid #ffb7c5; border-radius: 12px;
            font-size: 1rem; background: #fffafa; color: #444;
        }
        .auth-login-card input:focus {
            outline: none; border-color: #d87093;
            box-shadow: 0 0 0 3px rgba(255, 183, 197, 0.45);
        }
        .auth-login-submit {
            width: 100%; margin-top: 6px; padding: 14px;
            border: none; border-radius: 14px; font-size: 1.05rem;
            font-weight: bold; cursor: pointer; color: #fff;
            background: #d87093;
            box-shadow: 0 4px 0 rgba(180, 80, 110, 0.35);
        }
        .auth-login-submit:active { transform: translateY(2px); box-shadow: none; }
        .auth-login-submit:disabled { opacity: 0.65; cursor: not-allowed; transform: none; }
        .auth-login-error {
            min-height: 1.25em; margin: 0 0 10px 0;
            font-size: 0.85rem; color: #c44; text-align: center;
        }
    `;
    document.head.appendChild(style);
}

function buildAuthLoginOverlay() {
    injectAuthLoginStyles();
    let overlay = document.getElementById('auth-login-overlay');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'auth-login-overlay';
    overlay.className = 'auth-login-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'auth-login-title');

    const card = document.createElement('div');
    card.className = 'auth-login-card';

    const title = document.createElement('h2');
    title.id = 'auth-login-title';
    title.textContent = 'ログイン';

    const err = document.createElement('p');
    err.className = 'auth-login-error';
    err.setAttribute('aria-live', 'polite');

    const form = document.createElement('form');

    const emailLabel = document.createElement('label');
    emailLabel.htmlFor = 'auth-email';
    emailLabel.textContent = 'メールアドレス';
    const emailInput = document.createElement('input');
    emailInput.type = 'email';
    emailInput.id = 'auth-email';
    emailInput.name = 'email';
    emailInput.autocomplete = 'username';
    emailInput.required = true;

    const passLabel = document.createElement('label');
    passLabel.htmlFor = 'auth-password';
    passLabel.textContent = 'パスワード';
    const passInput = document.createElement('input');
    passInput.type = 'password';
    passInput.id = 'auth-password';
    passInput.name = 'password';
    passInput.autocomplete = 'current-password';
    passInput.required = true;

    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = 'auth-login-submit';
    submit.textContent = 'ログインする';

    const clearErr = () => { err.textContent = ''; };
    emailInput.addEventListener('input', clearErr);
    passInput.addEventListener('input', clearErr);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        err.textContent = '';
        submit.disabled = true;
        try {
            await firebase.auth().signInWithEmailAndPassword(
                emailInput.value.trim(),
                passInput.value
            );
            passInput.value = '';
        } catch (loginErr) {
            console.error('Login Error:', loginErr);
            err.textContent = AUTH_LOGIN_ERR;
        } finally {
            submit.disabled = false;
        }
    });

    form.appendChild(emailLabel);
    form.appendChild(emailInput);
    form.appendChild(passLabel);
    form.appendChild(passInput);
    form.appendChild(submit);

    card.appendChild(title);
    card.appendChild(err);
    card.appendChild(form);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    return overlay;
}

function openSettingsMenu() {
    const modal = document.getElementById('settings-menu-modal');
    const btn = document.getElementById('settings-btn');
    if (modal) modal.style.display = 'block';
    if (btn) btn.setAttribute('aria-expanded', 'true');
}

function closeSettingsMenu() {
    closeModal('settings-menu-modal');
    const btn = document.getElementById('settings-btn');
    if (btn) btn.setAttribute('aria-expanded', 'false');
}

function setLoginOverlayVisible(visible) {
    const overlay = buildAuthLoginOverlay();
    overlay.classList.toggle('visible', visible);
}

function setLogoutVisible(visible) {
    const btn = document.getElementById('settings-logout-btn');
    if (btn) btn.style.display = visible ? 'block' : 'none';
}

function handlePhotosSnapshot(snap) {
    photoData = snap.val() || {};
    // 最新データを端末に保存して次回起動時に即表示できるようにする
    try { localStorage.setItem('photoDataCache', JSON.stringify(photoData)); } catch(e) {}
    renderCalendarWithHolidays();
    if (document.getElementById('modal').style.display === 'block' && selectedDateKey) {
        openPhotoModal(selectedDateKey);
    }
}

let photosListenerAttached = false;

function attachPhotosListener() {
    if (photosListenerAttached) return;
    photosRef.on('value', handlePhotosSnapshot);
    photosListenerAttached = true;
}

function detachPhotosListener() {
    if (!photosListenerAttached) return;
    photosRef.off('value', handlePhotosSnapshot);
    photosListenerAttached = false;
    photoData = {};
    renderCalendarWithHolidays();
    const modal = document.getElementById('modal');
    if (modal) modal.style.display = 'none';
    const emptyDayModal = document.getElementById('empty-day-modal');
    if (emptyDayModal) emptyDayModal.style.display = 'none';
}

buildAuthLoginOverlay();
// 起動直後はログイン画面を見せず、ローディング画面を表示する
document.getElementById('loading-overlay').style.display = 'flex';
document.getElementById('loading-text').innerText = '読み込み中...';

firebase.auth().onAuthStateChanged((user) => {
    // Firebaseの確認が終わったらローディングを隠す
    document.getElementById('loading-overlay').style.display = 'none';
    if (user) {
        if (user.isAnonymous === true) {
            firebase.auth().signOut();
            return;
        }
        setLoginOverlayVisible(false);
        setLogoutVisible(true);
        attachPhotosListener();
        // 通知の許可を求めてトークンを保存する
        requestNotificationPermission();
    } else {
        detachPhotosListener();
        setLogoutVisible(false);
        setLoginOverlayVisible(true);
    }
});

// 4. カレンダー描画
function renderCalendar(holidays = []) {
    const y = currentDisplayDate.getFullYear(), m = currentDisplayDate.getMonth();
    document.getElementById('calendar-title').innerHTML = `<span class="calendar-title-text">${y}年 ${m + 1}月</span>`;
    const titleWrapper = document.querySelector('#calendar-title .calendar-title-text');
    if (titleWrapper) {
        titleWrapper.onclick = () => { goToday(); };
    }
    const first = new Date(y, m, 1).getDay(), last = new Date(y, m + 1, 0).getDate();
    const container = document.getElementById('calendar-dates');
    if (!container) return;
    container.innerHTML = '';

    for (let i = 0; i < first; i++) container.innerHTML += '<div class="date-cell"></div>';

    for (let d = 1; d <= last; d++) {
        const key = `${y}-${m + 1}-${d}`;
        const dayOfWeek = new Date(y, m, d).getDay();
        const isToday = y === realToday.getFullYear() && m === realToday.getMonth() && d === realToday.getDate();
        const isHoliday = holidays.includes(key);

        const cell = document.createElement('div');
        let dateClass = isToday ? 'today' : '';
        if (dayOfWeek === 0 || isHoliday) dateClass += ' sun';
        if (dayOfWeek === 6) dateClass += ' sat';
        if (selectedDateKey === key) dateClass += ' selected-date';

        cell.className = `date-cell ${dateClass}`;
        cell.innerHTML = `<div class="date-number">${d}</div><div class="photo-container" id="thumb-${key}"></div>`;

        cell.onclick = () => {
            if (selectedDateKey === key) {
                const hasPhotos = photoData[key] && Object.keys(photoData[key]).length > 0;
                if (hasPhotos) openPhotoModal(key);
                else openEmptyDayModal(key);
            } else {
                selectedDateKey = key;
                renderCalendarWithHolidays();
            }
        };
        container.appendChild(cell);
        updateThumbs(key);
    }
}

// 祝日を取得してからカレンダーを描画する
async function renderCalendarWithHolidays() {
    const y = currentDisplayDate.getFullYear();
    const m = currentDisplayDate.getMonth();
    const cacheKey = `${y}-${m + 1}`;

    // すでに取得済みならキャッシュを使う
    if (holidayCache[cacheKey]) {
        renderCalendar(holidayCache[cacheKey]);
        return;
    }

    // まず祝日なしで即描画して、取得後に再描画する
    renderCalendar([]);

    try {
        const res = await fetch(`https://holidays-jp.github.io/api/v1/${y}/date.json`);
        const data = await res.json();
        // APIのキー形式 "2026-03-20" を "2026-3-20" に変換して合わせる
        const holidays = Object.keys(data).map(dateStr => {
            const [hy, hm, hd] = dateStr.split('-').map(Number);
            return `${hy}-${hm}-${hd}`;
        });
        holidayCache[cacheKey] = holidays;
        renderCalendar(holidays);
    } catch(e) {
        // 取得失敗しても何も起きない（祝日が赤くならないだけ）
    }
}

function updateThumbs(key) {
    const div = document.getElementById(`thumb-${key}`);
    if (!div || !photoData[key]) return;
    const sortedIds = Object.keys(photoData[key]).sort((a, b) => (photoData[key][a].timestamp || 0) - (photoData[key][b].timestamp || 0));

    sortedIds.slice(0, 4).forEach((id, index) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'photo-wrapper-mini';
        const img = document.createElement('img');
        img.src = photoData[key][id].src;
        img.className = 'photo-preview';
        wrapper.appendChild(img);
        if (index === 3 && sortedIds.length > 4) {
            const overlay = document.createElement('div');
            overlay.className = 'more-overlay';
            overlay.innerText = `+${sortedIds.length - 3}`;
            wrapper.appendChild(overlay);
        }
        div.appendChild(wrapper);
    });
}

// 5. アップロードとモーダル関連
document.getElementById('photo-input').onchange = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0 && selectedDateKey && currentUser) {
        document.getElementById('loading-overlay').style.display = 'flex';
        for (let i = 0; i < files.length; i++) {
            document.getElementById('loading-text').innerText = `${files.length}枚中 ${i+1}枚目を送信中...`;
            const base64 = await new Promise(res => {
                const r = new FileReader(); r.onload = (ev) => res(ev.target.result); r.readAsDataURL(files[i]);
            });
            const compressed = await compressImage(base64);
            const messaging = firebase.messaging();
            let senderToken = null;
            try { senderToken = await messaging.getToken({ vapidKey: 'BKIljBShJULc0OZAnzDC1P_9msiBbn4J_FE_KY8wQnP7DkmEWcOK322V9x98p8Xj4qr0CjvOATlyNmI6kpxrfPE' }); } catch(e) {}
            await database.ref(`photos/${selectedDateKey}`).push({ 
                src: compressed, sender: currentUser.name, icon: currentUser.icon, 
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                token: senderToken
            });
        }
        document.getElementById('loading-overlay').style.display = 'none';
        e.target.value = ''; openPhotoModal(selectedDateKey);
    }
};

async function compressImage(base64) {
    return new Promise(res => {
        const img = new Image(); img.src = base64;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX = 800; let w = img.width, h = img.height;
            if (w > h) { if (w > MAX) { h *= MAX / w; w = MAX; } } else { if (h > MAX) { w *= MAX / h; h = MAX; } }
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            res(canvas.toDataURL('image/jpeg', 0.7));
        };
    });
}

function openEmptyDayModal(key) {
    const modal = document.getElementById('empty-day-modal');
    const titleEl = document.getElementById('empty-day-modal-title');
    if (!modal || !titleEl) return;
    const parts = key.split('-').map((n) => parseInt(n, 10));
    if (parts.length === 3 && parts.every((n) => !Number.isNaN(n))) {
        titleEl.textContent = `${parts[1]}月${parts[2]}日`;
    } else {
        titleEl.textContent = '';
    }
    modal.style.display = 'block';
}

function openPhotoModal(key) {
    const emptyModal = document.getElementById('empty-day-modal');
    if (emptyModal) emptyModal.style.display = 'none';

    const list = document.getElementById('modal-photo-list');
    if (!list) return;
    list.innerHTML = '';
    document.getElementById('modal-date-title').innerText = key.split('-')[2] + '日の思い出';
    currentPhotoList = [];
    if (photoData[key]) {
        const sortedIds = Object.keys(photoData[key]).sort((a, b) => (photoData[key][a].timestamp || 0) - (photoData[key][b].timestamp || 0));
        sortedIds.forEach((id, index) => {
            const item = photoData[key][id];
            currentPhotoList.push(item.src);
            const photoItem = document.createElement('div');
            photoItem.className = 'modal-photo-item';
            const canDelete = currentUser && item.sender && currentUser.name === item.sender;
            const caption = [
                formatPostDateTime(item.timestamp, key),
                item.icon || '👤',
                item.sender || 'ななし'
            ].filter(Boolean).join(' ');
            photoItem.innerHTML = `
                ${canDelete ? `<button class="delete-btn" onclick="event.stopPropagation(); deletePhoto('${key}', '${id}')">×</button>` : ''}
                <img src="${item.src}" class="modal-img" onclick="openZoomWithIndex(${index})">
                <br>
                <small>${caption}</small>
            `;
            list.appendChild(photoItem);
        });
    }
    document.getElementById('modal').style.display = 'block';
}

// 投稿日時を「3/15 13:58」形式（日付キーは M/D、時刻は24時間）で表示
function formatPostDateTime(timestamp, dateKeyFallback) {
    const tsNum = timestamp != null ? Number(timestamp) : NaN;
    const hasTs = !Number.isNaN(tsNum);
    let d = null;
    if (hasTs) {
        d = new Date(tsNum);
        if (Number.isNaN(d.getTime())) d = null;
    }
    if (!d && dateKeyFallback) {
        const parts = dateKeyFallback.split('-').map((n) => parseInt(n, 10));
        if (parts.length === 3 && parts.every((n) => !Number.isNaN(n))) {
            d = new Date(parts[0], parts[1] - 1, parts[2]);
        }
    }
    if (!d || Number.isNaN(d.getTime())) return '';
    const md = `${d.getMonth() + 1}/${d.getDate()}`;
    if (hasTs) {
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        return `${md} ${hh}:${mm}`;
    }
    return md;
}

function deletePhoto(dateKey, photoId) {
    const item = photoData[dateKey] && photoData[dateKey][photoId];
    if (!item) return;

    if (!currentUser || !item.sender || currentUser.name !== item.sender) {
        alert('自分が投稿した写真だけ消せます。');
        return;
    }

    if (confirm('消してもいいですか？')) {
        database.ref(`photos/${dateKey}/${photoId}`).remove();
    }
}

function closeModal(id) { document.getElementById(id).style.display = 'none'; }

function requestPhotoUpload() {
    if (!selectedDateKey) {
        alert('日付を選んでね！');
        return;
    }
    if (!currentUser) {
        document.getElementById('sender-modal').style.display = 'block';
        return;
    }
    document.getElementById('photo-input').click();
}

// 6. ボタン操作とユーザー設定

const settingsBtn = document.getElementById('settings-btn');
if (settingsBtn) {
    settingsBtn.addEventListener('click', () => openSettingsMenu());
}

const settingsOpenSender = document.getElementById('settings-open-sender');
if (settingsOpenSender) {
    settingsOpenSender.addEventListener('click', () => {
        closeSettingsMenu();
        document.getElementById('sender-modal').style.display = 'block';
    });
}

const settingsOpenHowto = document.getElementById('settings-open-howto');
if (settingsOpenHowto) {
    settingsOpenHowto.addEventListener('click', () => {
        closeSettingsMenu();
        document.getElementById('howto-modal').style.display = 'block';
    });
}

const settingsLogoutBtn = document.getElementById('settings-logout-btn');
if (settingsLogoutBtn) {
    settingsLogoutBtn.addEventListener('click', () => {
        if (!confirm('本当にログアウトしますか？')) return;
        closeSettingsMenu();
        firebase.auth().signOut();
    });
}

const settingsMenuBackBtn = document.getElementById('settings-menu-back-btn');
if (settingsMenuBackBtn) {
    settingsMenuBackBtn.addEventListener('click', () => closeSettingsMenu());
}

const emojis = ['👵','👴','👨','👩','👧','👦','👶','🐶','🐱','🌸','🌼','🌷'];
const elist = document.getElementById('emoji-list');
if (elist) {
    emojis.forEach(e => {
        const b = document.createElement('button');
        b.className = 'emoji-btn' + (selEmoji === e ? ' selected' : '');
        b.innerText = e; b.type = "button";
        b.onclick = () => {
            selEmoji = e;
            document.querySelectorAll('.emoji-btn').forEach(x => x.classList.remove('selected'));
            b.classList.add('selected');
        };
        elist.appendChild(b);
    });
}

function saveCustomUser() {
    const name = document.getElementById('user-name-input').value;
    if (name && selEmoji) {
        currentUser = { name, icon: selEmoji };
        localStorage.setItem('flowerUser', JSON.stringify(currentUser));
        document.getElementById('sender-modal').style.display = 'none';
        updateUserStatus();
        alert("設定完了！");
    } else alert("おなまえと絵文字をえらんでね！");
}

function changeMonth(n) { currentDisplayDate.setMonth(currentDisplayDate.getMonth() + n); renderCalendarWithHolidays(); }
function goToday() { currentDisplayDate = new Date(); selectedDateKey = null; renderCalendarWithHolidays(); }

const modalAddBtn = document.getElementById('modal-add-btn');
if (modalAddBtn) modalAddBtn.addEventListener('click', () => requestPhotoUpload());

const emptyDayUploadBtn = document.getElementById('empty-day-upload-btn');
if (emptyDayUploadBtn) emptyDayUploadBtn.addEventListener('click', () => requestPhotoUpload());

const emptyDayBackBtn = document.getElementById('empty-day-back-btn');
if (emptyDayBackBtn) emptyDayBackBtn.addEventListener('click', () => closeModal('empty-day-modal'));

// --- ズーム・スワイプ機能 ---
function openZoomWithIndex(index) {
    currentPhotoIndex = index;
    const overlay = document.getElementById('zoom-modal');
    const img = document.getElementById('zoomed-img');
    if (!overlay || !img) return;

    img.src = currentPhotoList[currentPhotoIndex];
    img.style.transform = `translate(0px, 0px) scale(1)`;
    overlay.style.setProperty('display', 'flex', 'important');

    // スワイプ用変数の初期化
    let touchStartX = 0;
    const swipeThreshold = 50;

    overlay.ontouchstart = (e) => {
        if (e.target.tagName === 'BUTTON') return;
        touchStartX = e.touches[0].pageX;
    };

    overlay.ontouchend = (e) => {
        if (e.target.tagName === 'BUTTON') return;
        let touchEndX = e.changedTouches[0].pageX;
        let diff = touchStartX - touchEndX;

        // 右へスワイプ（次の写真へ）
        if (diff > swipeThreshold && currentPhotoIndex < currentPhotoList.length - 1) {
            switchPhoto(currentPhotoIndex + 1, 1);
        } 
        // 左へスワイプ（前の写真へ）
        else if (diff < -swipeThreshold && currentPhotoIndex > 0) {
            switchPhoto(currentPhotoIndex - 1, -1);
        }
    };
}

function closeZoomModal() {
    const overlay = document.getElementById('zoom-modal');
    if (overlay) overlay.style.setProperty('display', 'none', 'important');
}

// 写真を切り替えるときのアニメーション
function switchPhoto(newIndex, direction) {
    const img = document.getElementById('zoomed-img');
    img.style.transition = 'opacity 0.2s ease';
    img.style.opacity = '0';
    
    setTimeout(() => {
        currentPhotoIndex = newIndex;
        img.src = currentPhotoList[currentPhotoIndex];
        img.style.opacity = '1';
    }, 200);
}

// --- ボタン用の命令 ---

// 「前へ」ボタンが押されたとき
function goPrev() {
    // もし今の写真が「0番目（ato最初）」より後なら、1つ前の写真へ
    if (currentPhotoIndex > 0) {
        switchPhoto(currentPhotoIndex - 1, -1);
    }
}

// 「次へ」ボタンが押されたとき
function goNext() {
    // もし今の写真が「最後の写真」より前なら、1つ次の写真へ
    if (currentPhotoIndex < currentPhotoList.length - 1) {
        switchPhoto(currentPhotoIndex + 1, 1);
    }
}

// 通知許可を求めてFCMトークンをデータベースに保存する
async function requestNotificationPermission() {
    if (!notificationEnabled) return;
    try {
        const messaging = firebase.messaging();
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        const token = await messaging.getToken({
            vapidKey: 'BKIljBShJULc0OZAnzDC1P_9msiBbn4J_FE_KY8wQnP7DkmEWcOK322V9x98p8Xj4qr0CjvOATlyNmI6kpxrfPE'
        });
        if (token) {
            // ユーザー名をキーにして保存することで同じ端末で重複しないようにする
            const userKey = (currentUser && currentUser.name)
                ? 'user_' + currentUser.name.replace(/[^a-zA-Z0-9ぁ-んァ-ン一-龯]/g, '_')
                : 'user_anonymous';
            await database.ref('tokens/' + userKey).set({
                token: token,
                updatedAt: firebase.database.ServerValue.TIMESTAMP
            });
        }
    } catch(e) {
        // 通知が使えない環境では何もしない
    }
}

// 通知モーダルを開いてボタンの状態を現在の設定に合わせて更新する
function openNotificationModal() {
    const modal = document.getElementById('notification-modal');
    if (modal) modal.style.display = 'block';
    updateNotificationButtons();
}

// オンボタン・オフボタンの色とテキストを現在の状態に合わせて切り替える
function updateNotificationButtons() {
    const onBtn = document.getElementById('notification-on-btn');
    const offBtn = document.getElementById('notification-off-btn');
    if (!onBtn || !offBtn) return;

    if (notificationEnabled) {
        // オンが選ばれている状態
        onBtn.style.background = '#d87093';
        onBtn.style.color = 'white';
        onBtn.textContent = '✅ オン';
        offBtn.style.background = '#ccc';
        offBtn.style.color = 'white';
        offBtn.textContent = 'オフ';
    } else {
        // オフが選ばれている状態
        onBtn.style.background = '#ccc';
        onBtn.style.color = 'white';
        onBtn.textContent = 'オン';
        offBtn.style.background = '#d87093';
        offBtn.style.color = 'white';
        offBtn.textContent = '✅ オフ';
    }
}

// 通知をオンにする（トークンを取得してデータベースに保存する）
async function enableNotification() {
    notificationEnabled = true;
    localStorage.setItem('notificationEnabled', 'true');
    await requestNotificationPermission();
    updateNotificationButtons();
}

// 通知をオフにする（データベースからトークンを削除する）
async function disableNotification() {
    try {
        const userKey = (currentUser && currentUser.name)
            ? 'user_' + currentUser.name.replace(/[^a-zA-Z0-9ぁ-んァ-ン一-龯]/g, '_')
            : 'user_anonymous';
        await database.ref('tokens/' + userKey).remove();
    } catch(e) {}
    notificationEnabled = false;
    localStorage.setItem('notificationEnabled', 'false');
    updateNotificationButtons();
}

// 「🔔 通知」ボタン：設定メニューを閉じて通知モーダルを開く
const settingsOpenNotification = document.getElementById('settings-open-notification');
if (settingsOpenNotification) {
    settingsOpenNotification.addEventListener('click', () => {
        closeSettingsMenu();
        openNotificationModal();
    });
}

// 「✅ オン」ボタン
const notificationOnBtn = document.getElementById('notification-on-btn');
if (notificationOnBtn) {
    notificationOnBtn.addEventListener('click', () => enableNotification());
}

// 「オフ」ボタン
const notificationOffBtn = document.getElementById('notification-off-btn');
if (notificationOffBtn) {
    notificationOffBtn.addEventListener('click', () => disableNotification());
}

// 「もどる」ボタン：通知モーダルを閉じて設定メニューに戻る
const notificationBackBtn = document.getElementById('notification-back-btn');
if (notificationBackBtn) {
    notificationBackBtn.addEventListener('click', () => {
        closeModal('notification-modal');
        openSettingsMenu();
    });
}
// 初回実行
renderCalendarWithHolidays();
updateUserStatus();