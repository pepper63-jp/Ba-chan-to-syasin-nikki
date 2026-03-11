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

// 2. 変数管理（ここを確実に初期化します）
let currentDisplayDate = new Date();
const realToday = new Date();
let selectedDateKey = null;
let photoData = {};
let currentPhotoList = [];
let currentPhotoIndex = 0;
// 以前のユーザー情報を取得
let currentUser = JSON.parse(localStorage.getItem('flowerUser')) || null;
let selEmoji = currentUser ? currentUser.icon : '';

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

// 3. 匿名ログインと合言葉（処理を整理しました）
firebase.auth().signInAnonymously().then(() => {
    if (localStorage.getItem('pass-ok') !== 'true') {
        const pass = prompt("合言葉を入力してね（親族専用）");
        if (pass === 'abc') {
            localStorage.setItem('pass-ok', 'true');
        } else {
            alert("合言葉が違います。もう一度開いてね。");
            location.reload(); 
        }
    }
}).catch(err => console.error("Login Error:", err));

// 4. データのリアルタイム監視
database.ref('photos').on('value', (snap) => {
    photoData = snap.val() || {};
    renderCalendar();
    // モーダルが開いている場合は更新
    if (document.getElementById('modal').style.display === 'block' && selectedDateKey) {
        openPhotoModal(selectedDateKey);
    }
});

// 5. カレンダー描画
function renderCalendar() {
    const y = currentDisplayDate.getFullYear(), m = currentDisplayDate.getMonth();
    document.getElementById('calendar-title').innerText = `${y}年 ${m + 1}月`;
    const first = new Date(y, m, 1).getDay(), last = new Date(y, m + 1, 0).getDate();
    const container = document.getElementById('calendar-dates');
    if (!container) return;
    container.innerHTML = '';

    for (let i = 0; i < first; i++) container.innerHTML += '<div class="date-cell"></div>';

    for (let d = 1; d <= last; d++) {
        const key = `${y}-${m + 1}-${d}`; // 直感形式
        const dayOfWeek = new Date(y, m, d).getDay();
        const isToday = y === realToday.getFullYear() && m === realToday.getMonth() && d === realToday.getDate();
        
        const cell = document.createElement('div');
        let dateClass = isToday ? 'today' : '';
        if (dayOfWeek === 0) dateClass += ' sun';
        if (dayOfWeek === 6) dateClass += ' sat';
        if (selectedDateKey === key) dateClass += ' selected-date';
        
        cell.className = `date-cell ${dateClass}`;
        cell.innerHTML = `<div class="date-number">${d}</div><div class="photo-container" id="thumb-${key}"></div>`;
        
        cell.onclick = () => { 
            selectedDateKey = key; 
            renderCalendar(); 
            if (photoData[key]) openPhotoModal(key);
        };
        container.appendChild(cell);
        updateThumbs(key);
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

// 6. アップロードとモーダル関連
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
            await database.ref(`photos/${selectedDateKey}`).push({ 
                src: compressed, sender: currentUser.name, icon: currentUser.icon, 
                timestamp: firebase.database.ServerValue.TIMESTAMP 
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

function openPhotoModal(key) {
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
            photoItem.innerHTML = `
                ${canDelete ? `<button class="delete-btn" onclick="event.stopPropagation(); deletePhoto('${key}', '${id}')">×</button>` : ''}
                <img src="${item.src}" class="modal-img" onclick="openZoomWithIndex(${index})">
                <br>
                <small>${formatTime(item.timestamp)} ${item.icon || '👤'} ${item.sender || 'ななし'}</small>
            `;
            list.appendChild(photoItem);
        });
    }
    document.getElementById('modal').style.display = 'block';
}

// 投稿時間を「HH:MM」形式で表示するための関数
function formatTime(timestamp) {
    if (!timestamp) return '';
    try {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return '';
    }
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

// 7. ボタン操作とユーザー設定
document.getElementById('main-upload-trigger').onclick = () => {
    if (!selectedDateKey) alert('日付を選んでね！');
    else if (!currentUser) document.getElementById('sender-modal').style.display = 'block';
    else document.getElementById('photo-input').click();
};

document.getElementById('sender-btn').onclick = () => { document.getElementById('sender-modal').style.display = 'block'; };

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

function changeMonth(n) { currentDisplayDate.setMonth(currentDisplayDate.getMonth() + n); renderCalendar(); }
function goToday() { currentDisplayDate = new Date(); selectedDateKey = null; renderCalendar(); }

// モーダル内の「追加」ボタンを動かす
const modalAddBtn = document.getElementById('modal-add-btn');
if (modalAddBtn) {
    modalAddBtn.onclick = () => {
        if (!currentUser) {
            document.getElementById('sender-modal').style.display = 'block';
        } else {
            document.getElementById('photo-input').click();
        }
    };
}

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

// 初回実行
renderCalendar();
updateUserStatus();