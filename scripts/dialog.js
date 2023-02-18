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
                    <span>Spending: </span>
                    <strong class="current-spending">0 gp</strong> / <span>${maxCost}</span>
                    <input type="range" id="spending-range" min="0" max="100" value="0">
                </section>
            `,
        buttons: {
            ok: {
                label: "Begin Project",
                icon: "<i class='fa-solid fa-hammer'></i>",
                callback: (html) => {
                    return {
                        startingProgress: game.pf2e.Coins.fromString($(html).find(".current-spending").html()).copperValue
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
                .querySelector("[id=spending-range]")
                .addEventListener("change", (event) => {
                    const curVal = maxCost.scale(event.target.value).scale(0.01);
                    $(event.target).siblings(".current-spending").html(curVal.toString());
                });
        },
    }, { width: 250 });
}