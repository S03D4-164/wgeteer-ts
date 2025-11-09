#!/bin/bash

#echo "starting X server and VNC display"
rm -rf /tmp/.X99-lock /tmp/.X* /tmp/ppengo
#Xvfb :99 -ac -listen tcp -screen 0 1280x720x24 &
#sleep 1

mkdir -p /home/node/.fluxbox && cat fluxbox_init > /home/node/.fluxbox/init
#/usr/bin/fluxbox -display :99 -screen 0 > /dev/null 2>&1 &
#sleep 1

#x11vnc -display :99.0 -no6 -noipv6 -shared -forever -v -o /tmp/x11vnc.log &

if [ ! -d "/home/node/.cache/camoufox/" ];then
  echo "installing camoufox"
  pnpx camoufox-js fetch
fi

echo "starting node server"
pnpm install --loglevel verbose
if [ ! -d "/home/node/app/chrome/linux-123.0.6312.122" ];then
  echo "installing chrome 123"
  pnpx @puppeteer/browsers install chrome@123
fi
pnpm run pm2
