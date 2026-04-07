#!/bin/bash

# Configuration
DB_HOST="localhost"
DB_PORT="5433"
DB_USER="postgres"
DB_NAME="postgres"
export PGPASSWORD="postgres"

echo "🔄 Resetting all clinics and subscriptions to FREE plan..."

# 1. Update clinics table
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "UPDATE clinics SET subscription_plan = 'free';"

# 2. Clear subscriptions table (or mark as cancelled)
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "DELETE FROM subscriptions;"

echo "✅ All clinics are now on the FREE plan. You can test the upgrade flow again!"
