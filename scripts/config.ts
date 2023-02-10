export const HeroicCraftingHourlySpendingLimit = [
    "3 sp", "5 sp", "8 sp", "1 gp, 5 sp", "2 gp", "3 gp", "5 gp", "7 gp", "10 gp", "15 gp", "21 gp", "30 gp", "40 gp", "70 gp", "100 gp", "125 gp", "200 gp", "300 gp", "500 gp", "800 gp"
];

export type SpendingLimitType = "Hour" | "Day" | "Week";

export function spendingLimit(spendingLimitDuration: SpendingLimitType, level: number) {
    let hourlyLimit = game.pf2e.Coins.fromString(HeroicCraftingHourlySpendingLimit[level]);

    switch (spendingLimitDuration) {
        case "Hour":
            return hourlyLimit;
        case "Day":
            return hourlyLimit.scale(4);
        case "Week":
            return hourlyLimit.scale(20);
        default:
            return hourlyLimit;
    }
}

Hooks.on(
    "init",
    () => {
        game.pf2eHeroicCrafting = {
            HeroicCraftingHourlySpendingLimit,
            spendingLimit
        };
    }
);