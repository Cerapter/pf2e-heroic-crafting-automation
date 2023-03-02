import { subtractCoins } from "./coins.js";
import { MODULE_NAME, spendingLimit } from "./constants.js";

export function getTroves(actor) {
    return actor.itemTypes.equipment.filter(equipment => equipment.flags[MODULE_NAME].isMaterialTrove == true);
}

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

export function changeTroveValue(troveLevel, newValue) {
    // Level 3, newValue: 10 sp || 8 sp one L
    const oneLbulk = spendingLimit("hour", troveLevel);
    const bulk = newValue.copperValue / oneLbulk.copperValue;
    const roundedBulk = Math.floor(bulk);

    return {
        quantity: roundedBulk,
        leftovers: subtractCoins(newValue, oneLbulk.scale(roundedBulk))
    }
}

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