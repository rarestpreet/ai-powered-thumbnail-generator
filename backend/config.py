import os
from dotenv import load_dotenv

# Looks for .env file
load_dotenv()

# Environment variables
HUGGING_API_KEY = os.getenv("HUGGING_API_KEY", "")
IMAGEKIT_PRIVATE_KEY = os.getenv("IMAGEKIT_PRIVATE_KEY", "")
IMAGEKIT_PUBLIC_KEY = os.getenv("IMAGEKIT_PUBLIC_KEY", "")
IMAGEKIT_URL_ENDPOINT = os.getenv("IMAGEKIT_URL_ENDPOINT", "")

# Points to the database in sqlite
DATABASE_URL = "sqlite:///./thumbnailbuilder.db"
