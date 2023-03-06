import { subtractCoins } from "./coins.js";
import { MODULE_NAME, spendingLimit } from "./constants.js";

/**
 * Iterates through an actor's inventory, returning all available Material Troves.
 * 
 * @param {ActorPF2e} actor The actor whose inventory to look through.
 * @returns {EquipmentPF2e[]} An array of Material Troves. Can be empty.
 */
export function getTroves(actor) {
    return actor.itemTypes.equipment.filter(equipment => equipment.flags[MODULE_NAME] && equipment.flags[MODULE_NAME].isMaterialTrove == true);
}

/**
 * Summarises the values of an array of Material Troves. Accounts for leftovers too.
 * 
 * @param {EquipmentPF2e[]} troves An array of equipment who (presumably) all have the `isMaterialTrove` flag -- though this is actually not mandatory.
 * @returns {game.pf2e.Coins} A Coins object of the accumulated overall value.
 */
export function getTroveValue(troves) {
    let accumulatedValue = new game.pf2e.Coins();

    troves.map(trove => {
        return game.pf2e.Coins.fromPrice(trove.system.price, trove.system.quantity)
            .add(game.pf2e.Coins.fromString(trove.flags[MODULE_NAME]?.leftovers || "0 gp"))
    }).forEach(indVal => {
        accumulatedValue = accumulatedValue.add(indVal);
    });

    return accumulatedValue;
}

/**
 * A convenience function that suggests the Bulk of a Material Trove of a given level to represent a material value, marking any leftovers.
 * 
 * @param {number} troveLevel The level of the Material Trove. Determines how much value can be "packed" inside one Bulk.
 * @param {game.pf2e.Coins} newValue The value the Material Trove should represent. 
 * @returns {{quantity: number, leftovers: game.pf2e.Coins}} An anonymous struct of two values.  
 * - `quantity` measures the Bulk the trove should be, with the tens being actual Bulk values, and the ones being X amount of Light Bulk (so, `quantity = 14` would be 1 + 4L Bulk).  
 * - `leftovers` is the amount of Coins that could not be neatly fit into the Bulk, and should be kept track of separately.
 */
export function changeTroveValue(troveLevel, newValue) {
    const oneLbulk = spendingLimit("hour", troveLevel);
    const bulk = newValue.copperValue / oneLbulk.copperValue;
    const roundedBulk = Math.floor(bulk);

    return {
        quantity: roundedBulk,
        leftovers: subtractCoins(newValue, oneLbulk.scale(roundedBulk))
    }
}

/**
 * Determines if a certain cost could be paid with the value contained in Material Troves.
 * 
 * @param {EquipmentPF2e[]} troves The array of Material Troves to use to pay the cost. 
 * @param {game.pf2e.Coins} CoinsToPay The Coins object of the cost to pay.
 * @param {boolean} fullCommit Defaults to true. If it's true, the function will prematurely quit if it cannot pay the full cost. If false, it will pay as much as it can, and report back that it CAN pay the cost (even if it cannot in actuality).
 * @returns {{canPay: boolean, updates: EmbeddedDocumentUpdateData[]}} An anonymous struct of two values.  
 * - `canPay` is true if the Material Troves can be used to pay the cost (most of the time, see `fullCommit`).  
 * - `updates` is an array of embedded item updates that remove value from the Material Troves, to be called at the caller's leisure with actor.updateEmbeddedDocuments("Item", updates).
 */
export function payWithTroves(troves, CoinsToPay, fullCommit = true) {
    let updates = [];
    let remainingPayment = CoinsToPay;

    if (subtractCoins(getTroveValue(troves), CoinsToPay).copperValue < 0 && fullCommit) {
        return {
            canPay: false,
            updates
        };
    }

    let troveSummaries = troves.map(trove => {
        return {
            id: trove.id,
            level: trove.level,
            quantity: trove.quantity,
            value: getTroveValue([trove])
        };
    }).sort((a, b) =>
        a.level - b.level
    );

    let i = 0;
    while (i < troveSummaries.length && remainingPayment.copperValue > 0) {
        const removeFromTrove = subtractCoins(troveSummaries[i].value, remainingPayment).copperValue < 0 ? troveSummaries[i].value : remainingPayment;
        const remainsInTrove = subtractCoins(troveSummaries[i].value, removeFromTrove);
        const newTroveData = changeTroveValue(troveSummaries[i].level, remainsInTrove);

        remainingPayment = subtractCoins(remainingPayment, removeFromTrove);

        updates.push({
            _id: troveSummaries[i].id,
            "system.quantity": newTroveData.quantity,
            [`flags.${MODULE_NAME}.leftovers`]: newTroveData.leftovers.toString()
        });

        i++;
    }

    if (remainingPayment.copperValue > 0 && fullCommit) {
        return {
            canPay: false,
            updates: []
        };
    } else {
        return {
            canPay: true,
            updates
        };
    }
}

/**
 * Determines of a cost could be paid with Material Troves, Coins, or a mix of both.
 * 
 * @param {"fullCoin" | "preferCoin" | "preferTrove" | "fullTrove" | "free"} paymentOption Determines what should be the preferred way of handling the cost.  
 * - `fullCoin` will only attempt to pay the cost in coins.
 * - `preferCoin` will attempt to pay the cost in coins, then if that's not enough, will attempt to pay the remainder with Material Troves.
 * - `preferTrove` is the reverse of the above.
 * - `fullTrove` will only attempt to pay with Material Troves. This is quite literally just payWithTroves().
 * - `free` ignores the costs altogether, and will always "pay" them.
 * @param {game.pf2e.Coins} actorCoins The Coins object to use when paying with coins. Doesn't actually have to come from an actor.
 * @param {EquipmentPF2e[]} troves An array of equipment with the isMaterialTrove flag (but doesn't actually have to be that). 
 * @param {game.pf2e.Coins} costCoins The Coins object of the cost that must be paid. 
 * @returns {{canPay: boolean, removeCopper: number, troveUpdates: EmbeddedDocumentUpdateData[]}} An anonymous struct of three values.  
 * - `canPay` is true if the cost could be paid using the `paymentOption`.  
 * - `removeCopper` is the amount of copper to remove from the (presumed) actor.
 * - `troveUpdates` is almost literally payWithTroves()'s `updates`, see that for more details.
 */
export function payWithCoinsAndTrove(paymentOption, actorCoins, troves, costCoins) {
    let canPay = false;
    let removeCopper = 0;
    let troveUpdates = [];

    switch (paymentOption) {
        case "fullCoin":
            {
                const payment = subtractCoins(costCoins, actorCoins);
                if (payment.copperValue <= 0) {
                    canPay = true;
                    removeCopper = costCoins.copperValue;
                }
            }
            break;
        case "preferCoin":
            {
                const payment = subtractCoins(costCoins, actorCoins);
                if (payment.copperValue <= 0) {
                    canPay = true;
                    removeCopper = costCoins.copperValue;
                } else {
                    const canPayTrove = payWithTroves(troves, payment);
                    canPay = canPayTrove.canPay;
                    troveUpdates = canPayTrove.updates;
                    removeCopper = canPay ? costCoins.copperValue : 0;
                }
            }
            break;
        case "preferTrove":
            {
                const payment = payWithTroves(troves, costCoins);

                if (payment.canPay) {
                    canPay = payment.canPay;
                    troveUpdates = payment.updates;
                } else {
                    const partialPayment = payWithTroves(troves, costCoins, false);
                    const coinsNeeded = subtractCoins(costCoins, getTroveValue(troves));

                    if (subtractCoins(coinsNeeded, actorCoins).copperValue <= 0) {
                        canPay = true;
                        removeCopper = coinsNeeded.copperValue;
                        troveUpdates = partialPayment.updates;
                    }
                }
            }
            break;
        case "fullTrove":
            {
                const canPayTrove = payWithTroves(troves, costCoins);
                canPay = canPayTrove.canPay;
                troveUpdates = canPayTrove.updates;
            }
            break;
        case "free":
            {
                canPay = true;
            }
        default:
            break;
    }

    return {
        canPay,
        removeCopper,
        troveUpdates
    };
}