#!/bin/bash
echo "Building Tournament Scheduler..."
./node_modules/.bin/esbuild index.jsx --bundle --outfile=bundle.js --format=iife --platform=browser --jsx=automatic --minify
echo "Done! bundle.js updated."
