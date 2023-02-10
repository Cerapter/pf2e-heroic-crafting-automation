import {HeroicCraftingHourlySpendingLimit, spendingLimit} from "./constants.js";

Hooks.on(
    "init",
    () => {
        game.pf2eHeroicCrafting = {
            HeroicCraftingHourlySpendingLimit,
            spendingLimit
        };
    }
);