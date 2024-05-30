

exec >> /home/ubuntu/dragon_IMAX_/cron.log 2>&1
cd /home/ubuntu/dragon_IMAX_ && xvfb-run --server-args="-screen 0 1024x768x24" npm start

