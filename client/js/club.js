// club.js
let clubId = null;
let clubUsername = null;
let currentUserId = null;
let userRole = null;
let currentPostId = null;
let clubData = null;
let currentEditPostId = null;
let currentBanUserId = null;
let currentBanUserName = null;
let currentMatchId = null;
let matchTimerInterval = null;

// Для замен и карточек
let currentSubstitutePlayerId = null;
let currentSubstitutePlayerName = null;
let currentSubstitutePlayerPosition = null;
let currentCardPlayerId = null;
let currentCardPlayerName = null;
let currentCardType = null; // 'yellow' или 'red'
let pendingAutoSubstitute = null; // { playerId, playerName, position, minute, candidates }

// Глобальные данные для сохранения
window.substitutionsData = [];
window.cardsData = [];

document.addEventListener("DOMContentLoaded", function () {
  const urlParams = new URLSearchParams(window.location.search);
  clubUsername = urlParams.get("club");
  if (!clubUsername) {
    window.location.href = "clubs.html";
    return;
  }

  const token = localStorage.getItem("token");
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      currentUserId = payload.id;
    } catch (e) {
      console.log("Не авторизован");
    }
  }

  loadClubInfo();

  // Обработчик формы добавления игрока
  const addPlayerForm = document.getElementById("addPlayerForm");
  if (addPlayerForm) {
    addPlayerForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      const token = localStorage.getItem("token");
      if (!token) {
        alert("Необходимо авторизоваться");
        return;
      }

      const fullName = document.getElementById("playerFullName").value.trim();
      if (!fullName) {
        alert("Введите ФИО игрока");
        return;
      }

      const number = document.getElementById("playerNumber").value;
      const position = document.getElementById("playerPosition").value;

      try {
        const res = await fetch(`/api/clubs/${clubId}/players`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: fullName,
            number: number ? parseInt(number) : null,
            position: position,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Ошибка добавления");
        }

        alert("Игрок успешно добавлен");
        closeAddPlayerModal();
        if (currentMatchId) {
          await loadAvailablePlayers();
          initDragAndDrop();
          initSubstitutesDragAndDrop();
        }
        await loadClubPlayers();
      } catch (error) {
        alert("Ошибка: " + error.message);
      }
    });
  }

  // Обработка выбора позиции кнопками
  document.body.addEventListener("click", function (e) {
    if (e.target.classList && e.target.classList.contains("pos-btn")) {
      document
        .querySelectorAll(".pos-btn")
        .forEach((btn) => btn.classList.remove("active"));
      e.target.classList.add("active");
      const pos = e.target.getAttribute("data-pos");
      document.getElementById("playerPosition").value = pos;
    }
  });
});

// ========== ДОБАВЛЕНИЕ ИГРОКА ==========
window.openAddPlayerModal = function () {
  document.getElementById("addPlayerModal").style.display = "block";
  document.getElementById("playerFullName").value = "";
  document.getElementById("playerNumber").value = "";
  document
    .querySelectorAll(".pos-btn")
    .forEach((btn) => btn.classList.remove("active"));
  document.getElementById("playerPosition").value = "midfielder";
  const defaultBtn = document.querySelector('.pos-btn[data-pos="midfielder"]');
  if (defaultBtn) defaultBtn.classList.add("active");
};

window.closeAddPlayerModal = function () {
  document.getElementById("addPlayerModal").style.display = "none";
};

// ========== ЗАГРУЗКА ОСНОВНЫХ ДАННЫХ ==========
async function loadClubInfo() {
  try {
    const res = await fetch(`/api/clubs/${clubUsername}`);
    const club = await res.json();
    if (!res.ok) throw new Error(club.error || "Клуб не найден");
    clubId = club.id;
    clubData = club;

    const token = localStorage.getItem("token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const infoRes = await fetch(`/api/clubs/${clubId}/info`, { headers });
    const infoData = await infoRes.json();
    userRole = infoData.userRole;

    const adminButton = document.getElementById("adminButton");
    if (adminButton && (userRole === "creator" || userRole === "admin")) {
      adminButton.style.display = "block";
    }

    await loadClubDetails();
    await loadClubPlayers();
    await loadPosts();
    await loadNextMatch();
    await loadLastMatch();
  } catch (error) {
    console.error("Ошибка:", error);
    document.querySelector("main").innerHTML =
      '<p class="error">Клуб не найден</p>';
  }
}

async function loadClubDetails() {
  try {
    const token = localStorage.getItem("token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(`/api/clubs/${clubId}/info`, { headers });
    if (!res.ok) throw new Error();
    const data = await res.json();
    displayClubHeader(data);
    checkUserRole(data);
    displayClubInfo(data);
  } catch (error) {
    console.error("Ошибка загрузки деталей:", error);
  }
}

async function loadClubPlayers() {
  const container = document.getElementById("clubPlayersList");
  if (!container) return;
  try {
    const token = localStorage.getItem("token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(`/api/clubs/${clubId}/players`, { headers });
    const players = await res.json();
    if (!players || players.length === 0) {
      container.innerHTML =
        '<p class="no-data">Состав команды пока не заполнен</p>';
      return;
    }
    const positions = {
      goalkeeper: { title: "🥅 Вратари", players: [] },
      defender: { title: "🛡️ Защитники", players: [] },
      midfielder: { title: "⚡ Полузащитники", players: [] },
      forward: { title: "🎯 Нападающие", players: [] },
    };
    players.forEach((p) => {
      const pos = p.position || "midfielder";
      if (positions[pos]) positions[pos].players.push(p);
      else positions.midfielder.players.push(p);
    });
    let html = "";
    for (const group of Object.values(positions)) {
      if (group.players.length === 0) continue;
      html += `<div class="players-position-group"><div class="position-title">${group.title}</div><div class="players-grid">${group.players.map((p) => `<div class="player-card"><span class="player-number">${p.number || ""}</span> ${escapeHtml(p.name)}</div>`).join("")}</div></div>`;
    }
    container.innerHTML = html;
  } catch (error) {
    console.error(error);
    container.innerHTML = '<p class="error">Ошибка загрузки состава</p>';
  }
}

function displayClubHeader(club) {
  const container = document.getElementById("clubHeader");
  const subscribersCount = club.followers_count || club.members_count || 0;
  container.innerHTML = `<div class="club-cover">${club.cover ? `<img src="${club.cover}" alt="cover">` : ""}</div><div class="club-header-content"><div class="club-avatar-large">${club.avatar ? `<img src="${club.avatar}" alt="logo">` : "⚽"}</div><div class="club-title"><h1>${escapeHtml(club.name)}</h1><p class="club-username">@${escapeHtml(club.username)}</p></div><div class="club-stats-large"><div class="stat"><span class="stat-value">${subscribersCount + 1}</span><span class="stat-label">ПОДПИСЧИКОВ</span></div><div class="stat"><span class="stat-value">${club.posts_count ?? "..."}</span><span class="stat-label">ПОСТОВ</span></div></div><div class="club-actions-header">${renderJoinButton(club)}</div></div>`;
}

function checkUserRole(club) {
  userRole = club.userRole;
  const createPostSection = document.getElementById("createPostSection");
  const proposeSection = document.getElementById("proposePostSection");
  const adminButton = document.getElementById("adminButton");
  if (
    club.isMember &&
    createPostSection &&
    (userRole === "creator" || userRole === "admin" || userRole === "moderator")
  ) {
    createPostSection.style.display = "block";
    if (proposeSection) proposeSection.style.display = "none";
  } else if (
    club.isMember &&
    proposeSection &&
    !(
      userRole === "creator" ||
      userRole === "admin" ||
      userRole === "moderator"
    )
  ) {
    proposeSection.style.display = "block";
    if (createPostSection) createPostSection.style.display = "none";
  } else {
    if (createPostSection) createPostSection.style.display = "none";
    if (proposeSection) proposeSection.style.display = "none";
  }
  if (adminButton && (userRole === "creator" || userRole === "admin"))
    adminButton.style.display = "block";
  else if (adminButton) adminButton.style.display = "none";
}

function displayClubInfo(club) {
  const container = document.getElementById("clubInfo");
  let infoHtml = `<div class="info-section"><h3>Описание</h3><p>${escapeHtml(club.description) || "Нет описания"}</p></div><div class="info-grid">`;
  if (club.city)
    infoHtml += `<div class="info-item"><span class="info-label">📍 Город</span><span class="info-value">${escapeHtml(club.city)}</span></div>`;
  if (club.stadium)
    infoHtml += `<div class="info-item"><span class="info-label">🏟️ Стадион</span><span class="info-value">${escapeHtml(club.stadium)}</span></div>`;
  if (club.founded_year)
    infoHtml += `<div class="info-item"><span class="info-label">📅 Год основания</span><span class="info-value">${club.founded_year}</span></div>`;
  if (club.website)
    infoHtml += `<div class="info-item"><span class="info-label">🌐 Сайт</span><span class="info-value"><a href="${club.website}" target="_blank">${club.website}</a></span></div>`;
  container.innerHTML = infoHtml;
}

window.showClubTab = function (tabName) {
  const tabs = document.querySelectorAll(".club-tab-content");
  const buttons = document.querySelectorAll(".club-tabs .tab-btn");
  tabs.forEach((tab) => tab.classList.remove("active"));
  buttons.forEach((btn) => btn.classList.remove("active"));
  const targetTab = document.getElementById(tabName + "Tab");
  if (targetTab) targetTab.classList.add("active");
  if (event && event.target) event.target.classList.add("active");
  if (tabName === "matches") {
    loadNextMatch();
    loadLastMatch();
  }
};

// ============ МАТЧИ (ФРОНТ) ==========
async function loadNextMatch() {
  const container = document.getElementById("nextMatchInfo");
  if (!container) return;
  try {
    const res = await fetch(`/api/clubs/${clubId}/matches/next`);
    if (!res.ok) {
      if (res.status === 404) {
        container.innerHTML =
          '<p class="no-matches">Нет запланированных матчей</p>';
        return;
      }
      throw new Error();
    }
    const match = await res.json();
    displayNextMatch(match);
    startMatchTimer(match.match_time);
  } catch (error) {
    container.innerHTML =
      '<p class="no-matches">Нет запланированных матчей</p>';
  }
}

function displayNextMatch(match) {
  const container = document.getElementById("nextMatchInfo");
  const date = new Date(match.match_time);
  const formattedDate = date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  container.innerHTML = `<div class="match-card"><div class="match-teams"><div class="team home">${escapeHtml(clubData.name)}</div><div class="match-vs">vs</div><div class="team away">${escapeHtml(match.opponent)}</div></div><div class="match-details"><span>📅 ${formattedDate}</span><span>📍 ${match.is_home ? "Дома" : "В гостях"}</span><span>🏟️ ${match.venue === "home" ? clubData.stadium || "Домашний стадион" : "Выезд"}</span></div></div>`;
}

function startMatchTimer(matchTime) {
  if (matchTimerInterval) clearInterval(matchTimerInterval);
  function updateTimer() {
    const now = new Date();
    const matchDate = new Date(matchTime);
    const diff = matchDate - now;
    if (diff <= 0) {
      document.getElementById("matchTimer").innerHTML =
        '<div class="timer-finished">⏰ Матч уже начался!</div>';
      clearInterval(matchTimerInterval);
      return;
    }
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % 86400000) / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    document.getElementById("matchTimer").innerHTML =
      `<div class="timer-label">До начала матча:</div><div class="timer-digits">${days > 0 ? `${days}д ` : ""}${hours}ч ${minutes}м ${seconds}с</div>`;
  }
  updateTimer();
  matchTimerInterval = setInterval(updateTimer, 1000);
}

async function loadLastMatch() {
  try {
    const res = await fetch(`/api/clubs/${clubId}/matches/last`);
    if (!res.ok) {
      if (res.status === 404) {
        document.getElementById("lastMatchInfo").innerHTML =
          '<p class="no-matches">Нет завершённых матчей</p>';
        return;
      }
      throw new Error();
    }
    const match = await res.json();
    displayLastMatch(match);
    await loadMatchLineup(match.id);
    await loadMatchStats(match.id);
  } catch (error) {
    console.error(error);
  }
}

function displayLastMatch(match) {
  const container = document.getElementById("lastMatchInfo");
  const date = new Date(match.match_time);
  const formattedDate = date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  container.innerHTML = `<div class="match-card finished"><div class="match-teams"><div class="team home">${escapeHtml(clubData.name)}</div><div class="match-score">${match.score || "?"}</div><div class="team away">${escapeHtml(match.opponent)}</div></div><div class="match-details"><span>📅 ${formattedDate}</span><span>📍 ${match.is_home ? "Дома" : "В гостях"}</span></div></div>`;
}

async function loadMatchLineup(matchId) {
  try {
    const res = await fetch(`/api/clubs/matches/${matchId}/lineup`);
    const lineup = await res.json();
    displayLineup(lineup);
    displaySubstitutions(lineup.filter((p) => !p.is_starter));
  } catch (error) {
    document.getElementById("matchLineup").innerHTML =
      '<p class="no-data">Состав не указан</p>';
    document.getElementById("matchSubstitutions").innerHTML = "";
  }
}

function displayLineup(lineup) {
  const starters = lineup.filter((p) => p.is_starter);
  const positions = {
    goalkeeper: [],
    defenders: [],
    midfielders: [],
    forwards: [],
  };
  starters.forEach((player) => {
    if (player.position === "goalkeeper") positions.goalkeeper.push(player);
    else if (player.position === "defender") positions.defenders.push(player);
    else if (player.position === "forward") positions.forwards.push(player);
    else positions.midfielders.push(player);
  });
  const container = document.getElementById("matchLineup");
  container.innerHTML = `<div class="formation"><div class="position-group"><div class="position-title">🥅 Вратарь</div><div class="players-grid">${positions.goalkeeper.map((p) => `<div class="player-card"><span class="player-number">${p.number || ""}</span> ${escapeHtml(p.name)}</div>`).join("")}</div></div><div class="position-group"><div class="position-title">🛡️ Защитники</div><div class="players-grid">${positions.defenders.map((p) => `<div class="player-card"><span class="player-number">${p.number || ""}</span> ${escapeHtml(p.name)}</div>`).join("")}</div></div><div class="position-group"><div class="position-title">⚡ Полузащитники</div><div class="players-grid">${positions.midfielders.map((p) => `<div class="player-card"><span class="player-number">${p.number || ""}</span> ${escapeHtml(p.name)}</div>`).join("")}</div></div><div class="position-group"><div class="position-title">🎯 Нападающие</div><div class="players-grid">${positions.forwards.map((p) => `<div class="player-card"><span class="player-number">${p.number || ""}</span> ${escapeHtml(p.name)}</div>`).join("")}</div></div></div>`;
}

function displaySubstitutions(subs) {
  const container = document.getElementById("matchSubstitutions");
  if (!subs.length) {
    container.innerHTML = '<p class="no-data">Замен не было</p>';
    return;
  }
  container.innerHTML = `<div class="substitutions-grid">${subs.map((sub) => `<div class="sub-card"><span class="sub-player">${escapeHtml(sub.name)}</span><span class="sub-minute">${sub.minute_in || "?"}'</span></div>`).join("")}</div>`;
}

async function loadMatchStats(matchId) {
  try {
    const res = await fetch(`/api/clubs/matches/${matchId}/stats`);
    const stats = await res.json();
    displayMatchStats(stats);
  } catch (error) {
    document.getElementById("matchStats").innerHTML =
      '<p class="no-data">Статистика не заполнена</p>';
  }
}

function displayMatchStats(stats) {
  const container = document.getElementById("matchStats");
  container.innerHTML = `<div class="stats-row"><span>Владение мячом</span><span class="stat-bar"><span style="width: ${stats.possession || 0}%"></span></span><span>${stats.possession || 0}%</span></div><div class="stats-row"><span>Удары (всего)</span><span>${stats.shots || 0}</span></div><div class="stats-row"><span>Удары в створ</span><span>${stats.shots_on_target || 0}</span></div><div class="stats-row"><span>Угловые</span><span>${stats.corners || 0}</span></div><div class="stats-row"><span>Фолы</span><span>${stats.fouls || 0}</span></div><div class="stats-row"><span>Жёлтые карточки</span><span>${stats.yellow_cards || 0}</span></div><div class="stats-row"><span>Красные карточки</span><span>${stats.red_cards || 0}</span></div>`;
}

// ============ АДМИН-ПАНЕЛЬ ==========
window.showAdminPanel = function () {
  document.getElementById("adminModal").style.display = "block";
  loadAdminInfoTab();
  loadAdminPostsTab();
  loadAdminSubscribersTab();
  loadAdminCommentsTab();
  loadAdminMatchesTab();
};
window.closeAdminPanel = function () {
  document.getElementById("adminModal").style.display = "none";
};
window.showAdminTab = function (tabName) {
  const tabs = document.querySelectorAll(".admin-tab-content");
  const buttons = document.querySelectorAll(".admin-tab-btn");
  tabs.forEach((tab) => tab.classList.remove("active"));
  buttons.forEach((btn) => btn.classList.remove("active"));
  const targetId =
    "admin" + tabName.charAt(0).toUpperCase() + tabName.slice(1) + "Tab";
  const targetTab = document.getElementById(targetId);
  if (targetTab) targetTab.classList.add("active");
  if (event?.target) event.target.classList.add("active");
  if (tabName === "info") loadAdminInfoTab();
  else if (tabName === "posts") loadAdminPostsTab();
  else if (tabName === "proposals") loadAdminProposals("pending");
  else if (tabName === "subscribers") loadAdminSubscribersTab();
  else if (tabName === "comments") loadAdminCommentsTab();
  else if (tabName === "matches") loadAdminMatchesTab();
};

async function loadAdminInfoTab() {
  const container = document.getElementById("clubEditForm");
  if (!container) return;
  try {
    const token = localStorage.getItem("token");
    const res = await fetch(`/api/clubs/${clubId}/info`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const club = await res.json();
    let html = `<h3>Редактирование информации о клубе</h3><div class="form-group"><label>Название клуба</label><input type="text" id="editClubName" value="${escapeHtml(club.name)}"></div><div class="form-group"><label>Описание</label><textarea id="editClubDescription" rows="4">${escapeHtml(club.description || "")}</textarea></div><div class="form-row"><div class="form-group"><label>Город</label><input type="text" id="editClubCity" value="${escapeHtml(club.city || "")}"></div><div class="form-group"><label>Стадион</label><input type="text" id="editClubStadium" value="${escapeHtml(club.stadium || "")}"></div></div><div class="form-row"><div class="form-group"><label>Год основания</label><input type="number" id="editClubFounded" value="${club.founded_year || ""}"></div><div class="form-group"><label>Веб-сайт</label><input type="url" id="editClubWebsite" value="${escapeHtml(club.website || "")}"></div></div><div class="form-group"><label>Логотип клуба</label><input type="file" id="editClubAvatar" accept="image/*">${club.avatar ? `<div class="current-avatar"><img src="${club.avatar}" alt="Текущий логотип" style="max-width: 100px; margin-top: 10px;"></div>` : ""}</div><div class="form-group checkbox"><label><input type="checkbox" id="editClubPrivate" ${club.is_private ? "checked" : ""}> Закрытый клуб (только по заявкам)</label></div><div class="admin-actions"><button onclick="saveClubInfo()" class="btn-submit">Сохранить изменения</button>`;
    if (userRole === "creator")
      html += `<button onclick="deleteClub()" class="btn-delete-club">🗑️ Удалить клуб</button>`;
    html += `</div>`;
    container.innerHTML = html;
  } catch (error) {
    container.innerHTML = '<p class="error">Ошибка загрузки</p>';
  }
}

window.saveClubInfo = async function () {
  const token = localStorage.getItem("token");
  if (!token) return alert("Необходимо авторизоваться");
  const formData = new FormData();
  formData.append("name", document.getElementById("editClubName").value);
  formData.append(
    "description",
    document.getElementById("editClubDescription").value,
  );
  formData.append("city", document.getElementById("editClubCity").value);
  formData.append("stadium", document.getElementById("editClubStadium").value);
  formData.append(
    "founded_year",
    document.getElementById("editClubFounded").value,
  );
  formData.append("website", document.getElementById("editClubWebsite").value);
  formData.append(
    "is_private",
    document.getElementById("editClubPrivate").checked ? "1" : "0",
  );
  const avatarFile = document.getElementById("editClubAvatar").files[0];
  if (avatarFile) formData.append("avatar", avatarFile);
  try {
    const res = await fetch(`/api/clubs/${clubId}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Ошибка обновления");
    alert("Информация о клубе обновлена");
    const clubRes = await fetch(`/api/clubs/${clubUsername}`);
    clubData = await clubRes.json();
    loadClubDetails();
    loadAdminInfoTab();
  } catch (error) {
    alert("Ошибка: " + error.message);
  }
};

async function loadAdminPostsTab() {
  const container = document.getElementById("adminPostsList");
  if (!container) return;
  try {
    const res = await fetch(`/api/clubs/${clubId}/posts?limit=50`);
    const data = await res.json();
    if (!data.posts || !data.posts.length) {
      container.innerHTML = '<p class="no-posts">В клубе пока нет постов</p>';
      return;
    }
    container.innerHTML = data.posts
      .map(
        (post) =>
          `<div class="admin-post-card"><div class="admin-post-header"><span class="admin-post-date">${formatDate(post.created_at)}</span><span class="admin-post-pinned">${post.pinned ? "📌 Закреплено" : ""}</span></div><div class="admin-post-content"><p>${escapeHtml(post.content.substring(0, 100))}${post.content.length > 100 ? "..." : ""}</p></div><div class="admin-post-actions"><button onclick="openEditPostModal(${post.id}, '${escapeHtml(post.content.replace(/'/g, "\\'"))}', '${post.image || ""}')" class="btn-edit">✏️ Редактировать</button><button onclick="togglePin(${post.id}, ${!post.pinned})" class="btn-pin">${post.pinned ? "📌 Открепить" : "📌 Закрепить"}</button><button onclick="deletePost(${post.id})" class="btn-delete">🗑️ Удалить</button></div></div>`,
      )
      .join("");
  } catch (error) {
    container.innerHTML = '<p class="error">Ошибка загрузки постов</p>';
  }
}

async function loadAdminCommentsTab() {
  const container = document.getElementById("adminCommentsList");
  if (!container) return;
  try {
    const res = await fetch(`/api/clubs/${clubId}/posts?limit=20`);
    const data = await res.json();
    if (!data.posts || !data.posts.length) {
      container.innerHTML =
        '<p class="no-posts">Нет постов для модерации комментариев</p>';
      return;
    }
    container.innerHTML = data.posts
      .map(
        (post) =>
          `<div class="comment-moderation-card"><div class="comment-moderation-header" onclick="toggleComments(${post.id})"><span class="post-title">📰 ${escapeHtml(post.content.substring(0, 50))}...</span><span class="comment-count">💬 ${post.comments_count || 0} комментариев</span><span class="toggle-icon">▼</span></div><div id="comments-${post.id}" class="post-comments-list" style="display: none;"><div class="loading-small">Загрузка комментариев...</div></div></div>`,
      )
      .join("");
  } catch (error) {
    container.innerHTML = '<p class="error">Ошибка загрузки</p>';
  }
}

window.toggleComments = async function (postId) {
  const commentsDiv = document.getElementById(`comments-${postId}`);
  if (commentsDiv.style.display === "none") {
    commentsDiv.style.display = "block";
    await loadCommentsForModeration(postId);
  } else commentsDiv.style.display = "none";
};

async function loadCommentsForModeration(postId) {
  const commentsDiv = document.getElementById(`comments-${postId}`);
  try {
    const res = await fetch(`/api/clubs/posts/${postId}/comments`);
    const comments = await res.json();
    if (!comments || !comments.length) {
      commentsDiv.innerHTML = '<p class="no-comments">Нет комментариев</p>';
      return;
    }
    commentsDiv.innerHTML = comments
      .map(
        (comment) =>
          `<div class="comment-moderation-item"><div class="comment-header"><span class="comment-author">${escapeHtml(comment.user_name)}</span><span class="comment-date">${formatDate(comment.created_at)}</span></div><div class="comment-content">${escapeHtml(comment.content)}</div><div class="comment-actions"><button onclick="deleteComment(${comment.id})" class="btn-delete-comment">🗑️ Удалить</button></div></div>`,
      )
      .join("");
  } catch (error) {
    commentsDiv.innerHTML = '<p class="error">Ошибка загрузки</p>';
  }
}

window.deleteComment = async function (commentId) {
  if (!confirm("Удалить этот комментарий?")) return;
  const token = localStorage.getItem("token");
  try {
    const res = await fetch(`/api/clubs/comments/${commentId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error();
    alert("Комментарий удален");
    loadAdminCommentsTab();
  } catch (error) {
    alert("Ошибка: " + error.message);
  }
};

async function loadAdminSubscribersTab() {
  const container = document.getElementById("adminSubscribersList");
  if (!container) return;
  try {
    const token = localStorage.getItem("token");
    const res = await fetch(`/api/clubs/${clubId}/members`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error();
    const subscribers = await res.json();
    if (!subscribers.length) {
      container.innerHTML =
        '<p class="no-subscribers">В клубе пока нет подписчиков</p>';
      return;
    }
    container.innerHTML = subscribers
      .map((sub) => {
        const isBanned =
          sub.banned_until && new Date(sub.banned_until) > new Date();
        const isCommentBanned =
          sub.comment_banned_until &&
          new Date(sub.comment_banned_until) > new Date();
        const joinedDate = sub.joined_at
          ? new Date(sub.joined_at).toLocaleDateString("ru-RU")
          : "неизвестно";
        return `<div class="admin-subscriber-card ${isBanned ? "banned" : ""}"><div class="admin-subscriber-avatar">${sub.avatar ? `<img src="${sub.avatar}" alt="${sub.fullname || ""}">` : "👤"}<span class="online-dot ${sub.is_online ? "online" : "offline"}"></span></div><div class="admin-subscriber-info"><div class="admin-subscriber-name">${escapeHtml(sub.fullname || "Без имени")}</div><div class="admin-subscriber-username">@${escapeHtml(sub.username || "unknown")}</div><div class="admin-subscriber-role role-${sub.role || "member"}">${getRoleName(sub.role || "member")}</div><div class="subscriber-meta"><small>📅 Присоединился: ${joinedDate}</small></div>${isBanned ? `<div class="admin-subscriber-banned">🚫 Забанен до ${new Date(sub.banned_until).toLocaleDateString("ru-RU")}</div>` : ""}${isCommentBanned ? `<div class="admin-subscriber-comment-banned">💬 Запрет комментариев до ${new Date(sub.comment_banned_until).toLocaleDateString("ru-RU")}</div>` : ""}</div>${sub.role !== "creator" ? `<div class="admin-subscriber-actions"><select onchange="changeSubscriberRole(${sub.id}, this.value)" class="role-select"><option value="member" ${sub.role === "member" ? "selected" : ""}>Подписчик</option><option value="moderator" ${sub.role === "moderator" ? "selected" : ""}>Модератор</option><option value="admin" ${sub.role === "admin" ? "selected" : ""}>Админ</option></select><button onclick="openBanModal(${sub.id}, '${escapeHtml(sub.fullname || "")}')" class="btn-ban">🚫 Бан</button></div>` : ""}</div>`;
      })
      .join("");
  } catch (error) {
    container.innerHTML = '<p class="error">Ошибка загрузки подписчиков</p>';
  }
}

function getRoleName(role) {
  const roles = {
    creator: "Создатель",
    admin: "Админ",
    moderator: "Модератор",
    member: "Подписчик",
  };
  return roles[role] || role || "Подписчик";
}

window.changeSubscriberRole = async function (userId, newRole) {
  const token = localStorage.getItem("token");
  if (!token) return alert("Необходимо авторизоваться");
  try {
    const res = await fetch(`/api/clubs/${clubId}/members/${userId}/role`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ role: newRole }),
    });
    const data = await res.json();
    if (!res.ok)
      throw new Error(data.error || data.message || "Ошибка изменения роли");
    alert("Роль успешно изменена");
    loadAdminSubscribersTab();
  } catch (error) {
    alert("Ошибка: " + error.message);
  }
};

window.openBanModal = function (userId, userName) {
  currentBanUserId = userId;
  currentBanUserName = userName;
  document.getElementById("banUserInfo").innerHTML =
    `<p><strong>Пользователь:</strong> ${escapeHtml(userName)}</p>`;
  document.getElementById("banModal").style.display = "block";
};
window.closeBanModal = function () {
  document.getElementById("banModal").style.display = "none";
  document.getElementById("banReason").value = "";
  const commentRadio = document.querySelector(
    'input[name="banType"][value="comment"]',
  );
  if (commentRadio) commentRadio.checked = true;
  document.getElementById("banDuration").value = "7";
};
window.executeBan = async function () {
  const token = localStorage.getItem("token");
  if (!token) return alert("Необходимо авторизоваться");
  const banType =
    document.querySelector('input[name="banType"]:checked')?.value || "comment";
  const duration = document.getElementById("banDuration").value;
  const reason = document.getElementById("banReason").value.trim();
  if (!currentBanUserId) return alert("Ошибка: не выбран пользователь");
  const banData = {
    reason: reason || null,
    duration: duration === "permanent" ? "permanent" : parseInt(duration),
  };
  try {
    const endpoint =
      banType === "comment"
        ? `/api/clubs/${clubId}/members/${currentBanUserId}/ban-comment`
        : `/api/clubs/${clubId}/members/${currentBanUserId}/ban`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(banData),
    });
    const data = await res.json();
    if (!res.ok)
      throw new Error(data.error || data.message || "Ошибка блокировки");
    alert(
      `Пользователь ${banType === "comment" ? "заблокирован в комментариях" : "забанен"}`,
    );
    closeBanModal();
    loadAdminSubscribersTab();
  } catch (error) {
    alert("Ошибка: " + error.message);
  }
};

window.subscribeToClub = async function () {
  const token = localStorage.getItem("token");
  if (!token) {
    alert("Необходимо авторизоваться");
    window.location.href = "login.html";
    return;
  }
  const subscribeBtn = document.querySelector(".btn-join");
  const originalText = subscribeBtn ? subscribeBtn.textContent : "Подписаться";
  if (subscribeBtn) {
    subscribeBtn.disabled = true;
    subscribeBtn.textContent = "Подписка...";
  }
  try {
    const res = await fetch(`/api/clubs/${clubId}/subscribe`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 500) {
      const altRes = await fetch(`/api/clubs/${clubId}/join`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (altRes.ok) {
        const altData = await altRes.json();
        alert(altData.message || "Вы успешно подписались на клуб");
        await loadClubDetails();
        return;
      }
    }
    const data = await res.json();
    if (!res.ok)
      throw new Error(data.error || data.message || "Ошибка подписки");
    alert(data.message);
    await loadClubDetails();
  } catch (error) {
    alert("Ошибка: " + error.message);
  } finally {
    if (subscribeBtn) {
      subscribeBtn.disabled = false;
      subscribeBtn.textContent = originalText;
    }
  }
};
window.unsubscribeFromClub = async function () {
  if (!confirm("Вы уверены, что хотите отписаться от клуба?")) return;
  const token = localStorage.getItem("token");
  if (!token) {
    alert("Необходимо авторизоваться");
    window.location.href = "login.html";
    return;
  }
  const unsubscribeBtn = document.querySelector(".btn-leave");
  const originalText = unsubscribeBtn
    ? unsubscribeBtn.textContent
    : "Отписаться";
  if (unsubscribeBtn) {
    unsubscribeBtn.disabled = true;
    unsubscribeBtn.textContent = "Отписка...";
  }
  try {
    const res = await fetch(`/api/clubs/${clubId}/unsubscribe`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 404) {
      const altRes = await fetch(`/api/clubs/${clubId}/leave`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (altRes.ok) {
        const altData = await altRes.json();
        alert(altData.message || "Вы отписались от клуба");
        await loadClubDetails();
        return;
      }
    }
    const data = await res.json();
    if (!res.ok)
      throw new Error(data.error || data.message || "Ошибка отписки");
    alert(data.message);
    await loadClubDetails();
  } catch (error) {
    alert("Ошибка: " + error.message);
  } finally {
    if (unsubscribeBtn) {
      unsubscribeBtn.disabled = false;
      unsubscribeBtn.textContent = originalText;
    }
  }
};
function renderJoinButton(club) {
  const token = localStorage.getItem("token");
  if (!token) return `<a href="login.html" class="btn-join">Войти</a>`;
  if (club.isMember || club.isFollower)
    return `<div class="subscribed-info"><span class="subscribed-badge">✅ Вы подписаны</span><button class="btn-leave" onclick="unsubscribeFromClub()">Отписаться</button></div>`;
  else
    return `<button class="btn-join" onclick="subscribeToClub()">Подписаться</button>`;
}

// ============ ПОСТЫ ==========
async function loadPosts() {
  const container = document.getElementById("postsList");
  try {
    const res = await fetch(`/api/clubs/${clubId}/posts`);
    const data = await res.json();
    if (data.total !== undefined) {
      updatePostsCount(data.total);
      if (clubData) clubData.posts_count = data.total;
    }
    displayPosts(data.posts || []);
  } catch (error) {
    container.innerHTML = '<p class="error">Ошибка загрузки постов</p>';
  }
}
function updatePostsCount(count) {
  const postsStat = document.querySelector(".stat:last-child .stat-value");
  if (postsStat) postsStat.textContent = count;
}
function displayPosts(posts) {
  const container = document.getElementById("postsList");
  if (!container) return;
  if (posts.length === 0) {
    container.innerHTML = '<p class="no-posts">В клубе пока нет постов</p>';
    return;
  }
  const clubName = clubData?.name || "Клуб";
  const clubAvatar = clubData?.avatar || null;
  container.innerHTML = posts
    .map((post) => {
      const postDate = new Date(post.created_at).toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      return `<div class="post-card ${post.pinned ? "pinned" : ""}">${post.pinned ? '<div class="pinned-badge">📌 Закреплено</div>' : ""}<div class="post-header"><div class="post-author"><span class="author-avatar">${clubAvatar ? `<img src="${clubAvatar}" alt="${clubName}">` : "⚽"}</span><div class="author-info"><span class="author-name">${escapeHtml(clubName)}<span class="author-club">⚽ официальный пост</span></span></div></div><span class="post-date">${postDate}</span></div><div class="post-content"><p>${escapeHtml(post.content).replace(/\n/g, "<br>")}</p>${post.image ? `<img src="${post.image}" class="post-image" onclick="window.open('${post.image}')">` : ""}</div><div class="post-footer"><div class="post-stats"><button onclick="handleLike(${post.id}, 'like')" class="btn-like">👍 ${post.likes_count || 0}</button><button onclick="handleLike(${post.id}, 'dislike')" class="btn-dislike">👎 ${post.dislikes_count || 0}</button><button onclick="showComments(${post.id})" class="btn-comment">💬 ${post.comments_count || 0}</button></div></div></div>`;
    })
    .join("");
}
window.createPost = async function () {
  const token = localStorage.getItem("token");
  if (!token) {
    alert("Необходимо авторизоваться");
    window.location.href = "login.html";
    return;
  }
  const content = document.getElementById("postContent").value.trim();
  const imageFile = document.getElementById("postImage").files[0];
  if (!content) {
    alert("Введите текст поста");
    return;
  }
  const submitBtn = document.querySelector(".create-post .btn-submit");
  const originalText = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = "<span>⏳ Публикация...</span>";
  const formData = new FormData();
  formData.append("content", content);
  if (imageFile) formData.append("image", imageFile);
  try {
    const res = await fetch(`/api/clubs/${clubId}/posts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Ошибка создания поста");
    document.getElementById("postContent").value = "";
    document.getElementById("postImage").value = "";
    const fileName = document.getElementById("file-name");
    if (fileName) {
      fileName.textContent = "Файл не выбран";
      fileName.style.color = "#666";
    }
    alert("✅ Пост успешно опубликован!");
    loadPosts();
  } catch (error) {
    alert("Ошибка: " + error.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
  }
};
window.openEditPostModal = function (postId, content, image) {
  currentEditPostId = postId;
  document.getElementById("editPostContent").value = content;
  const imageContainer = document.getElementById("currentPostImage");
  imageContainer.innerHTML = image
    ? `<img src="${image}" alt="Текущее изображение" style="max-width: 200px;">`
    : "";
  document.getElementById("editPostModal").style.display = "block";
};
window.closeEditPostModal = function () {
  document.getElementById("editPostModal").style.display = "none";
  document.getElementById("editPostContent").value = "";
  document.getElementById("editPostImage").value = "";
  document.getElementById("currentPostImage").innerHTML = "";
};
window.savePostEdit = async function () {
  const token = localStorage.getItem("token");
  if (!token) return alert("Необходимо авторизоваться");
  const content = document.getElementById("editPostContent").value.trim();
  if (!content) return alert("Текст поста не может быть пустым");
  const formData = new FormData();
  formData.append("content", content);
  const imageFile = document.getElementById("editPostImage").files[0];
  if (imageFile) formData.append("image", imageFile);
  try {
    const res = await fetch(`/api/clubs/posts/${currentEditPostId}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Ошибка редактирования");
    alert("Пост обновлен");
    closeEditPostModal();
    loadPosts();
    loadAdminPostsTab();
  } catch (error) {
    alert("Ошибка: " + error.message);
  }
};
window.togglePin = async function (postId, pinned) {
  const token = localStorage.getItem("token");
  if (!token) {
    alert("Необходимо авторизоваться");
    window.location.href = "login.html";
    return;
  }
  try {
    const res = await fetch(`/api/clubs/posts/${postId}/pin`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ pinned }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Ошибка");
    alert(data.message);
    loadPosts();
    if (document.getElementById("adminModal").style.display === "block")
      loadAdminPostsTab();
  } catch (error) {
    alert("Ошибка: " + error.message);
  }
};
window.deletePost = async function (postId) {
  if (!confirm("Удалить этот пост?")) return;
  const token = localStorage.getItem("token");
  if (!token) {
    alert("Необходимо авторизоваться");
    window.location.href = "login.html";
    return;
  }
  try {
    const res = await fetch(`/api/clubs/posts/${postId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Ошибка");
    alert("Пост удален");
    loadPosts();
    if (document.getElementById("adminModal").style.display === "block")
      loadAdminPostsTab();
  } catch (error) {
    alert("Ошибка: " + error.message);
  }
};
window.handleLike = async function (postId, type) {
  const token = localStorage.getItem("token");
  if (!token) {
    alert("Необходимо авторизоваться");
    window.location.href = "login.html";
    return;
  }
  try {
    const res = await fetch(`/api/clubs/posts/${postId}/like`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ type }),
    });
    if (!res.ok) throw new Error("Ошибка");
    loadPosts();
  } catch (error) {
    console.error("Ошибка:", error);
  }
};
window.showComments = async function (postId) {
  currentPostId = postId;
  try {
    const res = await fetch(`/api/clubs/posts/${postId}/comments`);
    const comments = await res.json();
    displayComments(comments);
    document.getElementById("commentsModal").style.display = "block";
  } catch (error) {
    console.error(error);
  }
};
function displayComments(comments) {
  const container = document.getElementById("commentsList");
  if (!container) return;
  if (comments.length === 0) {
    container.innerHTML = '<p class="no-comments">Комментариев пока нет</p>';
    return;
  }
  container.innerHTML = comments
    .map(
      (comment) =>
        `<div class="comment"><div class="comment-header"><span class="comment-author">${escapeHtml(comment.user_name)}</span><span class="comment-date">${formatDate(comment.created_at)}</span></div><div class="comment-content">${escapeHtml(comment.content)}</div></div>`,
    )
    .join("");
}
window.addComment = async function () {
  const token = localStorage.getItem("token");
  if (!token) {
    alert("Необходимо авторизоваться");
    window.location.href = "login.html";
    return;
  }
  const content = document.getElementById("commentContent").value.trim();
  if (!content) return;
  try {
    const res = await fetch(`/api/clubs/posts/${currentPostId}/comments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ content }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Ошибка");
    document.getElementById("commentContent").value = "";
    showComments(currentPostId);
  } catch (error) {
    alert("Ошибка: " + error.message);
  }
};
window.closeCommentsModal = function () {
  document.getElementById("commentsModal").style.display = "none";
};
window.updateFileName = function (input) {
  const fileName = document.getElementById("file-name");
  if (input.files && input.files[0]) {
    fileName.textContent = input.files[0].name;
    fileName.style.color = "#2a5298";
  } else {
    fileName.textContent = "Файл не выбран";
    fileName.style.color = "#666";
  }
};
window.updateEditFileName = function (input) {
  const fileName = document.getElementById("edit-file-name");
  if (input.files && input.files[0]) {
    fileName.textContent = input.files[0].name;
    fileName.style.color = "#2a5298";
  } else {
    fileName.textContent = "Файл не выбран";
    fileName.style.color = "#666";
  }
};
window.updateProposeFileName = function (input) {
  const fileName = document.getElementById("propose-file-name");
  if (input.files && input.files[0]) {
    fileName.textContent = input.files[0].name;
    fileName.style.color = "#2a5298";
  } else {
    fileName.textContent = "Файл не выбран";
    fileName.style.color = "#666";
  }
};
window.proposePost = async function () {
  const token = localStorage.getItem("token");
  if (!token) {
    alert("Необходимо авторизоваться");
    window.location.href = "login.html";
    return;
  }
  const content = document.getElementById("proposePostContent").value.trim();
  const imageFile = document.getElementById("proposePostImage").files[0];
  if (!content) {
    alert("Введите текст поста");
    return;
  }
  const proposeBtn = document.querySelector(".btn-propose");
  const originalText = proposeBtn.textContent;
  proposeBtn.disabled = true;
  proposeBtn.textContent = "Отправка...";
  const formData = new FormData();
  formData.append("content", content);
  if (imageFile) formData.append("image", imageFile);
  try {
    const res = await fetch(`/api/clubs/${clubId}/propose-post`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || data.message || "Ошибка");
    alert("✅ Пост отправлен на модерацию!");
    document.getElementById("proposePostContent").value = "";
    document.getElementById("proposePostImage").value = "";
    document.getElementById("propose-file-name").textContent = "Файл не выбран";
  } catch (error) {
    alert("Ошибка: " + error.message);
  } finally {
    proposeBtn.disabled = false;
    proposeBtn.textContent = originalText;
  }
};
window.loadAdminProposals = async function (status = "pending") {
  const container = document.getElementById("adminProposalsList");
  if (!container) return;
  document
    .querySelectorAll(".proposals-filters .filter-btn")
    .forEach((btn) => btn.classList.remove("active"));
  if (event?.target) event.target.classList.add("active");
  try {
    const token = localStorage.getItem("token");
    const res = await fetch(
      `/api/clubs/${clubId}/post-proposals?status=${status}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) {
      if (res.status === 403) {
        container.innerHTML =
          '<p class="error">У вас нет прав для просмотра</p>';
        return;
      }
      throw new Error();
    }
    const proposals = await res.json();
    if (!proposals || !proposals.length) {
      container.innerHTML = '<p class="no-proposals">Нет предложений</p>';
      return;
    }
    container.innerHTML = proposals
      .map((prop) => {
        const statusClass =
          prop.status === "approved"
            ? "approved"
            : prop.status === "rejected"
              ? "rejected"
              : "pending";
        const statusText =
          prop.status === "approved"
            ? "✅ Одобрено"
            : prop.status === "rejected"
              ? "❌ Отклонено"
              : "⏳ На модерации";
        return `<div class="proposal-card ${prop.status}"><div class="proposal-header"><div class="proposal-author"><span class="author-avatar-small">${prop.user_avatar ? `<img src="${prop.user_avatar}">` : "👤"}</span><div class="author-info"><span class="author-name">${escapeHtml(prop.user_name)}</span><span class="author-username">@${escapeHtml(prop.user_username)}</span></div></div><span class="proposal-date">${formatDate(prop.created_at)}</span></div><div class="proposal-content"><p>${escapeHtml(prop.content)}</p>${prop.image ? `<img src="${prop.image}" class="proposal-image" onclick="window.open('${prop.image}')">` : ""}</div><div class="proposal-footer"><span class="proposal-status status-${statusClass}">${statusText}</span>${prop.status === "pending" ? `<div class="proposal-actions"><button onclick="handleProposal(${prop.id}, 'approved')" class="btn-approve">✅ Одобрить</button><button onclick="handleProposal(${prop.id}, 'rejected')" class="btn-reject">❌ Отклонить</button></div>` : ""}${prop.review_comment ? `<div class="review-comment"><strong>Комментарий модератора:</strong><p>${escapeHtml(prop.review_comment)}</p></div>` : ""}</div></div>`;
      })
      .join("");
  } catch (error) {
    container.innerHTML = '<p class="error">Ошибка загрузки</p>';
  }
};
window.handleProposal = async function (proposalId, status) {
  const token = localStorage.getItem("token");
  let comment = "";
  if (status === "rejected") {
    comment = prompt("Укажите причину отклонения (необязательно):");
    if (comment === null) return;
  }
  try {
    const res = await fetch(
      `/api/clubs/${clubId}/post-proposals/${proposalId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status, comment }),
      },
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || data.message || "Ошибка");
    alert(data.message);
    const activeFilter = document.querySelector(
      ".proposals-filters .filter-btn.active",
    );
    const filterStatus = activeFilter
      ? activeFilter.textContent.includes("Одобр")
        ? "approved"
        : activeFilter.textContent.includes("Откл")
          ? "rejected"
          : "pending"
      : "pending";
    loadAdminProposals(filterStatus);
    if (status === "approved") loadPosts();
  } catch (error) {
    alert("Ошибка: " + error.message);
  }
};
window.deleteClub = async function () {
  const token = localStorage.getItem("token");
  if (!token) {
    alert("Необходимо авторизоваться");
    window.location.href = "login.html";
    return;
  }
  if (
    !confirm(
      "Вы уверены, что хотите удалить этот клуб? Это действие необратимо.",
    )
  )
    return;
  try {
    const res = await fetch(`/api/clubs/${clubId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok)
      throw new Error(data.error || data.message || "Ошибка удаления");
    alert("Клуб успешно удален");
    window.location.href = "clubs.html";
  } catch (error) {
    alert("Ошибка: " + error.message);
  }
};

// ============ УПРАВЛЕНИЕ МАТЧАМИ (АДМИНКА) ==========
async function loadAdminMatchesTab() {
  const container = document.getElementById("adminMatchesList");
  if (!container) return;
  try {
    const token = localStorage.getItem("token");
    const res = await fetch(`/api/clubs/${clubId}/matches`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const matches = await res.json();
    if (!matches || !matches.length) {
      container.innerHTML = '<p class="no-matches">Нет созданных матчей</p>';
      return;
    }
    container.innerHTML = matches
      .map(
        (match) =>
          `<div class="admin-match-card"><div class="match-info"><strong>${escapeHtml(match.opponent)}</strong><span>${match.is_home ? "🏠 Дома" : "✈️ В гостях"}</span><span>${new Date(match.match_time).toLocaleString()}</span><span class="match-status status-${match.status}">${getMatchStatusText(match.status)}</span>${match.score ? `<span class="match-score">Счёт: ${match.score}</span>` : ""}</div><div class="match-actions"><button onclick="editMatch(${match.id})" class="btn-edit">✏️</button><button onclick="openLineupModal(${match.id})" class="btn-lineup">👥 Состав</button><button onclick="deleteMatch(${match.id})" class="btn-delete">🗑️</button></div></div>`,
      )
      .join("");
  } catch (error) {
    container.innerHTML = '<p class="error">Ошибка загрузки матчей</p>';
  }
}
function getMatchStatusText(status) {
  const map = {
    scheduled: "⏳ Запланирован",
    ongoing: "⚽ Идёт",
    finished: "✅ Завершён",
  };
  return map[status] || status;
}
window.showCreateMatchModal = function () {
  document.getElementById("matchModalTitle").textContent = "Создание матча";
  document.getElementById("matchId").value = "";
  document.getElementById("matchForm").reset();
  document.getElementById("matchDateTime").value = "";
  document.getElementById("matchModal").style.display = "block";
};
window.closeMatchModal = function () {
  document.getElementById("matchModal").style.display = "none";
};
document.getElementById("matchForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const token = localStorage.getItem("token");
  if (!token) return alert("Необходимо авторизоваться");
  const matchId = document.getElementById("matchId").value;
  const data = {
    opponent: document.getElementById("matchOpponent").value,
    match_time: document.getElementById("matchDateTime").value,
    venue: document.getElementById("matchVenue").value,
    is_home: document.getElementById("matchIsHome").checked,
    status: document.getElementById("matchStatus").value,
    score: document.getElementById("matchScore").value || null,
  };
  const url = matchId
    ? `/api/clubs/matches/${matchId}`
    : `/api/clubs/${clubId}/matches`;
  const method = matchId ? "PUT" : "POST";
  try {
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Ошибка");
    alert(matchId ? "Матч обновлён" : "Матч создан");
    closeMatchModal();
    loadAdminMatchesTab();
    loadNextMatch();
    loadLastMatch();
  } catch (error) {
    alert("Ошибка: " + error.message);
  }
});
window.editMatch = async function (matchId) {
  try {
    const res = await fetch(`/api/clubs/matches/${matchId}`);
    const match = await res.json();
    document.getElementById("matchModalTitle").textContent =
      "Редактирование матча";
    document.getElementById("matchId").value = match.id;
    document.getElementById("matchOpponent").value = match.opponent;
    document.getElementById("matchDateTime").value = match.match_time.slice(
      0,
      16,
    );
    document.getElementById("matchVenue").value = match.venue;
    document.getElementById("matchIsHome").checked = match.is_home;
    document.getElementById("matchStatus").value = match.status;
    document.getElementById("matchScore").value = match.score || "";
    document.getElementById("matchModal").style.display = "block";
  } catch (error) {
    alert("Ошибка загрузки матча");
  }
};
window.deleteMatch = async function (matchId) {
  if (!confirm("Удалить матч?")) return;
  const token = localStorage.getItem("token");
  try {
    const res = await fetch(`/api/clubs/matches/${matchId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error();
    alert("Матч удалён");
    loadAdminMatchesTab();
    loadNextMatch();
    loadLastMatch();
  } catch (error) {
    alert("Ошибка удаления");
  }
};

// ============ СОСТАВ, ЗАМЕНЫ, КАРТОЧКИ ==========
window.openLineupModal = async function (matchId) {
  currentMatchId = matchId;
  document.getElementById("lineupModal").style.display = "block";
  document.getElementById("lineupMatchInfo").innerHTML =
    `<p>Загрузка данных матча...</p>`;
  try {
    const matchRes = await fetch(`/api/clubs/matches/${matchId}`);
    const match = await matchRes.json();
    document.getElementById("lineupMatchInfo").innerHTML =
      `<div class="match-info-bar"><strong>${escapeHtml(clubData.name)} vs ${escapeHtml(match.opponent)}</strong><span>${new Date(match.match_time).toLocaleString()}</span></div>`;
    await loadAvailablePlayers();
    await loadCurrentLineup(matchId);
    initDragAndDrop();
    initSubstitutesDragAndDrop();
  } catch (error) {
    console.error(error);
  }
};

async function loadAvailablePlayers() {
  const containers = {
    goalkeeper: document.getElementById("availableGoalkeepers"),
    defender: document.getElementById("availableDefenders"),
    midfielder: document.getElementById("availableMidfielders"),
    forward: document.getElementById("availableForwards"),
  };
  Object.values(containers).forEach((c) => {
    if (c) c.innerHTML = '<div class="loading-small">Загрузка...</div>';
  });
  try {
    const token = localStorage.getItem("token");
    const res = await fetch(`/api/clubs/${clubId}/players`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const players = await res.json();
    if (!players.length) {
      Object.values(containers).forEach((c) => {
        if (c) c.innerHTML = '<p class="no-data">Нет игроков</p>';
      });
      return;
    }
    const grouped = {
      goalkeeper: [],
      defender: [],
      midfielder: [],
      forward: [],
    };
    players.forEach((p) => {
      let pos = p.position || "midfielder";
      if (grouped[pos]) grouped[pos].push(p);
      else grouped.midfielder.push(p);
    });
    for (const [pos, list] of Object.entries(grouped)) {
      const container = containers[pos];
      if (!container) continue;
      if (list.length === 0)
        container.innerHTML = '<p class="no-data">Нет игроков</p>';
      else {
        container.innerHTML = list
          .map(
            (p) =>
              `<div class="player-drag" draggable="true" data-player-id="${p.id}" data-player-name="${escapeHtml(p.name)}" data-player-number="${p.number || ""}" data-player-position="${pos}"><span class="player-number">${p.number || ""}</span> ${escapeHtml(p.name)}</div>`,
          )
          .join("");
      }
    }
  } catch (error) {
    console.error(error);
    Object.values(containers).forEach((c) => {
      if (c) c.innerHTML = '<p class="error">Ошибка</p>';
    });
  }
}

function createPlayerOnField(player) {
  const div = document.createElement("div");
  div.className = "player-in-slot";
  div.dataset.playerId = player.player_id;
  div.dataset.position = player.position;
  let extraInfo = "";
  if (player.minute_in && player.minute_in > 0)
    extraInfo += `<span class="sub-minute-info">(вышел: ${player.minute_in}')</span>`;
  if (player.minute_out)
    extraInfo += `<span class="sub-minute-info">(ушел: ${player.minute_out}')</span>`;
  let cards = "";
  if (player.yellow_cards)
    cards += `<span class="card-info"> 🟨${player.yellow_cards}</span>`;
  if (player.red_cards)
    cards += `<span class="card-info"> 🟥${player.red_cards}</span>`;
  div.innerHTML = `<span class="player-number">${player.number || ""}</span> ${escapeHtml(player.name)}${cards}${extraInfo}<div class="player-actions"><button class="btn-yellow" onclick="event.stopPropagation(); openCardModal(${player.player_id}, 'yellow', '${escapeHtml(player.name)}')">🟨</button><button class="btn-red" onclick="event.stopPropagation(); openCardModal(${player.player_id}, 'red', '${escapeHtml(player.name)}')">🟥</button><button class="btn-sub" onclick="event.stopPropagation(); openSubstituteModal(${player.player_id}, '${escapeHtml(player.name)}', '${player.position}')">🔄 Замена</button></div>`;
  return div;
}

async function loadCurrentLineup(matchId) {
  try {
    const res = await fetch(`/api/clubs/matches/${matchId}/lineup`);
    const lineup = await res.json();
    const starters = lineup.filter((p) => p.is_starter);
    const substitutes = lineup.filter((p) => !p.is_starter);

    const container = document.getElementById("lineupPositions");
    if (!container) {
      console.error("Элемент lineupPositions не найден");
      return;
    }
    container.innerHTML = `<div class="position-slot" data-position="goalkeeper" data-slot="goalkeeper">🥅 Вратарь</div><div class="position-slot" data-position="defender" data-slot="defender">🛡️ Защитники</div><div class="position-slot" data-position="midfielder" data-slot="midfielder">⚡ Полузащитники</div><div class="position-slot" data-position="forward" data-slot="forward">🎯 Нападающие</div>`;

    starters.forEach((player) => {
      let slotSelector = "";
      if (player.position === "goalkeeper")
        slotSelector = '[data-slot="goalkeeper"]';
      else if (player.position === "defender")
        slotSelector = '[data-slot="defender"]';
      else if (player.position === "midfielder")
        slotSelector = '[data-slot="midfielder"]';
      else slotSelector = '[data-slot="forward"]';
      const slot = document.querySelector(slotSelector);
      if (
        slot &&
        !slot.querySelector(`[data-player-id="${player.player_id}"]`)
      ) {
        const playerDiv = createPlayerOnField(player);
        slot.appendChild(playerDiv);
      }
    });

    const subsContainer = document.getElementById("substitutesList");
    if (!subsContainer) {
      console.warn(
        "Элемент substitutesList не найден, пропускаем отображение запасных",
      );
      return;
    }
    if (substitutes.length === 0) {
      subsContainer.innerHTML = '<p class="no-data">Нет запасных игроков</p>';
    } else {
      subsContainer.innerHTML = substitutes
        .map(
          (p) =>
            `<div class="substitute-drag" draggable="true" data-player-id="${p.player_id}" data-player-name="${escapeHtml(p.name)}" data-player-number="${p.number || ""}" data-player-position="${p.position || "midfielder"}"><span class="player-number">${p.number || ""}</span> ${escapeHtml(p.name)}<span class="sub-status">(запасной)</span></div>`,
        )
        .join("");
    }
  } catch (error) {
    console.error("Ошибка загрузки состава:", error);
  }
}

function initDragAndDrop() {
  const draggables = document.querySelectorAll(".player-drag");
  const slots = document.querySelectorAll(".position-slot");
  draggables.forEach((drag) => {
    drag.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData(
        "text/plain",
        JSON.stringify({
          id: drag.dataset.playerId,
          name: drag.dataset.playerName,
          number: drag.dataset.playerNumber,
          position: drag.dataset.playerPosition,
        }),
      );
      drag.classList.add("dragging");
    });
    drag.addEventListener("dragend", () => drag.classList.remove("dragging"));
  });
  slots.forEach((slot) => {
    slot.addEventListener("dragover", (e) => {
      e.preventDefault();
      slot.classList.add("drag-over");
    });
    slot.addEventListener("dragleave", () => {
      slot.classList.remove("drag-over");
    });
    slot.addEventListener("drop", (e) => {
      e.preventDefault();
      slot.classList.remove("drag-over");
      const playerData = JSON.parse(e.dataTransfer.getData("text/plain"));
      const position = slot.dataset.position;
      if (playerData.position !== position) {
        alert(
          `Игрок позиции "${playerData.position}" не может играть на позиции "${position}"`,
        );
        return;
      }
      if (position === "goalkeeper" && slot.querySelector(".player-in-slot")) {
        alert("На поле уже есть вратарь!");
        return;
      }
      const totalOnField = document.querySelectorAll(".player-in-slot").length;
      if (totalOnField >= 11) {
        alert("На поле уже 11 игроков! Сначала замените кого-нибудь.");
        return;
      }
      const minute = prompt("Введите минуту выхода на поле (целое число):");
      if (minute === null || isNaN(parseInt(minute))) return;
      const playerDiv = document.createElement("div");
      playerDiv.className = "player-in-slot";
      playerDiv.dataset.playerId = playerData.id;
      playerDiv.dataset.position = position;
      playerDiv.innerHTML = `<span class="player-number">${playerData.number || ""}</span> ${escapeHtml(playerData.name)}<span class="sub-minute-info">(вышел: ${minute}')</span><div class="player-actions"><button class="btn-yellow" onclick="event.stopPropagation(); openCardModal(${playerData.id}, 'yellow', '${escapeHtml(playerData.name)}')">🟨</button><button class="btn-red" onclick="event.stopPropagation(); openCardModal(${playerData.id}, 'red', '${escapeHtml(playerData.name)}')">🟥</button><button class="btn-sub" onclick="event.stopPropagation(); openSubstituteModal(${playerData.id}, '${escapeHtml(playerData.name)}', '${position}')">🔄 Замена</button></div>`;
      slot.appendChild(playerDiv);
    });
  });
}

function initSubstitutesDragAndDrop() {
  const subs = document.querySelectorAll(".substitute-drag");
  const slots = document.querySelectorAll(".position-slot");
  subs.forEach((sub) => {
    sub.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData(
        "text/plain",
        JSON.stringify({
          id: sub.dataset.playerId,
          name: sub.dataset.playerName,
          number: sub.dataset.playerNumber,
          position: sub.dataset.playerPosition,
          isSubstitute: true,
        }),
      );
      sub.classList.add("dragging");
    });
    sub.addEventListener("dragend", () => sub.classList.remove("dragging"));
  });
  slots.forEach((slot) => {
    slot.addEventListener("dragover", (e) => e.preventDefault());
    slot.addEventListener("drop", async (e) => {
      e.preventDefault();
      const playerData = JSON.parse(e.dataTransfer.getData("text/plain"));
      if (!playerData.isSubstitute) return;
      const position = slot.dataset.position;
      if (playerData.position !== position && position !== "goalkeeper") {
        alert(
          `Игрок позиции "${playerData.position}" не может играть на позиции "${position}"`,
        );
        return;
      }
      if (position === "goalkeeper" && slot.querySelector(".player-in-slot")) {
        alert("На поле уже есть вратарь!");
        return;
      }
      const totalOnField = document.querySelectorAll(".player-in-slot").length;
      if (totalOnField >= 11) {
        alert("На поле уже 11 игроков! Сначала замените кого-нибудь.");
        return;
      }
      const minute = prompt("Введите минуту выхода на поле (целое число):");
      if (minute === null || isNaN(parseInt(minute))) return;
      const playerDiv = document.createElement("div");
      playerDiv.className = "player-in-slot";
      playerDiv.dataset.playerId = playerData.id;
      playerDiv.dataset.position = position;
      playerDiv.innerHTML = `<span class="player-number">${playerData.number || ""}</span> ${escapeHtml(playerData.name)}<span class="sub-minute-info">(вышел: ${minute}')</span><div class="player-actions"><button class="btn-yellow" onclick="event.stopPropagation(); openCardModal(${playerData.id}, 'yellow', '${escapeHtml(playerData.name)}')">🟨</button><button class="btn-red" onclick="event.stopPropagation(); openCardModal(${playerData.id}, 'red', '${escapeHtml(playerData.name)}')">🟥</button><button class="btn-sub" onclick="event.stopPropagation(); openSubstituteModal(${playerData.id}, '${escapeHtml(playerData.name)}', '${position}')">🔄 Замена</button></div>`;
      slot.appendChild(playerDiv);
      const subElement = document.querySelector(
        `.substitute-drag[data-player-id="${playerData.id}"]`,
      );
      if (subElement) subElement.remove();
      alert(`Игрок ${playerData.name} вышел на поле в ${minute} минуту.`);
    });
  });
}

// ========== МОДАЛЬНЫЕ ОКНА ЗАМЕНЫ ==========
window.openSubstituteModal = function (playerId, playerName, playerPosition) {
  currentSubstitutePlayerId = playerId;
  currentSubstitutePlayerName = playerName;
  currentSubstitutePlayerPosition = playerPosition;
  const candidates = getAvailableSubstitutes(playerPosition);
  if (candidates.length === 0) {
    alert("Нет подходящих запасных игроков для этой позиции!");
    return;
  }
  document.getElementById("substitutePlayerInfo").innerHTML =
    `<p><strong>Заменяемый:</strong> ${escapeHtml(playerName)}</p><p><strong>Позиция:</strong> ${getPositionName(playerPosition)}</p>`;
  const container = document.getElementById("substituteCandidatesList");
  container.innerHTML = candidates
    .map(
      (p) =>
        `<div class="candidate-card" onclick="confirmSubstitute(${p.id}, '${escapeHtml(p.name)}', ${p.number || 0}, '${p.position}')"><div><span class="player-number">${p.number || ""}</span> ${escapeHtml(p.name)}</div><div>➡️</div></div>`,
    )
    .join("");
  document.getElementById("substituteModal").style.display = "block";
};

window.closeSubstituteModal = function () {
  document.getElementById("substituteModal").style.display = "none";
  currentSubstitutePlayerId = null;
};

function getAvailableSubstitutes(position) {
  const substitutes = document.querySelectorAll(".substitute-drag");
  const result = [];
  substitutes.forEach((sub) => {
    const subPos = sub.dataset.playerPosition;
    if (position === "goalkeeper" && subPos === "goalkeeper") {
      result.push({
        id: parseInt(sub.dataset.playerId),
        name: sub.dataset.playerName,
        number: sub.dataset.playerNumber,
        position: subPos,
      });
    } else if (position !== "goalkeeper" && subPos !== "goalkeeper") {
      result.push({
        id: parseInt(sub.dataset.playerId),
        name: sub.dataset.playerName,
        number: sub.dataset.playerNumber,
        position: subPos,
      });
    }
  });
  return result;
}

function getPositionName(pos) {
  const names = {
    goalkeeper: "Вратарь",
    defender: "Защитник",
    midfielder: "Полузащитник",
    forward: "Нападающий",
  };
  return names[pos] || pos;
}

window.confirmSubstitute = function (
  newPlayerId,
  newPlayerName,
  newPlayerNumber,
  newPlayerPosition,
) {
  const playerDiv = document.querySelector(
    `.player-in-slot[data-player-id="${currentSubstitutePlayerId}"]`,
  );
  if (!playerDiv) {
    alert("Ошибка: игрок не найден");
    closeSubstituteModal();
    return;
  }
  const minuteOut = prompt("Введите минуту, когда игрок покинул поле:");
  if (minuteOut === null || isNaN(parseInt(minuteOut))) {
    closeSubstituteModal();
    return;
  }
  let infoSpan = playerDiv.querySelector(".sub-minute-info");
  if (!infoSpan) {
    infoSpan = document.createElement("span");
    infoSpan.className = "sub-minute-info";
    playerDiv.insertBefore(
      infoSpan,
      playerDiv.querySelector(".player-actions"),
    );
  }
  infoSpan.textContent = `(ушел: ${minuteOut}')`;
  const position = playerDiv.dataset.position;
  const slot = playerDiv.parentElement;
  playerDiv.remove();
  const minuteIn = prompt("Введите минуту выхода на замену:");
  if (minuteIn === null || isNaN(parseInt(minuteIn))) {
    closeSubstituteModal();
    return;
  }
  const newPlayerDiv = document.createElement("div");
  newPlayerDiv.className = "player-in-slot";
  newPlayerDiv.dataset.playerId = newPlayerId;
  newPlayerDiv.dataset.position = position;
  newPlayerDiv.innerHTML = `<span class="player-number">${newPlayerNumber || ""}</span> ${escapeHtml(newPlayerName)}<span class="sub-minute-info">(вышел: ${minuteIn}')</span><div class="player-actions"><button class="btn-yellow" onclick="event.stopPropagation(); openCardModal(${newPlayerId}, 'yellow', '${escapeHtml(newPlayerName)}')">🟨</button><button class="btn-red" onclick="event.stopPropagation(); openCardModal(${newPlayerId}, 'red', '${escapeHtml(newPlayerName)}')">🟥</button><button class="btn-sub" onclick="event.stopPropagation(); openSubstituteModal(${newPlayerId}, '${escapeHtml(newPlayerName)}', '${position}')">🔄 Замена</button></div>`;
  slot.appendChild(newPlayerDiv);
  const subElement = document.querySelector(
    `.substitute-drag[data-player-id="${newPlayerId}"]`,
  );
  if (subElement) subElement.remove();
  // Сохраняем замену
  if (!window.substitutionsData) window.substitutionsData = [];
  window.substitutionsData.push({
    player_out_id: currentSubstitutePlayerId,
    player_in_id: newPlayerId,
    minute_out: parseInt(minuteOut),
    minute_in: parseInt(minuteIn),
  });
  alert(`Замена выполнена: ${newPlayerName} вышел в ${minuteIn}'`);
  closeSubstituteModal();
};

// ========== МОДАЛЬНЫЕ ОКНА КАРТОЧЕК ==========
window.openCardModal = function (playerId, cardType, playerName) {
  currentCardPlayerId = playerId;
  currentCardPlayerName = playerName;
  currentCardType = cardType;
  document.getElementById("cardModalTitle").innerHTML =
    cardType === "yellow" ? "🟨 Жёлтая карточка" : "🟥 Красная карточка";
  document.getElementById("cardPlayerInfo").innerHTML =
    `<p><strong>Игрок:</strong> ${escapeHtml(playerName)}</p>`;
  document.getElementById("cardMinute").value = "";
  document.getElementById("cardModal").style.display = "block";
};

window.closeCardModal = function () {
  document.getElementById("cardModal").style.display = "none";
  currentCardPlayerId = null;
  currentCardType = null;
};

window.confirmCard = function () {
  const minute = parseInt(document.getElementById("cardMinute").value);
  if (isNaN(minute) || minute < 1) {
    alert("Введите корректную минуту матча");
    return;
  }
  const playerDiv = document.querySelector(
    `.player-in-slot[data-player-id="${currentCardPlayerId}"]`,
  );
  if (!playerDiv) {
    closeCardModal();
    return;
  }
  let cardSpan = playerDiv.querySelector(".card-info");
  if (!cardSpan) {
    cardSpan = document.createElement("span");
    cardSpan.className = "card-info";
    playerDiv.insertBefore(
      cardSpan,
      playerDiv.querySelector(".player-actions"),
    );
  }
  if (currentCardType === "yellow") {
    const existingYellows = (cardSpan.innerHTML.match(/🟨/g) || []).length;
    if (existingYellows === 1) {
      alert("Вторая жёлтая карточка! Игрок удаляется.");
      cardSpan.innerHTML += ` 🟨${minute}' (вторая)`;
      removePlayerAndAutoSubstitute(
        currentCardPlayerId,
        currentCardPlayerName,
        minute,
      );
    } else {
      cardSpan.innerHTML += ` 🟨${minute}'`;
    }
  } else if (currentCardType === "red") {
    cardSpan.innerHTML += ` 🟥${minute}'`;
    removePlayerAndAutoSubstitute(
      currentCardPlayerId,
      currentCardPlayerName,
      minute,
    );
  }
  if (!window.cardsData) window.cardsData = [];
  window.cardsData.push({
    playerId: currentCardPlayerId,
    cardType: currentCardType,
    minute,
  });
  closeCardModal();
};

// ========== АВТОМАТИЧЕСКАЯ ЗАМЕНА ПОСЛЕ УДАЛЕНИЯ ==========
function removePlayerAndAutoSubstitute(playerId, playerName, minute) {
  const playerDiv = document.querySelector(
    `.player-in-slot[data-player-id="${playerId}"]`,
  );
  if (!playerDiv) return;
  const position = playerDiv.dataset.position;
  let infoSpan = playerDiv.querySelector(".sub-minute-info");
  if (!infoSpan) {
    infoSpan = document.createElement("span");
    infoSpan.className = "sub-minute-info";
    playerDiv.insertBefore(
      infoSpan,
      playerDiv.querySelector(".player-actions"),
    );
  }
  infoSpan.textContent = `(удалён в ${minute}')`;
  playerDiv.remove();
  const substitutes = document.querySelectorAll(".substitute-drag");
  const candidates = [];
  substitutes.forEach((sub) => {
    const subPos = sub.dataset.playerPosition;
    if (position === "goalkeeper" && subPos === "goalkeeper") {
      candidates.push({
        id: parseInt(sub.dataset.playerId),
        name: sub.dataset.playerName,
        number: sub.dataset.playerNumber,
        pos: subPos,
        element: sub,
      });
    } else if (position !== "goalkeeper" && subPos !== "goalkeeper") {
      candidates.push({
        id: parseInt(sub.dataset.playerId),
        name: sub.dataset.playerName,
        number: sub.dataset.playerNumber,
        pos: subPos,
        element: sub,
      });
    }
  });
  if (candidates.length === 0) {
    alert(
      `Игрок ${playerName} удалён. Запасных на позицию "${getPositionName(position)}" нет. Команда играет в меньшинстве.`,
    );
    return;
  }
  pendingAutoSubstitute = {
    playerId,
    playerName,
    position,
    minute,
    candidates,
  };
  document.getElementById("autoSubstituteMessage").innerHTML =
    `<p>Игрок <strong>${escapeHtml(playerName)}</strong> удалён на ${minute} минуте. Выберите замену:</p>`;
  const container = document.getElementById("autoSubstituteCandidates");
  container.innerHTML = candidates
    .map(
      (c) =>
        `<div class="candidate-card" onclick="confirmAutoSubstitute(${c.id}, '${escapeHtml(c.name)}', ${c.number || 0}, '${c.pos}')"><div><span class="player-number">${c.number || ""}</span> ${escapeHtml(c.name)}</div><div>➡️</div></div>`,
    )
    .join("");
  document.getElementById("autoSubstituteModal").style.display = "block";
}

window.confirmAutoSubstitute = function (
  newPlayerId,
  newPlayerName,
  newPlayerNumber,
  newPlayerPosition,
) {
  if (!pendingAutoSubstitute) return;
  const { position, minute, candidates } = pendingAutoSubstitute;
  const slot = document.querySelector(
    `.position-slot[data-position="${position}"]`,
  );
  if (!slot) return;
  const minuteIn = prompt("Введите минуту выхода на замену:");
  if (minuteIn === null || isNaN(parseInt(minuteIn))) {
    closeAutoSubstituteModal();
    return;
  }
  const newPlayerDiv = document.createElement("div");
  newPlayerDiv.className = "player-in-slot";
  newPlayerDiv.dataset.playerId = newPlayerId;
  newPlayerDiv.dataset.position = position;
  newPlayerDiv.innerHTML = `<span class="player-number">${newPlayerNumber || ""}</span> ${escapeHtml(newPlayerName)}<span class="sub-minute-info">(вышел: ${minuteIn}')</span><div class="player-actions"><button class="btn-yellow" onclick="event.stopPropagation(); openCardModal(${newPlayerId}, 'yellow', '${escapeHtml(newPlayerName)}')">🟨</button><button class="btn-red" onclick="event.stopPropagation(); openCardModal(${newPlayerId}, 'red', '${escapeHtml(newPlayerName)}')">🟥</button><button class="btn-sub" onclick="event.stopPropagation(); openSubstituteModal(${newPlayerId}, '${escapeHtml(newPlayerName)}', '${position}')">🔄 Замена</button></div>`;
  slot.appendChild(newPlayerDiv);
  const candidate = candidates.find((c) => c.id === newPlayerId);
  if (candidate && candidate.element) candidate.element.remove();
  if (!window.substitutionsData) window.substitutionsData = [];
  window.substitutionsData.push({
    player_out_id: pendingAutoSubstitute.playerId,
    player_in_id: newPlayerId,
    minute_out: minute,
    minute_in: parseInt(minuteIn),
  });
  alert(`Замена после удаления: ${newPlayerName} вышел в ${minuteIn}'`);
  closeAutoSubstituteModal();
};

window.closeAutoSubstituteModal = function () {
  document.getElementById("autoSubstituteModal").style.display = "none";
  pendingAutoSubstitute = null;
};

// ========== СОХРАНЕНИЕ СОСТАВА И СТАТИСТИКИ ==========
window.saveLineupAndStats = async function () {
  const token = localStorage.getItem("token");
  if (!token) return alert("Необходимо авторизоваться");
  const fieldPlayers = document.querySelectorAll(".player-in-slot");
  if (fieldPlayers.length === 0) {
    alert("Добавьте хотя бы одного игрока на поле");
    return;
  }
  const goalkeepers = Array.from(fieldPlayers).filter(
    (p) => p.parentElement.dataset.position === "goalkeeper",
  );
  if (goalkeepers.length > 1) {
    alert("На поле не может быть больше одного вратаря!");
    return;
  }
  const lineup = [];
  fieldPlayers.forEach((playerDiv) => {
    const slot = playerDiv.parentElement;
    const position = slot.dataset.position;
    const minuteInfo =
      playerDiv.querySelector(".sub-minute-info")?.textContent || "";
    const minuteInMatch = minuteInfo.match(/вышел:\s*(\d+)/);
    const minuteOutMatch = minuteInfo.match(/ушел:\s*(\d+)/);
    const minuteIn = minuteInMatch ? parseInt(minuteInMatch[1]) : 0;
    const minuteOut = minuteOutMatch ? parseInt(minuteOutMatch[1]) : null;
    const cardInfo = playerDiv.querySelector(".card-info")?.textContent || "";
    const yellowCount = (cardInfo.match(/🟨/g) || []).length;
    const redCount = (cardInfo.match(/🟥/g) || []).length;
    lineup.push({
      player_id: parseInt(playerDiv.dataset.playerId),
      is_starter: true,
      position: position,
      minute_in: minuteIn,
      minute_out: minuteOut,
      yellow_cards: yellowCount,
      red_cards: redCount,
      goals: 0,
      assists: 0,
    });
  });
  const substitutes = document.querySelectorAll(".substitute-drag");
  substitutes.forEach((sub) => {
    lineup.push({
      player_id: parseInt(sub.dataset.playerId),
      is_starter: false,
      position: sub.dataset.playerPosition || "midfielder",
      minute_in: null,
      minute_out: null,
      yellow_cards: 0,
      red_cards: 0,
      goals: 0,
      assists: 0,
    });
  });
  const stats = {
    possession: parseInt(document.getElementById("statPossession").value) || 0,
    shots: parseInt(document.getElementById("statShots").value) || 0,
    shots_on_target:
      parseInt(document.getElementById("statShotsOnTarget").value) || 0,
    corners: parseInt(document.getElementById("statCorners").value) || 0,
    fouls: parseInt(document.getElementById("statFouls").value) || 0,
    yellow_cards:
      parseInt(document.getElementById("statYellowCards").value) || 0,
    red_cards: parseInt(document.getElementById("statRedCards").value) || 0,
  };
  try {
    const lineupRes = await fetch(
      `/api/clubs/matches/${currentMatchId}/lineup`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ lineup }),
      },
    );
    if (!lineupRes.ok) throw new Error("Ошибка сохранения состава");
    const statsRes = await fetch(`/api/clubs/matches/${currentMatchId}/stats`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(stats),
    });
    if (!statsRes.ok) throw new Error("Ошибка сохранения статистики");
    if (window.cardsData && window.cardsData.length)
      console.log("Карточки:", window.cardsData);
    if (window.substitutionsData && window.substitutionsData.length)
      console.log("Замены:", window.substitutionsData);
    alert("Состав, замены и статистика сохранены");
    closeLineupModal();
    loadLastMatch();
  } catch (error) {
    alert(error.message);
  }
};

window.finalizeMatch = async function () {
  if (
    !confirm(
      "Завершить матч? После этого изменить состав и статистику будет нельзя.",
    )
  )
    return;
  const token = localStorage.getItem("token");
  try {
    const res = await fetch(`/api/clubs/matches/${currentMatchId}/finalize`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error();
    alert("Матч завершён");
    closeLineupModal();
    loadAdminMatchesTab();
    loadLastMatch();
  } catch (error) {
    alert("Ошибка завершения матча");
  }
};

window.closeLineupModal = function () {
  document.getElementById("lineupModal").style.display = "none";
  currentMatchId = null;
};

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
