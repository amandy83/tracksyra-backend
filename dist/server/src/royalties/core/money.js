const MICRO_UNITS = 1000000n;
export function decimalUsdToMicros(value) {
    const raw = String(value).trim();
    if (!/^\d+(\.\d+)?$/.test(raw))
        throw new Error(`Invalid decimal amount: ${raw}`);
    const [whole, fractional = ""] = raw.split(".");
    const micros = (fractional + "000000").slice(0, 6);
    return BigInt(whole) * MICRO_UNITS + BigInt(micros);
}
export function microsToDecimalUsd(micros) {
    const whole = micros / MICRO_UNITS;
    const fractional = (micros % MICRO_UNITS).toString().padStart(6, "0").replace(/0+$/, "");
    return fractional ? `${whole}.${fractional}` : whole.toString();
}
export function percentageToBasisPoints(percentage) {
    const raw = String(percentage).trim();
    if (!/^\d+(\.\d+)?$/.test(raw))
        throw new Error(`Invalid percentage: ${raw}`);
    const [whole, fractional = ""] = raw.split(".");
    const basisPoints = (fractional + "00").slice(0, 2);
    return BigInt(whole) * 100n + BigInt(basisPoints);
}
export function applyBasisPoints(amountMicros, basisPoints) {
    return (amountMicros * basisPoints) / 10000n;
}
