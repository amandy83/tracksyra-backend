export function sumGrossRevenue(rows) {
    const cents = rows.reduce((sum, row) => sum + Math.round(Number(row.grossAmount || 0) * 100), 0);
    return (cents / 100).toFixed(2);
}
