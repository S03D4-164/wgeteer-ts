#!/bin/bash

DATADIR="./data"

NPMDIR="$DATADIR/npm"
mkdir -p $NPMDIR/cache
mkdir -p $NPMDIR/wgeteer
sudo chown -R 1000:1000 $DATADIR
chmod -R 777 $DATADIR

wget https://download.ip2location.com/lite/IP2LOCATION-LITE-DB1.IPV6.BIN.ZIP \
&& unzip IP2LOCATION-LITE-DB1.IPV6.BIN.ZIP -x *.TXT \
&& mv IP2LOCATION-LITE-DB1.IPV6.BIN $DATADIR

git clone https://github.com/enthec/webappanalyzer && mv webappanalyzer $DATADIR/webappanalyzer
