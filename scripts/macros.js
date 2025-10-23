import { localise } from "./constants.js";

export async function forageCraftingResources({
  skillName,
  rawTraits,
  actionName,
}) {
  // End of editable values

  if (!token) {
    ui.notifications.warn(localise("Warning.SelectToken"));
    return;
  }

  const dialogForm = `<form>
    <body>
        <section>
            <h1>${localise("ForageCraftingResources.Title")}</h1>
        </section>
    </body>
    <div class="form-group">
        <label for="taskLevel">${localise(
          "ForageCraftingResources.TaskLevel"
        )}:</label>
        <input type="number" name="taskLevel" id="taskLevel" value=0 min=0 max=20>
    </div>
    <div class="form-group">
        <label for="DC">${localise("ForageCraftingResources.DC")}:</label>
        <input type="number" name="DC" id="DC" value=0 min=0>
    </div>
</form>`;

  const dialogResults = await foundry.applications.api.DialogV2.wait({
    window: {
      title: localise("ForageCraftingResources.Title"),
      icon: "fa-solid fa-leaf",
    },
    position: { width: 350 },
    content: dialogForm,
    buttons: [
      {
        label: localise("ForageCraftingResources.Forage"),
        action: "ok",
        icon: "fa-solid fa-wheat-awn",
        callback: (_event, _button, dialog) => {
          const html = dialog.element ? dialog.element : dialog;
          return {
            DC: Number($(html).find("#DC")[0].value) || 0,
            level: Number($(html).find("#taskLevel")[0].value) || 0,
          };
        },
      },
      {
        label: "Cancel",
        action: "cancel",
        icon: "fa-solid fa-ban",
      },
    ],
    default: "ok",
  });

  if (dialogResults === "cancel") return;

  const modifiers = [];
  const traits = [];
  const extraRollNotes = [];

  const statistic = actor.getStatistic(skillName);
  const harvestSkillCheck = statistic.extend({
    check: {
      label: `${actionName}`,
    },
    rank: statistic.rank,
    rollOptions: [`action:forage`],
    slug: "action-forage-harvesting-resources",
  });
  const actorRollOptions = actor.getRollOptions();

  const baseGatheredIncome = game.pf2e.Coins.fromString(
    game.pf2eHeroicCrafting.HeroicCraftingGatheredIncome[dialogResults.level]
  );
  let gatheredIncome = baseGatheredIncome;

  {
    // Default Notes

    extraRollNotes.push({
      outcome: ["success", "criticalSuccess"],
      text: `<p>${game.i18n.localise("PF2E.Success")} ${localise(
        "ForageCraftingResources.NoteSuccess"
      )}`,
    });
    extraRollNotes.push({
      outcome: ["failure", "criticalFailure"],
      text: `<p>${game.i18n.localise("PF2E.Failure")} ${localise(
        "ForageCraftingResources.NoteFailure"
      )}`,
    });
  }
  {
    // Converting raw traits into actual traits

    const actionTraits = CONFIG.PF2E.actionTraits;
    const traitDescriptions = CONFIG.PF2E.traitsDescriptions;

    rawTraits
      .map((trait) => ({
        description: traitDescriptions[trait],
        name: trait,
        label: actionTraits[trait] ?? trait,
      }))
      .forEach((traitObject) => traits.push(traitObject));
  }

  {
    // If master in survival, double the crafting resources got

    if (harvestSkillCheck.rank >= 3) {
      gatheredIncome = gatheredIncome.add(baseGatheredIncome);
    }
  }
  {
    // Vigilant Forager
    if (actorRollOptions.includes("feat:vigilant-forager")) {
      modifiers.push(
        new game.pf2e.Modifier({
          slug: "vigilant-forager-penalty",
          label: localise("ForageCraftingResources.VigilantForager"),
          modifier: -5,
          predicate: ["8-hours-or-less-of-exploration"],
        })
      );
    }
  }

  harvestSkillCheck.roll({
    extraRollNotes,
    dc:
      dialogResults.DC === 0
        ? null
        : {
            value: dialogResults.DC,
          },
    traits,
    createMessage: false,
    [`callback`]: async (roll, outcome, message, event) => {
      if (message instanceof ChatMessage) {
        let extraFlavour = ``;

        // Practiced Forager
        if (
          outcome === "criticalSuccess" &&
          actorRollOptions.includes("feat:practiced-forager")
        ) {
          gatheredIncome = gatheredIncome.add(baseGatheredIncome);
        }

        // General Summary
        if (outcome === "success" || outcome === "criticalSuccess") {
          extraFlavour = extraFlavour.concat(
            `<hr> <p>${localise("General.FoundryNote")} ${localise(
              "ForageCraftingResources.GeneralSummary",
              { amt: gatheredIncome.toString() }
            )}</p>`
          );
        }

        message.updateSource({ flavor: message.flavor + extraFlavour });
        ChatMessage.create(message.toObject());
      }
    },
  });
}

export async function refillMaterialTroves() {
    if (!token) {
        ui.notifications.warn(localise("Warning.SelectToken"));
        return;
    }
    
    const troves = game.pf2eHeroicCrafting.getTroves(token.actor);
    
    const troveHTML = troves.map(trove => {
        const cost = game.pf2e.Coins.fromPrice(trove.system.price, trove.system.quantity);
    
        return `
            <div class="form-group trove-div" data-item-id="${trove.id}">
                <span>${trove.name}</span>
                <select autofocus class="troveLevel">${[...Array(token.actor.level).keys()].map(level => {
                    level++;
                    const selected = trove.level === level ? `selected="selected"` : ``;
                    return '<option value="'.concat(level, '" ', selected, '>', level, '</option>');
                })}</select>
                <input type="text" value="${cost}" class="materials" style='margin-right: 20px; margin-left: 20px'>
                <strong class="bulk" data-item-quantity="${trove.quantity}">${trove.bulk}</strong>
                <strong class="leftovers">${trove.flags["pf2e-heroic-crafting-automation"]?.leftovers || "0 gp"}</strong>
            </div>
        `
    });
    
    function updateRow(troveDiv) {
        const materials = game.pf2e.Coins.fromString(troveDiv.children(".materials")[0].value);
        const newTroveValue = game.pf2eHeroicCrafting.changeTroveValue(troveDiv.children(".troveLevel")[0].value, materials);
    
        const formattedBulk = {
            normal: Math.floor(newTroveValue.quantity / 10),
            light: newTroveValue.quantity - (Math.floor(newTroveValue.quantity / 10) * 10)
        };
        let bulkHTML = "";
    
        if (formattedBulk.normal > 0) {
            bulkHTML += `${formattedBulk.normal}`;
        }
        if (formattedBulk.light > 0) {
            bulkHTML += formattedBulk.normal > 0 ? `; ${formattedBulk.light}L` : `${formattedBulk.light}L`;
        }
        if (formattedBulk.normal === 0 && formattedBulk.light === 0) {
            bulkHTML = "-";
        }
    
        troveDiv.children(".bulk").html(bulkHTML);
        troveDiv.children(".bulk").attr("data-item-quantity", newTroveValue.quantity);
        troveDiv.children(".leftovers").html(newTroveValue.leftovers.toString());
    }
    
    const dialogResults = await foundry.applications.api.DialogV2.wait({
        window: {
            title: localise("RefillMaterialTroves.Title"),
            icon: "fa-solid fa-pickaxe"
        },
        position: { width: 600 },
        content: `
                <form>
                    <body>
                        <section>
                            <h1>${localise("RefillMaterialTroves.Title")}</h1>
                        </section>
                        <section>
                            <p>${localise("RefillMaterialTroves.Description.AdjustValues")}</p>
                            <p>${localise("RefillMaterialTroves.Description.AdjustLevels")}</p> 
                            <p><strong>${localise("RefillMaterialTroves.Description.ManualCoins")}</strong></p>
                        </section>
                    </body>
                    <hr/>
                    <div class="form-group">
                        <strong>${game.i18n.localise("PF2E.NameLabel")}</strong>
                        <strong>${game.i18n.localise("PF2E.LevelLabel")}</strong>
                        <strong style='margin-right: 20px; margin-left: 20px'>${game.i18n.localise("PF2E.ValueLabel")}</strong>
                        <strong>${game.i18n.localise("PF2E.Item.Physical.Bulk.Label")}</strong>
                        <strong>${localise("RefillMaterialTroves.Leftover")}</strong>
                    </div>
                    <hr/>
                    ${troveHTML.join("")}
                    <hr/>
                    <body>
                        <section>
                            <p>${localise("General.Note")} ${localise("RefillMaterialTroves.LeftoverDescription")}</p>
                        </section>
                    </body>
                    <br/>
                </form>
            `,
        buttons: [
            {
                label: localise("RefillMaterialTroves.Refill"),
                action: "refill",
                icon: "fa-solid fa-toolbox",
                callback: (_event, _button, dialog) => {
                    const html = dialog.element ? dialog.element : dialog;
                    let updates = [];
    
                    $(html).find(".trove-div").each(function () {
                        const level = Number($(this).find(".troveLevel")[0].value) || 0;
    
                        updates.push({
                            _id: $(this).attr("data-item-id"),
                            "system.level.value": level,
                            "system.price.value": game.pf2eHeroicCrafting.spendingLimit("hour", level),
                            "system.quantity": Number($(this).find(".bulk").attr("data-item-quantity")) || 0,
                            "flags.pf2e-heroic-crafting-automation.leftovers": $(this).find(".leftovers").html()
                        });
                    });
    
                    return updates;
                }
            },
            {
                label: "Cancel",
                action: "cancel",
                icon: "fa-solid fa-ban",
            }
        ],
        default: "cancel",
        render: (_event, app) => {
            const content = app.element ? app.element : app;
            const materialInputs = content
                .querySelectorAll(".trove-div");
    
            for (let i = 0; i < materialInputs.length; i++) {
                materialInputs[i].querySelector(".troveLevel").addEventListener("change", (event) => {
                    updateRow($(event.target).parent());
                });
    
                materialInputs[i].querySelector(".materials").addEventListener("keyup", (event) => {
                    updateRow($(event.target).parent());
                });
            };
        }
    });
    
    if (dialogResults !== "cancel") {
        await token.actor.updateEmbeddedDocuments("Item", dialogResults);
    }
}