"""
Cache service for performance optimization
"""
import os
import json
from typing import Any, Optional, Dict, List
from datetime import timedelta
import redis.asyncio as redis
from fastapi_cache import FastAPICache
from fastapi_cache.backends.redis import RedisBackend
from fastapi_cache.decorator import cache


class CacheService:
    """Redis-based caching service"""

    def __init__(self):
        self.redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
        self.redis_client: Optional[redis.Redis] = None
        self.default_ttl = 300  # 5 minutes default TTL

    async def init_cache(self):
        """Initialize Redis cache backend"""
        try:
            self.redis_client = redis.from_url(self.redis_url)
            FastAPICache.init(RedisBackend(self.redis_client), prefix="clinic-api")
        except Exception as e:
            print(f"Failed to initialize Redis cache: {e}")
            # Continue without caching if Redis is unavailable
            pass

    async def close(self):
        """Close Redis connection"""
        if self.redis_client:
            await self.redis_client.close()

    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        if not self.redis_client:
            return None

        try:
            value = await self.redis_client.get(key)
            return json.loads(value) if value else None
        except Exception:
            return None

    async def set(self, key: str, value: Any, ttl: int = None) -> bool:
        """Set value in cache with TTL"""
        if not self.redis_client:
            return False

        try:
            ttl = ttl or self.default_ttl
            await self.redis_client.setex(key, ttl, json.dumps(value))
            return True
        except Exception:
            return False

    async def delete(self, key: str) -> bool:
        """Delete value from cache"""
        if not self.redis_client:
            return False

        try:
            await self.redis_client.delete(key)
            return True
        except Exception:
            return False

    async def delete_pattern(self, pattern: str) -> bool:
        """Delete keys matching pattern"""
        if not self.redis_client:
            return False

        try:
            keys = await self.redis_client.keys(pattern)
            if keys:
                await self.redis_client.delete(*keys)
            return True
        except Exception:
            return False

    # High-level caching methods for common operations
    async def get_patients_cache_key(self, clinic_id: int) -> str:
        """Generate cache key for patients list"""
        return f"patients:clinic:{clinic_id}"

    async def get_patient_cache_key(self, patient_id: int) -> str:
        """Generate cache key for single patient"""
        return f"patient:{patient_id}"

    async def get_clinic_cache_key(self, clinic_id: int) -> str:
        """Generate cache key for clinic"""
        return f"clinic:{clinic_id}"

    async def get_user_cache_key(self, user_id: int) -> str:
        """Generate cache key for user"""
        return f"user:{user_id}"

    async def invalidate_clinic_cache(self, clinic_id: int):
        """Invalidate all clinic-related cache"""
        patterns = [
            f"patients:clinic:{clinic_id}",
            f"clinic:{clinic_id}",
            f"clinic:{clinic_id}:stats"
        ]
        for pattern in patterns:
            await self.delete_pattern(pattern)

    async def invalidate_patient_cache(self, patient_id: int, clinic_id: int):
        """Invalidate patient-related cache"""
        keys = [
            f"patient:{patient_id}",
            f"patients:clinic:{clinic_id}",
            f"patient:{patient_id}:summary"
        ]
        for key in keys:
            await self.delete(key)


# Global cache service instance
cache_service = CacheService()


# Cache decorators for common operations
def cache_patients(expire: int = 300):
    """Cache decorator for patient lists"""
    return cache(expire=expire, namespace="patients")

def cache_patient(expire: int = 300):
    """Cache decorator for single patient"""
    return cache(expire=expire, namespace="patient")

def cache_clinic(expire: int = 600):
    """Cache decorator for clinic data"""
    return cache(expire=expire, namespace="clinic")

def cache_user(expire: int = 300):
    """Cache decorator for user data"""
    return cache(expire=expire, namespace="user")