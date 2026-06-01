from sqlmodel import SQLModel, create_engine, Session
from config import DATABASE_URL

"""Registry for database connection (db location, sql queries not displayed, allow sharing of DB between multiple threads)"""
engine = create_engine(
    DATABASE_URL, echo=False, connect_args={"check_same_thread": False}
)


"""Create DB tables for all the models (entities) in project"""


def create_tables():
    SQLModel.metadata.create_all(engine)


"""Provide the DB session to FastAPI for use"""


def get_session():
    with Session(engine) as session:
        yield session
