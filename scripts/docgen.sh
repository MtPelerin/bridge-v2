#!/bin/bash
if ! [ -x "$(command -v solidity-docgen)" ]; then
  echo "Please install solidity-docgen in your PATH to execute this script"
  exit 1
fi

CURRENT_FOLDER=`PWD`
node ./node_modules/solidity-docgen/dist/cli.js -r "@openzeppelin=${CURRENT_FOLDER}/node_modules/@openzeppelin"
