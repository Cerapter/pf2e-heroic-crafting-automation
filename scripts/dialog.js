import { normaliseCoins, subtractCoins } from "./coins.js";
import {
  CheckFeat,
  getPreferredPayMethod,
  localise,
  MODULE_NAME,
  calculateMaxCost,
} from "./constants.js";

/**
 * Generates a form group HTML for choosing a paying method (for beginning or crafting projets).
 *
 * @param {"fullCoin" | "preferCoin" | "preferTrove" | "fullTrove" | "free"} preferredDefault One of the potential pay methods.
 * @returns {string} The generated form group HTML.
 */
async function getPaymentOptionHTML(preferredDefault = "fullCoin") {
  const paymentOptions = [
    {
      id: "fullCoin",
      text: localise("ProjectManagement.FullCoin"),
      selected: preferredDefault === "fullCoin",
    },
    {
      id: "preferCoin",
      text: localise("ProjectManagement.PreferCoin"),
      selected: preferredDefault === "preferCoin",
    },
    {
      id: "preferTrove",
      text: localise("ProjectManagement.PreferTrove"),
      selected: preferredDefault === "preferTrove",
    },
    {
      id: "fullTrove",
      text: localise("ProjectManagement.FullTrove"),
      selected: preferredDefault === "fullTrove",
    },
    {
      id: "free",
      text: localise("ProjectManagement.Free"),
      selected: preferredDefault === "free",
    },
  ];

  return await renderTemplate(
    `modules/${MODULE_NAME}/templates/pay-method.hbs`,
    { paymentOptions }
  );
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
export async function projectBeginDialog(
  itemDetails,
  preferredPayMethod = "fullCoin"
) {
  const item = await fromUuid(itemDetails.UUID);
  const maxCost = game.pf2e.Coins.fromPrice(
    item.price,
    itemDetails.batchSize || 1
  ).scale(0.5);

  return await foundry.applications.api.DialogV2.wait({
    window: {
      title: localise("ProjectBeginWindow.Title"),
      icon: "fa-solid fa-fw fa-scroll",
    },
    position: { width: 350 },
    content: `
                <form>
                    <body>
                        <section>
                            <h1>${localise("ProjectBeginWindow.Title")}</h1>
                        </section>
                        <section>
                            <span>${localise(
                              "ProjectManagement.CurrentProject"
                            )}</span> <strong>${item.name}</strong>
                        </section>
                        <section>
                            ${localise(
                              "ProjectManagement.RemainingMaterials"
                            )} / ${localise(
      "ProjectManagement.MaximumCost"
    )}: <span id="spanNotOverspending"><strong id="remainingMaterials">0 gp</strong> / <strong id="maxCost">0 gp</strong></span><span id="spanOverspending" hidden><strong style="color: red">${localise(
      "ProjectManagement.OverspendingWarning"
    )}</strong></span>
                        </section>
                    </body>
                    <div class="form-group">
                        <label for="spendingAmount">${localise(
                          "ProjectManagement.SpentMaterialsSoFar"
                        )}</label>
                        <input type="text" id="spendingAmount" name="spendingAmount" placeholder="0 gp">
                    </div>
                    ${await getPaymentOptionHTML(preferredPayMethod)}
                </form>
            `,
    buttons: [
      {
        label: localise("ProjectBeginWindow.BeginProjectButton"),
        action: "begin-project",
        icon: "fa-solid fa-hammer",
        callback: (_event, _button, dialog) => {
          const html = dialog.element ? dialog.element : dialog;
          return {
            startingProgress: game.pf2e.Coins.fromString(
              $(html).find("#spendingAmount")[0].value
            ).copperValue,
            payMethod: $(html).find("#payMethod")[0].value,
          };
        },
      },
      {
        label: "Cancel",
        action: "cancel",
        icon: "fa-solid fa-ban",
      },
    ],
    default: "begin-project",
    close: () => {
      return {};
    },
    render: (_event, app) => {
      const content = app.element ? app.element : app;
      content
        .querySelector("[id=spendingAmount]")
        .addEventListener("keyup", (event) => {
          const currentSpending = game.pf2e.Coins.fromString(
            event.target.value
          );
          const remainingSpending = subtractCoins(maxCost, currentSpending);

          const form = $(event.target).parent().parent();
          form
            .find("[id=remainingMaterials]")
            .html(
              !!remainingSpending
                ? remainingSpending.toString()
                : maxCost.toString()
            );

          if (remainingSpending === null) {
            $(event.target)
              .parent()
              .parent()
              .parent()
              .siblings(".dialog-buttons")
              .find(".ok")
              .attr("disabled", "true");
            form.find("[id=spanNotOverspending]").attr("hidden", true);
            form.find("[id=spanOverspending]").removeAttr("hidden");
          } else {
            $(event.target)
              .parent()
              .parent()
              .parent()
              .siblings(".dialog-buttons")
              .find(".ok")
              .removeAttr("disabled");
            form.find("[id=spanNotOverspending]").removeAttr("hidden");
            form.find("[id=spanOverspending]").attr("hidden", true);
          }
        });

      content.querySelector("[id=maxCost]").innerHTML = maxCost;
      content.querySelector("[id=remainingMaterials]").innerHTML = maxCost;
    },
  });
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
 * toggles: {XYZ: {value: boolean, rushCost: string}},
 * modifiers: {active: boolean, amount: number | string, mode: string, target: string, toggledBy?: string}}}
 * An anonymous struct of six values.
 * - `duration` determines for how long the crafting activity continues.
 * - `overtime` is the Overtime penalty the crafting activity is taking.
 * - `payMethod` is the choice of how the crafting activity should be paid for -- see payWithCoinsAndTrove()
 * - `spendingAmount` is the Coin the activity will cost.
 * - `toggles` is a struct of key-value pairs that were gathered from additional configurations given by feats.
 * - `modifiers` is an array of essentially ModifyCraftAProject rule elements,
 *   with an additional `active` field if they are, well, active.
 *
 * Alternatively, if cancelled, the dialog will return an empty struct.
 */
export async function projectCraftDialog(actor, itemDetails) {
  const item = await fromUuid(itemDetails.UUID);
  const extraHTML = [];
  let modifiers = [];

  for (const rule of actor.rules) {
    if (typeof rule.preCraft === "function") {
      rule.preCraft(item);
    }
  }

  if ("CraftingOption" in actor.synthetics) {
    for (const synthetic of actor.synthetics["CraftingOption"]) {
      const checked = synthetic.default ? "checked" : "";
      const disabled = synthetic.toggleable ? "" : "disabled";

      extraHTML.push(`
            <div class="form-group extra-craft-modifiers" >
                <label for="${synthetic.value}">${synthetic.label} <strong style="color: red" hidden></strong></label>
                <input type="checkbox" id="${synthetic.value}" name="${synthetic.value}" ${checked} ${disabled}>
            </div>
            <p class="notes">${synthetic.desc}</p>
        `);
    }
  }

  if ("ModifyCraftAProject" in actor.synthetics) {
    for (const synthetic of actor.synthetics["ModifyCraftAProject"]) {
      synthetic.active = synthetic.toggledBy ? false : true;
      modifiers.push(synthetic);
    }
  }

  // Purely a fancy thing, but add a horizontal line in front of the custom feat stuff if there is any.
  if (extraHTML.length > 0) {
    extraHTML.unshift(`<hr>`);
  }

  return await foundry.applications.api.DialogV2.wait({
    window: {
      title: localise("CraftWindow.Title"),
      icon: "fa-solid fa-hammer",
    },
    position: { width: 350 },
    content: `
        <form>
                    <body>
                        <section>
                            <h1>${localise("CraftWindow.Title")}</h1>
                        </section>
                        <section>
                            ${localise(
                              "ProjectManagement.CurrentProject"
                            )}: <strong>${item.name}</strong>
                        </section>
                        <section>
                        ${localise(
                          "ProjectManagement.RemainingMaterials"
                        )} / ${localise(
      "ProjectManagement.MaximumCost"
    )}: <span id="spanNotOverspending"><strong id="remainingMaterials">0 gp</strong> / <strong id="maxCost">0 gp</strong></span><span id="spanOverspending" hidden><strong style="color: red">${localise(
      "ProjectManagement.OverspendingWarning"
    )}</strong></span>
                        </section>
                    </body>
                    <div class="form-group">
                        <label for="spendingAmount">${localise(
                          "ProjectManagement.SpentMaterialsSoFar"
                        )}</label>
                        <input type="text" id="spendingAmount" name="spendingAmount" placeholder="0 gp">
                    </div>
                    <div class="form-group">
                        <label for="craftDuration">${localise(
                          "CraftWindow.CraftingDuration.Title"
                        )}</label>
                        <select autofocus id="craftDuration" name="craftDuration">
                            <option value="hour">${localise(
                              "CraftWindow.CraftingDuration.Hour"
                            )}</option>
                            <option value="day">${localise(
                              "CraftWindow.CraftingDuration.Day"
                            )}</option>
                            <option value="week">${localise(
                              "CraftWindow.CraftingDuration.Week"
                            )}</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="overtimePenalty">${localise(
                          "CraftWindow.OvertimePenalty.Title"
                        )}</label>
                        <select id="overtimePenalty" name="overtimePenalty">
                            <option value=0>${localise(
                              "CraftWindow.OvertimePenalty.NoOvertime"
                            )}</option>
                            <option value=-5>-5</option>
                            <option value=-10> -10</option>
                        </select>
                    </div>
                    ${await getPaymentOptionHTML(getPreferredPayMethod(actor))}
                    ${extraHTML.join("\n")}
                </form>
        `,
    buttons: [
      {
        label: localise("CraftWindow.CraftProjectButton"),
        action: "craft-project",
        icon: "fa-solid fa-hammer",
        callback: (_event, _button, dialog) => {
          const html = dialog.element ? dialog.element : dialog;
          const toggles = {};

          $(html)
            .find(".extra-craft-modifiers input")
            .each(function () {
              const input = $(this)[0];

              toggles[input.name] = {
                value: input.checked,
                rushCost:
                  input.parentElement.querySelector("label > strong").innerHTML,
              };
            });

          return {
            duration: $(html).find("#craftDuration")[0].value,
            overtime: Number($(html).find("#overtimePenalty")[0].value) || 0,
            payMethod: $(html).find("#payMethod")[0].value,
            spendingAmount: game.pf2e.Coins.fromString(
              $(html).find("#spendingAmount")[0].value
            ),
            toggles,
            modifiers,
          };
        },
      },
      {
        label: "Cancel",
        action: "cancel",
        icon: "fa-solid fa-ban",
        callback: (html) => {
          return {};
        },
      },
    ],
    default: "craft-project",
    close: (html) => {
      actor.synthetics["CraftingOption"] = [];
      actor.synthetics["ModifyCraftAProject"] = [];
      return {};
    },
    render: (_event, app) => {
      const content = app.element ? app.element : app;
      content
        .querySelector("[id=craftDuration]")
        .addEventListener("change", (event) => {
          let multipliers = 1;
          modifiers.forEach((modifier) => {
            if (
              modifier.target === "max" &&
              modifier.active &&
              modifier.mode === "multiply"
            ) {
              multipliers = multipliers * modifier.amount;
            }
          });

          const maxCost = calculateMaxCost(
            event.target.value,
            actor.level,
            itemDetails.batchSize,
            multipliers
          );
          $(event.target)
            .parent()
            .parent()
            .find("[id=maxCost]")
            .html(maxCost.toString());

          event.target.parentElement.parentElement
            .querySelector("#spendingAmount")
            .dispatchEvent(new Event("keyup"));
        });

      content
        .querySelector("[id=spendingAmount]")
        .addEventListener("keyup", (event) => {
          const maxCost = game.pf2e.Coins.fromString(
            $(event.target).parent().parent().find("[id=maxCost]").html()
          );
          const currentSpending = game.pf2e.Coins.fromString(
            event.target.value
          );
          const remainingSpending = subtractCoins(maxCost, currentSpending);

          const form = $(event.target).parent().parent();
          form
            .find("[id=remainingMaterials]")
            .html(
              !!remainingSpending
                ? remainingSpending.toString()
                : maxCost.toString()
            );

          if (remainingSpending === null) {
            $(event.target)
              .parent()
              .parent()
              .parent()
              .siblings(".dialog-buttons")
              .find(".ok")
              .attr("disabled", "true");
            form.find("[id=spanNotOverspending]").attr("hidden", true);
            form.find("[id=spanOverspending]").removeAttr("hidden");
          } else {
            $(event.target)
              .parent()
              .parent()
              .parent()
              .siblings(".dialog-buttons")
              .find(".ok")
              .removeAttr("disabled");
            form.find("[id=spanNotOverspending]").removeAttr("hidden");
            form.find("[id=spanOverspending]").attr("hidden", true);
          }

          const craftModifierLabels =
            event.target.parentElement.parentElement.querySelectorAll(
              "div.extra-craft-modifiers > label > strong"
            );
          for (let index = 0; index < craftModifierLabels.length; index++) {
            craftModifierLabels[index].dispatchEvent(new Event("change"));
          }
        });

      const extraCraftModifierDivs = content.querySelectorAll(
        "div.extra-craft-modifiers"
      );

      for (let i = 0; i < extraCraftModifierDivs.length; i++) {
        extraCraftModifierDivs[i]
          .querySelector("input")
          .addEventListener("change", (event) => {
            for (const modifier of modifiers) {
              if (modifier.toggledBy === event.target.id) {
                modifier.active = event.target.checked;

                switch (modifier.target) {
                  case "max":
                    event.target.parentElement.parentElement
                      .querySelector("#craftDuration")
                      .dispatchEvent(new Event("change"));
                    break;
                  case "rushCost":
                    $(event.target)
                      .siblings("label")
                      .find("strong")
                      .attr("amount", modifier.amount);
                    if (modifier.active) {
                      $(event.target)
                        .siblings("label")
                        .find("strong")
                        .removeAttr("hidden");
                    } else {
                      $(event.target)
                        .siblings("label")
                        .find("strong")
                        .attr("hidden", true);
                    }
                    event.target.parentElement
                      .querySelector("label > strong")
                      .dispatchEvent(new Event("change"));
                    break;
                }
              }
            }
          });

        extraCraftModifierDivs[i]
          .querySelector("label > strong")
          .addEventListener("change", (event) => {
            const cost = game.pf2e.Coins.fromString(
              $(event.target)
                .parent()
                .parent()
                .parent()
                .find("[id=spendingAmount]")
                .val()
            ).scale($(event.target).attr("amount"));
            $(event.target).html(cost.toString());
          });
      }

      let multipliers = 1;
      modifiers.forEach((modifier) => {
        if (
          modifier.target === "max" &&
          modifier.active &&
          modifier.mode === "multiply"
        ) {
          multipliers = multipliers * modifier.amount;
        }
      });
      const maxCost = calculateMaxCost(
        "Hour",
        actor.level,
        itemDetails.batchSize,
        multipliers
      );
      content.querySelector("[id=maxCost]").innerHTML = maxCost;
      content.querySelector("[id=remainingMaterials]").innerHTML = maxCost;
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

  return await foundry.applications.api.DialogV2.wait({
    window: {
      title: localise("EditProjectWindow.Title"),
      icon: "fa-solid fa-trowel",
    },
    position: { width: 350 },
    content: `
        <form>
                    <body>
                        <section>
                            <h1>${localise("EditProjectWindow.Title")}</h1>
                        </section>
                        <section>
                            <span>${localise(
                              "ProjectManagement.CurrentProject"
                            )}:</span> <strong>${item.name}</strong>
                        </section>
                    </body>
                    <div class="form-group">
                        <label for="currentProgress">${localise(
                          "ProjectManagement.CurrentProgress"
                        )}</label>
                        <input type="text" id="currentProgress" name="currentProgress" placeholder="0 gp" value="${normaliseCoins(
                          projectDetails.progressInCopper
                        ).toString()}">
                    </div>
                    <div class="form-group">
                        <label for="DC">${localise(
                          "EditProjectWindow.DC"
                        )}</label>
                        <input type="number" name="DC" id="DC" value=${
                          projectDetails.DC
                        } min=0 step=1>
                    </div>
                    <div class="form-group">
                        <label for="batchSize">${localise(
                          "EditProjectWindow.BatchSize"
                        )}</label>
                        <input type="number" name="batchSize" id="batchSize" value=${
                          projectDetails.batchSize
                        } min=1 step=1>
                    </div>
                </form>
        `,
    buttons: [
      {
        label: localise("EditProjectWindow.ConfirmChangesButton"),
        action: "confirm-changes",
        icon: "fas fa-edit fa-1x fa-fw",
        callback: (_event, _button, dialog) => {
          const html = dialog.element ? dialog.element : dialog;
          return {
            progressInCopper:
              game.pf2e.Coins.fromString(
                $(html).find("#currentProgress")[0].value
              ).copperValue || -1,
            DC: Number($(html).find("#DC")[0].value) || -1,
            batchSize: Number($(html).find("#batchSize")[0].value) || -1,
          };
        },
      },
      {
        label: "Cancel",
        action: "cancel",
        icon: "fa-solid fa-ban",
      },
    ],
    default: "confirm-changes",
    close: () => {
      return {
        progressInCopper: projectDetails.progressInCopper,
        DC: projectDetails.DC,
        batchSize: projectDetails.batchSize,
      };
    },
  });
}

/**
 * Posts a project to chat.
 *
 * @param {ActorPF2e} actor The actor whose project to display in chat.
 * @param {string} projectUUID The ID of the project.
 */
export async function projectToChat(actor, projectUUID) {
  if (!projectUUID || projectUUID === "") {
    console.error(
      "[HEROIC CRAFTING AUTOMATION] Missing Project UUID when posting to chat!"
    );
    return;
  }

  const actorProjects = actor.getFlag(MODULE_NAME, "projects") ?? [];
  const project = actorProjects.filter(
    (project) => project.ID === projectUUID
  )[0];

  if (!project) {
    ui.notifications.error(
      localise("CharSheet.CannotPostToChat", { name: actor.name, projectUUID })
    );
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
    completion: `${Math.floor(
      (currentValue.copperValue / price.copperValue) * 100
    )}% `,
  };

  ChatMessage.create({
    user: game.user.id,
    content: await renderTemplate(
      `modules/${MODULE_NAME}/templates/project-card.hbs`,
      projectDetails
    ),
    speaker: { alias: actor.name },
  });
}
