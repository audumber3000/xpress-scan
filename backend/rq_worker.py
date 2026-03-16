import os
import redis
from rq import Worker, Queue
try:
    from rq import Connection
except ImportError:
    from rq.connections import Connection

listen = ['high', 'default', 'low']

redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')

conn = redis.from_url(redis_url)

if __name__ == '__main__':
    with Connection(conn):
        worker = Worker(map(Queue, listen))
        worker.work()
