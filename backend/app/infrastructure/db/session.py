"""Engine e sessionmaker do SQLAlchemy — ponto único de criação de conexões.

🔑 palavra-chave: o engine é criado UMA vez por processo (nível de módulo) e
reaproveitado — criar um engine por request seria um vazamento de conexões
(cada engine mantém seu próprio connection pool).
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.infrastructure.config import get_settings

engine = create_engine(get_settings().database_url)

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)