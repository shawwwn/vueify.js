#!/bin/bash

rm vueify.js
ln -s ../vueify.js vueify.js
python -m SimpleHTTPServer 8000
