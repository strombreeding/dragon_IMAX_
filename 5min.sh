

exec >> /home/ubuntu/dragon_IMAX_/cron.log 2>&1

find /tmp/ -name 'puppeteer_dev_chrome_profile*' -type f -delete

cd /home/ubuntu/dragon_IMAX_ && xvfb-run --server-args="-screen 0 1024x768x24" npm start

