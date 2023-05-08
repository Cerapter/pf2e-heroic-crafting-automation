import { normaliseCoins, subtractCoins } from "./coins.js";
import { CheckFeat, getPreferredPayMethod, localise, MODULE_NAME, spendingLimit } from "./constants.js";

/**
 * Generates a form group HTML for choosing a paying method (for beginning or crafting projets).
 * 
 * @param {"fullCoin" | "preferCoin" | "preferTrove" | "fullTrove" | "free"} preferredDefault One of the potential pay methods.
 * @returns {string} The generated form group HTML.
 */
async function getPaymentOptionHTML(preferredDefault = "fullCoin") {
    const paymentOptions = [
        { id: "fullCoin", text: localise("ProjectManagement.FullCoin"), selected: preferredDefault === "fullCoin" },
        { id: "preferCoin", text: localise("ProjectManagement.PreferCoin"), selected: preferredDefault === "preferCoin" },
        { id: "preferTrove", text: localise("ProjectManagement.PreferTrove"), selected: preferredDefault === "preferTrove" },
        { id: "fullTrove", text: localise("ProjectManagement.FullTrove"), selected: preferredDefault === "fullTrove" },
        { id: "free", text: localise("ProjectManagement.Free"), selected: preferredDefault === "free" },
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
        title: localise("ProjectBeginWindow.Title"),
        content: `
                <form>
                    <body>
                        <section>
                            <h1>${localise("ProjectBeginWindow.Title")}</h1>
                        </section>
                        <section>
                            <span>${localise("ProjectManagement.CurrentProject")}</span> <strong>${item.name}</strong>
                        </section>
                        <section>
                            ${localise("ProjectManagement.RemainingMaterials")} / ${localise("ProjectManagement.MaximumCost")}: <span id="spanNotOverspending"><strong id="remainingMaterials">0 gp</strong> / <strong id="maxCost">0 gp</strong></span><span id="spanOverspending" hidden><strong style="color: red">${localise("ProjectManagement.OverspendingWarning")}</strong></span>
                        </section>
                    </body>
                    <div class="form-group">
                        <label for="spendingAmount">${localise("ProjectManagement.SpentMaterialsSoFar")}</label>
                        <input type="text" id="spendingAmount" name="spendingAmount" placeholder="0 gp">
                    </div>
                    ${await getPaymentOptionHTML(preferredPayMethod)}
                </form>
            `,
        buttons: {
            ok: {
                label: localise("ProjectBeginWindow.BeginProjectButton"),
                icon: "<i class='fa-solid fa-hammer'></i>",
                callback: (html) => {
                    return {
                        startingProgress: game.pf2e.Coins.fromString($(html).find("#spendingAmount")[0].value).copperValue,
                        payMethod: $(html).find("#payMethod")[0].value
                    };
                }
            },
            cancel: {
                label: localise("ProjectBeginWindow.CancelButton"),
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
            <label for="hyperfocus">${localise("HardcodedSupport.Hyperfocus.Name")}:</label>
            <input type="checkbox" id="hyperfocus" name="hyperfocus" checked disabled>
        </div>
        <p class="notes">${localise("HardcodedSupport.Hyperfocus.Desc")}</p>
        `)
    }

    if (CheckFeat(actor, "midnight-crafting")) {
        extraHTML.push(`
        <div class="form-group extra-craft-modifiers">
            <label for="midnightCrafting">${localise("HardcodedSupport.MidnightCrafting.Name")}:</label>
            <input type="checkbox" id="midnightCrafting" name="midnightCrafting">
        </div>
        <p class="notes" id="midnightCraftingNotes">${localise("HardcodedSupport.MidnightCrafting.Desc")} ${localise("HardcodedSupport.MidnightCrafting.NoSurcharge")}}</p >
        `);

        extraRender.push(
            (content) => {
                content
                    .querySelector("[id=midnightCrafting]")
                    .addEventListener("change", (event) => {
                        const rushCost = game.pf2e.Coins.fromString($(event.target).parent().parent().find("[id=spendingAmount]").val());

                        if (event.target.checked === true) {
                            $(event.target).parent().siblings("[id=midnightCraftingNotes]").html(
                                localise("HardcodedSupport.MidnightCrafting.Desc").concat(
                                    " ",
                                    localise("HardcodedSupport.MidnightCrafting.Surcharge", {
                                        cost: rushCost.toString()
                                    })
                                )
                            );
                        } else {
                            $(event.target).parent().siblings("[id=midnightCraftingNotes]").html(
                                localise("HardcodedSupport.MidnightCrafting.Desc").concat(
                                    " ",
                                    localise("HardcodedSupport.MidnightCrafting.NoSurcharge")
                                )
                            );
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
        <div class="form-group extra-craft-modifiers" >
            <label for="naturalBornTinker">${localise("HardcodedSupport.NaturalBornTinker.Name")}:</label>
            <input type="checkbox" id="naturalBornTinker" name="naturalBornTinker">
        </div>
        <p class="notes">${localise("HardcodedSupport.NaturalBornTinker.Desc")}</p>
    `);
    }

    if (CheckFeat(actor, "herbalist-dedication")) {
        const isHerbal = (
            item.system.traits.otherTags.includes("herbal") ||
            (item.system.traits.value.includes("alchemical") && item.system.traits.value.includes("healing"))
        );

        const extraHint = isHerbal ?
            localise("HardcodedSupport.HerbalistDedication.CurrentItemIsHerbal") :
            localise("HardcodedSupport.HerbalistDedication.CurrentItemIsNotHerbal");

        extraHTML.push(`
        <div class="form-group extra-craft-modifiers">
            <label for="herbalistDed">${localise("HardcodedSupport.HerbalistDedication.Name")}:</label>
            <input type="checkbox" id="herbalistDed" name="herbalistDed">
        </div>
        <p class="notes">${localise("HardcodedSupport.HerbalistDedication.Desc")}<br>${extraHint}</p>
    `);
    }

    if (CheckFeat(actor, "efficient-crafting")) {
        extraHTML.push(`
        <div class="form-group extra-craft-modifiers">
            <label for="efficientCrafting">${localise("HardcodedSupport.EfficientCrafting.Name")}:</label>
            <input type="checkbox" id="efficientCrafting" name="efficientCrafting">
        </div>
        <p class="notes">${localise("HardcodedSupport.EfficientCrafting.Desc")}</p>
    `);
    }

    if (CheckFeat(actor, "quick-crafting")) {
        extraHTML.push(`
        <div class="form-group extra-craft-modifiers">
            <label for="quickCrafting">${localise("HardcodedSupport.QuickCrafting.Name")}:</label>
            <input type="checkbox" id="quickCrafting" name="quickCrafting">
        </div>
        <p class="notes">${localise("HardcodedSupport.QuickCrafting.Desc")}</p>
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
        title: localise("CraftWindow.Title"),
        content: `
        <form>
                    <body>
                        <section>
                            <h1>${localise("CraftWindow.Title")}</h1>
                        </section>
                        <section>
                            ${localise("ProjectManagement.CurrentProject")}: <strong>${item.name}</strong>
                        </section>
                        <section>
                        ${localise("ProjectManagement.RemainingMaterials")} / ${localise("ProjectManagement.MaximumCost")}: <span id="spanNotOverspending"><strong id="remainingMaterials">0 gp</strong> / <strong id="maxCost">0 gp</strong></span><span id="spanOverspending" hidden><strong style="color: red">${localise("ProjectManagement.OverspendingWarning")}</strong></span>
                        </section>
                    </body>
                    <div class="form-group">
                        <label for="spendingAmount">${localise("ProjectManagement.SpentMaterialsSoFar")}</label>
                        <input type="text" id="spendingAmount" name="spendingAmount" placeholder="0 gp">
                    </div>
                    <div class="form-group">
                        <label for="craftDuration">${localise("CraftWindow.CraftingDuration.Title")}</label>
                        <select autofocus id="craftDuration" name="craftDuration">
                            <option value="hour">${localise("CraftWindow.CraftingDuration.Hour")}</option>
                            <option value="day">${localise("CraftWindow.CraftingDuration.Day")}</option>
                            <option value="week">${localise("CraftWindow.CraftingDuration.Week")}</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="overtimePenalty">${localise("CraftWindow.OvertimePenalty.Title")}</label>
                        <select id="overtimePenalty" name="overtimePenalty">
                            <option value=0>${localise("CraftWindow.OvertimePenalty.NoOvertime")}</option>
                            <option value=-5>-5</option>
                            <option value=-10> -10</option>
                        </select>
                    </div>
                    ${await getPaymentOptionHTML(getPreferredPayMethod(actor))}
                    ${extraHTML.join('\n')}
                </form>
        `,
        buttons: {
            ok: {
                label: localise("CraftWindow.CraftProjectButton"),
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
                label: localise("CraftWindow.CancelButton"),
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
        title: localise("EditProjectWindow.Title"),
        content: `
        <form>
                    <body>
                        <section>
                            <h1>${localise("EditProjectWindow.Title")}</h1>
                        </section>
                        <section>
                            <span>${localise("ProjectManagement.CurrentProject")}:</span> <strong>${item.name}</strong>
                        </section>
                    </body>
                    <div class="form-group">
                        <label for="currentProgress">${localise("ProjectManagement.CurrentProgress")}</label>
                        <input type="text" id="currentProgress" name="currentProgress" placeholder="0 gp" value="${normaliseCoins(projectDetails.progressInCopper).toString()}">
                    </div>
                    <div class="form-group">
                        <label for="DC">${localise("EditProjectWindow.DC")}</label>
                        <input type="number" name="DC" id="DC" value=${projectDetails.DC} min=0 step=1>
                    </div>
                    <div class="form-group">
                        <label for="batchSize">${localise("EditProjectWindow.BatchSize")}</label>
                        <input type="number" name="batchSize" id="batchSize" value=${projectDetails.batchSize} min=1 step=1>
                    </div>
                </form>
        `,
        buttons: {
            ok: {
                label: localise("EditProjectWindow.ConfirmChangesButton"),
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
                label: localise("EditProjectWindow.CancelButton"),
                icon: "<i class='fa-solid fa-ban'></i>",
            }
        },
        default: "ok"
    }, { width: 350 });
}

/**
 * Posts a project to chat.
 * 
 * @param {ActorPF2e} actor The actor whose project to display in chat. 
 * @param {string} projectUUID The ID of the project.
 */
export async function projectToChat(actor, projectUUID) {
    if (!projectUUID || projectUUID === "") {
        console.error("[HEROIC CRAFTING AUTOMATION] Missing Project UUID when posting to chat!");
        return;
    }

    const actorProjects = actor.getFlag(MODULE_NAME, "projects") ?? [];
    const project = actorProjects.filter(project => project.ID === projectUUID)[0];

    if (!project) {
        ui.notifications.error(localise("CharSheet.CannotPostToChat", { name: actor.name, projectUUID }));
        return;
    }

    const item = await fromUuid(project.ItemUUID);
    const currentValue = normaliseCoins(project.progressInCopper);
    const price = game.pf2e.Coins.fromPrice(item.price, project.batchSize);

    const projectDetails = {
        UUID: project.ID,
        actorID: actor.id,
        itemID: project.ItemUUID,
        itemImg: item.img,
        itemName: item.name,
        itemDesc: item.description,
        DC: project.DC,
        batchSize: project.batchSize,
        currentValue: currentValue.toString(),
        price: price.toString(),
        completion: `${Math.floor(currentValue.copperValue / price.copperValue * 100)}% `
    }

    ChatMessage.create({
        user: game.user.id,
        content: await renderTemplate(`modules/${MODULE_NAME}/templates/project-card.hbs`, projectDetails),
        speaker: { alias: actor.name },
    });
}