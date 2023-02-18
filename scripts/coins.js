// Shit that the system was too lazy to implement

/// Converts a value in copper (so like, `1234`) to a Coins object where it tries to match the various denominations.
export function normaliseCoins(copperValue) {
    const pp = Math.floor(copperValue / 1000);
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

/// Given two Coins objects, subtracts one from the other.
export function subtractCoins(minuend, subtrahend) {
    return normaliseCoins(minuend.copperValue - subtrahend.copperValue);
}