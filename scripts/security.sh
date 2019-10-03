#!/bin/bash

if ! [ -x "$(command -v myth)" ] || ! [ -x "$(command -v slither)" ]; then
  echo "Please install mythril (https://github.com/ConsenSys/mythril) and slither (https://github.com/crytic/slither) in your PATH to execute this script"
  exit 1
fi

if [[ "$1" == "slither" || "$1" == "" ]]
then
    echo "Running slither on all contracts"
    slither .
fi

if [[ "$1" == "mythril" || "$1" == "" ]]
then
    for FILE in contracts/**/*.sol
    do
        if [[ ! "$FILE" =~ "interfaces" ]]
        then
            echo "Running mythril on $FILE"
            myth a "$FILE" --solc-args="--allow-paths $(pwd)/contracts,$(pwd)/node_modules openzeppelin-eth=$(pwd)/node_modules/openzeppelin-eth zos-lib=$(pwd)/node_modules/zos-lib" --execution-timeout 300
        fi
    done
fi