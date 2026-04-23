from dotenv import load_dotenv
from sqlalchemy import NullPool, create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.ext.declarative import declarative_base

load_dotenv()  # Load environment variables from .env file
from app.config.settings import DATABASE_URL

# Create database engine
engine = create_engine(DATABASE_URL,
                       poolclass=NullPool,
                       connect_args={
                           "prepare_threshold": None
                       })   #python API- SQLAlchemy engine- PostgreSQL database : connection

# Create database session- temporary connection to perform database operations
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

#API request->create db session->perform db operations(queries)->close session

# Base class for ORM models
Base = declarative_base()

print("DB URL:", DATABASE_URL)

def get_db():
    """FastAPI dependency — yields a DB session, always closes it after."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()