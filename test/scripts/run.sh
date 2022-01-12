#!/bin/bash
# for i in {1..10}
# do
#    NODE_OPTIONS=--max-old-space-size=4096 VCOUNT=$i REPORT_GAS=true npx hardhat test --no-compile test/gasanalysis/ElectAnon.js > outputs/v$i.txt
# done

for i in {1..10}
do
   m=$(( i*5 ))
   NODE_OPTIONS=--max-old-space-size=4096 PCOUNT=$m REPORT_GAS=true npx hardhat test --no-compile ../gasanalysis/ElectAnon.js > ../../outputs/p$m.txt
done