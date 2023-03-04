import { normaliseCoins } from "./coins.js";

export const MODULE_NAME = "pf2e-heroic-crafting";

export const HeroicCraftingHourlySpendingLimit = [
    "3 sp", "5 sp", "8 sp", "1 gp, 5 sp", "2 gp", "3 gp", "5 gp", "7 gp", "10 gp", "15 gp", "21 gp", "30 gp", "40 gp", "70 gp", "100 gp", "125 gp", "200 gp", "300 gp", "500 gp", "800 gp"
];

export const HeroicCraftingGatheredIncome = [
    "1 sp", "4 sp", "6 sp", "1 gp", "1 gp, 6 sp", "2 gp", "4 gp", "5 gp", "6 gp", "8 gp", "10 gp", "12 gp", "16 gp", "24 gp", "30 gp", "40 gp", "60 gp", "80 gp", "140 gp", "200 gp", "300 gp"
];

export function spendingLimit(spendingLimitDuration, level) {
    if (level <= 0 || level >= 21) {
        return new game.pf2e.Coins();
    }

    let hourlyLimit = game.pf2e.Coins.fromString(HeroicCraftingHourlySpendingLimit[level - 1]);

    switch (spendingLimitDuration) {
        case "Hour":
        case "hour":
            return hourlyLimit;
        case "Day":
        case "day":
            return normaliseCoins(hourlyLimit.scale(4).copperValue);
        case "Week":
        case "week":
            return normaliseCoins(hourlyLimit.scale(20).copperValue);
        default:
            return new game.pf2e.Coins();
    }
}