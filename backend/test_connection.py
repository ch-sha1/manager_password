import asyncpg
import asyncio

async def test():
    try:
        conn = await asyncpg.connect(
            host='localhost',
            port=5432,
            user='admin',
            password='123',
            database='password_manager'
        )
        print("Подключение к PostgreSQL успешно!")
        
        # Проверим версию PostgreSQL
        version = await conn.fetchval("SELECT version()")
        print(f"Версия PostgreSQL: {version[:50]}...")
        
        await conn.close()
    except Exception as e:
        print(f"Ошибка подключения: {e}")

asyncio.run(test())