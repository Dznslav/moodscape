from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base

import os
from urllib.parse import urlparse, urlencode, parse_qsl, urlunparse

                                                                         
                                                        
SQLALCHEMY_DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:admin@localhost:5432/moodscape"
)

                                          
if SQLALCHEMY_DATABASE_URL.startswith("postgresql://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

                                                                                         
parsed = urlparse(SQLALCHEMY_DATABASE_URL)
if parsed.query:
    qs = parse_qsl(parsed.query, keep_blank_values=True)
    new_qs = []
    for k, v in qs:
        if k == "sslmode":
            new_qs.append(("ssl", v))
        elif k not in ["channel_binding", "options", "gssencmode"]:                                                          
            new_qs.append((k, v))
    SQLALCHEMY_DATABASE_URL = urlunparse(parsed._replace(query=urlencode(new_qs)))

                                              
engine = create_async_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_size=20,
    max_overflow=10,
    pool_timeout=30,
    pool_pre_ping=True,
    pool_recycle=900
)

                        
SessionLocal = async_sessionmaker(autocommit=False, autoflush=False, expire_on_commit=False, bind=engine, class_=AsyncSession)

                                
Base = declarative_base()

                         
async def get_db():
    async with SessionLocal() as db:
        try:
            yield db
        finally:
            await db.close()
