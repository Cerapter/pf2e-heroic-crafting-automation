// Shit that the system was too lazy to implement

/**
 * Converts a value in copper (so like, `1234`) to a Coins object where it tries to match the various denominations.
 * 
 * @param {number} copperValue A numerical value, usually the copperValue getter of a Coins object.
 * @param {boolean} ignorePlatinums Defaults to true, and if so, will not attempt to convert to platinums. 
 * PF2E keeps to gold usually as the highest denomination.
 * @returns {game.pf2e.Coins} A Coins object with values divided as best as possible amongst the denominations.
 */
export function normaliseCoins(copperValue, ignorePlatinums = true) {
    const pp = ignorePlatinums ? 0 : Math.floor(copperValue / 1000);
    const gp = Math.floor(copperValue / 100) - pp * 10;
    const sp = Math.floor(copperValue / 10) - pp * 100 - gp * 10;
    const cp = copperValue - pp * 1000 - gp * 100 - sp * 10;

    return new game.pf2e.Coins({
        pp,
        gp,
        sp,
        cp
    });
}

/**
 * Given two Coins objects, subtracts one from the other.
 * I tried game.pf2e.Coins.add() with negatives, but it gives back denominations with minus values. :weary:
 * 
 * @param {game.pf2e.Coins} minuend The Coins object that you are subtracting from. 
 * @param {game.pf2e.Coins} subtrahend The Coins object that you are substracting.
 * @returns {game.pf2e.Coins | null} A new Coins object that is the difference of the minuend and subtrahend.
 * Returns null if the value would be negative because of a new PR to the system that literally stops you from
 * making negative Coins.
 */
export function subtractCoins(minuend, subtrahend) {
    const copperValue = minuend.copperValue - subtrahend.copperValue;
    return copperValue >= 0 ? normaliseCoins(copperValue) : null;
}