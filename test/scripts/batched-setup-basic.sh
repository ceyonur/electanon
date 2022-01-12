#!/bin/zsh
source ./constants.sh
NODE_OPTIONS=--max-old-space-size=4096 REPORT_GAS=true VCOUNT=$VOTECOUNT PCOUNT=$PCOUNT npx hardhat --network localhost test --no-compile ../gasanalysis/batched-basic/setup.js > ../../outputs/electanon/basic/setup-v$VOTECOUNT-p$PCOUNT.txt
