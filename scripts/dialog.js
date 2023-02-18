import { subtractCoins } from "./coins.js";
import { spendingLimit } from "./constants.js";

export async function projectBeginDialog(itemDetails) {
    const item = await fromUuid(itemDetails.UUID);
    const maxCost = game.pf2e.Coins.fromPrice(item.price, itemDetails.batchSize || 1).scale(0.5);

    return await Dialog.wait({
        title: "Begin A Project",
        content: `
                <section>
                    <h1>Begin A Project</h1>
                </section>
                <section>
                    Current project: <strong>${item.name}</strong>
                </section>
                <section>
                    <span>Remaining spending: </span>
                    <strong class="remaining-spending">${maxCost}</strong>
                    <input type="text" id="spending-amount">
                </section>
                <br/>
            `,
        buttons: {
            ok: {
                label: "Begin Project",
                icon: "<i class='fa-solid fa-hammer'></i>",
                callback: (html) => {
                    return {
                        startingProgress: game.pf2e.Coins.fromString($(html).find("#spending-amount")[0].value).copperValue
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
                        $(event.target).parent().parent().siblings(".dialog-buttons").find(".ok").attr("disabled", "true");
                        $(event.target).siblings(".remaining-spending").html("Overspending!");
                    } else {
                        $(event.target).parent().parent().siblings(".dialog-buttons").find(".ok").removeAttr("disabled");
                        $(event.target).siblings(".remaining-spending").html(remainingSpending.toString());
                    }
                });
        },
    }, { width: 250 });
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
                            Current project: <strong>${item.name}</strong>
                        </section>
                        <section>
                            Maximum Cost: <strong id="maxCost">0 gp</strong>
                        </section>
                    </body>
                    <div class="form-group">
                        <label for="craftDuration">Crafting duration:</label>
                        <select autofocus id="craftDuration" name="craftDuration">
                            <option value="hour">Hour</option>
                            <option value="day">Day</option>
                            <option value="week">Week</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="overtimePenalty">Overtime penalty:</label>
                        <select id="overtimePenalty" name="overtimePenalty">
                            <option value=0>No overtime</option>
                            <option value=-5>-5</option>
                            <option value=-10>-10</option>
                        </select>
                    </div>
                </form>
            `,
        buttons: {
            ok: {
                label: "Craft Project",
                icon: "<i class='fa-solid fa-hammer'></i>",
                callback: (html) => {
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