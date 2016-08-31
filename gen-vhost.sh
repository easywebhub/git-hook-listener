#!/bin/bash

# usage ~/gen-vhost.sh test-ptd.easywebhub.com github_com_easywebhub_test-webhook-pull

DOMAIN="$1"
SITE_AVAILABLE_PATH="/etc/nginx/sites-available/$DOMAIN"
SITE_ENABLED_PATH="/etc/nginx/sites-enabled/$DOMAIN"
SITEDIR="/var/www/repositories/$2"

echo "server {" > $SITE_AVAILABLE_PATH
echo "        server_name $DOMAIN;" >> $SITE_AVAILABLE_PATH
echo "        root $SITEDIR;" >> $SITE_AVAILABLE_PATH
echo "        index index.html;" >> $SITE_AVAILABLE_PATH
echo "        location / {" >> $SITE_AVAILABLE_PATH
echo "                try_files \$uri \$uri/index.html \$uri.html =404;" >> $SITE_AVAILABLE_PATH
echo "        }" >> $SITE_AVAILABLE_PATH
echo "}" >> $SITE_AVAILABLE_PATH

ln -f -s $SITE_AVAILABLE_PATH $SITE_ENABLED_PATH

systemctl reload nginx
