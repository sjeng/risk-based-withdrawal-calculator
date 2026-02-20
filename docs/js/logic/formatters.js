export function formatCurrency(amount, decimals = 0) {
    return '$' + Number(amount).toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
}