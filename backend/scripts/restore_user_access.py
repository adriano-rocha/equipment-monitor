import os
from getpass import getpass

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.infrastructure.auth.user_auth_service import UserAuthService
from app.infrastructure.db.models.user_model import UserModel

database_url = os.environ["DATABASE_URL"].strip()
email = "asaph_eq@asaph.com"

name = input("Nome para o Dashboard: ").strip()
if not name:
    raise SystemExit("Erro: o nome não pode ficar vazio.")

password = getpass("Nova senha para o Dashboard: ")
password_confirmation = getpass("Confirme a nova senha: ")

if not password:
    raise SystemExit("Erro: a senha não pode ficar vazia.")

if password != password_confirmation:
    raise SystemExit("Erro: as senhas não coincidem.")

password_hash = UserAuthService().hash_password(password)
engine = create_engine(database_url)

try:
    with Session(engine) as session:
        user = session.query(UserModel).filter_by(email=email).first()

        if user is None:
            user = UserModel(
                name=name,
                email=email,
                password_hash=password_hash,
            )
            session.add(user)
            acao = "criado"
        else:
            user.name = name
            user.password_hash = password_hash
            acao = "atualizado"

        session.commit()
        print(f"Usuário {acao} com sucesso: {email}")
finally:
    engine.dispose()
