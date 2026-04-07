import os
from redis import Redis
from rq import Worker, Queue
from dotenv import load_dotenv

# Load nexus environment
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

listen = ['default', 'reports']

redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
conn = Redis.from_url(redis_url)

if __name__ == '__main__':
    # Initialize queues with the connection
    queues = [Queue(name, connection=conn) for name in listen]
    
    # Initialize worker with the queues and connection
    worker = Worker(queues, connection=conn)
    
    print("🚀 Nexus Background Worker Started")
    worker.work()
