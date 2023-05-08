import { normaliseCoins } from "./coins.js";

/** 
 * A constant handle for the module name if I ever end up changing it. 
 *
 * **WARNING!** If this changes, you HAVE to change the Material Trove and the macros too.
 */
export const MODULE_NAME = "pf2e-heroic-crafting-automation";

/** 
 * The Spending Limit table's Hour column. Note that THAT table starts at level 1, but arrays obviously start at 0. 
 * 
 * @see spendingLimit, and use that instead.
 */
export const HeroicCraftingHourlySpendingLimit = [
    "3 sp", "5 sp", "8 sp", "1 gp, 5 sp", "2 gp", "3 gp", "5 gp", "7 gp", "10 gp", "15 gp", "21 gp", "30 gp", "40 gp", "70 gp", "100 gp", "125 gp", "200 gp", "300 gp", "500 gp", "800 gp"
];

/**
 * The Gathered Income table's only column. THIS one starts at level 0.
 */
export const HeroicCraftingGatheredIncome = [
    "1 sp", "4 sp", "6 sp", "1 gp", "1 gp, 6 sp", "2 gp", "4 gp", "5 gp", "6 gp", "8 gp", "10 gp", "12 gp", "16 gp", "24 gp", "30 gp", "40 gp", "60 gp", "80 gp", "140 gp", "200 gp", "300 gp"
];

/**
 * Calculates the appropriate spending limit for a level.
 * 
 * @param {"hour"|"day"|"week"} spendingLimitDuration The duration of the crafting activity to calculate the spending limit for.
 * @param {number} level The leve at which the activity is performed.
 * @returns {game.pf2e.Coins} A Coins object of the appropriate spending limit.
 */
export function spendingLimit(spendingLimitDuration, level) {
    if (level <= 0 || level >= 21) {
        return new game.pf2e.Coins();
    }

    let hourlyLimit = game.pf2e.Coins.fromString(HeroicCraftingHourlySpendingLimit[level - 1]);

    const dayMultiplier = game.settings.get(MODULE_NAME, "hoursInADay") || 4;
    const weekMultiplier = game.settings.get(MODULE_NAME, "daysInAWeek") || 5;

    switch (spendingLimitDuration) {
        case "Hour":
        case "hour":
            return hourlyLimit;
        case "Day":
        case "day":
            return normaliseCoins(hourlyLimit.scale(dayMultiplier).copperValue);
        case "Week":
        case "week":
            return normaliseCoins(hourlyLimit.scale(dayMultiplier).scale(weekMultiplier).copperValue);
        default:
            return new game.pf2e.Coins();
    }
}

/**
 * Checks if an actor has a feat.
 * 
 * @param {ActorPF2e} actor The actor whose feats to check.
 * @param {string} slug The slug of the feat to check. 
 * Also checks for a sluggified name because most Heroic Crafting feats have no slugs.
 * @returns {boolean} True if the feat exists. 
 */
export function CheckFeat(actor, slug) {
    return actor.itemTypes.feat.some((i) => i.slug === slug || game.pf2e.system.sluggify(i.name) === slug);
}

/**
 * Gets the preferred pay method of an actor.
 * 
 * @param {ActorPF2e} actor The actor whose preferred pay method to check.
 * @returns {"fullCoin" | "preferCoin" | "preferTrove" | "fullTrove" | "free"} The preferred pay method.
 */
export function getPreferredPayMethod(actor) {
    return actor.getFlag(MODULE_NAME, "preferredPayMethod") ?? "fullCoin";
}

/**
 * Sets the preferred pay method of an actor.
 * 
 * @param {ActorPF2e} actor The actor whose preferred pay method to set. 
 * @param {"fullCoin" | "preferCoin" | "preferTrove" | "fullTrove" | "free"} preferredPayMethod The preferred pay method.
 */
export async function setPreferredPayMethod(actor, preferredPayMethod = "fullCoin") {
    await actor.update({ [`flags.${MODULE_NAME}.preferredPayMethod`]: preferredPayMethod });
}

/// Quick and easy way to localise stuff.
export const localise = (key, data = null) => game.i18n.format("PF2E-HEROIC-CRAFTING-AUTOMATION." + key, data)