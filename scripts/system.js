/*
 * All three of these are literally just 1-to-1 reimplementations from the system code.
 *
 * This is because you have to specifically tell a roll to use rolltwice / substitutions / DoS adjustments -- 
 * and skill checks by default do that, but game.pf2e.Check doesn't. 
 * Skill checks are also not as customisable as I'd like 'em, so I HAVE to use game.pf2e.Check.
 * 
 * Sucks, don't it.
 */

export function extractRollTwice(
    rollTwices,
    selectors,
    options
) {
    const twices = selectors.flatMap((s) => rollTwices[s] ?? []).filter((rt) => rt.predicate?.test(options) ?? true);
    if (twices.length === 0) return false;
    if (twices.some((rt) => rt.keep === "higher") && twices.some((rt) => rt.keep === "lower")) {
        return false;
    }

    return twices.at(0)?.keep === "higher" ? "keep-higher" : "keep-lower";
}

export function extractRollSubstitutions(
    substitutions,
    domains,
    rollOptions
) {
    return domains
        .flatMap((d) => deepClone(substitutions[d] ?? []))
        .filter((s) => s.predicate?.test(rollOptions) ?? true);
}

export function extractDegreeOfSuccessAdjustments(
    synthetics,
    selectors
) {
    return Object.values(pick(synthetics.degreeOfSuccessAdjustments, selectors)).flat();
}

function pick(obj, keys) {
    return [...keys].reduce((result, key) => {
        if (key in obj) {
            result[key] = obj[key];
        }
        return result;
    }, {});
}