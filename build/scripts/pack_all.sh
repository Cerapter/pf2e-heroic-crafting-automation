# How to use this:
# 1. Have https://github.com/foundryvtt/foundryvtt-cli installed.
# 2. Run this from the main directory of the module, where module.json resides.
#
# This will then packs all that ya changed into, well, packs!

fvtt package workon "pf2e-heroic-crafting-automation"
fvtt package --id=./src/macros --od=./packs pack macros
fvtt package --id=./src/items --od=./packs pack items