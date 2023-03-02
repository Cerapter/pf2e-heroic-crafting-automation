import { subtractCoins } from "./coins.js";
import { spendingLimit } from "./constants.js";

const paymentOptionHtml = `<div class="form-group">
    <label for="pay-method">Pay Method:</label>
    <select id="pay-method" name="pay-method">
        <option value="fullCoin" selected>Coins only</option>
        <option value="preferCoin">Coins, then Troves</option>
        <option value="preferTrove">Troves, then coins</option>
        <option value="fullTrove">Material Troves only</option>
        <option value="free">Free</option>
    </select>
</div>`;

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
                    </body>
                    <div class="form-group">
                        <span>Current Project:</span>
                        <strong>${item.name}</strong>
                    </div>
                    <div class="form-group">
                        <span>Remaining Spending:</span>
                        <strong class="remaining-spending">${maxCost}</strong>
                    </div>
                    <div class="form-group">
                        <label for="spending-amount">Spent Materials:</label>
                        <input type="text" id="spending-amount" name="spending-amount">
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
                        startingProgress: game.pf2e.Coins.fromString($(html).find("#spending-amount")[0].value).copperValue,
                        payMethod: $(html).find("#pay-method")[0].value
                    };
                }
            },
            cancel: {
                label: "Cancel",
                icon: "<i class='fa-solid fa-ban'></i>",
            }
        },
        default: "cancel",
        render: ([content]) => {
            content
                .querySelector("[id=spending-amount]")
                .addEventListener("keyup", (event) => {
                    const currentSpending = game.pf2e.Coins.fromString(event.target.value);
                    const remainingSpending = subtractCoins(maxCost, currentSpending);

                    if (remainingSpending.copperValue < 0) {
                        $(event.target).parent().parent().parent().siblings(".dialog-buttons").find(".ok").attr("disabled", "true");
                        $(event.target).parent().parent().find(".remaining-spending").html("Overspending!");
                    } else {
                        $(event.target).parent().parent().parent().siblings(".dialog-buttons").find(".ok").removeAttr("disabled");
                        $(event.target).parent().parent().find(".remaining-spending").html(remainingSpending.toString());
                    }
                });
        },
    }, { width: 350 });
}

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
                            Maximum Cost: <strong id="maxCost">0 gp</strong>
                        </section>
                    </body>
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
                        payMethod: $(html).find("#pay-method")[0].value
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
        default: "cancel",
        render: ([content]) => {
            content
                .querySelector("[id=craftDuration]")
                .addEventListener("change", (event) => {
                    const maxCost = spendingLimit(event.target.value, actor.level);
                    $(event.target).parent().parent().find("[id=maxCost]").html(maxCost.toString());
                });

            const maxCost = spendingLimit("Hour", actor.level);
            content
                .querySelector("[id=maxCost]").innerHTML = maxCost;
        },
    });
}