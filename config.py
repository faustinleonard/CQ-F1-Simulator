"""
Configuration settings for F1 Simulator backend.
"""

import os
from datetime import timedelta

class Config:
    """Base configuration."""
    
    # Flask settings
    DEBUG = False
    TESTING = False
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-key-change-in-production")
    
    # CORS settings
    CORS_HEADERS = "Content-Type"
    CORS_ALLOW_ORIGINS = ["http://localhost:3000", "http://localhost:5000", "*"]
    
    # Session settings
    PERMANENT_SESSION_LIFETIME = timedelta(hours=24)
    SESSION_COOKIE_SECURE = False
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    
    # Data settings
    DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
    CACHE_TIMEOUT = 3600  # 1 hour


class DevelopmentConfig(Config):
    """Development configuration."""
    DEBUG = True
    TESTING = False


class TestingConfig(Config):
    """Testing configuration."""
    DEBUG = True
    TESTING = True


class ProductionConfig(Config):
    """Production configuration."""
    DEBUG = False
    TESTING = False
    SESSION_COOKIE_SECURE = True


# Select config based on environment
env = os.getenv("FLASK_ENV", "development")
if env == "testing":
    config = TestingConfig()
elif env == "production":
    config = ProductionConfig()
else:
    config = DevelopmentConfig()
