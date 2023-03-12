import { normaliseCoins, subtractCoins } from "./coins.js";
import { CheckFeat, getPreferredPayMethod, MODULE_NAME, spendingLimit } from "./constants.js";

/**
 * Generates a form group HTML for choosing a paying method (for beginning or crafting projets).
 * 
 * @param {"fullCoin" | "preferCoin" | "preferTrove" | "fullTrove" | "free"} preferredDefault One of the potential pay methods.
 * @returns {string} The generated form group HTML.
 */
async function getPaymentOptionHTML(preferredDefault = "fullCoin") {
    const paymentOptions = [
        { id: "fullCoin", text: "Coins only", selected: preferredDefault === "fullCoin" },
        { id: "preferCoin", text: "Coins, then Troves", selected: preferredDefault === "preferCoin" },
        { id: "preferTrove", text: "Troves, then coins", selected: preferredDefault === "preferTrove" },
        { id: "fullTrove", text: "Material Troves only", selected: preferredDefault === "fullTrove" },
        { id: "free", text: "Free", selected: preferredDefault === "free" },
    ];

    return await renderTemplate(`modules/${MODULE_NAME}/templates/pay-method.hbs`, { paymentOptions });
}

/**
 * Creates a dialog 
 * 
 * @param {Object} itemDetails The details of the item to make a project of.
 * @param {string} itemDetails.UUID The UUID of the item.
 * @param {number} itemDetails.batchSize The size of the batch of the item being crafted.
 * Usually 1, 4 or 10, but feats can change this.
 * @param {number} itemDetails.DC The crafting DC of the item.
 * @param {"fullCoin" | "preferCoin" | "preferTrove" | "fullTrove" | "free"} preferredPayMethod The preferred pay method of the crafter.
 * @returns {{startingProgress: game.pf2e.Coins, 
 * payMethod: "fullCoin" | "preferCoin" | "preferTrove" | "fullTrove" | "free"} | "cancel"} 
 * An anonymous struct of two values.  
 * - `startingProgress` is the Coins object of the project's starting Current Value.
 * - `payMethod` is the choice of how said starting progress should be paid -- see payWithCoinsAndTrove()
 * 
 * Alternatively, the dialog can return "cancel" if the user pressed the Cancel button.
 */
export async function projectBeginDialog(itemDetails, preferredPayMethod = "fullCoin") {
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
                    ${await getPaymentOptionHTML(preferredPayMethod)}
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
 * spendingAmount: game.pf2e.Coins,
 * customValues: {name: string, value: boolean}[]} |{}} 
 * An anonymous struct of four values.  
 * - `duration` determines for how long the crafting activity continues.  
 * - `overtime` is the Overtime penalty the crafting activity is taking.  
 * - `payMethod` is the choice of how the crafting activity should be paid for -- see payWithCoinsAndTrove()  
 * - `spendingAmount` is the Coin the activity will cost.
 * - `customValues` is an array of name-value pairs that were gathered from additional configurations given by feats.
 * 
 * Alternatively, if cancelled, the dialog will return an empty struct.
 */
export async function projectCraftDialog(actor, itemDetails) {
    const item = await fromUuid(itemDetails.UUID);
    const extraHTML = [];
    const extraRender = [];
    let spendingLimitMultiplier = 1;

    // TODO: Lift this feat checking part out.
    if (CheckFeat(actor, "hyperfocus")) {
        extraHTML.push(`
        <div class="form-group extra-craft-modifiers">
            <label for="hyperfocus">Hyperfocus:</label>
            <input type="checkbox" id="hyperfocus" name="hyperfocus" checked disabled>
        </div>
        <p class="notes">Applies while you have the feat. Make more progress on critical successes on a check to Craft a Project for at least a day.</p>
        `)
    }

    if (CheckFeat(actor, "midnight-crafting")) {
        extraHTML.push(`
        <div class="form-group extra-craft-modifiers">
            <label for="midnightCrafting">Midnight Crafting:</label>
            <input type="checkbox" id="midnightCrafting" name="midnightCrafting">
        </div>
        <p class="notes" id="midnightCraftingNotes">Craft in 10 minutes. No rush surcharge.</p>
        `);

        extraRender.push(
            (content) => {
                content
                    .querySelector("[id=midnightCrafting]")
                    .addEventListener("change", (event) => {
                        const rushCost = game.pf2e.Coins.fromString($(event.target).parent().parent().find("[id=spendingAmount]").val());

                        if (event.target.checked === true) {
                            $(event.target).parent().siblings("[id=midnightCraftingNotes]").html(`Craft in 10 minutes. Pay extra ${rushCost.toString()} in rush costs.`);
                        } else {
                            $(event.target).parent().siblings("[id=midnightCraftingNotes]").html(`Craft in 10 minutes. No rush surcharge.`);
                        }
                    });

                content
                    .querySelector("[id=spendingAmount]")
                    .addEventListener("keyup", (event) => {
                        event.target.parentElement.parentElement.querySelector("#midnightCrafting").dispatchEvent(new Event("change"));
                    });
            }
        )
    }

    if (CheckFeat(actor, "natural-born-tinker")) {
        extraHTML.push(`
        <div class="form-group extra-craft-modifiers">
            <label for="naturalBornTinker">Natural-Born Tinker:</label>
            <input type="checkbox" id="naturalBornTinker" name="naturalBornTinker">
        </div>
        <p class="notes">Craft with Survival instead of Crafting?</p>
        `);
    }

    if (CheckFeat(actor, "efficient-crafting")) {
        extraHTML.push(`
        <div class="form-group extra-craft-modifiers">
            <label for="efficientCrafting">Efficient Crafting:</label>
            <input type="checkbox" id="efficientCrafting" name="efficientCrafting">
        </div>
        <p class="notes">Recover materials on a failure? (Check manually if applies!)</p>
        `);
    }

    if (CheckFeat(actor, "quick-crafting")) {
        extraHTML.push(`
        <div class="form-group extra-craft-modifiers">
            <label for="quickCrafting">Quick Crafting:</label>
            <input type="checkbox" id="quickCrafting" name="quickCrafting">
        </div>
        <p class="notes">Double the spending limit?</p>
        `);

        extraRender.push(
            (content) => {
                content
                    .querySelector("[id=quickCrafting]")
                    .addEventListener("change", (event) => {
                        spendingLimitMultiplier = event.target.checked ? 2 : 1;
                        event.target.parentElement.parentElement.querySelector("#craftDuration").dispatchEvent(new Event("change"));
                    });
            }
        )
    }

    // Purely a fancy thing, but add a horizontal line in front of the custom feat stuff if there is any.
    if (extraHTML.length > 0) {
        extraHTML.unshift(`<hr>`);
    }

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
                    ${await getPaymentOptionHTML(getPreferredPayMethod(actor))}
                    ${extraHTML.join('\n')}
                </form>
            `,
        buttons: {
            ok: {
                label: "Craft Project",
                icon: "<i class='fa-solid fa-hammer'></i>",
                callback: (html) => {
                    const customValues = [];

                    $(html).find(".extra-craft-modifiers input").each(function () {
                        const input = $(this)[0];

                        customValues.push({
                            name: input.name,
                            value: input.checked
                        });
                    });

                    return {
                        duration: $(html).find("#craftDuration")[0].value,
                        overtime: Number($(html).find("#overtimePenalty")[0].value) || 0,
                        payMethod: $(html).find("#payMethod")[0].value,
                        spendingAmount: game.pf2e.Coins.fromString($(html).find("#spendingAmount")[0].value),
                        customValues
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
                    const maxCost = normaliseCoins(spendingLimit(event.target.value, actor.level).scale(itemDetails.batchSize).scale(spendingLimitMultiplier).copperValue);
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

            extraRender.forEach((renderCommand) => renderCommand(content));

            const maxCost = spendingLimit("Hour", actor.level).scale(itemDetails.batchSize);
            content
                .querySelector("[id=maxCost]").innerHTML = maxCost;
            content
                .querySelector("[id=remainingMaterials]").innerHTML = maxCost;
        },
    });
}

/**
 * Edits a project.
 * 
 * @param {Object} projectDetails The project being edit.
 * @param {string} projectDetails.ID The UUID of the project itself.
 * @param {string} projectDetails.ItemUUID The UUID of the item specifically.
 * @param {number} projectDetails.progressInCopper The current progress on the project, measured in copper.
 * @param {number} projectDetails.batchSize The amount of items being made at once.
 * Usually relevant for consumables more, and is 1 for permanent items. 
 * @param {number} projectDetails.DC The Crafting DC of the project. 
 */
export async function projectEditDialog(projectDetails) {
    const item = await fromUuid(projectDetails.ItemUUID);


    return await Dialog.wait({
        title: "Edit Project Details",
        content: `
                <form>
                    <body>
                        <section>
                            <h1>Edit Project Details</h1>
                        </section>
                        <section>
                            <span>Current Project:</span> <strong>${item.name}</strong>
                        </section>
                    </body>
                    <div class="form-group">
                        <label for="currentProgress">Current Progress:</label>
                        <input type="text" id="currentProgress" name="currentProgress" placeholder="0 gp" value="${normaliseCoins(projectDetails.progressInCopper).toString()}">
                    </div>
                    <div class="form-group">
                        <label for="DC">DC:</label>
                        <input type="number" name="DC" id="DC" value=${projectDetails.DC} min=0 step=1>
                    </div>
                    <div class="form-group">
                        <label for="batchSize">Batch size:</label>
                        <input type="number" name="batchSize" id="batchSize" value=${projectDetails.batchSize} min=1 step=1>
                    </div>
                </form>
            `,
        buttons: {
            ok: {
                label: "Confirm Changes",
                icon: "<i class='fas fa-edit fa-1x fa-fw'></i>",
                callback: (html) => {

                    return {
                        progressInCopper: game.pf2e.Coins.fromString($(html).find("#currentProgress")[0].value).copperValue || -1,
                        DC: Number($(html).find("#DC")[0].value) || -1,
                        batchSize: Number($(html).find("#batchSize")[0].value) || -1,
                    };
                }
            },
            cancel: {
                label: "Cancel",
                icon: "<i class='fa-solid fa-ban'></i>",
            }
        },
        default: "ok"
    }, { width: 350 });
}