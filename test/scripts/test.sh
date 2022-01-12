#!/bin/zsh
source ./constants.sh

# NODE_OPTIONS=--max-old-space-size=4096 REPORT_GAS=true VCOUNT=$VOTECOUNT PCOUNT=$PCOUNT npx hardhat --network localhost test --no-compile test/gasanalysis/batched-basic/setup.js > outputs/electanon/basic/setup-v$VOTECOUNT-p$PCOUNT.txt

# N=10
# (
# for ((i=0; i<$(( (VOTECOUNT/BATCHSIZE) )); i++))
# for i in 10 23 24 61 71 94
# do
#    # ((p=p%N)); ((p++==0)) && wait
#    NODE_OPTIONS=--max-old-space-size=4096 VROUND=$i ADDRESS=$ADDRESS VCOUNT=$VOTECOUNT PCOUNT=$PCOUNT BSIZE=$BATCHSIZE REPORT_GAS=true npx hardhat --network localhost test --no-compile test/gasanalysis/batched-basic/commit-vote.js > outputs/electanon/basic/commit-vote-v$VOTECOUNT-p$PCOUNT-r$i.txt &
# done
# )

NODE_OPTIONS=--max-old-space-size=4096 ADDRESS=$ADDRESS VCOUNT=$VOTECOUNT PCOUNT=$PCOUNT REPORT_GAS=true npx hardhat --network localhost test --no-compile ../gasanalysis/batched-basic/reveal-vote.js > ../../outputs/electanon/basic/reveal-vote-v$VOTECOUNT-p$PCOUNT.txt
