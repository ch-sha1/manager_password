import asyncpg
import asyncio
from app.config import DATABASE_URL

async def init():
    conn = await asyncpg.connect(DATABASE_URL)
    

    await conn.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(100) UNIQUE NOT NULL,
            master_password_hash VARCHAR(255) NOT NULL,
            twofa_secret VARCHAR(255),
            twofa_enabled BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    

    await conn.execute('''
        CREATE TABLE IF NOT EXISTS passwords (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            site VARCHAR(255) NOT NULL,
            login VARCHAR(255) NOT NULL,
            encrypted_password TEXT NOT NULL,
            category VARCHAR(100),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    

    await conn.execute('''
        CREATE TABLE IF NOT EXISTS sessions (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            token VARCHAR(255) UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP NOT NULL
        )
    ''')
    
    print("Таблицы созданы успешно!")
    
    # Проверим, какие таблицы есть
    tables = await conn.fetch("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
    """)
    
    print("\nСозданные таблицы:")
    for table in tables:
        print(f"  - {table['table_name']}")
    
    await conn.close()

asyncio.run(init())