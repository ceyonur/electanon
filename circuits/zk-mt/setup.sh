#!/bin/zsh

rm -rf ./build/*
echo "Compile"
time (zokrates compile -i main.zok -o build/out -s build/abi.json)

echo "\nSetup"
time (zokrates setup -i build/out -p build/proving.key -v build/verification.key)

echo "\nExport Verifier"
time (zokrates export-verifier -i build/verification.key -o build/verifier.sol)
