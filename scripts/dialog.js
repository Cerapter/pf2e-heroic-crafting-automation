import { subtractCoins } from "./coins.js";

export async function projectBeginDialog(itemDetails) {
    const item = await fromUuid(itemDetails.UUID);
    const maxCost = game.pf2e.Coins.fromPrice(item.price, itemDetails.batchSize || 1).scale(0.5);

    return await Dialog.wait({
        title: "Begin A Project",
        content: `
                <section>
                    <h1>Begin A Project</h1>
                </section>
                <section class="drop-item-zone">
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