# How to use this:
# 1. Have https://github.com/foundryvtt/foundryvtt-cli installed.
# 2. Run this from the main directory of the module, where module.json resides.
#
# This will then extract all the shit in the packs into JSON format.

fvtt package workon "pf2e-heroic-crafting-automation"
fvtt package --id=./packs --od=./raw/macros unpack macros
fvtt package --id=./packs --od=./raw/items unpack items

node ./build/scripts/mass_cleaner.js

rm -rf ./raw