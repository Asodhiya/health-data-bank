import os
from sqlalchemy.ext.asyncio import create_async_engine
from dotenv import load_dotenv
load_dotenv()

USER = os.getenv("user")
PASSWORD = os.getenv("password")
HOST = os.getenv("host")
PORT = os.getenv("port")
DBNAME = os.getenv("dbname")


DATABASE_URL = f"postgresql+asyncpg://{USER}:{PASSWORD}@{HOST}:{PORT}/{DBNAME}"
SSL_MODE = os.getenv("DB_SSLMODE", "require").strip().lower()

if not all([USER, PASSWORD, HOST, PORT, DBNAME]):
    raise RuntimeError("DATABASE_URL not set")

connect_args = {"statement_cache_size": 0}
if SSL_MODE not in {"disable", "false", "0", "off", "none"}:
    connect_args["ssl"] = SSL_MODE

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    pool_size=int(os.getenv("DB_POOL_SIZE", "5")),
    max_overflow=int(os.getenv("DB_MAX_OVERFLOW", "10")),
    pool_timeout=int(os.getenv("DB_POOL_TIMEOUT", "30")),
    pool_recycle=int(os.getenv("DB_POOL_RECYCLE", "1800")),
    connect_args=connect_args,
)
