import pg from "../node_modules/@types/pg";

const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgres://taskque:taskque123@localhost:5432/taskque",
});

export async function initDb() {
  // Create tables if they don't exist
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE,
      password_hash VARCHAR(255),
      avatar VARCHAR(10) NOT NULL,
      color VARCHAR(20) NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'member',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id UUID PRIMARY KEY,
      title VARCHAR(500) NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status VARCHAR(20) NOT NULL DEFAULT 'backlog',
      priority VARCHAR(20) NOT NULL DEFAULT 'medium',
      assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
      start_date DATE,
      end_date DATE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Migrate from old 'developers' table if it exists
  const { rows: devTable } = await pool.query(`
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'developers' AND table_schema = 'public'
  `);

  if (devTable.length > 0) {
    await pool.query(`
      INSERT INTO users (id, name, avatar, color, created_at)
      SELECT id, name, avatar, color, created_at FROM developers
      ON CONFLICT (id) DO NOTHING;

      DROP TABLE developers CASCADE;
    `);
    console.log("Migrated developers table to users");
  }

  console.log("Database initialized");
}

export { pool };
