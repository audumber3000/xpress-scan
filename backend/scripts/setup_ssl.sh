#!/bin/bash
# Nginx and SSL Setup Script

DOMAIN="api.molarplus.com"

# Install Nginx and Certbot
apt-get update
apt-get install -y nginx certbot python3-certbot-nginx

# Remove default nginx config if exists
rm -f /etc/nginx/sites-enabled/default

# Copy our custom config (transferred via scp)
cp /root/nginx.conf /etc/nginx/sites-available/xpress-scan
ln -s /etc/nginx/sites-available/xpress-scan /etc/nginx/sites-enabled/

# Test Nginx config
nginx -t

# Restart Nginx
systemctl restart nginx

# Obtain SSL Certificate (non-interactive)
certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email audumber3000@gmail.com --redirect

echo "✅ Domain and SSL setup complete for $DOMAIN!"
