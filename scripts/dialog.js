import { normaliseCoins, subtractCoins } from "./coins.js";
import { spendingLimit } from "./constants.js";

/** A quick HTML piece for the whole prefer coins / prefer trove thing. @see payWithCoinsAndTrove() */
const paymentOptionHtml = `<div class="form-group">
    <label for="payMethod">Pay Method:</label>
    <select id="payMethod" name="payMethod">
        <option value="fullCoin" selected>Coins only</option>
        <option value="preferCoin">Coins, then Troves</option>
        <option value="preferTrove">Troves, then coins</option>
        <option value="fullTrove">Material Troves only</option>
        <option value="free">Free</option>
    </select>
</div>`;

/**
 * Creates a dialog 
 * 
 * @param {Object} itemDetails The details of the item to make a project of.
 * @param {string} itemDetails.UUID The UUID of the item.
 * @param {number} itemDetails.batchSize The size of the batch of the item being crafted.
 * Usually 1, 4 or 10, but feats can change this.
 * @param {number} itemDetails.DC The crafting DC of the item.
 * @returns {{startingProgress: game.pf2e.Coins, 
 * payMethod: "fullCoin" | "preferCoin" | "preferTrove" | "fullTrove" | "free"} | "cancel"} 
 * An anonymous struct of two values.  
 * - `startingProgress` is the Coins object of the project's starting Current Value.
 * - `payMethod` is the choice of how said starting progress should be paid -- see payWithCoinsAndTrove()
 * 
 * Alternatively, the dialog can return "cancel" if the user pressed the Cancel button.
 */
export async function projectBeginDialog(itemDetails) {
    const item = await fromUuid(itemDetails.UUID);
    const maxCost = game.pf2e.Coins.fromPrice(item.price, itemDetails.batchSize || 1).scale(0.5);

    return await Dialog.wait({
        title: "Begin A Project",
        content: `
                <form>
                    <body>
                        <section>
                            <h1>Begin A Project</h1>
                        </section>
                        <section>
                            <span>Current Project:</span> <strong>${item.name}</strong>
                        </section>
                        <section>
                            Remaining Materials / Maximum Cost: <span id="spanNotOverspending"><strong id="remainingMaterials">0 gp</strong> / <strong id="maxCost">0 gp</strong></span><span id="spanOverspending" hidden><strong style="color: red">OVERSPENDING!</strong></span>
                        </section>
                    </body>
                    <div class="form-group">
                        <label for="spendingAmount">Spent Materials:</label>
                        <input type="text" id="spendingAmount" name="spendingAmount" placeholder="0 gp">
                    </div>
                    ${paymentOptionHtml}
                </form>
            `,
        buttons: {
            ok: {
                label: "Begin Project",
                icon: "<i class='fa-solid fa-hammer'></i>",
                callback: (html) => {
                    return {
                        startingProgress: game.pf2e.Coins.fromString($(html).find("#spendingAmount")[0].value).copperValue,
                        payMethod: $(html).find("#payMethod")[0].value
                    };
                }
            },
            cancel: {
                label: "Cancel",
                icon: "<i class='fa-solid fa-ban'></i>",
            }
        },
        default: "ok",
        render: ([content]) => {
            content
                .querySelector("[id=spendingAmount]")
                .addEventListener("keyup", (event) => {
                    const currentSpending = game.pf2e.Coins.fromString(event.target.value);
                    const remainingSpending = subtractCoins(maxCost, currentSpending);

                    const form = $(event.target).parent().parent();
                    form.find("[id=remainingMaterials]").html(remainingSpending.toString());

                    if (remainingSpending.copperValue < 0) {
                        $(event.target).parent().parent().parent().siblings(".dialog-buttons").find(".ok").attr("disabled", "true");
                        form.find("[id=spanNotOverspending]").attr("hidden", true);
                        form.find("[id=spanOverspending]").removeAttr("hidden");
                    } else {
                        $(event.target).parent().parent().parent().siblings(".dialog-buttons").find(".ok").removeAttr("disabled");
                        form.find("[id=spanNotOverspending]").removeAttr("hidden");
                        form.find("[id=spanOverspending]").attr("hidden", true);
                    }
                });

            content
                .querySelector("[id=maxCost]").innerHTML = maxCost;
            content
                .querySelector("[id=remainingMaterials]").innerHTML = maxCost;
        },
    }, { width: 350 });
}

/**
 * 
 * @param {ActorPF2e} actor 
 * @param {Object} itemDetails The details of the item to make a project of.
 * @param {string} itemDetails.UUID The UUID of the item.
 * @param {string} itemDetails.projectUUID The UUID of the project itself. Unused.
 * @param {number} itemDetails.batchSize The size of the batch of the item being crafted. 
 * Usually 1, 4 or 10, but feats can change this.
 * @returns {{duration: "hour" | "day" | "week", 
 * overtime: 0 | -5 | -10, 
 * payMethod: "fullCoin" | "preferCoin" | "preferTrove" | "fullTrove" | "free", 
 * spendingAmount: game.pf2e.Coins} |{}} 
 * An anonymous struct of four values.  
 * - `duration` determines for how long the crafting activity continues.  
 * - `overtime` is the Overtime penalty the crafting activity is taking.  
 * - `payMethod` is the choice of how the crafting activity should be paid for -- see payWithCoinsAndTrove()  
 * - `spendingAmount` is the Coin the activity will cost.
 * 
 * Alternatively, if cancelled, the dialog will return an empty struct.
 */
export async function projectCraftDialog(actor, itemDetails) {
    const item = await fromUuid(itemDetails.UUID);

    return await Dialog.wait({
        title: "Craft A Project",
        content: `
                <form>
                    <body>
                        <section>
                            <h1>Craft A Project</h1>
                        </section>
                        <section>
                            Current Project: <strong>${item.name}</strong>
                        </section>
                        <section>
                            Remaining Materials / Maximum Cost: <span id="spanNotOverspending"><strong id="remainingMaterials">0 gp</strong> / <strong id="maxCost">0 gp</strong></span><span id="spanOverspending" hidden><strong style="color: red">OVERSPENDING!</strong></span>
                        </section>
                    </body>
                    <div class="form-group">
                        <label for="spendingAmount">Spent Materials:</label>
                        <input type="text" id="spendingAmount" name="spendingAmount" placeholder="0 gp">
                    </div>
                    <div class="form-group">
                        <label for="craftDuration">Crafting Duration:</label>
                        <select autofocus id="craftDuration" name="craftDuration">
                            <option value="hour">Hour</option>
                            <option value="day">Day</option>
                            <option value="week">Week</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="overtimePenalty">Overtime Penalty:</label>
                        <select id="overtimePenalty" name="overtimePenalty">
                            <option value=0>No overtime</option>
                            <option value=-5>-5</option>
                            <option value=-10>-10</option>
                        </select>
                    </div>
                    ${paymentOptionHtml}
                </form>
            `,
        buttons: {
            ok: {
                label: "Craft Project",
                icon: "<i class='fa-solid fa-hammer'></i>",
                callback: (html) => {
                    return {
                        duration: $(html).find("#craftDuration")[0].value,
                        overtime: Number($(html).find("#overtimePenalty")[0].value) || 0,
                        payMethod: $(html).find("#payMethod")[0].value,
                        spendingAmount: game.pf2e.Coins.fromString($(html).find("#spendingAmount")[0].value)
                    };
                }
            },
            cancel: {
                label: "Cancel",
                icon: "<i class='fa-solid fa-ban'></i>",
                callback: (html) => {
                    return {};
                }
            }
        },
        default: "ok",
        render: ([content]) => {

            content
                .querySelector("[id=craftDuration]")
                .addEventListener("change", (event) => {
                    const maxCost = normaliseCoins(spendingLimit(event.target.value, actor.level).scale(itemDetails.batchSize).copperValue);
                    $(event.target).parent().parent().find("[id=maxCost]").html(maxCost.toString());

                    event.target.parentElement.parentElement.querySelector("#spendingAmount").dispatchEvent(new Event("keyup"));
                });

            content
                .querySelector("[id=spendingAmount]")
                .addEventListener("keyup", (event) => {
                    const maxCost = game.pf2e.Coins.fromString($(event.target).parent().parent().find("[id=maxCost]").html());
                    const currentSpending = game.pf2e.Coins.fromString(event.target.value);
                    const remainingSpending = subtractCoins(maxCost, currentSpending);

                    const form = $(event.target).parent().parent();
                    form.find("[id=remainingMaterials]").html(remainingSpending.toString());

                    if (remainingSpending.copperValue < 0) {
                        $(event.target).parent().parent().parent().siblings(".dialog-buttons").find(".ok").attr("disabled", "true");
                        form.find("[id=spanNotOverspending]").attr("hidden", true);
                        form.find("[id=spanOverspending]").removeAttr("hidden");
                    } else {
                        $(event.target).parent().parent().parent().siblings(".dialog-buttons").find(".ok").removeAttr("disabled");
                        form.find("[id=spanNotOverspending]").removeAttr("hidden");
                        form.find("[id=spanOverspending]").attr("hidden", true);
                    }
                });

            const maxCost = spendingLimit("Hour", actor.level).scale(itemDetails.batchSize);
            content
                .querySelector("[id=maxCost]").innerHTML = maxCost;
            content
                .querySelector("[id=remainingMaterials]").innerHTML = maxCost;
        },
    });
}