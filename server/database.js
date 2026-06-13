const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "database.sqlite");

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Ошибка подключения к базе данных:", err.message);
  } else {
    console.log("Подключено к базе данных SQLite");

    // Включаем поддержку внешних ключей
    db.run("PRAGMA foreign_keys = ON");

    // ============ ПОЛЬЗОВАТЕЛИ ============
    db.run(
      `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fullname TEXT,
        nickname TEXT,
        username TEXT UNIQUE,
        email TEXT UNIQUE,
        password TEXT,
        role TEXT DEFAULT 'user' CHECK(role IN ('user', 'moderator', 'admin', 'main_admin')),
        city TEXT,
        birthdate TEXT, -- храним как строку YYYY-MM-DD
        club TEXT,
        bio TEXT,
        avatar TEXT,
        is_online INTEGER DEFAULT 0 CHECK(is_online IN (0, 1))
      )
    `,
      (err) => {
        if (err) console.error("Ошибка создания users:", err.message);
        else console.log("Таблица users готова");
      },
    );

    // ============ НОВОСТИ ============
    db.run(
      `
      CREATE TABLE IF NOT EXISTS news (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        image TEXT,
        author_id INTEGER NOT NULL,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'published', 'rejected')),
        views INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        published_at TEXT,
        moderated_by INTEGER,
        moderated_at TEXT,
        FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (moderated_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `,
      (err) => {
        if (err) console.error("Ошибка создания news:", err.message);
        else console.log("Таблица news готова");
      },
    );

    // ============ ЛАЙКИ НОВОСТЕЙ ============
    db.run(
      `
      CREATE TABLE IF NOT EXISTS news_likes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        news_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        type TEXT CHECK(type IN ('like', 'dislike')),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (news_id) REFERENCES news(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(news_id, user_id)
      )
    `,
      (err) => {
        if (err) console.error("Ошибка создания news_likes:", err.message);
        else console.log("Таблица news_likes готова");
      },
    );

    // ============ КОММЕНТАРИИ НОВОСТЕЙ ============
    db.run(
      `
      CREATE TABLE IF NOT EXISTS news_comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        news_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        parent_id INTEGER,
        content TEXT NOT NULL,
        is_hidden INTEGER DEFAULT 0 CHECK(is_hidden IN (0, 1)),
        is_admin_reply INTEGER DEFAULT 0 CHECK(is_admin_reply IN (0, 1)),
        has_admin_reply INTEGER DEFAULT 0 CHECK(has_admin_reply IN (0, 1)),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (news_id) REFERENCES news(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_id) REFERENCES news_comments(id) ON DELETE CASCADE
      )
    `,
      (err) => {
        if (err) console.error("Ошибка создания news_comments:", err.message);
        else console.log("Таблица news_comments готова");
      },
    );

    // ============ КАТЕГОРИИ НОВОСТЕЙ ============
    db.run(
      `
      CREATE TABLE IF NOT EXISTS news_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        description TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `,
      (err) => {
        if (err) console.error("Ошибка создания news_categories:", err.message);
        else {
          console.log("Таблица news_categories готова");
          // Добавляем базовые категории, если их нет
          db.run(
            `INSERT OR IGNORE INTO news_categories (name, slug, description) VALUES 
             ('Трансферы', 'transfers', 'Новости о трансферах игроков'),
             ('Матчи', 'matches', 'Обзоры матчей и результаты'),
             ('Интервью', 'interviews', 'Интервью с игроками и тренерами'),
             ('Аналитика', 'analytics', 'Аналитические статьи'),
             ('Клубы', 'clubs', 'Новости о клубах'),
             ('Сборные', 'national', 'Новости о сборных'),
             ('Лиги', 'leagues', 'Новости о лигах и турнирах'),
             ('Другое', 'other', 'Прочие новости')`,
          );
        }
      },
    );

    // ============ ХЭШТЕГИ НОВОСТЕЙ ============
    db.run(
      `
      CREATE TABLE IF NOT EXISTS news_hashtags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `,
      (err) => {
        if (err) console.error("Ошибка создания news_hashtags:", err.message);
        else console.log("Таблица news_hashtags готова");
      },
    );

    // ============ СВЯЗЬ НОВОСТЕЙ С КАТЕГОРИЯМИ ============
    db.run(
      `
      CREATE TABLE IF NOT EXISTS news_to_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        news_id INTEGER NOT NULL,
        category_id INTEGER NOT NULL,
        FOREIGN KEY (news_id) REFERENCES news(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES news_categories(id) ON DELETE CASCADE,
        UNIQUE(news_id, category_id)
      )
    `,
      (err) => {
        if (err)
          console.error("Ошибка создания news_to_categories:", err.message);
        else console.log("Таблица news_to_categories готова");
      },
    );

    // ============ СВЯЗЬ НОВОСТЕЙ С ХЭШТЕГАМИ ============
    db.run(
      `
      CREATE TABLE IF NOT EXISTS news_to_hashtags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        news_id INTEGER NOT NULL,
        hashtag_id INTEGER NOT NULL,
        FOREIGN KEY (news_id) REFERENCES news(id) ON DELETE CASCADE,
        FOREIGN KEY (hashtag_id) REFERENCES news_hashtags(id) ON DELETE CASCADE,
        UNIQUE(news_id, hashtag_id)
      )
    `,
      (err) => {
        if (err)
          console.error("Ошибка создания news_to_hashtags:", err.message);
        else console.log("Таблица news_to_hashtags готова");
      },
    );

    // ============ ТЕХПОДДЕРЖКА ============
    db.run(
      `
      CREATE TABLE IF NOT EXISTS support_tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        subject TEXT NOT NULL,
        message TEXT NOT NULL,
        photos TEXT, -- JSON массив путей к фото
        status TEXT DEFAULT 'open' CHECK(status IN ('open', 'in_progress', 'closed')),
        priority TEXT DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high')),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        closed_at TEXT,
        assigned_to INTEGER,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
      )
    `,
      (err) => {
        if (err) console.error("Ошибка создания support_tickets:", err.message);
        else console.log("Таблица support_tickets готова");
      },
    );

    db.run(
      `
      CREATE TABLE IF NOT EXISTS support_replies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        message TEXT NOT NULL,
        photos TEXT, -- JSON массив путей к фото
        is_admin INTEGER DEFAULT 0 CHECK(is_admin IN (0, 1)),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `,
      (err) => {
        if (err) console.error("Ошибка создания support_replies:", err.message);
        else console.log("Таблица support_replies готова");
      },
    );

    // ============ КЛУБЫ ============
    db.run(
      `
      CREATE TABLE IF NOT EXISTS clubs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        username TEXT UNIQUE NOT NULL,
        description TEXT,
        avatar TEXT,
        cover TEXT,
        creator_id INTEGER NOT NULL,
        city TEXT,
        stadium TEXT,
        founded_year INTEGER,
        website TEXT,
        is_private INTEGER DEFAULT 0 CHECK(is_private IN (0, 1)),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `,
      (err) => {
        if (err) console.error("Ошибка создания clubs:", err.message);
        else console.log("Таблица clubs готова");
      },
    );

    db.run(
      `
      CREATE TABLE IF NOT EXISTS club_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        club_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        role TEXT DEFAULT 'member' CHECK(role IN ('member', 'moderator', 'admin', 'owner')),
        joined_at TEXT DEFAULT CURRENT_TIMESTAMP,
        banned_until TEXT,
        ban_reason TEXT,
        banned_by INTEGER,
        banned_at TEXT,
        comment_banned_until TEXT,
        comment_ban_reason TEXT,
        comment_banned_by INTEGER,
        comment_banned_at TEXT,
        FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (banned_by) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (comment_banned_by) REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE(club_id, user_id)
      )
    `,
      (err) => {
        if (err) console.error("Ошибка создания club_members:", err.message);
        else console.log("Таблица club_members готова");
      },
    );

    db.run(
      `
      CREATE TABLE IF NOT EXISTS club_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        club_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        message TEXT,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        handled_at TEXT,
        handled_by INTEGER,
        FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (handled_by) REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE(club_id, user_id)
      )
    `,
      (err) => {
        if (err) console.error("Ошибка создания club_requests:", err.message);
        else console.log("Таблица club_requests готова");
      },
    );

    db.run(
      `
      CREATE TABLE IF NOT EXISTS club_posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        club_id INTEGER NOT NULL,
        author_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        image TEXT,
        pinned INTEGER DEFAULT 0 CHECK(pinned IN (0, 1)),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE,
        FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `,
      (err) => {
        if (err) console.error("Ошибка создания club_posts:", err.message);
        else console.log("Таблица club_posts готова");
      },
    );

    db.run(
      `
      CREATE TABLE IF NOT EXISTS club_post_likes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        type TEXT CHECK(type IN ('like', 'dislike')),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (post_id) REFERENCES club_posts(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(post_id, user_id)
      )
    `,
      (err) => {
        if (err) console.error("Ошибка создания club_post_likes:", err.message);
        else console.log("Таблица club_post_likes готова");
      },
    );

    db.run(
      `
      CREATE TABLE IF NOT EXISTS club_post_comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (post_id) REFERENCES club_posts(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `,
      (err) => {
        if (err)
          console.error("Ошибка создания club_post_comments:", err.message);
        else console.log("Таблица club_post_comments готова");
      },
    );

    db.run(
      `
      CREATE TABLE IF NOT EXISTS club_followers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        club_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(club_id, user_id)
      )
    `,
      (err) => {
        if (err) console.error("Ошибка создания club_followers:", err.message);
        else console.log("Таблица club_followers готова");
      },
    );

    // ============ ИГРОКИ КЛУБА ============
    db.run(
      `
  CREATE TABLE IF NOT EXISTS club_players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    club_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    number INTEGER,
    position TEXT CHECK(position IN ('goalkeeper', 'defender', 'midfielder', 'forward')),
    photo TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE
  )
`,
      (err) => {
        if (err) console.error("Ошибка создания club_players:", err.message);
        else console.log("Таблица club_players готова");
      },
    );

    // ============ МАТЧИ КЛУБА ============
    db.run(
      `
  CREATE TABLE IF NOT EXISTS club_matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    club_id INTEGER NOT NULL,
    opponent TEXT NOT NULL,
    match_time TEXT NOT NULL,
    venue TEXT CHECK(venue IN ('home', 'away')),
    is_home INTEGER DEFAULT 1 CHECK(is_home IN (0,1)),
    status TEXT DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'ongoing', 'finished')),
    score TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE
  )
`,
      (err) => {
        if (err) console.error("Ошибка создания club_matches:", err.message);
        else console.log("Таблица club_matches готова");
      },
    );

    // ============ СОСТАВ НА МАТЧ ============
    db.run(
      `
  CREATE TABLE IF NOT EXISTS match_lineups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id INTEGER NOT NULL,
    player_id INTEGER NOT NULL,
    is_starter INTEGER DEFAULT 1 CHECK(is_starter IN (0,1)),
    position TEXT CHECK(position IN ('goalkeeper', 'defender', 'midfielder', 'forward')),
    minute_in INTEGER,
    minute_out INTEGER,
    goals INTEGER DEFAULT 0,
    assists INTEGER DEFAULT 0,
    yellow_cards INTEGER DEFAULT 0,
    red_cards INTEGER DEFAULT 0,
    FOREIGN KEY (match_id) REFERENCES club_matches(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES club_players(id) ON DELETE CASCADE
  )
`,
      (err) => {
        if (err) console.error("Ошибка создания match_lineups:", err.message);
        else console.log("Таблица match_lineups готова");
      },
    );

    // ============ СТАТИСТИКА МАТЧА (КОМАНДНАЯ) ============
    db.run(
      `
  CREATE TABLE IF NOT EXISTS match_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id INTEGER NOT NULL UNIQUE,
    possession INTEGER DEFAULT 0,
    shots INTEGER DEFAULT 0,
    shots_on_target INTEGER DEFAULT 0,
    corners INTEGER DEFAULT 0,
    fouls INTEGER DEFAULT 0,
    yellow_cards INTEGER DEFAULT 0,
    red_cards INTEGER DEFAULT 0,
    offsides INTEGER DEFAULT 0,
    FOREIGN KEY (match_id) REFERENCES club_matches(id) ON DELETE CASCADE
  )
`,
      (err) => {
        if (err) console.error("Ошибка создания match_stats:", err.message);
        else console.log("Таблица match_stats готова");
      },
    );

    db.run(
      `
      CREATE TABLE IF NOT EXISTS club_post_proposals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        club_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        image TEXT,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        reviewed_at TEXT,
        reviewed_by INTEGER,
        review_comment TEXT,
        FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `,
      (err) => {
        if (err)
          console.error("Ошибка создания club_post_proposals:", err.message);
        else console.log("Таблица club_post_proposals готова");
      },
    );
    // Проверяем наличие колонки photos в support_tickets
    db.all("PRAGMA table_info(support_tickets)", (err, rows) => {
      if (!err && rows && !rows.some((row) => row.name === "photos")) {
        db.run("ALTER TABLE support_tickets ADD COLUMN photos TEXT");
      }
    });

    // Проверяем наличие колонки photos в support_replies
    db.all("PRAGMA table_info(support_replies)", (err, rows) => {
      if (!err && rows && !rows.some((row) => row.name === "photos")) {
        db.run("ALTER TABLE support_replies ADD COLUMN photos TEXT");
      }
    });
    // ============ ИНДЕКСЫ ============
    // Новости
    db.run("CREATE INDEX IF NOT EXISTS idx_news_status ON news(status)");
    db.run("CREATE INDEX IF NOT EXISTS idx_news_created ON news(created_at)");
    db.run("CREATE INDEX IF NOT EXISTS idx_news_author ON news(author_id)");
    db.run("CREATE INDEX IF NOT EXISTS idx_likes_news ON news_likes(news_id)");
    db.run(
      "CREATE INDEX IF NOT EXISTS idx_comments_news ON news_comments(news_id)",
    );

    // Категории и хэштеги
    db.run(
      "CREATE INDEX IF NOT EXISTS idx_news_categories_slug ON news_categories(slug)",
    );
    db.run(
      "CREATE INDEX IF NOT EXISTS idx_news_hashtags_slug ON news_hashtags(slug)",
    );
    db.run(
      "CREATE INDEX IF NOT EXISTS idx_news_to_categories_news ON news_to_categories(news_id)",
    );
    db.run(
      "CREATE INDEX IF NOT EXISTS idx_news_to_hashtags_news ON news_to_hashtags(news_id)",
    );

    // Клубы
    db.run("CREATE INDEX IF NOT EXISTS idx_clubs_username ON clubs(username)");
    db.run("CREATE INDEX IF NOT EXISTS idx_clubs_name ON clubs(name)");
    db.run(
      "CREATE INDEX IF NOT EXISTS idx_club_members_club ON club_members(club_id)",
    );
    db.run(
      "CREATE INDEX IF NOT EXISTS idx_club_members_user ON club_members(user_id)",
    );
    db.run(
      "CREATE INDEX IF NOT EXISTS idx_club_members_role ON club_members(role)",
    );
    db.run(
      "CREATE INDEX IF NOT EXISTS idx_club_posts_club ON club_posts(club_id)",
    );
    db.run(
      "CREATE INDEX IF NOT EXISTS idx_club_followers_club ON club_followers(club_id)",
    );
    db.run(
      "CREATE INDEX IF NOT EXISTS idx_club_followers_user ON club_followers(user_id)",
    );
    db.run(
      "CREATE INDEX IF NOT EXISTS idx_proposals_club ON club_post_proposals(club_id)",
    );
    db.run(
      "CREATE INDEX IF NOT EXISTS idx_proposals_status ON club_post_proposals(status)",
    );
    db.run(
      "CREATE INDEX IF NOT EXISTS idx_proposals_user ON club_post_proposals(user_id)",
    );

    // Индексы для игроков и матчей
    db.run(
      "CREATE INDEX IF NOT EXISTS idx_players_club ON club_players(club_id)",
    );
    db.run(
      "CREATE INDEX IF NOT EXISTS idx_matches_club ON club_matches(club_id)",
    );
    db.run(
      "CREATE INDEX IF NOT EXISTS idx_matches_status ON club_matches(status)",
    );
    db.run(
      "CREATE INDEX IF NOT EXISTS idx_matches_time ON club_matches(match_time)",
    );
    db.run(
      "CREATE INDEX IF NOT EXISTS idx_lineups_match ON match_lineups(match_id)",
    );
    db.run(
      "CREATE INDEX IF NOT EXISTS idx_stats_match ON match_stats(match_id)",
    );

    // Техподдержка
    db.run(
      "CREATE INDEX IF NOT EXISTS idx_tickets_user ON support_tickets(user_id)",
    );
    db.run(
      "CREATE INDEX IF NOT EXISTS idx_tickets_status ON support_tickets(status)",
    );
    db.run(
      "CREATE INDEX IF NOT EXISTS idx_replies_ticket ON support_replies(ticket_id)",
    );
  }
});

module.exports = db;
